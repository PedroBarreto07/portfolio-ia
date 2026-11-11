# Portfólio de projetos com IA

Projetos que construí usando IA como ferramenta de desenvolvimento. Eu defini a ideia, escrevi as especificações, tomei as decisões de design e de arquitetura, e revisei, testei e iterei o código, desenvolvido com o **Claude Code**. Cada projeto fica em uma pasta própria, com a documentação dele.

| Projeto | O que é | Stack | Ver |
|---|---|---|---|
| [`jarvis/`](jarvis/) | Assistente pessoal por voz para Windows: acorda com "Jarvis", entende português com Whisper local, responde falando e controla PC, Google Agenda, Gmail, clima, notícias e Spotify. Um LLM (Claude API) interpreta o comando e escolhe a ação, com modo local sem IA como reserva. | Python, Claude API, Whisper, APIs do Google, Spotify API | [Documentação](jarvis/README.md) |
| [`aurora-site/`](aurora-site/) | Site institucional de agência digital: uma viagem do espaço à Terra guiada pelo scroll, com fotos da NASA. | GSAP, ScrollTrigger, Lenis, Barba.js, particles.js | [Demo](https://pedrobarreto07.github.io/portfolio-ia/aurora-site/) · [Documentação](aurora-site/LEIAME.md) |
| [`nexora-site/`](nexora-site/) | Experiência WebGL imersiva guiada pelo scroll, da órbita ao asfalto: Terra e satélite com dados da NASA, data center, chip quântico, cards de IA e carro PBR nos Alpes, com áudio sintetizado no navegador. | Three.js, GSAP, Vite, Web Audio | [Documentação](nexora-site/README.md) |
| [`ora-60a-site/`](ora-60a-site/) | Site 3D de um relógio de luxo guiado pelo scroll: relógio 100% procedural em tempo real, vista explodida, coração mecânico em partículas, 4 acabamentos, configurador com link e final com os relógios seguindo o cursor. | Three.js, Svelte 5, GSAP, Lenis, Vite | [Documentação](ora-60a-site/README.md) |

## Como trabalho com IA

- **Especificação primeiro:** descrevo o objetivo, as restrições e o resultado esperado antes de qualquer código.
- **Iteração curta:** peço uma parte, testo, corrijo o rumo e sigo, em vez de pedir tudo de uma vez.
- **Revisão e testes:** confiro o que foi gerado e mantenho testes automatizados onde faz sentido (o Jarvis tem a pasta `testes/`).
- **Segurança:** chaves e tokens ficam fora do repositório (`.env`, ignorado pelo Git); só os modelos `.env.example` são versionados.

## Rodar um projeto localmente

```bash
cd aurora-site
npm install
npm start        # http://localhost:8000
```

O `nexora-site` e o `ora-60a-site` usam Vite: `cd <pasta> && npm install && npm run dev` (http://localhost:5173).

Sem Node.js (no aurora-site), use `python -m http.server 8000` dentro da pasta do projeto.

O `jarvis` é um app Python para Windows: veja o [README dele](jarvis/README.md) (tem a seção de como abrir e rodar no VS Code).

## GitHub Pages

O Pages publica a branch `main` a partir da raiz. Os projetos estáticos ficam em:

`https://pedrobarreto07.github.io/portfolio-ia/<pasta-do-projeto>/`

O `nexora-site` e o `ora-60a-site` precisam do build do Vite (`npm run build`) para rodar no Pages; por enquanto, rode-os localmente.

O `404.html` da raiz é a página "voo perdido" do Aurora. O Pages só usa o 404 que estiver na raiz do repositório.
