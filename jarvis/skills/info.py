"""Clima (Open-Meteo, grátis e sem chave) e notícias (Google Notícias RSS)."""
import json
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import requests

from config import CFG

from .registro import ferramenta

TIMEOUT = 10

CODIGOS_CLIMA = {
    0: "céu limpo", 1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado",
    45: "neblina", 48: "neblina com geada",
    51: "garoa fraca", 53: "garoa", 55: "garoa forte",
    61: "chuva fraca", 63: "chuva", 65: "chuva forte",
    66: "chuva congelante", 67: "chuva congelante forte",
    71: "neve fraca", 73: "neve", 75: "neve forte", 77: "grãos de neve",
    80: "pancadas de chuva fracas", 81: "pancadas de chuva", 82: "pancadas de chuva fortes",
    85: "pancadas de neve", 86: "pancadas de neve fortes",
    95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas fortes com granizo",
}


def _localizar(cidade):
    r = requests.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        params={"name": cidade, "count": 1, "language": "pt", "format": "json"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    resultados = r.json().get("results") or []
    if not resultados:
        raise ValueError(f"Não encontrei a cidade '{cidade}'.")
    lugar = resultados[0]
    nome = ", ".join(p for p in (lugar.get("name"), lugar.get("admin1"), lugar.get("country")) if p)
    return lugar["latitude"], lugar["longitude"], nome


@ferramenta(
    "clima",
    "Previsão do tempo atual e dos próximos dias. Sem cidade, usa a cidade padrão do usuário.",
    {
        "cidade": {"type": "string"},
        "dias": {"type": "integer", "minimum": 1, "maximum": 7, "description": "Padrão: 3"},
    },
)
def clima(cidade=None, dias=3):
    lat, lon, nome = _localizar(cidade or CFG.CIDADE)
    r = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat, "longitude": lon, "timezone": "auto",
            "forecast_days": max(1, min(7, int(dias))),
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
                       "weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,"
                     "precipitation_probability_max,weather_code",
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return formatar_clima(nome, r.json())


def formatar_clima(nome, d):
    atual = d["current"]
    saida = {
        "local": nome,
        "agora": {
            "temperatura_c": atual["temperature_2m"],
            "sensacao_c": atual["apparent_temperature"],
            "umidade_pct": atual["relative_humidity_2m"],
            "vento_kmh": atual["wind_speed_10m"],
            "condicao": CODIGOS_CLIMA.get(atual["weather_code"], "desconhecida"),
        },
        "previsao": [],
    }
    diario = d["daily"]
    for i, data in enumerate(diario["time"]):
        saida["previsao"].append({
            "data": data,
            "min_c": diario["temperature_2m_min"][i],
            "max_c": diario["temperature_2m_max"][i],
            "chance_chuva_pct": diario["precipitation_probability_max"][i],
            "condicao": CODIGOS_CLIMA.get(diario["weather_code"][i], "desconhecida"),
        })
    return json.dumps(saida, ensure_ascii=False)


@ferramenta(
    "noticias",
    "Manchetes recentes do Google Notícias Brasil. Pode filtrar por tema.",
    {
        "tema": {"type": "string", "description": "Ex.: tecnologia, Brasília, futebol. Vazio = principais."},
        "quantidade": {"type": "integer", "minimum": 1, "maximum": 10, "description": "Padrão: 5"},
    },
)
def noticias(tema=None, quantidade=5):
    sufixo = "hl=pt-BR&gl=BR&ceid=BR:pt-419"
    if tema:
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote_plus(tema)}&{sufixo}"
    else:
        url = f"https://news.google.com/rss?{sufixo}"
    r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    return formatar_noticias(r.content, int(quantidade))


def formatar_noticias(xml_bytes, quantidade=5):
    raiz = ET.fromstring(xml_bytes)
    itens = []
    for item in raiz.iter("item"):
        titulo = (item.findtext("title") or "").strip()
        fonte = (item.findtext("source") or "").strip()
        if fonte and titulo.endswith(" - " + fonte):
            titulo = titulo[: -len(" - " + fonte)]
        quando = item.findtext("pubDate")
        try:
            quando = parsedate_to_datetime(quando).strftime("%d/%m %H:%M") if quando else ""
        except (TypeError, ValueError):
            pass
        itens.append({"titulo": titulo, "fonte": fonte, "quando": quando})
        if len(itens) >= quantidade:
            break
    if not itens:
        return "Nenhuma notícia encontrada."
    return json.dumps(itens, ensure_ascii=False)
