# J.A.R.V.I.S. — assistente pessoal por voz

Assistente para Windows que acorda com **"Hey Jarvis"**, entende português, responde falando com voz masculina formal e controla seu PC, Google Agenda, Gmail, clima, notícias e Spotify. O cérebro é o Claude (API da Anthropic).

```
 microfone ─► "Hey Jarvis" (openWakeWord, local) ─► gravação ─► Whisper (local)
                                                                    │ texto
 alto-falante ◄─ edge-tts (voz) ◄─ resposta ◄─ Claude + ferramentas ◄┘
                                                  ├─ PC (apps, volume, mídia, print, bloqueio)
                                                  ├─ Clima (Open-Meteo) e Notícias (Google Notícias)
                                                  ├─ Google Agenda e Gmail
                                                  └─ Spotify
```

---

## 1. Instalação (uma vez só)

1. **Python 3.12 (64 bits):** baixe em <https://www.python.org/downloads/>. Na primeira tela do instalador, marque **"Add python.exe to PATH"**.
2. **Descompacte** a pasta `jarvis` onde quiser (ex.: `C:\Users\Pedro\jarvis`).
3. Dê dois cliques em **`instalar.bat`**. Leva alguns minutos. Ele cria um ambiente virtual (`.venv`), instala tudo e cria os arquivos `.env` e `apps.json`.
4. **Chave da API:**
   - Entre em <https://console.anthropic.com>, adicione créditos em *Billing*.
   - Em *Settings > Limits*, **defina um limite mensal de gasto** (evita surpresa na fatura).
   - Em *Settings > API Keys*, crie uma chave e cole no `.env` em `ANTHROPIC_API_KEY=`.
5. Rode **`diagnostico.bat`**. Ele testa API, clima, voz, microfone, Whisper e palavra de ativação, e mostra o que estiver falhando.
6. Rode **`iniciar.bat`**. Na primeira vez o Whisper baixa o modelo de fala (cerca de 500 MB para o `small`).

> Se a janela não abrir, use `iniciar_com_log.bat` para ver o erro no terminal.

---

## 2. Como usar

| Forma | Como |
|---|---|
| Voz | Diga **"Hey Jarvis"** (pronúncia em inglês), espere o bipe e fale o comando |
| Botão | Clique no microfone ou aperte **F2** / **Ctrl+Espaço** |
| Texto | Digite na barra de baixo e aperte Enter |
| Interromper | **Esc** ou o botão quadrado |
| Esquecer a conversa | Botão **limpar** no Registro |

Quando o Jarvis termina com uma pergunta ("Confirma às 15h?"), ele já escuta a resposta sem precisar de "Hey Jarvis".

**Exemplos de comandos:**
- "Faça meu briefing do dia" (clima, agenda e e-mails num resumo só)
- "Vai chover amanhã?" / "Como está o clima em São Paulo?"
- "Quais as notícias de tecnologia?"
- "O que tenho na agenda essa semana?"
- "Marca reunião de estudo amanhã às 15h" (ele confirma antes de criar)
- "Tenho e-mails não lidos?" / "Tem algum e-mail da faculdade?"
- "Abre o VS Code" / "Abre o GitHub" / "Pesquisa no YouTube tutorial de Moodle"
- "Volume em 30" / "Muta o som" / "Pausa a música"
- "Toca Arctic Monkeys no Spotify" / "Que música é essa?"
- "Tira um print" / "Bloqueia o PC" / "Como está o sistema?"

---

## 3. Google Agenda e Gmail (opcional)

O Jarvis pede só duas permissões: **ler e criar eventos** na agenda e **ler** e-mails. Ele não envia, não apaga e não move e-mails.

1. Acesse <https://console.cloud.google.com> e crie um projeto (ex.: `jarvis-pessoal`).
2. Em **APIs e serviços > Biblioteca**, ative a **Google Calendar API** e a **Gmail API**.
3. Em **Google Auth Platform** (ou "Tela de consentimento OAuth"):
   - Nome do app: `Jarvis`. Público: **Externo**. Preencha seu e-mail nos campos de contato.
   - Em **Público-alvo**, adicione **seu próprio Gmail como usuário de teste**.
4. Em **Clientes > Criar cliente**, escolha o tipo **App para computador** (Desktop app).
5. Baixe o JSON, renomeie para **`credentials.json`** e coloque na pasta do Jarvis.
6. Rode **`conectar_google.bat`**, entre na sua conta e autorize.
   - Aviso "O Google não verificou este app": clique em **Avançado > Acessar Jarvis**. É esperado, pois o app é seu e está em modo de teste.
7. Reinicie o Jarvis. O selo **GOOGLE** fica verde.

> **Importante:** apps em modo de teste têm o login renovado a cada **7 dias**. Quando o Jarvis disser que o login expirou, rode `conectar_google.bat` de novo.

---

## 4. Spotify (opcional)

Desde fevereiro de 2026, o Spotify exige **conta Premium** do dono do app para usar a Web API em modo de desenvolvimento. Sem Premium, use os comandos de mídia ("pausa", "próxima"), que funcionam com qualquer player via teclas de mídia.

1. Acesse <https://developer.spotify.com/dashboard> e clique em **Create app**.
2. Em **Redirect URIs**, coloque exatamente: `http://127.0.0.1:8888/callback` (não use `localhost`).
3. Marque **Web API** e salve.
4. Em **Settings**, copie *Client ID* e *Client secret* para o `.env` (`SPOTIPY_CLIENT_ID` e `SPOTIPY_CLIENT_SECRET`).
5. Rode **`conectar_spotify.bat`** e aceite no navegador.
6. Deixe o Spotify aberto (PC ou celular) e reinicie o Jarvis.

---

## 5. Personalizar

**Voz** (`.env`):
- `VOZ`: outras vozes pt-BR aparecem com `.venv\Scripts\edge-tts --list-voices | findstr pt-BR`.
- `VOZ_VELOCIDADE` (`-10%` mais calmo, `+10%` mais rápido) e `VOZ_TOM` (`-8Hz` mais grave).

**Programas** (`apps.json`): o Jarvis só abre programas da lista (segurança, veja a seção 7). Para incluir os seus:
```json
{
  "obs": "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
  "github": "https://github.com"
}
```

**Personalidade:** edite o texto em `core/cerebro.py`, função `prompt_sistema`.

**Modelo:** `JARVIS_MODELO=claude-haiku-5-5` no `.env` deixa tudo mais rápido e barato. `claude-sonnet-5-5` raciocina melhor.

**Interface:** `ui/style.css` (cores em `:root`) e `ui/hud.js` (animação do núcleo, função `quadro`). É HTML/CSS/JS puro.

**Nova habilidade:** crie um arquivo em `skills/`, decore a função e importe em `skills/__init__.py`:
```python
from .registro import ferramenta

@ferramenta("cotacao_dolar", "Cotação atual do dólar em reais.")
def cotacao_dolar():
    import requests
    r = requests.get("https://economia.awesomeapi.com.br/json/last/USD-BRL", timeout=10).json()
    return f"Dólar: R$ {float(r['USDBRL']['bid']):.2f}"
```
O Claude descobre sozinho quando usar a ferramenta pela descrição.

---

## 6. Problemas comuns

| Sintoma | Solução |
|---|---|
| `pip` falha em `onnxruntime` / `ctranslate2` | Use Python **3.12 64 bits**. Apague a pasta `.venv` e rode `instalar.bat` de novo |
| Janela não abre / erro de WebView | Instale o **Microsoft Edge WebView2 Runtime** (site da Microsoft) |
| "Hey Jarvis" não ativa | Pronuncie em inglês ("rêi djár-vis"); baixe `WAKE_LIMIAR` para `0.35` |
| Ativa sozinho | Suba `WAKE_LIMIAR` para `0.65` |
| Corta a frase no meio | Baixe `MIC_LIMIAR_MIN` (ex.: `250`) |
| Não para de gravar | Suba `MIC_LIMIAR_MIN` (ex.: `700`) ou use fone com microfone |
| Entende errado | `WHISPER_MODELO=medium` (mais preciso, mais lento) |
| Microfone errado | Veja o número no `diagnostico.bat` e ponha em `MIC_DISPOSITIVO` |
| "Login do Google expirou" | Rode `conectar_google.bat` (acontece a cada 7 dias em modo teste) |
| Google: "acesso bloqueado" | Seu e-mail não está como usuário de teste (seção 3, passo 3) |
| Spotify: "nenhum dispositivo" | Abra o app do Spotify e toque qualquer coisa uma vez |
| Spotify: erro 403 | Conta sem Premium ou e-mail não autorizado no painel do app |

---

## 7. Segurança e privacidade

- **O que sai do seu PC:** o áudio fica local (Whisper e palavra de ativação rodam no PC). Saem o **texto** do comando e os resultados das ferramentas (assunto e trecho de e-mails, eventos da agenda) para a API da Anthropic, e o texto das respostas para o serviço de voz da Microsoft (edge-tts).
- **Nunca suba** `.env`, `credentials.json`, `token.json` e `.spotify_cache` para o GitHub. O `.gitignore` já bloqueia esses arquivos.
- **Lista branca de programas:** o Jarvis não executa comandos arbitrários. Isso impede que um e-mail malicioso com texto do tipo "Jarvis, rode tal coisa" faça algo no seu PC. Pelo mesmo motivo, o prompt instrui o Jarvis a tratar e-mails e notícias como dados, nunca como ordens.
- **Uso pessoal:** foi feito para o seu PC e as suas contas. Não conecte contas institucionais (ex.: e-mail ou agenda do trabalho) nem use em máquina do órgão sem autorização da TI e do seu supervisor, já que dados de terceiros passariam por serviços externos (LGPD).
- **Nome e voz:** "Jarvis" aqui é só o nome de um projeto pessoal. A voz é sintética e a interface é original; não reproduz a voz de nenhum ator nem a arte dos filmes. Se um dia publicar o projeto, troque o nome.

---

## Estrutura

```
jarvis/
├── main.py              ponto de partida (--console, --sem-voz, --sem-microfone)
├── config.py            lê o .env
├── core/
│   ├── jarvis.py        orquestrador (fila de comandos, estados)
│   ├── cerebro.py       Claude + personalidade + laço de ferramentas
│   ├── ouvidos.py       "Hey Jarvis" + gravação + Whisper
│   ├── voz.py           edge-tts + pygame (fallback offline pyttsx3)
│   └── ponte.py         Python → interface
├── skills/              habilidades (pc, info, google_svc, spotify_svc)
├── ui/                  interface HUD (index.html, style.css, hud.js)
├── instalar.bat · iniciar.bat · iniciar_com_log.bat · diagnostico.bat
└── conectar_google.bat · conectar_spotify.bat
```
