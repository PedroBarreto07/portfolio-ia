"""J.A.R.V.I.S. — assistente pessoal por voz.

Uso:
    python main.py                 interface completa (HUD + voz + microfone)
    python main.py --console       sem janela, conversa digitando no terminal
    python main.py --sem-microfone só texto na interface (útil sem microfone)
    python main.py --sem-voz       Jarvis responde só por escrito
"""
import argparse
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
os.chdir(BASE)
sys.path.insert(0, str(BASE))

from config import CFG  # noqa: E402
from core.jarvis import Jarvis  # noqa: E402


class ApiJS:
    """Métodos que o JavaScript da interface pode chamar (pywebview.api.*).
    Atributos começando com _ não são expostos ao JavaScript."""

    def __init__(self, jarvis):
        self._jarvis = jarvis

    def enviar_texto(self, texto):
        self._jarvis.enviar_texto(texto)

    def ouvir(self):
        self._jarvis.ouvir()

    def silenciar(self):
        self._jarvis.silenciar()

    def esquecer(self):
        self._jarvis.esquecer()

    # aba Claude
    def claude_enviar(self, texto):
        self._jarvis.claude_enviar(texto)

    def claude_parar(self):
        self._jarvis.claude_parar()

    def claude_nova(self):
        self._jarvis.claude_nova()

    def claude_permitir_comandos(self, valor):
        self._jarvis.claude_permitir_comandos(valor)

    # aba Terminal
    def terminal_iniciar(self, colunas, linhas):
        self._jarvis.terminal_iniciar(colunas, linhas)

    def terminal_escrever(self, dados):
        self._jarvis.terminal_escrever(dados)

    def terminal_redimensionar(self, colunas, linhas):
        self._jarvis.terminal_redimensionar(colunas, linhas)

    def terminal_reiniciar(self, colunas, linhas):
        self._jarvis.terminal_reiniciar(colunas, linhas)

    # painéis
    def midia(self, acao):
        self._jarvis.midia(acao)

    def atualizar_paineis(self, nome=None):
        self._jarvis.atualizar_paineis(nome)


def modo_console(args):
    from core.ponte import PonteConsole
    jarvis = Jarvis(PonteConsole(), com_voz=not args.sem_voz, com_microfone=False)
    jarvis.iniciar()
    print("Digite seus comandos (ou 'sair'):")
    import time
    while True:
        try:
            texto = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if texto.lower() in ("sair", "exit", "quit"):
            break
        jarvis.enviar_texto(texto)
        time.sleep(0.2)
        while not jarvis.fila.empty() or jarvis.ocupado:
            time.sleep(0.1)


def modo_janela(args):
    import webview
    from core.ponte import Ponte

    ponte = Ponte()
    jarvis = Jarvis(ponte, com_voz=not args.sem_voz, com_microfone=not args.sem_microfone)
    janela = webview.create_window(
        "J.A.R.V.I.S.", "ui/index.html", js_api=ApiJS(jarvis),
        width=1360, height=820, min_size=(960, 620), background_color="#04070c", maximized=True,
    )
    janela.events.closed += jarvis.encerrar
    ponte.conectar(janela)
    webview.start(jarvis.iniciar, debug=CFG.DEBUG)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="J.A.R.V.I.S.")
    p.add_argument("--console", action="store_true")
    p.add_argument("--sem-voz", action="store_true")
    p.add_argument("--sem-microfone", action="store_true")
    argumentos = p.parse_args()
    (modo_console if argumentos.console else modo_janela)(argumentos)
