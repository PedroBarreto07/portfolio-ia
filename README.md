# Projetos com Claude

Coleção de projetos web feitos com o Claude Code. Cada projeto fica em uma pasta própria.

| Projeto | O que é | Ver |
|---|---|---|
| [`aurora-site/`](aurora-site/) | Site institucional de agência digital: uma viagem do espaço à Terra guiada pelo scroll (GSAP, ScrollTrigger, Lenis, Barba.js, particles.js e fotos da NASA). | [Documentação](aurora-site/LEIAME.md) |
| [`nexora-site/`](nexora-site/) | Experiência WebGL imersiva guiada pelo scroll, da órbita ao asfalto: Terra e satélite com dados da NASA, data center, chip quântico, cards de IA e carro PBR nos Alpes (Three.js, GSAP, Vite, áudio sintetizado). | [Documentação](nexora-site/README.md) |
| [`ora-60a-site/`](ora-60a-site/) | Site imersivo 3D de um relógio de luxo guiado pelo scroll: relógio 100% procedural em tempo real, vista explodida com as peças saindo da caixa, coração mecânico em partículas, 4 acabamentos, configurador com link e final com os relógios seguindo o cursor (Three.js, Svelte 5, GSAP, Lenis, Vite). | [Documentação](ora-60a-site/README.md) |

## Rodar um projeto localmente

```bash
cd aurora-site
npm install
npm start        # http://localhost:8000
```

O `nexora-site` e o `ora-60a-site` usam Vite: `cd <pasta> && npm install && npm run dev` (http://localhost:5173).

Sem Node.js (no aurora-site), use `python -m http.server 8000` dentro da pasta do projeto.

## GitHub Pages

Se o Pages estiver ativo (Settings › Pages › Deploy from a branch › `main` / `root`), cada projeto fica em:

`https://pedrobarreto07.github.io/projetos_claude/<pasta-do-projeto>/`

O `404.html` da raiz é a página "voo perdido" do Aurora. O Pages só usa o 404 que estiver na raiz do repositório.
