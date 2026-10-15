"""Claude Code dentro do Jarvis. Usa a assinatura do Claude (o mesmo login da extensão
do VS Code), não os créditos da API.

Dois usos aqui (o terminal interativo fica em core/terminal.py):
- ConversaClaude: o agente completo da aba Claude, que lê e edita arquivos na pasta de
  trabalho (CLAUDE_CODE_PASTA). Também atende "Jarvis, pergunta pro Claude...".
- CerebroClaudeCode: responde, com a personalidade do Jarvis, as perguntas livres que o
  modo local não entende. Sem ferramentas de programação, para responder rápido por voz.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import threading
from pathlib import Path

from config import CFG

# variáveis de uma sessão do Claude Code que tenha aberto o Jarvis (não podem vazar)
_VARIAVEIS_DE_SESSAO = ("CLAUDECODE", "CLAUDE_PID", "CLAUDE_EFFORT")
_PREFIXOS_DE_SESSAO = ("CLAUDE_CODE_", "CLAUDE_AGENT_")
_MANTER = ("CLAUDE_CODE_GIT_BASH_PATH",)


class ClaudeCodeIndisponivel(RuntimeError):
    pass


def localizar():
    """Caminho do executável do Claude Code: o do .env, o do PATH ou o que vem
    dentro da extensão do VS Code (a versão mais nova). None se não houver."""
    if CFG.CLAUDE_CODE_EXE and Path(CFG.CLAUDE_CODE_EXE).exists():
        return CFG.CLAUDE_CODE_EXE
    achado = shutil.which("claude")
    if achado:
        return achado
    padrao = (Path.home() / ".vscode" / "extensions" / "anthropic.claude-code-*"
              / "resources" / "native-binary" / "claude.exe")
    candidatos = glob.glob(str(padrao))
    return max(candidatos, key=_versao) if candidatos else None


def _versao(caminho):
    m = re.search(r"claude-code-(\d+)\.(\d+)\.(\d+)", caminho)
    return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)


def ambiente():
    """Variáveis de ambiente para o Claude Code. Sem a ANTHROPIC_API_KEY do .env: com
    ela, o Claude Code usaria a API (que pode estar sem créditos) em vez da assinatura."""
    return {
        k: v for k, v in os.environ.items()
        if k in _MANTER or not (
            k.startswith("ANTHROPIC_") or k in _VARIAVEIS_DE_SESSAO
            or k.startswith(_PREFIXOS_DE_SESSAO))
    }


def _resumo_da_ferramenta(nome, entrada):
    for chave in ("file_path", "path", "command", "pattern", "url", "query", "description"):
        valor = (entrada or {}).get(chave)
        if valor:
            valor = str(valor).replace("\n", " ")
            return f"{nome} {valor[:90]}{'…' if len(valor) > 90 else ''}"
    return nome


def interpretar_evento(linha):
    """Converte uma linha do `claude -p --output-format stream-json` em eventos:
    ("sessao", id), ("texto", str), ("ferramenta", str) e ("fim", texto, deu_erro).
    Linhas que não são JSON (avisos do programa) viram ("aviso", str)."""
    linha = linha.strip()
    if not linha:
        return []
    try:
        d = json.loads(linha)
    except ValueError:
        return [("aviso", linha)]
    eventos = []
    if d.get("session_id") and d.get("type") in ("system", "result"):
        eventos.append(("sessao", d["session_id"]))
    if d.get("type") == "assistant":
        for bloco in (d.get("message") or {}).get("content") or []:
            if bloco.get("type") == "text" and bloco.get("text", "").strip():
                eventos.append(("texto", bloco["text"]))
            elif bloco.get("type") == "tool_use":
                eventos.append(("ferramenta", _resumo_da_ferramenta(bloco.get("name", "?"), bloco.get("input"))))
    elif d.get("type") == "result":
        texto = d.get("result") or ""
        if not texto and d.get("errors"):
            texto = "; ".join(map(str, d["errors"]))
        eventos.append(("fim", texto, bool(d.get("is_error")) or d.get("subtype", "success") != "success"))
    return eventos


class ConversaClaude:
    """Uma conversa com o Claude Code em modo automático (claude -p), mantendo a sessão
    entre as mensagens. Cada mensagem roda um processo; o texto vai pela entrada padrão."""

    def __init__(self, argumentos, pasta=None):
        self._argumentos = argumentos      # função que devolve as opções da linha de comando
        self.pasta = pasta or CFG.CLAUDE_CODE_PASTA
        self.sessao = None
        self._proc = None
        self._parado = False
        self._trava = threading.Lock()

    @property
    def ocupado(self):
        return self._trava.locked()

    def nova(self):
        self.sessao = None

    def parar(self):
        proc = self._proc
        if proc and proc.poll() is None:
            self._parado = True
            proc.kill()

    def enviar(self, texto, ao_evento=None):
        """Manda a mensagem e espera a resposta final (chamando ao_evento no caminho)."""
        exe = localizar()
        if not exe:
            raise ClaudeCodeIndisponivel(
                "Claude Code não encontrado. Instale a extensão do Claude Code no VS Code "
                "ou ponha o caminho do claude.exe em CLAUDE_CODE_EXE no .env.")
        comando = [exe, "-p", "--output-format", "stream-json", "--verbose", *self._argumentos()]
        if self.sessao:
            comando += ["--resume", self.sessao]
        with self._trava:
            self._parado = False
            self._proc = proc = subprocess.Popen(
                comando, cwd=self.pasta, env=ambiente(), stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                encoding="utf-8", errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                proc.stdin.write(texto)
                proc.stdin.close()
                final, deu_erro, avisos = None, False, []
                for linha in proc.stdout:
                    for tipo, *valores in interpretar_evento(linha):
                        if tipo == "sessao":
                            self.sessao = valores[0]
                            continue
                        if tipo == "fim":
                            final, deu_erro = valores
                        elif tipo == "aviso":
                            avisos.append(valores[0])
                        if ao_evento:
                            ao_evento(tipo, *valores)
                proc.wait()
            finally:
                self._proc = None
        if self._parado:
            raise RuntimeError("interrompido")
        if proc.returncode and final is None:
            raise RuntimeError(" ".join(avisos)[-400:] or f"o Claude Code saiu com código {proc.returncode}")
        if deu_erro:
            raise RuntimeError(final or "o Claude Code não conseguiu responder")
        return final or ""


def argumentos_do_chat(permitir_comandos):
    """Opções da aba Claude: o agente completo, editando arquivos sem pedir confirmação
    (não há como confirmar no modo automático). Comandos no terminal (Bash) só com o
    botão "Permitir comandos" ligado."""
    def argumentos():
        liberadas = ["WebSearch", "WebFetch"] + (["Bash"] if permitir_comandos() else [])
        return ["--permission-mode", "acceptEdits",
                "--append-system-prompt",
                "O usuário fala com você pela aba Claude da interface do J.A.R.V.I.S., o "
                "assistente pessoal dele. Responda em português do Brasil.",
                "--allowedTools", *liberadas]
    return argumentos


PERSONA = """Você é J.A.R.V.I.S., o assistente pessoal de {nome}. Mordomo digital: formal, \
leal, calmo, com humor seco e elegante, sem bajulação. Chama o usuário de "{tratamento}".

Suas respostas são FALADAS em voz alta: português do Brasil, 1 a 3 frases curtas, sem \
markdown, listas, emojis ou links. Números e horários escritos como se fala.

Cada mensagem começa com a data e a hora atuais entre colchetes; não repita os colchetes.
Você responde perguntas e conversa. Os comandos do PC (abrir programas, volume, música, \
clima, agenda) são tratados antes de chegarem a você; se ainda assim pedirem um, diga que \
não entendeu o comando e sugira dizer, por exemplo, "abre o Chrome" ou "volume em 30". \
Use a busca na web só quando a pergunta depender de fatos recentes."""


class CerebroClaudeCode:
    """Perguntas livres por voz, pelo Claude Code, com a personalidade do Jarvis. Usa um
    prompt de sistema próprio, sem ferramentas de programação e sem conectores, o que deixa
    a resposta em uns 5 segundos."""

    def __init__(self):
        persona = PERSONA.format(nome=CFG.NOME, tratamento=CFG.TRATAMENTO)
        self.conversa = ConversaClaude(lambda: [
            "--model", CFG.CLAUDE_CODE_MODELO, "--system-prompt", persona,
            "--tools", "WebSearch", "--allowedTools", "WebSearch",
            "--strict-mcp-config", "--setting-sources", "",
        ])

    def responder(self, texto):
        from core.cerebro import agora_por_extenso
        return self.conversa.enviar(f"[{agora_por_extenso()}] {texto}")

    def esquecer(self):
        self.conversa.nova()

    def parar(self):
        self.conversa.parar()


def resumo_falado(texto, limite=350):
    """A resposta do agente pode ser longa e ter código: fala só o começo."""
    texto = re.sub(r"```.*?```", " ", texto or "", flags=re.S)
    texto = re.sub(r"\s+", " ", re.sub(r"[*_#`>|]", "", texto)).strip()
    if len(texto) <= limite:
        return texto
    frases = re.split(r"(?<=[.!?])\s+", texto)
    curto = ""
    for frase in frases:
        if len(curto) + len(frase) > limite:
            break
        curto += frase + " "
    curto = curto.strip() or texto[:limite].rsplit(" ", 1)[0] + "…"
    return f"{curto} Os detalhes estão na aba Claude."
