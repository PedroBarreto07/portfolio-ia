"""Configurações do Jarvis, lidas do arquivo .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")


def _bool(nome, padrao=False):
    return os.getenv(nome, str(padrao)).strip().lower() in ("1", "true", "sim", "yes", "on")


def _float(nome, padrao):
    try:
        return float(os.getenv(nome, padrao))
    except ValueError:
        return float(padrao)


class CFG:
    # Cérebro
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    MODELO = os.getenv("JARVIS_MODELO", "claude-sonnet-5-5")

    # Usuário
    NOME = os.getenv("USUARIO_NOME", "Pedro")
    TRATAMENTO = os.getenv("USUARIO_TRATAMENTO", "senhor")
    CIDADE = os.getenv("CIDADE_PADRAO", "Brasília")

    # Voz (fala)
    VOZ = os.getenv("VOZ", "pt-BR-AntonioNeural")
    VOZ_VELOCIDADE = os.getenv("VOZ_VELOCIDADE", "+5%")
    VOZ_TOM = os.getenv("VOZ_TOM", "-4Hz")

    # Ouvidos
    WHISPER_MODELO = os.getenv("WHISPER_MODELO", "small")
    WAKE_WORD = os.getenv("WAKE_WORD", "hey_jarvis")
    WAKE_LIMIAR = _float("WAKE_LIMIAR", 0.5)
    MIC_LIMIAR_MIN = _float("MIC_LIMIAR_MIN", 400)
    MIC_DISPOSITIVO = os.getenv("MIC_DISPOSITIVO", "").strip() or None  # índice ou nome

    # Comportamento
    SAUDACAO = _bool("SAUDACAO_AO_INICIAR", True)
    CONTINUAR_SE_PERGUNTA = _bool("OUVIR_APOS_PERGUNTA", True)
    DEBUG = _bool("DEBUG", False)

    # Spotify
    SPOTIFY_ID = os.getenv("SPOTIPY_CLIENT_ID", "")
    SPOTIFY_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET", "")
    SPOTIFY_REDIRECT = os.getenv("SPOTIPY_REDIRECT_URI", "http://127.0.0.1:8888/callback")

    # Arquivos locais (NUNCA subir para o GitHub)
    GOOGLE_CREDENCIAIS = BASE / "credentials.json"
    GOOGLE_TOKEN = BASE / "token.json"
    SPOTIFY_CACHE = BASE / ".spotify_cache"
    APPS_PERSONALIZADOS = BASE / "apps.json"
    PASTA_PRINTS = Path.home() / "Pictures" / "Jarvis"
