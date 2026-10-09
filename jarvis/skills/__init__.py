"""Carrega as habilidades disponíveis conforme o que estiver configurado."""
from config import CFG

from .registro import FERRAMENTAS, executar  # noqa: F401


def carregar():
    """Importa os módulos de habilidades e devolve o status de cada um."""
    status = {}

    from . import pc  # noqa: F401
    status["PC"] = True

    from . import info  # noqa: F401
    status["Clima/Notícias"] = True

    # Google só entra se o login já foi feito (token.json existe)
    if CFG.GOOGLE_TOKEN.exists():
        try:
            from . import google_svc  # noqa: F401
            status["Google"] = True
        except Exception as erro:  # noqa: BLE001
            print(f"[Google] desativado: {erro}")
            status["Google"] = False
    else:
        status["Google"] = False

    # Spotify só entra se as chaves estiverem no .env
    if CFG.SPOTIFY_ID and CFG.SPOTIFY_SECRET:
        try:
            from . import spotify_svc  # noqa: F401
            status["Spotify"] = True
        except Exception as erro:  # noqa: BLE001
            print(f"[Spotify] desativado: {erro}")
            status["Spotify"] = False
    else:
        status["Spotify"] = False

    return status
