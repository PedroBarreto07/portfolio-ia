"""Testes da palavra de ativação: python -m unittest discover -s testes"""
import unittest

from core.ativacao import eh_ativacao, separar_ativacao, tirar_palavra_ativacao


class TestSepararAtivacao(unittest.TestCase):
    def test_nome_com_comando(self):
        self.assertEqual(separar_ativacao("Jarvis, abre o Chrome."), (True, "abre o Chrome."))

    def test_nome_sozinho(self):
        for texto in ("Jarvis.", "Jarvis!", " jarvis ", "Ei, Jarvis?", "Hey Jarvis"):
            with self.subTest(texto=texto):
                self.assertEqual(separar_ativacao(texto), (True, ""))

    def test_jeitos_que_o_whisper_escreve(self):
        for texto in ("Járvis, que horas são?", "Jarves que horas são?", "Jarbas, que horas são?",
                      "Javis, que horas são?", "Jar vis, que horas são?", "Djarvis que horas são?"):
            with self.subTest(texto=texto):
                achou, resto = separar_ativacao(texto)
                self.assertTrue(achou)
                self.assertEqual(resto, "que horas são?")

    def test_saudacao_antes_vira_comando(self):
        self.assertEqual(separar_ativacao("Bom dia, Jarvis"), (True, "Bom dia"))
        self.assertEqual(separar_ativacao("Bom dia Jarvis, como está o tempo?"),
                         (True, "Bom dia, como está o tempo?"))

    def test_sem_nome_nao_ativa(self):
        for texto in ("Abre o Chrome", "Já vi esse filme", "O Travis Scott lançou um disco novo",
                      "chaves", "", "jar"):
            with self.subTest(texto=texto):
                self.assertFalse(separar_ativacao(texto)[0])

    def test_nome_no_meio_de_frase_longa_nao_ativa(self):
        self.assertFalse(separar_ativacao("ontem eu vi um filme e o Jarvis aparecia")[0])

    def test_outra_palavra(self):
        self.assertEqual(separar_ativacao("Sexta, liga a luz", alvo="sexta"), (True, "liga a luz"))
        self.assertFalse(separar_ativacao("Jarvis, liga a luz", alvo="sexta")[0])

    def test_tirar_palavra(self):
        self.assertEqual(tirar_palavra_ativacao("Jarvis, toca Arctic Monkeys"), "toca Arctic Monkeys")
        self.assertEqual(tirar_palavra_ativacao("toca Arctic Monkeys"), "toca Arctic Monkeys")

    def test_eh_ativacao(self):
        self.assertTrue(eh_ativacao("JARVIS"))
        self.assertFalse(eh_ativacao("javali"))
        self.assertFalse(eh_ativacao("marvin"))


if __name__ == "__main__":
    unittest.main()
