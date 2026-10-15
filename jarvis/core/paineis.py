"""Dados dos painéis da interface (Clima, Agenda e e-mails, Spotify).

Cada função devolve um dicionário pronto para o JavaScript (hud.painel) e pode levantar
exceção; quem chama mostra o erro no próprio painel.
"""
import datetime
import json

from core.cerebro import DIAS

# segundos entre atualizações
INTERVALOS = {"spotify": 5, "google": 300, "clima": 1800}


def clima():
    from skills.info import clima as consultar
    d = json.loads(consultar(dias=4))
    hoje = d["previsao"][0]
    return {
        "local": d["local"].split(",")[0],
        "temp": round(d["agora"]["temperatura_c"]),
        "sensacao": round(d["agora"]["sensacao_c"]),
        "condicao": d["agora"]["condicao"],
        "min": round(hoje["min_c"]), "max": round(hoje["max_c"]),
        "chuva": hoje["chance_chuva_pct"],
        "dias": [{
            "dia": DIAS[datetime.date.fromisoformat(p["data"]).weekday()][:3],
            "min": round(p["min_c"]), "max": round(p["max_c"]),
            "condicao": p["condicao"], "chuva": p["chance_chuva_pct"],
        } for p in d["previsao"][1:4]],
    }


def google():
    from skills import google_svc
    resultado = google_svc.agenda_compromissos(dias=1)
    eventos = []
    if resultado.startswith("["):
        for ev in json.loads(resultado):
            inicio = datetime.datetime.fromisoformat(ev["inicio"])
            eventos.append({"hora": "dia todo" if ev["dia_inteiro"] else f"{inicio:%H:%M}",
                            "titulo": ev["titulo"]})
    return {"eventos": eventos, "nao_lidos": google_svc.nao_lidos()}


def spotify():
    from skills import spotify_svc
    atual = spotify_svc._sp().current_playback()
    if not atual or not atual.get("item"):
        return {"vazio": True}
    item = atual["item"]
    imagens = (item.get("album") or {}).get("images") or []
    return {
        "musica": item.get("name", ""),
        "artista": ", ".join(a["name"] for a in item.get("artists", [])),
        "capa": imagens[-1]["url"] if imagens else "",   # a menor imagem basta
        "tocando": bool(atual.get("is_playing")),
        "dispositivo": (atual.get("device") or {}).get("name", ""),
    }
