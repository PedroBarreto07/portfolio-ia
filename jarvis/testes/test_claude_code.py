"""Testes da integração com o Claude Code, sem rodar o Claude Code de verdade."""
import json
import os
import unittest
from unittest import mock

from config import CFG
from core import claude_code as cc
from core.jarvis import Jarvis
from core.modo_local import ModoLocal, interpretar


def linha(**d):
    return json.dumps(d) + "\n"


class TestEventos(unittest.TestCase):
    def test_stream_json(self):
        self.assertEqual(cc.interpretar_evento(linha(type="system", subtype="init", session_id="s1")),
                         [("sessao", "s1")])
        msg = {"content": [{"type": "text", "text": "Vou ler."},
                           {"type": "tool_use", "name": "Read", "input": {"file_path": "C:/a.py"}}]}
        self.assertEqual(cc.interpretar_evento(linha(type="assistant", message=msg)),
                         [("texto", "Vou ler."), ("ferramenta", "Read C:/a.py")])
        self.assertEqual(cc.interpretar_evento(linha(type="result", subtype="success", result="Pronto.",
                                                     is_error=False, session_id="s1")),
                         [("sessao", "s1"), ("fim", "Pronto.", False)])
        self.assertEqual(cc.interpretar_evento(linha(type="result", subtype="error_max_turns", is_error=True,
                                                     errors=["limite"])), [("fim", "limite", True)])
        self.assertEqual(cc.interpretar_evento("aviso solto\n"), [("aviso", "aviso solto")])
        self.assertEqual(cc.interpretar_evento("\n"), [])

    def test_ambiente_sem_chave_da_api(self):
        falso = {"ANTHROPIC_API_KEY": "sk-x", "CLAUDECODE": "1", "CLAUDE_CODE_SESSION_ID": "x",
                 "CLAUDE_CODE_GIT_BASH_PATH": "C:/bash.exe", "PATH": "C:/Windows"}
        with mock.patch.dict(os.environ, falso, clear=True):
            self.assertEqual(cc.ambiente(), {"CLAUDE_CODE_GIT_BASH_PATH": "C:/bash.exe", "PATH": "C:/Windows"})

    def test_resumo_falado(self):
        self.assertEqual(cc.resumo_falado("Criei o **arquivo** `a.py`."), "Criei o arquivo a.py.")
        longo = "Primeira frase. " * 40 + "```python\nprint(1)\n```"
        resumo = cc.resumo_falado(longo)
        self.assertLess(len(resumo), 420)
        self.assertTrue(resumo.endswith("Os detalhes estão na aba Claude."))
        self.assertNotIn("print", resumo)

    def test_localizar_pega_a_versao_mais_nova(self):
        caminhos = [r"C:\u\.vscode\extensions\anthropic.claude-code-2.1.9-win32-x64\resources\native-binary\claude.exe",
                    r"C:\u\.vscode\extensions\anthropic.claude-code-2.1.299-win32-x64\resources\native-binary\claude.exe"]
        with mock.patch.object(CFG, "CLAUDE_CODE_EXE", ""), mock.patch("shutil.which", return_value=None), \
                mock.patch("glob.glob", return_value=caminhos):
            self.assertIn("2.1.299", cc.localizar())


class TestPedidos(unittest.TestCase):
    def test_pergunta_pro_claude(self):
        casos = {
            "Pergunta pro Claude quantos arquivos tem na pasta": "quantos arquivos tem na pasta",
            "Jarvis, pede para o Claude criar um script de backup": "criar um script de backup",
            "Fala pro Cláudio que o teste passou": "o teste passou",
        }
        for texto, pedido in casos.items():
            with self.subTest(texto=texto):
                self.assertEqual(interpretar(texto), ("claude", {"pedido": pedido}))

    def test_a_musica_sai_da_busca(self):
        self.assertEqual(interpretar("Tocar a música Você e Eu", {"Spotify": True}),
                         ("tocar_musica", {"busca": "Você e Eu", "tipo": "track"}))


class ConversaFalsa:
    def __init__(self, resposta="", erro=None):
        self.resposta, self.erro, self.pedidos = resposta, erro, []
        self.ocupado = False

    def enviar(self, texto, ao_evento=None):
        self.pedidos.append(texto)
        if self.erro:
            raise self.erro
        if ao_evento:
            ao_evento("ferramenta", "Glob *.py")
            ao_evento("texto", self.resposta)
        return self.resposta

    def responder(self, texto):
        return self.enviar(texto)


class UIFalsa:
    def __init__(self):
        self.eventos = []

    def enviar(self, metodo, *args):
        self.eventos.append((metodo, args))


class TestRotas(unittest.TestCase):
    def criar(self):
        CFG.CEREBRO = "auto"
        j = Jarvis(UIFalsa(), com_voz=False, com_microfone=False)
        j.local = ModoLocal({})
        return j

    def test_pergunta_livre_vai_para_o_cerebro_claude_code(self):
        j = self.criar()
        j.cerebro_cc = ConversaFalsa("Às ordens, senhor. Aqui vai a piada.")
        self.assertEqual(j._responder("me conta uma piada"), "Às ordens, senhor. Aqui vai a piada.")
        self.assertRegex(j._responder("que horas são?"), r"^(São|É) ")   # comando continua local
        self.assertEqual(len(j.cerebro_cc.pedidos), 1)

    def test_cerebro_claude_code_falhando_cai_no_modo_local(self):
        j = self.criar()
        j.cerebro_cc = ConversaFalsa(erro=RuntimeError("limite de uso"))
        self.assertIn("cérebro principal", j._responder("me conta uma piada"))

    def test_pergunta_pro_claude_vai_para_a_aba(self):
        j = self.criar()
        j.claude_chat = ConversaFalsa("Encontrei 3 arquivos.")
        self.assertEqual(j._responder("pergunta pro Claude quantos arquivos .py tem"), "Encontrei 3 arquivos.")
        self.assertEqual(j.claude_chat.pedidos, ["quantos arquivos .py tem"])
        enviados = [a[0] for m, a in j.ui.eventos if m == "claude"]
        self.assertEqual([e["tipo"] for e in enviados], ["voce", "ocupado", "ferramenta", "texto", "ocupado"])
        self.assertIn(("aba", ("claude",)), j.ui.eventos)


if __name__ == "__main__":
    unittest.main()
