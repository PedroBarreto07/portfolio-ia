"""Testa cada peça do Jarvis separadamente e mostra o que está faltando."""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

from config import CFG  # noqa: E402

OK, FALHA = "[ OK ]", "[FALHA]"


def etapa(nome, func):
    print(f"\n--- {nome} ---")
    try:
        func()
    except Exception as erro:  # noqa: BLE001
        print(f"{FALHA} {type(erro).__name__}: {erro}")


def microfones():
    import sounddevice as sd
    padrao = sd.default.device[0]
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] > 0:
            marca = "  <- padrão" if i == padrao else ""
            print(f"  {i}: {d['name']}{marca}")
    print("Para trocar, ponha o número em MIC_DISPOSITIVO no .env.")
    print("Gravando 3 segundos... fale algo.")
    import numpy as np
    audio = sd.rec(int(3 * 16000), samplerate=16000, channels=1, dtype="int16",
                   device=int(CFG.MIC_DISPOSITIVO) if (CFG.MIC_DISPOSITIVO or "").isdigit() else None)
    sd.wait()
    rms = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2)))
    pico = int(np.abs(audio).max())
    print(f"{OK} volume médio {rms:.0f}, pico {pico}.")
    if pico < 1000:
        print("  Muito baixo: confira se o microfone certo está selecionado e não está mudo.")


def voz():
    from core.voz import Voz
    Voz().falar(f"Teste de voz concluído, {CFG.TRATAMENTO}.")
    print(f"{OK} se você ouviu a frase, a voz está funcionando ({CFG.VOZ}).")


def whisper():
    from faster_whisper import WhisperModel
    t = time.time()
    WhisperModel(CFG.WHISPER_MODELO, device="cpu", compute_type="int8")
    print(f"{OK} Whisper '{CFG.WHISPER_MODELO}' carregado em {time.time() - t:.1f}s.")


def palavra_ativacao():
    import openwakeword.utils
    from openwakeword.model import Model
    openwakeword.utils.download_models(model_names=[CFG.WAKE_WORD])
    Model(wakeword_models=[CFG.WAKE_WORD], inference_framework="onnx")
    print(f"{OK} modelo '{CFG.WAKE_WORD}' pronto.")


def claude():
    if not CFG.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY vazia no .env")
    import anthropic
    r = anthropic.Anthropic(api_key=CFG.ANTHROPIC_API_KEY).messages.create(
        model=CFG.MODELO, max_tokens=30,
        messages=[{"role": "user", "content": "Responda só: sistemas online."}])
    print(f"{OK} {CFG.MODELO} respondeu: {r.content[0].text}")


def internet_apis():
    from skills.info import clima, noticias
    print(f"{OK} clima: {clima()[:120]}...")
    print(f"{OK} notícias: {noticias(quantidade=1)[:120]}...")


def integracoes():
    print(f"Google:  {'conectado' if CFG.GOOGLE_TOKEN.exists() else 'não conectado (opcional)'}")
    spot = CFG.SPOTIFY_ID and CFG.SPOTIFY_SECRET
    print(f"Spotify: {'chaves ok' if spot else 'sem chaves (opcional)'}"
          f"{' / login feito' if CFG.SPOTIFY_CACHE.exists() else ''}")


if __name__ == "__main__":
    print("==== Diagnóstico do J.A.R.V.I.S. ====")
    etapa("Cérebro (Claude API)", claude)
    etapa("Clima e notícias", internet_apis)
    etapa("Voz", voz)
    etapa("Microfone", microfones)
    etapa("Reconhecimento de fala", whisper)
    etapa("Palavra de ativação", palavra_ativacao)
    etapa("Integrações", integracoes)
    print("\nFim do diagnóstico.")
