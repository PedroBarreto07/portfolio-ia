"""Modo local: entende comandos básicos sem IA, direto no PC e sem custo.

Entra quando o Claude não está disponível (sem créditos, sem chave ou sem internet) ou
quando JARVIS_CEREBRO=local. Não conversa livremente: reconhece frases comuns
("abre o Chrome", "volume em 30", "vai chover amanhã?") e chama as mesmas habilidades
que o Claude usaria. Clima e notícias ainda usam a internet (serviços gratuitos, sem
chave); o resto funciona totalmente offline.

interpretar() só decide o que fazer (dá para testar sem tocar no PC); ModoLocal executa.
"""
import datetime
import json
import re
import unicodedata

from config import CFG
from core.cerebro import DIAS, MESES

SITES = {
    "youtube": "https://www.youtube.com", "google": "https://www.google.com",
    "gmail": "https://mail.google.com", "google agenda": "https://calendar.google.com",
    "google drive": "https://drive.google.com", "drive": "https://drive.google.com",
    "github": "https://github.com", "netflix": "https://www.netflix.com",
    "instagram": "https://www.instagram.com", "facebook": "https://www.facebook.com",
    "linkedin": "https://www.linkedin.com", "twitter": "https://x.com",
    "whatsapp web": "https://web.whatsapp.com", "claude": "https://claude.ai",
}

_ABRIR = re.compile(
    r"(?:abre|abra|abrir|abri|abro|inicia|inicie|iniciar|executa|execute|executar"
    r"|entra|entre|entrar)(?: (?:o|a|os|as|no|na|um|uma|meu|minha))? (.+)")
_PESQUISAR = r"(?:pesquisa|pesquise|pesquisar|procura|procure|procurar|busca|busque|buscar)"
_PESQUISAR_ONDE = re.compile(_PESQUISAR + r" (?:no|na) (youtube|google) (?:por |sobre )?(.+)")
_PESQUISAR_ALGO = re.compile(_PESQUISAR + r" (?:por |sobre )?(.+?)(?: (?:no|na) (youtube|google))?")
_TOCAR = re.compile(
    r"(?:toca|tocar|toque|coloca|coloque|bota|poe|ponha|ouvir|escutar)"
    r"(?: (?:pra tocar|para tocar|pra mim|para mim|ai|agora))*(?: (?:a|o|uma|um))?"
    r"(?: (?:musica|cancao|faixa))? (.+?)"
    r"(?: (?:no|na) (spotify|youtube))?")
# "pergunta pro Claude ..." (o Whisper também escreve Claud, Cláudio, Clode, Cloud)
_CLAUDE = re.compile(
    r"\b(?:pergunta|pergunte|perguntar|fala|fale|diz|diga|manda|mande|pede|peca|pedir|conta|conte)"
    r" (?:pro|pra|para o|para|ao|a|o) (?:claude|claud|claudio|clode|cloud)\b(?: (?:que|se|sobre))? (.+)")
_CRIAR_EVENTO = re.compile(
    r"(?:marca|marcar|marque|agenda|agendar|agende|cria|criar|crie|adiciona|adicionar"
    r"|anota|anotar)\b.*\b(?:reuniao|compromisso|evento|consulta|lembrete|aula|na agenda"
    r"|no calendario)\b")
# palavras que o Whisper costuma pôr antes do comando ("pode pausar?", "dá pra tocar...")
_ENCHIMENTO = {"por", "favor", "pode", "poderia", "voce", "vc", "consegue", "da", "pra", "para",
               "me", "eu", "quero", "queria", "gostaria", "de", "agora", "ai", "ok", "entao", "jarvis"}
# "toca a playlist X" / "toca o álbum X" / "toca músicas do X" -> tipo de busca no Spotify
_TIPO_MUSICA = [
    ("playlist", r"(?:a )?playlist (?:de |do |da )?"),
    ("album", r"(?:o )?(?:album|disco) (?:de |do |da )?"),
    ("artist", r"(?:(?:as )?(?:musicas|cancoes) (?:de|do|da|dos|das) |(?:o |a )?(?:artista|banda|cantor|cantora) )"),
]
_MIDIA = [
    ("proxima", r"(?:proxima|pula|pular|pule|avanca|avancar|passa|passar)"
                r"(?: (?:a|essa|esta|pra|para))?(?: (?:musica|faixa|cancao|proxima))?"),
    ("anterior", r"(?:volta|voltar|volte|anterior)(?: (?:a|pra|para))?"
                 r"(?: (?:musica|faixa|cancao)(?: anterior)?| anterior)?|musica anterior"),
    ("parar", r"(?:para|parar|pare) (?:a )?(?:musica|reproducao|de tocar)"),
    ("tocar_pausar", r"(?:pausa|pausar|pause|despausa|despausar|continua|continuar|continue"
                     r"|retoma|retomar|play|toca|tocar|solta)(?: (?:a|o))?"
                     r"(?: (?:musica|som|video|reproducao))?"),
]
_MIDIA = [(comando, re.compile(padrao)) for comando, padrao in _MIDIA]
_TEMPO_FINAL = re.compile(
    r"(?: (?:hoje|amanha|agora|depois de amanha|essa semana|esta semana|nesta semana"
    r"|nessa semana|semana que vem|na semana|de manha|a tarde|a noite|nos proximos dias"
    r"|no fim de semana|neste fim de semana|no momento|por favor))+$")
_NAO_E_LUGAR = {"", "hoje", "amanha", "agora", "momento", "semana", "semana que vem",
                "fim de semana", "proximos dias", "geral", "dia", "mundo", "tempo"}


class _Frase:
    """A frase em minúsculas, sem acento e sem pontuação (para reconhecer o comando),
    sabendo devolver o trecho original: o que vai para a busca ou para o clima
    mantém os acentos ("São Paulo", "Goiânia")."""

    def __init__(self, texto):
        self.texto = texto or ""
        pares = []
        for i, c in enumerate(self.texto):
            for x in unicodedata.normalize("NFKD", c):
                if unicodedata.combining(x):
                    continue
                x = x.lower() if x.isalnum() else " "
                if x == " " and (not pares or pares[-1][0] == " "):
                    continue
                pares.append((x, i))
        if pares and pares[-1][0] == " ":
            pares.pop()
        self.n = "".join(x for x, _ in pares)
        self._origem = [i for _, i in pares]

    def original(self, ini, fim):
        if ini >= fim:
            return ""
        return self.texto[self._origem[ini]:self._origem[fim - 1] + 1].strip(" .,;:!?")


def _depois(f, pos, prep, excluir=_NAO_E_LUGAR):
    """Trecho depois de uma preposição ("em São Paulo amanhã" -> "São Paulo")."""
    m = re.compile(r"(?: (?:hoje|amanha|agora))? (?:" + prep + r") (.+)").match(f.n, pos)
    if not m:
        return None
    nome = _TEMPO_FINAL.sub("", m.group(1))
    if nome in excluir:
        return None
    return f.original(m.start(1), m.start(1) + len(nome))


def _inicios(n, max_pular=3):
    """Onde o comando pode começar. O Whisper às vezes põe palavras antes do verbo:
    "pode tocar...", "você pode abrir...", ou o nome do Jarvis mal escrito ("Já vi, toca...")."""
    return ([0] + [i + 1 for i, c in enumerate(n) if c == " "])[:max_pular + 1]


def _inicios_enchimento(n):
    """Como _inicios, mas só pula palavras de enchimento. Usado nos comandos de mídia,
    que são palavras comuns ("a chuva continua?" não pode pausar a música)."""
    pos = 0
    yield pos
    for palavra in n.split(" "):
        if palavra not in _ENCHIMENTO:
            return
        pos += len(palavra) + 1
        yield pos


def _quando(n):
    if "depois de amanha" in n:
        return 2
    if "amanha" in n:
        return 1
    if re.search(r"\b(semana|proximos dias)\b", n):
        return "semana"
    return 0


def interpretar(texto, modulos=None):
    """Devolve (acao, argumentos) para um comando falado ou digitado."""
    modulos = modulos or {}
    f = _Frase(texto)
    n = f.n

    def tem(padrao):
        return re.search(padrao, n)

    if not n:
        return "desconhecido", {}
    m = _CLAUDE.search(n)
    if m:
        return "claude", {"pedido": f.original(*m.span(1))}
    if tem(r"\b(ajuda|o que (voce )?(sabe|consegue|pode) fazer|quais (sao )?(os )?(seus )?comandos)\b"):
        return "ajuda", {}

    # volume
    if tem(r"\b(volume|som|audio)\b") or tem(r"\b(mais alto|mais baixo|muta|mutar|mute|mudo|desmuta|desmutar)\b"):
        if tem(r"\b(desmuta|desmutar|desmute)\b|\b(volta|ativa|liga|devolve) o (som|audio)\b|\btira do mudo\b"):
            return "volume", {"acao": "desmutar"}
        if tem(r"\b(muta|mutar|mute|mudo|silencia|silenciar)\b|\b(tira|corta|desliga) o (som|audio)\b"):
            return "volume", {"acao": "mutar"}
        if tem(r"\b(aumenta|aumentar|aumente|sobe|subir|suba)\b|\bmais alto\b"):
            return "volume", {"acao": "aumentar"}
        if tem(r"\b(abaixa|abaixar|abaixe|baixa|baixar|diminui|diminuir|diminua|reduz|reduzir)\b|\bmais baixo\b"):
            return "volume", {"acao": "diminuir"}
        if tem(r"\bvolume\b"):
            if tem(r"\bmaximo\b"):
                return "volume", {"nivel": 100}
            if tem(r"\bmetade\b"):
                return "volume", {"nivel": 50}
            if tem(r"\bminimo\b"):
                return "volume", {"nivel": 10}
            numero = tem(r"\b(\d{1,3})\b")
            if numero:
                return "volume", {"nivel": min(100, int(numero.group(1)))}

    # mídia (frases curtas e exatas, para "continua chovendo?" não pausar a música)
    for pos in _inicios_enchimento(n):
        for comando, padrao in _MIDIA:
            if padrao.fullmatch(n, pos):
                return "midia", {"comando": comando}

    for pos in _inicios(n):
        m = _ABRIR.fullmatch(n, pos)
        if m:
            alvo = f.original(*m.span(1))
            alvo = re.sub(r"\s+(pra mim|para mim|por favor|a[ií])$", "", alvo, flags=re.I)
            return "abrir", {"alvo": alvo}
        m = _PESQUISAR_ONDE.fullmatch(n, pos)
        if m:
            return "pesquisar", {"consulta": f.original(*m.span(2)), "onde": m.group(1)}
        m = _PESQUISAR_ALGO.fullmatch(n, pos)
        if m:
            return "pesquisar", {"consulta": f.original(*m.span(1)), "onde": m.group(2) or "google"}

    if tem(r"\b(que|qual) (e )?(essa |a )?musica\b|\bo que (esta|ta) tocando\b|\bque som e esse\b"):
        return ("musica_atual", {}) if modulos.get("Spotify") else ("sem_spotify", {})
    for pos in _inicios(n):
        m = _TOCAR.fullmatch(n, pos)
        if not m:
            continue
        ini, fim = m.span(1)
        if m.group(2) == "youtube" or not modulos.get("Spotify"):
            return "tocar_no_youtube", {"busca": f.original(ini, fim)}
        tipo = "track"
        for nome, padrao in _TIPO_MUSICA:
            prefixo = re.match(padrao, n[ini:fim])
            if prefixo and prefixo.end() < fim - ini:
                tipo, ini = nome, ini + prefixo.end()
                break
        return "tocar_musica", {"busca": f.original(ini, fim), "tipo": tipo}

    if tem(r"\b(briefing|bom dia|resumo do dia|me atualiza)\b"):
        return "briefing", {}
    if tem(r"\b(que horas|horas sao|que hora e|hora atual|hora certa|(diz|fala|diga) a hora)\b"):
        return "hora", {}
    if tem(r"\b(que dia (e )?hoje|hoje e que dia|qual (e )?a data|data de hoje|dia de hoje|em que dia estamos)\b"):
        return "data", {}

    if any(_CRIAR_EVENTO.match(n, pos) for pos in _inicios(n)):
        return "criar_compromisso", {}
    if tem(r"\b(agenda|compromissos?|reunia?o|reunioes|eventos?|calendario)\b|\btenho (algo|alguma coisa|algum compromisso)\b"):
        if not modulos.get("Google"):
            return "sem_google", {}
        return "agenda", {"quando": _quando(n)}
    if tem(r"\b(e mails?|emails?|caixa de entrada|gmail|mensagens? nao lidas?)\b"):
        return ("emails", {}) if modulos.get("Google") else ("sem_google", {})

    if tem(r"\b(print|printa|printar|printe|screenshot)\b|\bcaptura (de|da) tela\b"):
        return "print", {}
    if (tem(r"\b(bloqueia|bloquear|bloqueie|trava|travar|trave)\b")
            and tem(r"\b(pc|tela|computador|notebook|maquina|windows)\b")) or n in ("bloqueia", "bloquear"):
        return "bloquear", {}
    if tem(r"\b(status|sistema|cpu|processador|memoria|ram|bateria|desempenho|disco)\b"):
        return "status", {}

    m = None
    for m in re.finditer(r"\b(clima|tempo|previsao|temperatura|chover|chove|chuva|chovendo"
                         r"|calor|frio|graus|umidade|guarda chuva)\b", n):
        pass
    if m:
        return "clima", {"cidade": _depois(f, m.end(), "em|no|na|para|pra|de|do|da"),
                         "quando": _quando(n)}

    m = None
    for m in re.finditer(r"\b(noticias?|manchetes?|novidades)\b", n):
        pass
    if m:
        return "noticias", {"tema": _depois(f, m.end(), "sobre|de|do|da|dos|das|em|no|na")}

    if tem(r"\b(obrigad[oa]|brigad[oa]|valeu|agradeco)\b"):
        return "conversa", {"tipo": "obrigado"}
    if tem(r"\b(quem (e|eh) voce|seu nome|como voce se chama)\b"):
        return "conversa", {"tipo": "quem"}
    if tem(r"\b(tudo bem|tudo certo|como (voce )?(esta|vai)|beleza)\b"):
        return "conversa", {"tipo": "tudo_bem"}
    if re.match(r"(oi|ola|e ai|eai|opa|fala|boa tarde|boa noite|hey|ei)\b", n) and len(n.split()) <= 4:
        return "conversa", {"tipo": "oi"}

    return "desconhecido", {}


# --- jeito de falar os resultados ------------------------------------------------

def _hora_falada(agora):
    h, m = agora.hour, agora.minute
    if h == 0:
        base = "É meia-noite"
    elif h == 12 and m == 0:
        return "É meio-dia"
    elif h == 1:
        base = "É 1 hora"
    else:
        base = f"São {h} horas"
    return f"{base} e {m} minuto{'s' if m != 1 else ''}" if m else base


def _data_falada(dia):
    return f"{DIAS[dia.weekday()]}, {dia.day} de {MESES[dia.month - 1]} de {dia.year}"


def _r(valor):
    return round(valor) if isinstance(valor, (int, float)) else valor


def _chuva(chance):
    return "" if chance is None else f", com {chance}% de chance de chuva"


def falar_clima(dados_json, quando=0):
    d = json.loads(dados_json)
    local = d["local"].split(",")[0]
    previsao = d["previsao"]
    if quando == "semana":
        dias = []
        for p in previsao[1:6]:
            dia = DIAS[datetime.date.fromisoformat(p["data"]).weekday()].split("-")[0]
            dias.append(f"{dia}, {p['condicao']}, de {_r(p['min_c'])} a {_r(p['max_c'])} graus")
        return f"Próximos dias em {local}: " + "; ".join(dias) + "."
    if quando in (1, 2) and len(previsao) > quando:
        p = previsao[quando]
        nome = "Amanhã" if quando == 1 else "Depois de amanhã"
        return (f"{nome} em {local}: {p['condicao']}, mínima de {_r(p['min_c'])} e máxima de "
                f"{_r(p['max_c'])} graus{_chuva(p['chance_chuva_pct'])}.")
    a, hoje = d["agora"], previsao[0]
    return (f"Agora em {local}: {_r(a['temperatura_c'])} graus, sensação de "
            f"{_r(a['sensacao_c'])}, {a['condicao']}. Hoje a mínima é de {_r(hoje['min_c'])} "
            f"e a máxima de {_r(hoje['max_c'])} graus{_chuva(hoje['chance_chuva_pct'])}.")


def falar_noticias(resultado):
    if not resultado.startswith("["):
        return resultado
    itens = json.loads(resultado)
    frases = [f"{i['titulo']}, segundo {i['fonte']}." if i.get("fonte") else f"{i['titulo']}."
              for i in itens]
    return "Principais manchetes. " + " ".join(frases)


def falar_status(d):
    texto = f"Processador em {d['cpu']}%, memória em {d['ram']}% e disco em {d['disco']}%"
    if d.get("bateria") is not None:
        texto += f". Bateria em {d['bateria']}%{', carregando' if d.get('carregando') else ''}"
    return texto + "."


def falar_agenda(resultado, quando):
    rotulo = {0: "hoje", 1: "amanhã", "semana": "nos próximos sete dias"}.get(quando, "")
    if not resultado.startswith("["):
        return f"Nenhum compromisso {rotulo}, {CFG.TRATAMENTO}."
    eventos = json.loads(resultado)
    partes = []
    for ev in eventos:
        inicio = datetime.datetime.fromisoformat(ev["inicio"])
        hora = "o dia todo" if ev["dia_inteiro"] else f"às {inicio:%H:%M}"
        dia = f"{DIAS[inicio.weekday()].split('-')[0]} " if quando == "semana" else ""
        partes.append(f"{ev['titulo']}, {dia}{hora}")
    n = len(eventos)
    return (f"{rotulo.capitalize()} o {CFG.TRATAMENTO} tem {n} compromisso{'s' if n > 1 else ''}: "
            + "; ".join(partes) + ".")


def falar_emails(resultado):
    if not resultado.startswith("{"):
        return f"Nenhum e-mail não lido, {CFG.TRATAMENTO}."
    d = json.loads(resultado)
    frases = []
    for e in d["emails"][:3]:
        nome = e["de"].split("<")[0].strip().strip('"') or e["de"]
        frases.append(f"De {nome}: {e['assunto']}.")
    return f"Há cerca de {d['total_aproximado']} e-mails não lidos. " + " ".join(frases)


# --- execução ------------------------------------------------------------------------

class ModoLocal:
    def __init__(self, modulos):
        self.modulos = modulos
        self.motivo = None   # por que o Claude não está disponível (para explicar ao usuário)

    def responder(self, texto, ao_usar_ferramenta=None):
        acao, args = interpretar(texto, self.modulos)
        print(f"[Modo local] ouvi {texto!r} -> {acao} {args or ''}")
        self._ferramenta = ao_usar_ferramenta or (lambda _n: None)
        try:
            return getattr(self, f"_{acao}")(**args)
        except Exception as erro:  # noqa: BLE001
            print(f"[Modo local] {acao}: {type(erro).__name__}: {erro}")
            return f"Não consegui fazer isso, {CFG.TRATAMENTO}: {erro}"

    @property
    def _t(self):
        return CFG.TRATAMENTO

    # --- PC ---
    def _abrir(self, alvo):
        from skills import pc
        self._ferramenta("abrir_programa")
        chave = _Frase(alvo).n
        if chave in SITES and chave not in pc._apps():
            pc.abrir_site(SITES[chave])
            return f"Abrindo {alvo}, {self._t}."
        if "não está na lista" not in pc.abrir_programa(alvo):
            return f"Abrindo {alvo}, {self._t}."
        endereco = re.sub(r"\s+ponto\s+", ".", alvo.strip().lower())
        if re.fullmatch(r"[\w-]+(\.[\w-]+)+(/\S*)?", endereco):
            pc.abrir_site(endereco)
            return f"Abrindo {endereco}, {self._t}."
        pc.pesquisar_na_web(alvo)
        return (f"{alvo} não está na minha lista de programas, {self._t}, então abri uma pesquisa. "
                "Para incluir um programa, edite o apps.json.")

    def _pesquisar(self, consulta, onde):
        from skills import pc
        self._ferramenta("pesquisar_na_web")
        pc.pesquisar_na_web(consulta, onde)
        return f"Pesquisa por {consulta} aberta no {'YouTube' if onde == 'youtube' else 'Google'}."

    def _volume(self, **args):
        from skills import pc
        self._ferramenta("ajustar_volume")
        return pc.ajustar_volume(**args)

    def _midia(self, comando):
        from skills import pc
        self._ferramenta("controle_de_midia")
        pc.controle_de_midia(comando)
        return {"proxima": "Próxima faixa.", "anterior": "Faixa anterior.",
                "parar": "Reprodução parada."}.get(comando, "Pronto.")

    def _print(self):
        from skills import pc
        self._ferramenta("tirar_print")
        pc.tirar_print()
        return f"Captura salva na pasta Jarvis, dentro de Imagens, {self._t}."

    def _bloquear(self):
        from skills import pc
        self._ferramenta("bloquear_pc")
        return pc.bloquear_pc()

    def _status(self):
        from skills.pc import dados_sistema
        self._ferramenta("status_do_sistema")
        return falar_status(dados_sistema())

    # --- música ---
    def _tocar_musica(self, busca, tipo="track"):
        from skills import spotify_svc
        self._ferramenta("tocar_musica")
        return spotify_svc.tocar_musica(busca, tipo)

    def _tocar_no_youtube(self, busca):
        from skills import pc
        self._ferramenta("pesquisar_na_web")
        pc.pesquisar_na_web(busca, "youtube")
        if self.modulos.get("Spotify"):
            return f"Abri {busca} no YouTube, {self._t}."
        return f"O Spotify não está configurado, {self._t}, então abri {busca} no YouTube."

    def _musica_atual(self):
        from skills import spotify_svc
        self._ferramenta("musica_atual")
        return spotify_svc.musica_atual()

    def _sem_spotify(self):
        return f"Para saber o que está tocando preciso do Spotify configurado, {self._t}. O README explica como."

    # --- informações ---
    def _hora(self):
        return f"{_hora_falada(datetime.datetime.now())}, {self._t}."

    def _data(self):
        return f"Hoje é {_data_falada(datetime.date.today())}, {self._t}."

    def _clima(self, cidade=None, quando=0):
        from skills.info import clima
        self._ferramenta("clima")
        return falar_clima(clima(cidade, dias=7 if quando == "semana" else 3), quando)

    def _noticias(self, tema=None):
        from skills.info import noticias
        self._ferramenta("noticias")
        return falar_noticias(noticias(tema, quantidade=3))

    def _agenda(self, quando=0):
        from skills import google_svc
        self._ferramenta("agenda_compromissos")
        inicio = datetime.date.today() + datetime.timedelta(days=1 if quando == 1 else 0)
        dias = 7 if quando == "semana" else 1
        return falar_agenda(google_svc.agenda_compromissos(inicio.isoformat(), dias), quando)

    def _emails(self):
        from skills import google_svc
        self._ferramenta("emails")
        return falar_emails(google_svc.emails())

    def _sem_google(self):
        return f"A Agenda e o Gmail ainda não foram conectados, {self._t}. Rode o conectar_google.bat."

    def _criar_compromisso(self):
        return (f"Criar compromissos exige o meu cérebro principal, {self._t}, que está "
                f"indisponível{self._por_que()}. Por enquanto, crie direto no Google Agenda.")

    def _briefing(self):
        agora = datetime.datetime.now()
        periodo = "Bom dia" if 5 <= agora.hour < 12 else "Boa tarde" if agora.hour < 18 else "Boa noite"
        partes = [f"{periodo}, {self._t}. Hoje é {_data_falada(agora.date())}. {_hora_falada(agora)}."]
        etapas = [self._clima]
        if self.modulos.get("Google"):
            etapas += [self._agenda, self._emails]
        etapas.append(self._noticias)
        for etapa in etapas:
            try:
                partes.append(etapa())
            except Exception as erro:  # noqa: BLE001  uma parte falhando não estraga o resto
                print(f"[Modo local] briefing: {erro}")
        return " ".join(partes)

    # --- conversa ---
    def _conversa(self, tipo):
        if tipo == "obrigado":
            return f"Às ordens, {self._t}."
        if tipo == "quem":
            return f"Sou o J.A.R.V.I.S., seu assistente pessoal, {self._t}."
        if tipo == "tudo_bem":
            return f"Todos os sistemas operando normalmente, {self._t}."
        return f"Às suas ordens, {self._t}."

    def _ajuda(self):
        return (f"No modo local eu entendo comandos como: abre o Chrome, volume em 30, pausa a "
                f"música, próxima música, toca uma música, como está o clima, vai chover amanhã, "
                f"quais as notícias, que horas são, tira um print, bloqueia o PC e como está o "
                f"sistema, {self._t}.")

    def _desconhecido(self):
        if CFG.CEREBRO == "local":
            inicio = f"No modo local eu só entendo comandos básicos, {self._t}."
        else:
            inicio = (f"Esse pedido precisa do meu cérebro principal, {self._t}, que está "
                      f"indisponível{self._por_que()}.")
        return (f"{inicio} Posso abrir programas, mexer no volume e na música, dizer o clima, "
                "as notícias e a hora, tirar prints e mostrar o status do PC.")

    def _claude(self, pedido):
        # normalmente o orquestrador manda direto para a aba Claude; chega aqui sem Claude Code
        return (f"Não encontrei o Claude Code neste PC, {self._t}. Instale a extensão do Claude "
                "Code no VS Code ou configure CLAUDE_CODE_EXE no arquivo .env.")

    def _por_que(self):
        return f": {self.motivo}" if self.motivo else ""
