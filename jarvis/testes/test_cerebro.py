"""Testes do cérebro e da troca para o modo local, com uma API falsa (não gasta créditos)."""
import unittest
from types import SimpleNamespace

import anthropic

import skills.pc  # noqa: F401  registra as ferramentas do PC
from config import CFG
from core import cerebro as cer
from core.jarvis import Jarvis, motivo_indisponivel
from core.modo_local import ModoLocal


def texto(t):
    return SimpleNamespace(type="text", text=t)


def raciocinio():
    return SimpleNamespace(type="thinking", thinking="", signature="assinatura")


def resposta(*blocos, parada="end_turn"):
    return SimpleNamespace(stop_reason=parada, content=list(blocos))


class ClienteFalso:
    """Imita client.beta.messages.create devolvendo as respostas na ordem."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.pedidos = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._criar))

    def _criar(self, **pedido):
        self.pedidos.append({**pedido, "messages": list(pedido["messages"])})
        resp = self.respostas.pop(0)
        if isinstance(resp, Exception):
            raise resp
        return resp


def erro_sem_credito():
    erro = anthropic.BadRequestError.__new__(anthropic.BadRequestError)
    Exception.__init__(erro, "Your credit balance is too low to access the Anthropic API.")
    return erro


class TestCerebro(unittest.TestCase):
    def setUp(self):
        CFG.MODELO, CFG.ESFORCO = "claude-sonnet-5-5", "low"

    def test_prompt_fixo_e_hora_na_mensagem(self):
        cliente = ClienteFalso(resposta(raciocinio(), texto("Olá.")), resposta(texto("Certo.")))
        c = cer.Cerebro({"PC": True}, cliente=cliente)
        self.assertEqual(c.responder("oi"), "Olá.")
        c.responder("e agora?")
        p1, p2 = cliente.pedidos
        self.assertEqual(p1["system"], p2["system"])
        self.assertNotRegex(p1["system"], r"\d{2}:\d{2}")
        self.assertRegex(p2["messages"][-1]["content"], r"^\[.+\d{2}:\d{2}\] e agora\?$")
        # o raciocínio da 1ª resposta volta intacto no 2º pedido
        self.assertEqual(p2["messages"][1]["content"][0].type, "thinking")

    def test_parametros_do_pedido(self):
        cliente = ClienteFalso(resposta(texto("a")), resposta(texto("b")))
        cer.Cerebro({}, cliente=cliente).responder("x")
        pedido = cliente.pedidos[0]
        self.assertEqual(pedido["output_config"], {"effort": "low"})
        self.assertEqual(pedido["fallbacks"], "default")
        self.assertEqual(pedido["betas"], ["server-side-fallback-2026-07-01"])
        CFG.MODELO = "claude-haiku-5-5"   # Haiku não tem fallback no servidor
        cer.Cerebro({}, cliente=cliente).responder("x")
        self.assertNotIn("fallbacks", cliente.pedidos[1])

    def test_ferramenta(self):
        uso = SimpleNamespace(type="tool_use", id="t1", name="status_do_sistema", input={})
        cliente = ClienteFalso(resposta(raciocinio(), uso, parada="tool_use"),
                               resposta(texto("CPU tranquila.")))
        vistas = []
        c = cer.Cerebro({}, cliente=cliente)
        self.assertEqual(c.responder("como está o PC?", vistas.append), "CPU tranquila.")
        self.assertEqual(vistas, ["status_do_sistema"])
        resultado = cliente.pedidos[1]["messages"][-1]["content"][0]
        self.assertEqual(resultado["tool_use_id"], "t1")
        self.assertIn("cpu", resultado["content"])

    def test_corte_do_historico_tira_o_raciocinio(self):
        c = cer.Cerebro({}, cliente=ClienteFalso())
        for i in range(cer.MAX_MENSAGENS // 2 + 1):
            c.historico += [{"role": "user", "content": f"pergunta {i}"},
                            {"role": "assistant", "content": [raciocinio(), texto(f"resposta {i}")]}]
        c._aparar_historico()
        self.assertLessEqual(len(c.historico), cer.MANTER_MENSAGENS)
        self.assertEqual(c.historico[0]["role"], "user")
        for msg in c.historico:
            if msg["role"] == "assistant":
                self.assertEqual([b.type for b in msg["content"]], ["text"])

    def test_recusa_e_resposta_vazia_nao_ficam_no_historico(self):
        cliente = ClienteFalso(resposta(parada="refusal"), resposta())
        c = cer.Cerebro({}, cliente=cliente)
        self.assertIn("não posso ajudar", c.responder("algo proibido"))
        self.assertEqual(c.historico, [])
        self.assertTrue(c.responder("oi"))   # resposta vazia: devolve "Feito" e não guarda nada vazio
        self.assertEqual([m["role"] for m in c.historico], ["user"])

    def test_erro_desfaz_a_rodada(self):
        c = cer.Cerebro({}, cliente=ClienteFalso(erro_sem_credito()))
        with self.assertRaises(anthropic.BadRequestError):
            c.responder("oi")
        self.assertEqual(c.historico, [])


class UIFalsa:
    def __init__(self):
        self.eventos = []

    def enviar(self, metodo, *args):
        self.eventos.append((metodo, args))


class TestTrocaParaModoLocal(unittest.TestCase):
    def setUp(self):
        CFG.CEREBRO = "auto"

    def criar(self, *respostas):
        j = Jarvis(UIFalsa(), com_voz=False, com_microfone=False)
        j.cerebro = cer.Cerebro({}, cliente=ClienteFalso(*respostas))
        j.local = ModoLocal({})
        j._mods_ui = {"Claude API": True}
        return j

    def test_sem_credito_usa_modo_local(self):
        self.assertEqual(motivo_indisponivel(erro_sem_credito()), "sem créditos na conta da Anthropic")
        j = self.criar(erro_sem_credito(), erro_sem_credito())
        self.assertRegex(j._responder("Que horas são?"), r"^(São|É) ")
        self.assertIn("sem créditos", j._responder("me explica a relatividade"))
        avisos = [a for m, a in j.ui.eventos if m == "aviso"]
        self.assertEqual(len(avisos), 1)   # avisa uma vez só
        self.assertFalse(j._mods_ui["Claude API"])

    def test_modo_claude_nao_troca(self):
        CFG.CEREBRO = "claude"
        j = self.criar(erro_sem_credito())
        self.assertIn("sem créditos na API", j._responder("Que horas são?"))
        CFG.CEREBRO = "auto"


if __name__ == "__main__":
    unittest.main()
