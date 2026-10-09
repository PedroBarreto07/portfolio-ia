"""Simula o microfone e o Whisper para testar o fluxo do motor "whisper"."""
import unittest
from types import SimpleNamespace

import numpy as np

from config import CFG
from core.ouvidos import BLOCO, Ouvidos, _s

SILENCIO = np.zeros(BLOCO, dtype=np.int16)
FALA = np.full(BLOCO, 3000, dtype=np.int16)


class WhisperFalso:
    """Devolve as frases na ordem, uma por chamada de transcribe()."""

    def __init__(self, *frases):
        self.frases = list(frases)
        self.chamadas = 0

    def transcribe(self, _audio, **_kw):
        self.chamadas += 1
        texto = self.frases.pop(0) if self.frases else ""
        return [SimpleNamespace(text=texto)], None


def criar(audio, rapido, principal):
    eventos = {"comandos": [], "estados": []}
    o = Ouvidos(
        on_comando=eventos["comandos"].append, on_estado=eventos["estados"].append,
        on_nivel=lambda _n: None, on_aviso=lambda _t: None,
    )
    o.motor = "whisper"
    o.whisper_rapido, o.whisper = rapido, principal
    o._espera_max = 0.01
    o._bip = lambda: None
    for bloco in audio:
        o._audio.put(bloco)
    return o, eventos


def rodar(o):
    try:
        o._laco()
    except Exception as erro:  # noqa: BLE001  fim do áudio simulado
        if type(erro).__name__ != "MicrofoneParado":
            raise


def trecho(bloco, segundos):
    return [bloco] * _s(segundos)


class TestMotorWhisper(unittest.TestCase):
    def setUp(self):
        CFG.WAKE_PALAVRA = "jarvis"
        CFG.MIC_LIMIAR_MIN = 400

    def test_nome_e_comando_numa_frase(self):
        audio = trecho(SILENCIO, 1) + trecho(FALA, 3) + trecho(SILENCIO, 1.5)
        rapido = WhisperFalso("Jarvis, abre o")
        principal = WhisperFalso("Jarvis, abre o Chrome.")
        o, ev = criar(audio, rapido, principal)
        rodar(o)
        self.assertEqual(ev["comandos"], ["abre o Chrome."])
        self.assertEqual(rapido.chamadas, 1)

    def test_nome_sozinho_espera_o_comando(self):
        audio = (trecho(SILENCIO, 1) + trecho(FALA, 0.5) + trecho(SILENCIO, 0.6)
                 + trecho(FALA, 1.5) + trecho(SILENCIO, 1.5))
        rapido = WhisperFalso("Jarvis.")
        principal = WhisperFalso("Que horas são?")
        o, ev = criar(audio, rapido, principal)
        rodar(o)
        self.assertEqual(ev["comandos"], ["Que horas são?"])
        self.assertIn("ouvindo", ev["estados"])

    def test_conversa_sem_o_nome_e_ignorada(self):
        audio = trecho(SILENCIO, 1) + trecho(FALA, 4) + trecho(SILENCIO, 1.5)
        rapido = WhisperFalso("Mãe, cadê o controle")
        principal = WhisperFalso("não deveria ser chamado")
        o, ev = criar(audio, rapido, principal)
        rodar(o)
        self.assertEqual(ev["comandos"], [])
        self.assertEqual(principal.chamadas, 0)
        self.assertEqual(rapido.chamadas, 1)   # só confere o começo de cada fala

    def test_estalo_curto_nem_chama_o_whisper(self):
        audio = trecho(SILENCIO, 1) + [FALA] + trecho(SILENCIO, 1)
        rapido = WhisperFalso("Jarvis")
        o, ev = criar(audio, rapido, WhisperFalso())
        rodar(o)
        self.assertEqual(rapido.chamadas, 0)
        self.assertEqual(ev["comandos"], [])

    def test_pausado_nao_escuta(self):
        audio = trecho(SILENCIO, 1) + trecho(FALA, 2) + trecho(SILENCIO, 1.5)
        rapido = WhisperFalso("Jarvis, abre o Chrome")
        o, ev = criar(audio, rapido, WhisperFalso("Jarvis, abre o Chrome"))
        o.pausado = True
        rodar(o)
        self.assertEqual(rapido.chamadas, 0)
        self.assertEqual(ev["comandos"], [])

    def test_botao_do_microfone_dispensa_o_nome(self):
        audio = trecho(SILENCIO, 0.5) + trecho(FALA, 1.5) + trecho(SILENCIO, 1.5)
        rapido = WhisperFalso()
        o, ev = criar(audio, rapido, WhisperFalso("Como está o clima?"))
        o.escutar_agora()
        rodar(o)
        self.assertEqual(ev["comandos"], ["Como está o clima?"])
        self.assertEqual(rapido.chamadas, 0)


if __name__ == "__main__":
    unittest.main()
