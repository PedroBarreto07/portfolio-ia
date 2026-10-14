"""Testes do modo local (comandos sem IA): só a interpretação, nada é executado no PC."""
import datetime
import json
import unittest

from core.modo_local import _hora_falada, falar_agenda, falar_clima, interpretar

TUDO = {"Google": True, "Spotify": True}


class TestInterpretar(unittest.TestCase):
    def confere(self, casos, modulos=TUDO):
        for texto, esperado in casos:
            with self.subTest(texto=texto):
                self.assertEqual(interpretar(texto, modulos), esperado)

    def test_abrir(self):
        self.confere([
            ("Abre o VS Code.", ("abrir", {"alvo": "VS Code"})),
            ("abra as configurações", ("abrir", {"alvo": "configurações"})),
            ("Abre o YouTube pra mim", ("abrir", {"alvo": "YouTube"})),
        ])

    def test_pesquisar(self):
        self.confere([
            ("Pesquisa no YouTube tutorial de Moodle",
             ("pesquisar", {"consulta": "tutorial de Moodle", "onde": "youtube"})),
            ("Pesquisa receita de pão de queijo",
             ("pesquisar", {"consulta": "receita de pão de queijo", "onde": "google"})),
            ("procura sobre Python no Google", ("pesquisar", {"consulta": "Python", "onde": "google"})),
        ])

    def test_volume(self):
        self.confere([
            ("Volume em 30", ("volume", {"nivel": 30})),
            ("coloca o volume no máximo", ("volume", {"nivel": 100})),
            ("Aumenta o volume", ("volume", {"acao": "aumentar"})),
            ("abaixa o som", ("volume", {"acao": "diminuir"})),
            ("Muta o som", ("volume", {"acao": "mutar"})),
            ("tira do mudo", ("volume", {"acao": "desmutar"})),
            ("liga o som", ("volume", {"acao": "desmutar"})),
        ])

    def test_midia(self):
        self.confere([
            ("Pausa a música.", ("midia", {"comando": "tocar_pausar"})),
            ("continua", ("midia", {"comando": "tocar_pausar"})),
            ("Próxima música", ("midia", {"comando": "proxima"})),
            ("volta a música", ("midia", {"comando": "anterior"})),
        ])

    def test_musica(self):
        self.confere([
            ("Toca Arctic Monkeys no Spotify", ("tocar_musica", {"busca": "Arctic Monkeys", "tipo": "track"})),
            ("Toca Do I Wanna Know", ("tocar_musica", {"busca": "Do I Wanna Know", "tipo": "track"})),
            ("Toca a playlist lo-fi para estudar",
             ("tocar_musica", {"busca": "lo-fi para estudar", "tipo": "playlist"})),
            ("Coloca o álbum AM", ("tocar_musica", {"busca": "AM", "tipo": "album"})),
            ("Toca músicas do Legião Urbana", ("tocar_musica", {"busca": "Legião Urbana", "tipo": "artist"})),
            ("Toca a banda Queen", ("tocar_musica", {"busca": "Queen", "tipo": "artist"})),
            ("Que música é essa?", ("musica_atual", {})),
        ])
        # sem Spotify, a música vai para o YouTube
        self.assertEqual(interpretar("Toca Arctic Monkeys", {}),
                         ("tocar_no_youtube", {"busca": "Arctic Monkeys"}))

    def test_informacoes(self):
        self.confere([
            ("Que horas são?", ("hora", {})),
            ("Que dia é hoje?", ("data", {})),
            ("Bom dia", ("briefing", {})),
            ("Como está o clima?", ("clima", {"cidade": None, "quando": 0})),
            ("Vai chover amanhã em São Paulo?", ("clima", {"cidade": "São Paulo", "quando": 1})),
            ("Como está o tempo em Brasília hoje?", ("clima", {"cidade": "Brasília", "quando": 0})),
            ("previsão do tempo para amanhã", ("clima", {"cidade": None, "quando": 1})),
            ("Vai fazer frio na semana que vem?", ("clima", {"cidade": None, "quando": "semana"})),
            ("Quais as notícias de tecnologia?", ("noticias", {"tema": "tecnologia"})),
            ("principais notícias de hoje", ("noticias", {"tema": None})),
            ("Como está o sistema?", ("status", {})),
            ("Tira um print", ("print", {})),
            ("Bloqueia o PC", ("bloquear", {})),
        ])

    def test_google(self):
        self.confere([
            ("O que tenho na agenda essa semana?", ("agenda", {"quando": "semana"})),
            ("Tenho e-mails não lidos?", ("emails", {})),
            ("Marca reunião de estudo amanhã às 15h", ("criar_compromisso", {})),
        ])
        self.assertEqual(interpretar("O que tenho na agenda hoje?", {}), ("sem_google", {}))

    def test_palavras_antes_do_comando(self):
        # o Whisper às vezes põe palavras antes do verbo ou erra o nome do Jarvis
        self.confere([
            ("Pode tocar Queen?", ("tocar_musica", {"busca": "Queen", "tipo": "track"})),
            ("Já vi, toca Do I Wanna Know.", ("tocar_musica", {"busca": "Do I Wanna Know", "tipo": "track"})),
            ("Eu quero ouvir Legião Urbana", ("tocar_musica", {"busca": "Legião Urbana", "tipo": "track"})),
            ("Coloca pra tocar Queen", ("tocar_musica", {"busca": "Queen", "tipo": "track"})),
            ("Toca aí a playlist lo-fi", ("tocar_musica", {"busca": "lo-fi", "tipo": "playlist"})),
            ("Você pode abrir o Spotify?", ("abrir", {"alvo": "Spotify"})),
            ("Abro o Spotify.", ("abrir", {"alvo": "Spotify"})),
            ("Pode pausar a música?", ("midia", {"comando": "tocar_pausar"})),
            ("Dá pra pular essa música?", ("midia", {"comando": "proxima"})),
        ])

    def test_nao_confunde(self):
        self.confere([
            ("continua chovendo lá fora?", ("clima", {"cidade": None, "quando": 0})),
            ("a chuva continua?", ("clima", {"cidade": None, "quando": 0})),
            ("me explica a teoria da relatividade", ("desconhecido", {})),
            ("", ("desconhecido", {})),
            ("Obrigado", ("conversa", {"tipo": "obrigado"})),
        ])


class TestFalas(unittest.TestCase):
    def test_hora(self):
        self.assertEqual(_hora_falada(datetime.datetime(2026, 1, 1, 15, 42)), "São 15 horas e 42 minutos")
        self.assertEqual(_hora_falada(datetime.datetime(2026, 1, 1, 12, 0)), "É meio-dia")
        self.assertEqual(_hora_falada(datetime.datetime(2026, 1, 1, 1, 1)), "É 1 hora e 1 minuto")

    def test_clima(self):
        dados = json.dumps({
            "local": "Brasília, Distrito Federal, Brasil",
            "agora": {"temperatura_c": 29.7, "sensacao_c": 30.4, "umidade_pct": 38,
                      "vento_kmh": 3.6, "condicao": "céu limpo"},
            "previsao": [
                {"data": "2026-10-13", "min_c": 18.2, "max_c": 31.0, "chance_chuva_pct": 5, "condicao": "céu limpo"},
                {"data": "2026-10-14", "min_c": 19.0, "max_c": 28.4, "chance_chuva_pct": 70, "condicao": "chuva"},
            ],
        })
        self.assertEqual(falar_clima(dados), "Agora em Brasília: 30 graus, sensação de 30, céu limpo. "
                         "Hoje a mínima é de 18 e a máxima de 31 graus, com 5% de chance de chuva.")
        self.assertIn("Amanhã em Brasília: chuva", falar_clima(dados, 1))

    def test_agenda(self):
        eventos = json.dumps([{"titulo": "Reunião", "inicio": "2026-10-13T15:00:00-03:00",
                               "dia_inteiro": False, "local": ""}])
        self.assertIn("1 compromisso: Reunião, às 15:00", falar_agenda(eventos, 0))
        self.assertIn("Nenhum compromisso amanhã", falar_agenda("Nenhum compromisso nesse período.", 1))


if __name__ == "__main__":
    unittest.main()
