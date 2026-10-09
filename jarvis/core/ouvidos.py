"""Ouvidos do Jarvis: palavra de ativação ("Jarvis") + gravação + Whisper local.

Dois motores de ativação (WAKE_MOTOR no .env):
- whisper (padrão): quando você começa a falar, um Whisper rápido transcreve o
  primeiro segundo e meio e confere se começa com "Jarvis". Aceita "Jarvis" sozinho
  (bipe e espera o comando) ou "Jarvis, abre o VS Code" numa frase só.
- openwakeword: modelo pronto "hey_jarvis" (mais leve na CPU, mas exige "Hey Jarvis").
  Também aceita o caminho de um modelo .onnx próprio em WAKE_WORD.
"""
import collections
import queue
import threading
import time

import numpy as np

from config import CFG
from core.ativacao import separar_ativacao, tirar_palavra_ativacao

TAXA = 16000
BLOCO = 1280                 # 80 ms por bloco (tamanho que o openWakeWord espera)
BLOCOS_POR_SEG = TAXA / BLOCO

ESPERA_FALA_S = 5.0          # tempo para começar a falar depois da ativação
SILENCIO_FIM_S = 1.0         # silêncio que encerra a frase
MAX_FRASE_S = 15.0

# motor whisper
PRE_FALA_S = 0.4             # áudio guardado antes do volume subir (para não cortar o "J")
PREFIXO_S = 1.6              # quanto da fala é usado para procurar o nome
SILENCIO_PALAVRA_S = 0.45    # pausa que indica "Jarvis" dito sozinho
FALA_MIN_S = 0.24            # ignora estalos e batidas curtas


def _s(segundos):
    return max(1, int(round(segundos * BLOCOS_POR_SEG)))


def rms(bloco):
    return float(np.sqrt(np.mean(bloco.astype(np.float32) ** 2)))


def para_float(blocos):
    return np.concatenate(blocos).astype(np.float32) / 32768.0


class MicrofoneParado(RuntimeError):
    pass


class Ouvidos:
    """Roda numa thread própria. Chama:
    - on_comando(texto) quando entende uma frase
    - on_estado(nome) para a interface ('ouvindo', 'transcrevendo', 'ocioso')
    - on_nivel(0..1) com o volume do microfone enquanto escuta
    - on_aviso(texto) para mensagens de status
    """

    def __init__(self, on_comando, on_estado, on_nivel, on_aviso):
        self.on_comando, self.on_estado = on_comando, on_estado
        self.on_nivel, self.on_aviso = on_nivel, on_aviso
        self.pausado = False
        self.rodando = True
        self.motor = CFG.WAKE_MOTOR
        self.wake = None             # openWakeWord
        self.whisper = None          # transcrição do comando
        self.whisper_rapido = None   # procura do nome (motor whisper)
        self.microfone_ok = False
        self._audio = queue.Queue()
        self._espera_max = 2.0       # segundos sem áudio = microfone parou
        self._ouvir_agora = threading.Event()
        self._ruido = 200.0
        self._ultimo_nivel = 0.0

    @property
    def frase_ativacao(self):
        if self.motor == "openwakeword":
            return CFG.WAKE_WORD.replace("_", " ").title()
        return CFG.WAKE_PALAVRA.title()

    # --- controle externo -----------------------------------------------------
    def iniciar(self):
        threading.Thread(target=self._executar, name="ouvidos", daemon=True).start()

    def escutar_agora(self):
        """Começa a gravar sem precisar da palavra de ativação (botão do microfone)."""
        self._ouvir_agora.set()

    def parar(self):
        self.rodando = False

    # --- carregamento -----------------------------------------------------------
    def _carregar_modelos(self):
        from faster_whisper import WhisperModel

        self.on_aviso(f"Carregando reconhecimento de fala (Whisper {CFG.WHISPER_MODELO})...")
        self.whisper = WhisperModel(CFG.WHISPER_MODELO, device="cpu", compute_type="int8")

        if self.motor == "openwakeword":
            self._carregar_openwakeword()
            return
        if CFG.WAKE_WHISPER_MODELO == CFG.WHISPER_MODELO:
            self.whisper_rapido = self.whisper
        else:
            self.on_aviso(f"Carregando detector do nome (Whisper {CFG.WAKE_WHISPER_MODELO})...")
            self.whisper_rapido = WhisperModel(CFG.WAKE_WHISPER_MODELO, device="cpu",
                                               compute_type="int8")

    def _carregar_openwakeword(self):
        try:
            import openwakeword.utils
            from openwakeword.model import Model
            modelo = CFG.WAKE_WORD
            if not modelo.endswith((".onnx", ".tflite")):   # modelo pronto: baixa se faltar
                try:
                    openwakeword.utils.download_models(model_names=[modelo])
                except Exception:  # noqa: BLE001  já baixado ou sem internet
                    pass
            self.wake = Model(wakeword_models=[modelo], inference_framework="onnx")
        except Exception as erro:  # noqa: BLE001
            self.wake = None
            self.on_aviso(f"Palavra de ativação indisponível ({erro}). Use o botão do microfone.")

    # --- áudio ------------------------------------------------------------------
    def _executar(self):
        try:
            import sounddevice as sd
            self._carregar_modelos()
            dispositivo = CFG.MIC_DISPOSITIVO
            if dispositivo and dispositivo.isdigit():
                dispositivo = int(dispositivo)
            # o callback guarda o áudio numa fila: enquanto o Whisper trabalha, nada se perde
            with sd.InputStream(samplerate=TAXA, channels=1, dtype="int16", blocksize=BLOCO,
                                device=dispositivo, callback=self._ao_receber):
                self.microfone_ok = True
                if self.wake is not None or self.whisper_rapido is not None:
                    self.on_aviso(f"Microfone pronto. Diga \"{self.frase_ativacao}\" "
                                  "ou clique no microfone.")
                else:
                    self.on_aviso("Microfone pronto. Clique no microfone para falar.")
                self._laco()
        except Exception as erro:  # noqa: BLE001
            self.microfone_ok = False
            self.on_aviso(f"Microfone indisponível: {erro}. Modo texto ativo.")

    def _ao_receber(self, dados, _quadros, _tempo, _status):
        self._audio.put(dados[:, 0].copy())

    def _ler(self):
        try:
            return self._audio.get(timeout=self._espera_max)
        except queue.Empty:
            raise MicrofoneParado("o microfone parou de enviar áudio") from None

    def _descartar_fila(self):
        while True:
            try:
                self._audio.get_nowait()
            except queue.Empty:
                return

    def _limiar(self):
        return max(self._ruido * 2.5, CFG.MIC_LIMIAR_MIN)

    def _medir_ruido(self, nivel, falando):
        # durante a fala o ruído de fundo quase não muda, senão o limiar sobe junto com a voz
        alfa = 0.005 if falando else 0.03
        self._ruido = (1 - alfa) * self._ruido + alfa * nivel

    # --- laço principal ---------------------------------------------------------
    def _laco(self):
        estava_pausado = False
        antes = collections.deque(maxlen=_s(PRE_FALA_S))
        while self.rodando:
            bloco = self._ler()   # sempre lê, para a fila não acumular

            if self.pausado:   # Jarvis pensando/falando: não escuta a própria voz
                estava_pausado = True   # (um clique no microfone fica guardado)
                continue
            if estava_pausado:  # limpa o que sobrou da própria fala
                estava_pausado = False
                self._descartar_fila()
                antes.clear()
                if self.wake is not None:
                    self.wake.reset()
                continue

            if self._ouvir_agora.is_set():
                self._ouvir_agora.clear()
                self._capturar()
                antes.clear()
                continue

            nivel = rms(bloco)
            falando = nivel > self._limiar()
            self._medir_ruido(nivel, falando)

            if self.wake is not None:
                pontos = self.wake.predict(bloco)
                if pontos and max(pontos.values()) >= CFG.WAKE_LIMIAR:
                    self._bip()
                    self._capturar()
                    self.wake.reset()
            elif self.whisper_rapido is not None:
                if falando:
                    self._verificar_nome(list(antes) + [bloco])
                    antes.clear()
                else:
                    antes.append(bloco)

    # --- motor whisper ------------------------------------------------------------
    def _verificar_nome(self, blocos):
        """Grava o começo da fala e confere se é o nome do Jarvis."""
        limiar = self._limiar()
        voz, silencio = 1, 0
        while self.rodando and not self.pausado and len(blocos) < _s(PREFIXO_S):
            bloco = self._ler()
            blocos.append(bloco)
            if rms(bloco) > limiar:
                voz, silencio = voz + 1, 0
            else:
                silencio += 1
                if silencio >= _s(SILENCIO_PALAVRA_S):
                    break
        if self.pausado or voz < _s(FALA_MIN_S):
            return
        terminou = silencio >= _s(SILENCIO_PALAVRA_S)

        texto = self._transcrever_rapido(para_float(blocos))
        achou, resto = separar_ativacao(texto, CFG.WAKE_PALAVRA)
        if CFG.DEBUG:
            print(f"[Ouvidos] ouvi {texto!r} -> {'ATIVOU' if achou else 'ignorado'}")
        if not achou:
            if not terminou:
                self._pular_ate_silencio(limiar)
            return

        if terminou and not resto:   # disse só "Jarvis": bipe e espera o comando
            self._bip()
            self._capturar()
            return

        # "Jarvis, abre o Chrome": continua gravando a mesma frase
        self.on_estado("ouvindo")
        if not terminou:
            blocos = self._gravar(blocos, ja_falou=True, limiar=limiar)
        self.on_nivel(0)
        if self.whisper_rapido is self.whisper and terminou:
            comando = resto
        else:
            self.on_estado("transcrevendo")
            comando = self.transcrever(para_float(blocos))
        if comando:
            self.on_comando(comando)
        else:   # o Whisper principal só ouviu o nome
            self._bip()
            self._capturar()

    def _pular_ate_silencio(self, limiar):
        """Conversa que não é com o Jarvis: ignora até a próxima pausa."""
        silencio, total = 0, 0
        while self.rodando and not self.pausado and total < _s(MAX_FRASE_S):
            total += 1
            if rms(self._ler()) > limiar:
                silencio = 0
            else:
                silencio += 1
                if silencio >= _s(SILENCIO_PALAVRA_S):
                    return

    def _transcrever_rapido(self, audio):
        segmentos, _ = self.whisper_rapido.transcribe(
            audio, language="pt", beam_size=1, vad_filter=False,
            condition_on_previous_text=False, without_timestamps=True,
            hotwords=CFG.WAKE_PALAVRA.title(),
        )
        return " ".join(s.text for s in segmentos).strip()

    # --- gravação do comando --------------------------------------------------------
    def _gravar(self, blocos=None, ja_falou=False, limiar=None):
        """Grava até um segundo de silêncio. Devolve os blocos, ou None se ninguém falou."""
        limiar = limiar or self._limiar()
        blocos = list(blocos or [])
        falou, silencio = ja_falou, 0
        while self.rodando and len(blocos) < _s(MAX_FRASE_S):
            bloco = self._ler()
            blocos.append(bloco)
            nivel = rms(bloco)
            self._enviar_nivel(min(1.0, nivel / (limiar * 4)))
            if nivel > limiar:
                falou, silencio = True, 0
            else:
                silencio += 1
            if falou and silencio >= _s(SILENCIO_FIM_S):
                break
            if not falou and len(blocos) >= _s(ESPERA_FALA_S):
                break
        return blocos if falou else None

    def _capturar(self):
        self.on_estado("ouvindo")
        blocos = self._gravar()
        self.on_nivel(0)
        if not blocos:
            self.on_estado("ocioso")
            return

        self.on_estado("transcrevendo")
        texto = self.transcrever(para_float(blocos))
        if texto:
            self.on_comando(texto)
        else:
            self.on_estado("ocioso")

    def transcrever(self, audio):
        segmentos, _ = self.whisper.transcribe(
            audio, language="pt", beam_size=1, vad_filter=True,
            initial_prompt="Jarvis, assistente pessoal.",
        )
        texto = " ".join(s.text for s in segmentos).strip()
        return tirar_palavra_ativacao(texto, CFG.WAKE_PALAVRA)

    def _enviar_nivel(self, valor):
        agora = time.monotonic()
        if agora - self._ultimo_nivel > 0.08:
            self._ultimo_nivel = agora
            self.on_nivel(valor)

    def _bip(self):
        try:
            import winsound
            winsound.Beep(880, 90)
        except Exception:  # noqa: BLE001
            return
        time.sleep(0.05)
        self._descartar_fila()   # o próprio bipe não pode contar como fala
