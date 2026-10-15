"""Orquestrador: liga ouvidos, cérebro, voz e interface."""
import queue
import threading
import time

import anthropic

from config import CFG
from core.modo_local import interpretar
from skills import carregar

NOMES_FERRAMENTAS = {
    "claude_code": "Consultando o Claude Code",
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
        self.cerebro_cc = None    # Claude Code para perguntas livres (sem créditos da API)
        self.claude_chat = None   # aba Claude
        self.terminal = None      # aba Terminal
        self.permitir_comandos = False
        self.voz = None
        self.ouvidos = None
        self._mods_ui = {}
        self._spotify_tocando = False
        self._atualizar = threading.Event()
        self._forcar = set()

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

        from core.claude_code import CerebroClaudeCode, ConversaClaude, argumentos_do_chat, localizar
        tem_claude_code = localizar() is not None
        if tem_claude_code:
            self.claude_chat = ConversaClaude(argumentos_do_chat(lambda: self.permitir_comandos))
            if CFG.CEREBRO == "auto" and CFG.CLAUDE_CODE_CEREBRO:
                self.cerebro_cc = CerebroClaudeCode()
        self.ui.enviar("claude_info", {"disponivel": tem_claude_code, "pasta": CFG.CLAUDE_CODE_PASTA})

        if self.com_voz:
            from core.voz import Voz
            self.voz = Voz()

        mods = {"Claude API": self.cerebro is not None, "Claude Code": tem_claude_code, **self.modulos}
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
        if self.cerebro:
            threading.Thread(target=self._testar_api, name="testar-api", daemon=True).start()

        threading.Thread(target=self._trabalhador, name="trabalhador", daemon=True).start()
        threading.Thread(target=self._sensores, name="sensores", daemon=True).start()
        threading.Thread(target=self._paineis, name="paineis", daemon=True).start()

        if CFG.SAUDACAO:
            self._falar(self._saudacao())
        self.ui.enviar("estado", "ocioso")
        if self.ouvidos:
            self.ouvidos.pausado = False

    def _testar_api(self):
        """Confere a API na partida (contar tokens é grátis), para o selo já nascer certo
        e o aviso de "sem créditos" aparecer antes do primeiro comando."""
        try:
            self.cerebro.cliente.messages.count_tokens(
                model=CFG.MODELO, messages=[{"role": "user", "content": "oi"}])
        except Exception as erro:  # noqa: BLE001
            motivo = motivo_indisponivel(erro)
            if motivo and CFG.CEREBRO != "claude":
                self.local.motivo = motivo
                reserva = "o modo local e o Claude Code" if self.cerebro_cc else "o modo local"
                self.ui.enviar("aviso", f"Claude API indisponível ({motivo}). Usando {reserva}.")
                self._mostrar_claude(False)

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
        if self.cerebro_cc:
            self.cerebro_cc.esquecer()
        self.ui.enviar("aviso", "Memória da conversa apagada.")

    def encerrar(self):
        """Janela fechando: não deixa o Claude Code rodando sozinho."""
        if self.terminal:
            self.terminal.encerrar()
        for conversa in (self.claude_chat, self.cerebro_cc):
            if conversa:
                conversa.parar()

    # --- aba Claude ---------------------------------------------------------------
    def claude_enviar(self, texto):
        texto = (texto or "").strip()
        if not texto or not self.claude_chat:
            return
        if self.claude_chat.ocupado:
            self.ui.enviar("claude", {"tipo": "erro", "texto": "O Claude ainda está trabalhando no pedido anterior."})
            return
        threading.Thread(target=self._rodar_claude, args=(texto,), name="claude", daemon=True).start()

    def _rodar_claude(self, texto):
        """Roda um pedido na aba Claude. Devolve (resposta, erro)."""
        teve_texto = []

        def ao_evento(tipo, *valores):
            if tipo == "texto":
                teve_texto.append(True)
                self.ui.enviar("claude", {"tipo": "texto", "texto": valores[0]})
            elif tipo == "ferramenta":
                self.ui.enviar("claude", {"tipo": "ferramenta", "texto": valores[0]})
            elif tipo == "fim" and valores[0] and not teve_texto and not valores[1]:
                self.ui.enviar("claude", {"tipo": "texto", "texto": valores[0]})

        self.ui.enviar("claude", {"tipo": "voce", "texto": texto})
        self.ui.enviar("claude", {"tipo": "ocupado", "valor": True})
        try:
            return self.claude_chat.enviar(texto, ao_evento=ao_evento), None
        except Exception as erro:  # noqa: BLE001
            self.ui.enviar("claude", {"tipo": "erro", "texto": str(erro)})
            return "", erro
        finally:
            self.ui.enviar("claude", {"tipo": "ocupado", "valor": False})

    def _perguntar_ao_claude(self, pedido):
        """"Jarvis, pergunta pro Claude ...": roda na aba Claude e fala o resumo."""
        from core.claude_code import resumo_falado
        if self.claude_chat.ocupado:
            return f"O Claude ainda está trabalhando no pedido anterior, {CFG.TRATAMENTO}."
        self.ui.enviar("aba", "claude")
        self.ui.enviar("ferramenta", NOMES_FERRAMENTAS["claude_code"])
        resposta, erro = self._rodar_claude(pedido)
        if erro:
            return f"O Claude Code não conseguiu responder, {CFG.TRATAMENTO}: {erro}"
        return resumo_falado(resposta) or f"Feito, {CFG.TRATAMENTO}."

    def claude_parar(self):
        if self.claude_chat:
            self.claude_chat.parar()

    def claude_nova(self):
        if self.claude_chat:
            self.claude_chat.nova()
        self.ui.enviar("claude", {"tipo": "nova"})

    def claude_permitir_comandos(self, valor):
        self.permitir_comandos = bool(valor)
        self.ui.enviar("aviso", "Claude: comandos no terminal liberados." if valor
                       else "Claude: comandos no terminal bloqueados.")

    # --- aba Terminal ---------------------------------------------------------------
    def terminal_iniciar(self, colunas, linhas):
        if self.terminal is None:
            from core.terminal import TerminalClaude
            self.terminal = TerminalClaude(lambda d: self.ui.enviar("terminal_dados", d),
                                           lambda: self.ui.enviar("terminal_saiu"))
        try:
            self.terminal.iniciar(colunas, linhas)
        except Exception as erro:  # noqa: BLE001
            self.ui.enviar("terminal_dados", f"\r\n\x1b[31mNão consegui abrir o terminal: {erro}\x1b[0m\r\n")

    def terminal_escrever(self, dados):
        if self.terminal:
            self.terminal.escrever(dados)

    def terminal_redimensionar(self, colunas, linhas):
        if self.terminal:
            self.terminal.redimensionar(colunas, linhas)

    def terminal_reiniciar(self, colunas, linhas):
        if self.terminal:
            self.terminal.encerrar()
        self.terminal_iniciar(colunas, linhas)

    # --- painéis --------------------------------------------------------------------
    def atualizar_paineis(self, nome=None):
        self._forcar.add(nome or "*")
        self._atualizar.set()

    def midia(self, acao):
        """Botões do player: pelo Spotify se configurado, senão teclas de mídia."""
        from skills import pc
        try:
            if not self.modulos.get("Spotify"):
                raise LookupError
            from skills import spotify_svc
            if acao == "tocar_pausar":
                acao = "pausar" if self._spotify_tocando else "continuar"
            spotify_svc.controle_spotify(acao)
        except Exception:  # noqa: BLE001  sem Spotify ou sem dispositivo: tecla de mídia
            pc.controle_de_midia("tocar_pausar" if acao in ("pausar", "continuar") else acao)
        time.sleep(0.5)
        self.atualizar_paineis("spotify")

    def _paineis(self):
        from core import paineis
        tarefas = {"clima": paineis.clima}
        for nome, modulo in (("google", "Google"), ("spotify", "Spotify")):
            if self.modulos.get(modulo):
                tarefas[nome] = getattr(paineis, nome)
            else:
                self.ui.enviar("painel", nome, {"desativado": True})
        proximo = dict.fromkeys(tarefas, 0.0)
        while True:
            agora = time.monotonic()
            for nome, func in tarefas.items():
                if agora < proximo[nome]:
                    continue
                proximo[nome] = agora + paineis.INTERVALOS[nome]
                try:
                    dados = func()
                except Exception as erro:  # noqa: BLE001
                    dados = {"erro": str(erro)[:140]}
                if nome == "spotify":
                    self._spotify_tocando = bool(dados.get("tocando"))
                self.ui.enviar("painel", nome, dados)
            if self._atualizar.wait(1.0):
                self._atualizar.clear()
                forcar, self._forcar = self._forcar, set()
                for nome in proximo:
                    if "*" in forcar or nome in forcar:
                        proximo[nome] = 0.0

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
        """Usa o Claude (API); se ele estiver fora de alcance (e o .env permitir), o modo
        local, e o Claude Code para o que o modo local não entende."""
        def ferramenta(nome):
            self.ui.enviar("ferramenta", NOMES_FERRAMENTAS.get(nome, nome))

        acao, args = interpretar(texto, self.modulos)
        if acao == "claude" and self.claude_chat:
            return self._perguntar_ao_claude(args["pedido"])

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
        if acao == "desconhecido" and self.cerebro_cc:
            ferramenta("claude_code")
            try:
                return self.cerebro_cc.responder(texto)
            except Exception as erro:  # noqa: BLE001  cai para a explicação do modo local
                print(f"[Claude Code] {type(erro).__name__}: {erro}")
        return self.local.responder(texto, ao_usar_ferramenta=ferramenta)

    def _mostrar_claude(self, ok):
        if self._mods_ui.get("Claude API") != ok:
            self._mods_ui["Claude API"] = ok
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
