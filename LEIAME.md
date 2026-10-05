# Aurora: site "do espaço à Terra"

Site institucional one-page de uma agência digital fictícia (**Aurora**). O scroll conta uma viagem: você começa **dentro de uma estação espacial olhando pela cúpula**, atravessa a janela, desce pela atmosfera até o **céu azul**, lê o manifesto, conhece os serviços, vê o globo com as cidades onde a agência atua e termina no **formulário de contato em vidro fosco**.

Todas as fotos são da **NASA** (domínio público). A janela da cúpula é desenhada por código, inspirada na Cupola da ISS, com os vidros 100% transparentes.

## Como abrir

As animações e as transições entre páginas precisam de um servidor local. Se você abrir o `index.html` com duplo clique, o site funciona, mas sem as transições do Barba.

**Opção 1: com npm (recomendado)**

```bash
npm install     # instala as libs e copia para assets/vendor/
npm start       # abre em http://localhost:8000
```

**Opção 2: sem instalar nada.** A pasta `assets/vendor/` já vem pronta:

```bash
python -m http.server 8000
```

A extensão **Live Server** do VS Code também funciona.

> **O site aparece parado, sem animações?** O Windows e o macOS têm a opção "reduzir movimento" (no Windows: *Configurações › Acessibilidade › Efeitos visuais › Efeitos de animação*). O site respeita essa escolha e mostra uma versão estática, mas exibe um aviso com o botão **"Ativar animações"**. Também dá para trocar pelo link **Animações** no rodapé.

## O que personalizar primeiro

Tudo fica no topo de `assets/js/main.js`, no objeto `CONFIG`:

| Campo | Para que serve |
|---|---|
| `formEndpoint` | URL que recebe os formulários. Com o [Formspree](https://formspree.io): crie um formulário e cole `https://formspree.io/f/SEU_ID`. **Vazio = modo demonstração**: simula o envio e mostra os dados no console (F12). |
| `whatsapp` | Número com DDI e DDD, só dígitos (ex.: `5511912345678`). |
| `whatsappMsg` | Mensagem que já vem escrita no WhatsApp (PT e EN). |
| `gaId` | ID do Google Analytics 4 (`G-XXXXXXX`). Só carrega depois que a pessoa aceita os cookies. |
| `hq`, `CITIES` | Sede e cidades do rotador/globo (nome, fuso, latitude, longitude). |
| `logoOffset` | Ajuste fino do logo dentro da janela central, em px. |

Depois, troque nos HTML:

- o e-mail `contato@aurora.example`, telefones e endereços;
- o domínio `https://www.aurora.example` (canonical, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt`);
- os textos. O **português fica no HTML** e o **inglês fica no objeto `EN`** do `main.js` (mesma chave do `data-i18n`).

> Para ver o estado de **erro** do formulário no modo demonstração, digite `erro` no campo Nome.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html` | Página principal (preloader, header, hero, céu, manifesto, serviços, mundo, contato, rodapé, CTA, popup) |
| `privacidade.html` | Política de Privacidade (LGPD), Cookies, Aviso Legal e Termos |
| `404.html` | Página "voo perdido" (o `npm start` a serve para qualquer endereço inexistente) |
| `assets/css/style.css` | Tokens da escala fluida, design system, componentes, responsivo e movimento reduzido |
| `assets/js/main.js` | Todas as animações e interações, em módulos comentados |
| `assets/vendor/` | GSAP 3.15 + ScrollTrigger, Lenis 1.3, Barba.js 2.10, particles.js 2.0 |
| `assets/images/` | Imagens geradas a partir das fotos da NASA |
| `scripts/gerar-imagens.js` | Baixa as fotos da NASA e gera todas as imagens (`npm run imagens`) |
| `sitemap.xml`, `robots.txt` | SEO |

### Módulos do `main.js`

`initLenis` (scroll suave) · `initPreloader` (persiana de janela de avião, 3s na primeira visita e 1s nas seguintes) · `initHero` (zoom de 6,5× pela janela, títulos que se abrem, logo que vai da janela para o header) · `initAboutParallax` (conteúdo flutuando sobre o céu) · `initReveals` / `initHighlight` (textos com blur e manifesto que acende letra a letra) · `initParallax` · `initMagnetic` (botões magnéticos) · `initHovers` (texto duplicado) · `initPopup` · `initSuccess` · `initForms` (validação, máscara de telefone por país, honeypot, `fetch`) · `initAccordion` · `initTheme` (header e CTA trocam de cor conforme a seção) · `initClock` · `initWorld` (rotador de cidades e globo pontilhado com os continentes reais, que você pode arrastar) · `initParticles` · `initMenu` · `initBarba` · `initCookies` · `I18N`.

### A escala fluida (a regra mais importante)

O `body` tem `font-size: 1vw` e tudo é medido em `em`, então o layout escala como uma arte do Figma (artboard de 1440px no desktop e de 372px no celular). Os tokens `--12px`, `--24px`… só devem ser usados em elementos **sem** classe tipográfica. Dentro de um `.h1` ou `.p6`, `1em` já é o tamanho daquela fonte; nesses casos, use medidas na própria fonte (ex.: `height: 2em`).

## Imagens (NASA, domínio público)

| Uso | Foto | ID da NASA |
|---|---|---|
| Vista pela janela | A Lua sobre o limbo da Terra, STS-80 (1996) | `sts080-759-038` |
| Céu azul | Cúmulos sobre o Atlântico, Mercury-Atlas 6 (1962) | `s62-06613` |
| Criação de sites | Lançamento da Artemis I (2022) | `NHQ202211160200` |
| Branding | "Penhascos Cósmicos", telescópio James Webb | `carina_nebula` |
| E-commerce | Caminhada espacial, Expedição 61 | `iss061e058522` |
| Growth e SEO | Aurora vista da ISS, Expedição 46 | `iss046e015599` |
| Experiências | Reflexo no capacete, EVA 25 | `iss038e020313` |
| Globo | Blue Marble, NASA Visible Earth | `land_shallow_topo_2048` |

A NASA não endossa marcas que usam suas imagens. Isso já está dito no Aviso Legal.

Para refazer as imagens (por exemplo, com outro recorte), rode `npm run imagens`. O script baixa os originais para `scripts/.cache/` e gera os WebP/AVIF.

## Acessibilidade, performance e LGPD

- Skip-link, foco visível, `aria-live` nos erros e no sucesso, foco preso dentro do popup e `Esc` fecha menu, popup e tela de sucesso.
- "Reduzir movimento" desliga zoom, parallax, blur e partículas, e mostra tudo estático.
- Imagem do hero e fontes pré-carregadas, WebP/AVIF com `srcset`, scripts com `defer`, e partículas e globo pausados fora da tela.
- Checkbox de consentimento, link para a política, banner de cookies (o Analytics só carrega após aceite) e honeypot anti-spam.
