"""Ponte Python -> interface (HTML). Envia eventos por uma fila para não travar o áudio."""
import json
import queue
import threading


class Ponte:
    def __init__(self):
        self._fila = queue.Queue()
        self._janela = None
        self._pronta = threading.Event()

    def conectar(self, janela):
        self._janela = janela
        janela.events.loaded += lambda: self._pronta.set()
        threading.Thread(target=self._despachar, name="ponte-ui", daemon=True).start()

    def enviar(self, metodo, *args):
        """Chama hud.<metodo>(*args) no JavaScript."""
        self._fila.put((metodo, args))

    def _despachar(self):
        self._pronta.wait()
        while True:
            metodo, args = self._fila.get()
            # evita acumular atualizações de nível de microfone atrasadas
            if metodo == "nivel" and not self._fila.empty():
                continue
            js = f"window.hud && hud.{metodo}({', '.join(json.dumps(a, ensure_ascii=False) for a in args)})"
            try:
                self._janela.evaluate_js(js)
            except Exception as erro:  # noqa: BLE001  janela fechando
                print(f"[UI] {erro}")


class PonteConsole:
    """Usada no modo sem interface (python main.py --console)."""

    def enviar(self, metodo, *args):
        if metodo == "mensagem":
            quem, texto = args
            print(f"\n{'JARVIS' if quem == 'jarvis' else 'VOCÊ'}: {texto}")
        elif metodo == "aviso":
            print(f"[i] {args[0]}")
        elif metodo == "ferramenta":
            print(f"   ⚙ {args[0]}")
