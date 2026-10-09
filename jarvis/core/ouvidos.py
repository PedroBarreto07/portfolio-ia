"""Ouvidos do Jarvis: palavra de ativação ("Hey Jarvis") + gravação + Whisper local."""
import re
import threading
import time

import numpy as np

from config import CFG

TAXA = 16000
BLOCO = 1280                 # 80 ms por bloco (tamanho que o openWakeWord espera)
BLOCOS_POR_SEG = TAXA / BLOCO

ESPERA_FALA_S = 5.0          # tempo para começar a falar depois da ativação
SILENCIO_FIM_S = 1.0         # silêncio que encerra a frase
MAX_FRASE_S = 15.0

_PREFIXO = re.compile(r"^\s*(hey|ei|ê|rei)?[\s,]*jarvis[\s,.!?]*", re.I)


def tirar_palavra_ativacao(texto):
    return _PREFIXO.sub("", texto).strip()


def rms(bloco):
    return float(np.sqrt(np.mean(bloco.astype(np.float32) ** 2)))


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
        self.wake = None
        self.whisper = None
        self.microfone_ok = False
        self._ouvir_agora = threading.Event()
        self._ruido = 200.0
        self._ultimo_nivel = 0.0

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
        self.on_aviso(f"Carregando reconhecimento de fala (Whisper {CFG.WHISPER_MODELO})...")
        from faster_whisper import WhisperModel
        self.whisper = WhisperModel(CFG.WHISPER_MODELO, device="cpu", compute_type="int8")

        try:
            import openwakeword.utils
            from openwakeword.model import Model
            try:
                openwakeword.utils.download_models(model_names=[CFG.WAKE_WORD])
            except Exception:  # noqa: BLE001  já baixado ou sem internet
                pass
            self.wake = Model(wakeword_models=[CFG.WAKE_WORD], inference_framework="onnx")
        except Exception as erro:  # noqa: BLE001
            self.wake = None
            self.on_aviso(f"Palavra de ativação indisponível ({erro}). Use o botão do microfone.")

    # --- laço principal ---------------------------------------------------------
    def _executar(self):
        try:
            import sounddevice as sd
            self._carregar_modelos()
            dispositivo = CFG.MIC_DISPOSITIVO
            if dispositivo and dispositivo.isdigit():
                dispositivo = int(dispositivo)
            with sd.InputStream(samplerate=TAXA, channels=1, dtype="int16",
                                blocksize=BLOCO, device=dispositivo) as fluxo:
                self.microfone_ok = True
                self.on_aviso("Microfone pronto. Diga \"Hey Jarvis\" ou clique no microfone.")
                self._laco(fluxo)
        except Exception as erro:  # noqa: BLE001
            self.microfone_ok = False
            self.on_aviso(f"Microfone indisponível: {erro}. Modo texto ativo.")

    def _ler(self, fluxo):
        dados, _ = fluxo.read(BLOCO)
        return dados[:, 0]

    def _laco(self, fluxo):
        estava_pausado = False
        while self.rodando:
            bloco = self._ler(fluxo)   # sempre lê, para o buffer não acumular

            if self.pausado:   # Jarvis pensando/falando: não escuta a própria voz
                estava_pausado = True   # (um clique no microfone fica guardado)
                continue
            if estava_pausado:  # limpa o que o detector ouviu da própria fala
                estava_pausado = False
                if self.wake is not None:
                    self.wake.reset()

            if self._ouvir_agora.is_set():
                self._ouvir_agora.clear()
                self._capturar(fluxo)
                continue

            nivel = rms(bloco)
            self._ruido = 0.97 * self._ruido + 0.03 * nivel   # ruído de fundo médio

            if self.wake is not None:
                pontos = self.wake.predict(bloco)
                if pontos and max(pontos.values()) >= CFG.WAKE_LIMIAR:
                    self._bip()
                    self._capturar(fluxo)
                    self.wake.reset()

    def _limiar(self):
        return max(self._ruido * 2.5, CFG.MIC_LIMIAR_MIN)

    def _capturar(self, fluxo):
        self.on_estado("ouvindo")
        limiar = self._limiar()
        blocos, falou, silencio = [], False, 0
        max_espera = int(ESPERA_FALA_S * BLOCOS_POR_SEG)
        max_silencio = int(SILENCIO_FIM_S * BLOCOS_POR_SEG)
        max_total = int(MAX_FRASE_S * BLOCOS_POR_SEG)

        while self.rodando and len(blocos) < max_total:
            bloco = self._ler(fluxo)
            blocos.append(bloco)
            nivel = rms(bloco)
            self._enviar_nivel(min(1.0, nivel / (limiar * 4)))
            if nivel > limiar:
                falou, silencio = True, 0
            else:
                silencio += 1
            if falou and silencio >= max_silencio:
                break
            if not falou and len(blocos) >= max_espera:
                break
        self.on_nivel(0)

        if not falou:
            self.on_estado("ocioso")
            return

        self.on_estado("transcrevendo")
        audio = np.concatenate(blocos).astype(np.float32) / 32768.0
        texto = self.transcrever(audio)
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
        return tirar_palavra_ativacao(texto)

    def _enviar_nivel(self, valor):
        agora = time.monotonic()
        if agora - self._ultimo_nivel > 0.08:
            self._ultimo_nivel = agora
            self.on_nivel(valor)

    @staticmethod
    def _bip():
        try:
            import winsound
            winsound.Beep(880, 90)
        except Exception:  # noqa: BLE001
            pass
