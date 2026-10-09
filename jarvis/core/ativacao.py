"""Reconhece a palavra de ativação ("Jarvis") no texto transcrito pelo Whisper.

Fica separado de ouvidos.py para poder ser testado sem microfone nem modelos.
"""
import difflib
import re
import unicodedata

# Jeitos como o Whisper costuma escrever "Jarvis" falado com sotaque brasileiro
VARIANTES_JARVIS = {
    "jarvis", "jarvys", "jarviz", "jarves", "jarvas", "jarbas", "javis", "jarvi",
    "djarvis", "djavis", "charvis", "jervis", "garvis", "jaris",
}
# Palavras que podem vir antes do nome e não fazem parte do comando ("Ei, Jarvis")
INTERJEICOES = {
    "hey", "hei", "ei", "ey", "ê", "e", "o", "oh", "ô", "oi", "ola", "ok", "okay",
    "ai", "rei", "fala", "alo", "opa",
}
SIMILARIDADE_MIN = 0.75     # 0..1: quão parecida a palavra precisa ser com o nome
MAX_PALAVRAS_ANTES = 3      # "Bom dia, Jarvis" ainda vale; "o filme que o Jarvis..." não

_PALAVRA = re.compile(r"[^\W\d_]+", re.UNICODE)
_PONTUACAO = " ,.;:!?-–—…\"'“”"


def normalizar(palavra):
    """Minúsculas e sem acento: 'Járvis' -> 'jarvis'."""
    sem_acento = unicodedata.normalize("NFKD", palavra)
    return "".join(c for c in sem_acento if not unicodedata.combining(c)).lower()


def eh_ativacao(palavra, alvo="jarvis"):
    p = normalizar(palavra)
    alvo = normalizar(alvo)
    if len(p) < 4:
        return False
    if p == alvo or (alvo == "jarvis" and p in VARIANTES_JARVIS):
        return True
    return difflib.SequenceMatcher(None, p, alvo).ratio() >= SIMILARIDADE_MIN


def separar_ativacao(texto, alvo="jarvis"):
    """Procura o nome no começo da frase e devolve (achou, comando).

    "Jarvis, abre o Chrome."  -> (True, "abre o Chrome.")
    "Ei Jarvis"               -> (True, "")
    "Bom dia, Jarvis"         -> (True, "Bom dia")
    "Abre o Chrome"           -> (False, "Abre o Chrome")
    """
    texto = (texto or "").strip()
    palavras = list(_PALAVRA.finditer(texto))
    alvo_norm = normalizar(alvo)

    for i, m in enumerate(palavras[:MAX_PALAVRAS_ANTES + 1]):
        fim = None
        if eh_ativacao(m.group(), alvo):
            fim = m.end()
        elif i + 1 < len(palavras):   # Whisper às vezes separa: "Jar vis"
            junto = normalizar(m.group() + palavras[i + 1].group())
            if junto == alvo_norm or (alvo_norm == "jarvis" and junto in VARIANTES_JARVIS):
                fim = palavras[i + 1].end()
        if fim is None:
            continue

        antes = palavras[:i]
        depois = texto[fim:].lstrip(_PONTUACAO).strip()
        if not depois.strip(_PONTUACAO):
            depois = ""
        if antes and not all(normalizar(p.group()) in INTERJEICOES for p in antes):
            # saudação antes do nome vira parte do comando ("Bom dia, Jarvis" -> "Bom dia")
            prefixo = texto[:m.start()].strip(_PONTUACAO + " ")
            return True, f"{prefixo}, {depois}" if depois else prefixo
        return True, depois

    return False, texto


def tirar_palavra_ativacao(texto, alvo="jarvis"):
    """Remove o nome do começo do comando, se estiver lá."""
    achou, resto = separar_ativacao(texto, alvo)
    return resto if achou else (texto or "").strip()
