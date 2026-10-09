"""Orquestrador: liga ouvidos, cérebro, voz e interface."""
import queue
import threading
import time

from config import CFG
from skills import carregar

NOMES_FERRAMENTAS = {
    "abrir_programa": "Abrindo programa", "abrir_site": "Abrindo site",
    "pesquisar_na_web": "Pesquisando", "ajustar_volume": "Ajustando volume",
    "controle_de_midia": "Controlando mídia", "tirar_print": "Capturando tela",
    "bloquear_pc": "Bloqueando PC", "status_do_sistema": "Lendo sensores",
    "clima": "Consultando clima", "noticias": "Buscando notícias",
    "agenda_compromissos": "Lendo agenda", "criar_compromisso": "Criando evento",
    "emails": "Lendo e-mails", "tocar_musica": "Spotify", "controle_spotify": "Spotify",
    "musica_atual": "Spotify",
}


class Jarvis:
    def __init__(self, ui, com_voz=True, com_microfone=True):
        self.ui = ui
        self.com_voz = com_voz
        self.com_microfone = com_microfone
        self.fila = queue.Queue()
        self.ocupado = False
        self.modulos = {}
        self.cerebro = None
        self.voz = None
        self.ouvidos = None

    # --- partida ---------------------------------------------------------------
    def iniciar(self):
        """Chamado pelo pywebview numa thread separada depois que a janela abre."""
        from core.cerebro import Cerebro

        self.modulos = carregar()
        self.ui.enviar("estado", "iniciando")
        if not CFG.ANTHROPIC_API_KEY:
            self.ui.enviar("aviso", "ANTHROPIC_API_KEY não configurada no arquivo .env.")
        self.cerebro = Cerebro(self.modulos)

        if self.com_voz:
            from core.voz import Voz
            self.voz = Voz()

        mods = dict(self.modulos)
        if self.com_microfone:
            from core.ouvidos import Ouvidos
            self.ouvidos = Ouvidos(
                on_comando=self._comando_de_voz,
                on_estado=lambda e: self.ui.enviar("estado", e),
                on_nivel=lambda n: self.ui.enviar("nivel", n),
                on_aviso=lambda t: self.ui.enviar("aviso", t),
            )
            self.ouvidos.pausado = True   # só escuta depois da saudação
            self.ouvidos.iniciar()
            mods["Microfone"] = True
        mods["Voz"] = bool(self.voz)
        self.ui.enviar("modulos", mods)

        threading.Thread(target=self._trabalhador, name="trabalhador", daemon=True).start()
        threading.Thread(target=self._sensores, name="sensores", daemon=True).start()

        if CFG.SAUDACAO:
            self._falar(self._saudacao())
        self.ui.enviar("estado", "ocioso")
        if self.ouvidos:
            self.ouvidos.pausado = False

    def _saudacao(self):
        hora = time.localtime().tm_hour
        periodo = "Bom dia" if 5 <= hora < 12 else "Boa tarde" if hora < 18 else "Boa noite"
        return f"{periodo}, {CFG.TRATAMENTO}. Todos os sistemas estão online."

    # --- entradas ---------------------------------------------------------------
    def _comando_de_voz(self, texto):
        if self.ouvidos:
            self.ouvidos.pausado = True   # para de escutar enquanto processa
        self.fila.put(texto)

    def enviar_texto(self, texto):
        texto = (texto or "").strip()
        if texto:
            if self.ouvidos:
                self.ouvidos.pausado = True
            self.fila.put(texto)

    def ouvir(self):
        if self.voz:
            self.voz.parar()
        if self.ouvidos and self.ouvidos.microfone_ok:
            self.ouvidos.escutar_agora()
        else:
            self.ui.enviar("aviso", "Microfone indisponível. Digite o comando.")

    def silenciar(self):
        if self.voz:
            self.voz.parar()

    def esquecer(self):
        if self.cerebro:
            self.cerebro.esquecer()
        self.ui.enviar("aviso", "Memória da conversa apagada.")

    # --- processamento ------------------------------------------------------------
    def _trabalhador(self):
        while True:
            texto = self.fila.get()
            self.ocupado = True
            self.ui.enviar("mensagem", "voce", texto)
            self.ui.enviar("estado", "pensando")
            try:
                resposta = self.cerebro.responder(
                    texto, ao_usar_ferramenta=lambda n: self.ui.enviar(
                        "ferramenta", NOMES_FERRAMENTAS.get(n, n)))
            except Exception as erro:  # noqa: BLE001
                resposta = self._mensagem_de_erro(erro)
                self.ui.enviar("estado", "erro")
            self.ui.enviar("mensagem", "jarvis", resposta)
            self._falar(resposta)
            self.ui.enviar("estado", "ocioso")
            self.ocupado = False

            if self.ouvidos and self.fila.empty():
                if CFG.CONTINUAR_SE_PERGUNTA and resposta.rstrip().endswith("?"):
                    self.ouvidos.escutar_agora()   # resposta sem precisar do "Hey Jarvis"
                self.ouvidos.pausado = False

    def _falar(self, texto):
        if not self.voz:
            return
        self.ui.enviar("estado", "falando")
        self.voz.falar(texto)

    @staticmethod
    def _mensagem_de_erro(erro):
        nome = type(erro).__name__
        t = CFG.TRATAMENTO
        if "Authentication" in nome:
            return f"Minha chave de acesso foi recusada, {t}. Verifique a ANTHROPIC_API_KEY no arquivo .env."
        if "Connection" in nome or "Timeout" in nome:
            return f"Perdi a conexão com meus servidores, {t}. Verifique a internet."
        if "RateLimit" in nome or "Overloaded" in nome:
            return f"Os servidores estão sobrecarregados, {t}. Tente de novo em instantes."
        print(f"[Erro] {nome}: {erro}")
        return f"Encontrei um erro inesperado, {t}: {nome}."

    def _sensores(self):
        from skills.pc import dados_sistema
        while True:
            try:
                self.ui.enviar("sistema", dados_sistema())
            except Exception:  # noqa: BLE001
                pass
            time.sleep(2)
