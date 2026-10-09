"""Faz o login no Spotify uma única vez e salva o .spotify_cache."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CFG  # noqa: E402

if not (CFG.SPOTIFY_ID and CFG.SPOTIFY_SECRET):
    print("ERRO: preencha SPOTIPY_CLIENT_ID e SPOTIPY_CLIENT_SECRET no arquivo .env.")
    sys.exit(1)

from skills.spotify_svc import autenticador  # noqa: E402

auth = autenticador(abrir_navegador=True)
print("Uma janela do navegador vai abrir. Entre no Spotify e aceite.")
token = auth.get_access_token(as_dict=False)
if token:
    print("\nSpotify conectado! Reinicie o Jarvis.")
else:
    print("\nNão foi possível conectar. Confira o Redirect URI no painel do Spotify.")
