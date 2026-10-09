"""Controle do PC (Windows): abrir programas e sites, volume, mídia, prints, status."""
import ctypes
import datetime
import json
import os
import subprocess
import sys
import urllib.parse
import webbrowser

import psutil

from config import CFG

from .registro import ferramenta

WINDOWS = sys.platform == "win32"

# Lista branca de programas. Só o que estiver aqui (ou no apps.json) pode ser aberto.
# Isso impede que um texto malicioso (num e-mail, por exemplo) faça o Jarvis rodar
# um comando qualquer no seu PC.
APPS = {
    "bloco de notas": "notepad",
    "calculadora": "calc",
    "explorador de arquivos": "explorer",
    "paint": "mspaint",
    "prompt de comando": "cmd",
    "terminal": "wt",
    "gerenciador de tarefas": "taskmgr",
    "configurações": "ms-settings:",
    "chrome": "chrome",
    "edge": "msedge",
    "firefox": "firefox",
    "vscode": "code",
    "visual studio code": "code",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "outlook": "outlook",
    "spotify": "spotify:",
    "whatsapp": "whatsapp:",
    "discord": "discord:",
    "zoom": "zoommtg:",
    "steam": "steam:",
}


def _apps():
    apps = dict(APPS)
    if CFG.APPS_PERSONALIZADOS.exists():
        try:
            extras = json.loads(CFG.APPS_PERSONALIZADOS.read_text(encoding="utf-8"))
            apps.update({k.lower(): v for k, v in extras.items()})
        except Exception as erro:  # noqa: BLE001
            print(f"[apps.json] ignorado: {erro}")
    return apps


def _iniciar(alvo):
    if not WINDOWS:
        raise RuntimeError("abrir programas só funciona no Windows")
    if alvo.endswith(":") or os.path.exists(alvo):
        os.startfile(alvo)  # protocolos (spotify:) e caminhos completos
    else:
        # "start" resolve nomes registrados no Windows (chrome, winword, code...)
        subprocess.Popen(["cmd", "/c", "start", "", alvo], shell=False,
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


@ferramenta(
    "abrir_programa",
    "Abre um programa do PC. Só abre programas da lista conhecida; se o pedido não "
    "estiver na lista, a ferramenta devolve as opções disponíveis.",
    {"nome": {"type": "string", "description": "Nome do programa, ex.: 'chrome', 'calculadora', 'vscode'"}},
    ["nome"],
)
def abrir_programa(nome):
    apps = _apps()
    chave = nome.strip().lower()
    alvo = apps.get(chave)
    if alvo is None:  # tenta casamento parcial: "o vs code" -> "vscode"
        candidatos = [k for k in apps if k in chave or chave in k]
        if len(candidatos) == 1:
            chave, alvo = candidatos[0], apps[candidatos[0]]
    if alvo is None:
        return f"Programa '{nome}' não está na lista. Disponíveis: {', '.join(sorted(apps))}"
    _iniciar(alvo)
    return f"Abrindo {chave}."


@ferramenta(
    "abrir_site",
    "Abre um endereço da web no navegador padrão.",
    {"url": {"type": "string", "description": "Endereço completo, ex.: https://github.com"}},
    ["url"],
)
def abrir_site(url):
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if urllib.parse.urlparse(url).scheme not in ("http", "https"):
        return "Só abro endereços http ou https."
    webbrowser.open(url)
    return f"Abrindo {url}"


@ferramenta(
    "pesquisar_na_web",
    "Abre uma pesquisa no navegador (Google ou YouTube) para o usuário ver.",
    {
        "consulta": {"type": "string"},
        "onde": {"type": "string", "enum": ["google", "youtube"], "description": "Padrão: google"},
    },
    ["consulta"],
)
def pesquisar_na_web(consulta, onde="google"):
    q = urllib.parse.quote_plus(consulta)
    url = (f"https://www.youtube.com/results?search_query={q}" if onde == "youtube"
           else f"https://www.google.com/search?q={q}")
    webbrowser.open(url)
    return f"Pesquisa aberta no {onde}."


# --- Volume e mídia ---------------------------------------------------------

_TECLAS = {
    "tocar_pausar": 0xB3, "proxima": 0xB0, "anterior": 0xB1, "parar": 0xB2,
    "mudo": 0xAD, "volume_menos": 0xAE, "volume_mais": 0xAF,
}


def _tecla(vk, vezes=1):
    if not WINDOWS:
        raise RuntimeError("teclas de mídia só funcionam no Windows")
    for _ in range(vezes):
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
        ctypes.windll.user32.keybd_event(vk, 0, 2, 0)


def _volume_endpoint():
    import comtypes
    from pycaw.pycaw import AudioUtilities
    try:
        comtypes.CoInitialize()
    except OSError:
        pass
    alto_falantes = AudioUtilities.GetSpeakers()
    if hasattr(alto_falantes, "EndpointVolume"):  # pycaw novo
        return alto_falantes.EndpointVolume
    from ctypes import POINTER, cast  # pycaw antigo
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import IAudioEndpointVolume
    interface = alto_falantes.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))


@ferramenta(
    "ajustar_volume",
    "Ajusta o volume geral do PC. Use 'nivel' (0 a 100) para valor exato, ou 'acao' "
    "para aumentar, diminuir, mutar ou desmutar.",
    {
        "nivel": {"type": "integer", "minimum": 0, "maximum": 100},
        "acao": {"type": "string", "enum": ["aumentar", "diminuir", "mutar", "desmutar"]},
    },
)
def ajustar_volume(nivel=None, acao=None):
    if nivel is not None:
        try:
            vol = _volume_endpoint()
            vol.SetMute(0, None)
            vol.SetMasterVolumeLevelScalar(max(0, min(100, int(nivel))) / 100, None)
            return f"Volume em {nivel}%."
        except Exception:  # noqa: BLE001  sem pycaw: aproxima com teclas
            _tecla(_TECLAS["volume_menos"], 50)
            _tecla(_TECLAS["volume_mais"], int(nivel) // 2)
            return f"Volume aproximadamente em {nivel}%."
    if acao == "aumentar":
        _tecla(_TECLAS["volume_mais"], 5)
        return "Volume aumentado."
    if acao == "diminuir":
        _tecla(_TECLAS["volume_menos"], 5)
        return "Volume diminuído."
    if acao in ("mutar", "desmutar"):
        try:
            _volume_endpoint().SetMute(1 if acao == "mutar" else 0, None)
        except Exception:  # noqa: BLE001
            _tecla(_TECLAS["mudo"])
        return "Som mutado." if acao == "mutar" else "Som de volta."
    return "Diga um nível ou uma ação."


@ferramenta(
    "controle_de_midia",
    "Envia comandos de mídia do teclado (funciona com qualquer player: YouTube, "
    "Spotify sem API, VLC...).",
    {"comando": {"type": "string", "enum": ["tocar_pausar", "proxima", "anterior", "parar"]}},
    ["comando"],
)
def controle_de_midia(comando):
    _tecla(_TECLAS[comando])
    return f"Comando '{comando}' enviado."


# --- Utilidades -------------------------------------------------------------

@ferramenta("tirar_print", "Tira uma captura da tela inteira e salva em Imagens\\Jarvis.")
def tirar_print():
    from PIL import ImageGrab
    CFG.PASTA_PRINTS.mkdir(parents=True, exist_ok=True)
    caminho = CFG.PASTA_PRINTS / f"print_{datetime.datetime.now():%Y-%m-%d_%H-%M-%S}.png"
    ImageGrab.grab(all_screens=True).save(caminho)
    return f"Print salvo em {caminho}"


@ferramenta("bloquear_pc", "Bloqueia a tela do Windows (como Win+L).")
def bloquear_pc():
    if not WINDOWS:
        return "Só funciona no Windows."
    ctypes.windll.user32.LockWorkStation()
    return "Tela bloqueada."


@ferramenta("status_do_sistema", "Informa uso de CPU, memória, disco e bateria do PC.")
def status_do_sistema():
    return json.dumps(dados_sistema(), ensure_ascii=False)


def dados_sistema():
    """Também usado pela interface para os medidores laterais."""
    disco = psutil.disk_usage(os.path.abspath(os.sep))
    dados = {
        "cpu": round(psutil.cpu_percent(interval=None)),
        "ram": round(psutil.virtual_memory().percent),
        "disco": round(disco.percent),
        "bateria": None,
        "carregando": None,
    }
    bat = psutil.sensors_battery() if hasattr(psutil, "sensors_battery") else None
    if bat:
        dados["bateria"] = round(bat.percent)
        dados["carregando"] = bool(bat.power_plugged)
    return dados
