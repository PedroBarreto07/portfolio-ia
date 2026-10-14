"""Fala do Jarvis: edge-tts (voz neural da Microsoft, grátis) + pygame para tocar.

Se a internet cair, cai para pyttsx3 (voz offline do Windows).
"""
import asyncio
import os
import re
import tempfile
import threading
import time
import uuid

os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

from config import CFG  # noqa: E402

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️]")


def limpar_para_fala(texto):
    """Remove marcações que soariam estranhas faladas."""
    texto = re.sub(r"```.*?```", " ", texto, flags=re.S)
    texto = re.sub(r"https?://\S+", "o link", texto)
    texto = re.sub(r"[*_#`>|~]", "", texto)
    texto = re.sub(r"^\s*[-•]\s+", "", texto, flags=re.M)
    texto = _EMOJI.sub("", texto)
    return re.sub(r"\s+", " ", texto).strip()


class Voz:
    def __init__(self):
        self.falando = False
        self._parar = threading.Event()
        self._uma_por_vez = threading.Lock()   # saudação e resposta não falam juntas
        self._loop = None
        self._mixer = False

    def _iniciar_mixer(self):
        if not self._mixer:
            import pygame
            pygame.mixer.init()
            self._mixer = True

    def parar(self):
        self._parar.set()

    def falar(self, texto):
        texto = limpar_para_fala(texto)
        if not texto:
            return
        with self._uma_por_vez:
            self._parar.clear()
            self.falando = True
            try:
                self._falar_edge(texto)
            except Exception as erro:  # noqa: BLE001
                print(f"[Voz] edge-tts falhou ({erro}); usando voz offline.")
                self._falar_offline(texto)
            finally:
                self.falando = False

    def _falar_edge(self, texto):
        import edge_tts
        import pygame

        self._iniciar_mixer()
        if self._loop is None:
            self._loop = asyncio.new_event_loop()
        caminho = os.path.join(tempfile.gettempdir(), f"jarvis_{uuid.uuid4().hex}.mp3")
        comunicador = edge_tts.Communicate(texto, CFG.VOZ, rate=CFG.VOZ_VELOCIDADE, pitch=CFG.VOZ_TOM)
        self._loop.run_until_complete(comunicador.save(caminho))
        try:
            pygame.mixer.music.load(caminho)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                if self._parar.is_set():
                    pygame.mixer.music.stop()
                    break
                time.sleep(0.05)
            pygame.mixer.music.unload()
        finally:
            try:
                os.remove(caminho)
            except OSError:
                pass

    def _falar_offline(self, texto):
        try:
            import pyttsx3
            motor = pyttsx3.init()
            for v in motor.getProperty("voices"):
                if "pt" in (v.id or "").lower() or "portugu" in (v.name or "").lower():
                    motor.setProperty("voice", v.id)
                    break
            motor.say(texto)
            motor.runAndWait()
        except Exception as erro:  # noqa: BLE001
            print(f"[Voz] sem voz disponível: {erro}")
