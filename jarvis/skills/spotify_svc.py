"""Spotify via Web API (exige conta Premium do dono do app)."""
import spotipy
from spotipy.oauth2 import SpotifyOAuth

from config import CFG

from .registro import ferramenta

ESCOPOS = "user-read-playback-state user-modify-playback-state user-read-currently-playing"


def autenticador(abrir_navegador=False):
    return SpotifyOAuth(
        client_id=CFG.SPOTIFY_ID,
        client_secret=CFG.SPOTIFY_SECRET,
        redirect_uri=CFG.SPOTIFY_REDIRECT,
        scope=ESCOPOS,
        cache_path=str(CFG.SPOTIFY_CACHE),
        open_browser=abrir_navegador,
    )


_cliente = None


def _sp():
    global _cliente
    if _cliente is None:
        auth = autenticador()
        if not auth.get_cached_token():
            raise RuntimeError("Spotify não conectado. Rode conectar_spotify.bat.")
        _cliente = spotipy.Spotify(auth_manager=auth)
    return _cliente


def _dispositivo():
    """Devolve o id do dispositivo ativo (ou o primeiro disponível)."""
    dispositivos = _sp().devices().get("devices", [])
    if not dispositivos:
        raise RuntimeError("Nenhum dispositivo Spotify aberto. Abra o Spotify no PC ou celular.")
    ativo = next((d for d in dispositivos if d.get("is_active")), dispositivos[0])
    return ativo["id"]


@ferramenta(
    "tocar_musica",
    "Procura e toca no Spotify uma música, artista, álbum ou playlist.",
    {
        "busca": {"type": "string", "description": "Ex.: 'Back in Black AC/DC', 'lo-fi para estudar'"},
        "tipo": {"type": "string", "enum": ["track", "artist", "album", "playlist"],
                 "description": "Padrão: track"},
    },
    ["busca"],
)
def tocar_musica(busca, tipo="track"):
    sp = _sp()
    res = sp.search(q=busca, type=tipo, limit=1)
    itens = [i for i in res.get(f"{tipo}s", {}).get("items", []) if i]
    if not itens:
        return f"Não encontrei '{busca}' no Spotify."
    item = itens[0]
    dispositivo = _dispositivo()
    if tipo == "track":
        sp.start_playback(device_id=dispositivo, uris=[item["uri"]])
        artistas = ", ".join(a["name"] for a in item.get("artists", []))
        return f"Tocando {item['name']} de {artistas}."
    sp.start_playback(device_id=dispositivo, context_uri=item["uri"])
    return f"Tocando {tipo} {item['name']}."


@ferramenta(
    "controle_spotify",
    "Controla a reprodução no Spotify.",
    {"acao": {"type": "string", "enum": ["pausar", "continuar", "proxima", "anterior", "aleatorio_on", "aleatorio_off"]}},
    ["acao"],
)
def controle_spotify(acao):
    sp = _sp()
    dispositivo = _dispositivo()
    acoes = {
        "pausar": lambda: sp.pause_playback(device_id=dispositivo),
        "continuar": lambda: sp.start_playback(device_id=dispositivo),
        "proxima": lambda: sp.next_track(device_id=dispositivo),
        "anterior": lambda: sp.previous_track(device_id=dispositivo),
        "aleatorio_on": lambda: sp.shuffle(True, device_id=dispositivo),
        "aleatorio_off": lambda: sp.shuffle(False, device_id=dispositivo),
    }
    acoes[acao]()
    return f"Spotify: {acao}."


@ferramenta("musica_atual", "Diz qual música está tocando no Spotify agora.")
def musica_atual():
    atual = _sp().current_playback()
    if not atual or not atual.get("item"):
        return "Nada tocando no Spotify."
    item = atual["item"]
    artistas = ", ".join(a["name"] for a in item.get("artists", []))
    estado = "tocando" if atual.get("is_playing") else "pausada"
    return f"{item['name']} de {artistas} ({estado})."
