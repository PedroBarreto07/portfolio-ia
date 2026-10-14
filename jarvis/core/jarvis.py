"""Orquestrador: liga ouvidos, cérebro, voz e interface."""
import queue
import threading
import time

import anthropic

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


def motivo_indisponivel(erro):
    """Se o erro quer dizer que o Claude está fora de alcance, devolve o motivo."""
    if isinstance(erro, anthropic.BadRequestError) and "credit balance" in str(erro).lower():
        return "sem créditos na conta da Anthropic"
    if isinstance(erro, anthropic.AuthenticationError):
        return "a chave da API foi recusada"
    if isinstance(erro, anthropic.PermissionDeniedError):
        return "a chave da API não tem permissão"
    if isinstance(erro, anthropic.APIConnectionError):   # inclui timeout
        return "sem conexão com a internet"
    if isinstance(erro, (anthropic.RateLimitError, anthropic.InternalServerError,
                         anthropic.OverloadedError, anthropic.ServiceUnavailableError)):
        return "servidores da Anthropic sobrecarregados"
    return None


class Jarvis:
    def __init__(self, ui, com_voz=True, com_microfone=True):
        self.ui = ui
        self.com_voz = com_voz
        self.com_microfone = com_microfone
        self.fila = queue.Queue()
        self.ocupado = False
        self.modulos = {}
        self.cerebro = None   # Claude (None = só o modo local)
        self.local = None     # comandos básicos sem IA
        self.voz = None
        self.ouvidos = None
        self._mods_ui = {}

    # --- partida ---------------------------------------------------------------
    def iniciar(self):
        """Chamado pelo pywebview numa thread separada depois que a janela abre."""
        from core.cerebro import Cerebro
        from core.modo_local import ModoLocal

        self.modulos = carregar()
        self.ui.enviar("estado", "iniciando")
        self.local = ModoLocal(self.modulos)
        if CFG.CEREBRO == "local":
            self.ui.enviar("aviso", "Modo local: comandos básicos, sem IA e sem custo.")
        elif not CFG.ANTHROPIC_API_KEY:
            self.local.motivo = "a chave da API não foi configurada"
            self.ui.enviar("aviso", "ANTHROPIC_API_KEY não configurada no .env. Usando o modo local.")
        else:
            self.cerebro = Cerebro(self.modulos)

        if self.com_voz:
            from core.voz import Voz
            self.voz = Voz()

        mods = {"Claude": self.cerebro is not None, **self.modulos}
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
        self._mods_ui = mods
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
            resposta = self._responder(texto)
            self.ui.enviar("mensagem", "jarvis", resposta)
            self._falar(resposta)
            self.ui.enviar("estado", "ocioso")
            self.ocupado = False

            if self.ouvidos and self.fila.empty():
                if CFG.CONTINUAR_SE_PERGUNTA and resposta.rstrip().endswith("?"):
                    self.ouvidos.escutar_agora()   # resposta sem precisar dizer "Jarvis"
                self.ouvidos.pausado = False

    def _responder(self, texto):
        """Usa o Claude; se ele estiver fora de alcance (e o .env permitir), o modo local."""
        def ferramenta(nome):
            self.ui.enviar("ferramenta", NOMES_FERRAMENTAS.get(nome, nome))

        if self.cerebro:
            try:
                resposta = self.cerebro.responder(texto, ao_usar_ferramenta=ferramenta)
                self.local.motivo = None
                self._mostrar_claude(True)
                return resposta
            except Exception as erro:  # noqa: BLE001
                motivo = motivo_indisponivel(erro)
                if motivo is None or CFG.CEREBRO == "claude":
                    self.ui.enviar("estado", "erro")
                    return self._mensagem_de_erro(erro)
                if self.local.motivo != motivo:
                    self.ui.enviar("aviso", f"Claude indisponível ({motivo}). Usando o modo local.")
                self.local.motivo = motivo
                self._mostrar_claude(False)
        return self.local.responder(texto, ao_usar_ferramenta=ferramenta)

    def _mostrar_claude(self, ok):
        if self._mods_ui.get("Claude") != ok:
            self._mods_ui["Claude"] = ok
            self.ui.enviar("modulos", self._mods_ui)

    def _falar(self, texto):
        if not self.voz:
            return
        self.ui.enviar("estado", "falando")
        self.voz.falar(texto)

    @staticmethod
    def _mensagem_de_erro(erro):
        t = CFG.TRATAMENTO
        motivo = motivo_indisponivel(erro)
        if motivo == "sem créditos na conta da Anthropic":
            return (f"Estou sem créditos na API da Anthropic, {t}. "
                    "Adicione saldo em console.anthropic.com, na parte de faturamento.")
        if isinstance(erro, anthropic.AuthenticationError):
            return f"Minha chave de acesso foi recusada, {t}. Verifique a ANTHROPIC_API_KEY no arquivo .env."
        if isinstance(erro, anthropic.PermissionDeniedError):
            return f"Minha chave não tem permissão para usar a API, {t}. Crie uma chave com o escopo de uso da API."
        if isinstance(erro, anthropic.APIConnectionError):
            return f"Perdi a conexão com meus servidores, {t}. Verifique a internet."
        if motivo:
            return f"Os servidores estão sobrecarregados, {t}. Tente de novo em instantes."
        if isinstance(erro, anthropic.NotFoundError):
            return f"O modelo {CFG.MODELO} não foi encontrado, {t}. Confira o JARVIS_MODELO no arquivo .env."
        print(f"[Erro] {type(erro).__name__}: {erro}")
        if isinstance(erro, anthropic.BadRequestError):
            return f"Meus servidores recusaram o pedido, {t}. Os detalhes estão no terminal."
        return f"Encontrei um erro inesperado, {t}: {type(erro).__name__}."

    def _sensores(self):
        from skills.pc import dados_sistema
        while True:
            try:
                self.ui.enviar("sistema", dados_sistema())
            except Exception:  # noqa: BLE001
                pass
            time.sleep(2)
