# Projetos com Claude

Coleção de projetos web feitos com o Claude Code. Cada projeto fica em uma pasta própria.

| Projeto | O que é | Ver |
|---|---|---|
| [`aurora-site/`](aurora-site/) | Site institucional de agência digital: uma viagem do espaço à Terra guiada pelo scroll (GSAP, ScrollTrigger, Lenis, Barba.js, particles.js e fotos da NASA). | [Documentação](aurora-site/LEIAME.md) |

## Rodar um projeto localmente

```bash
cd aurora-site
npm install
npm start        # http://localhost:8000
```

Sem Node.js, use `python -m http.server 8000` dentro da pasta do projeto.

## GitHub Pages

Se o Pages estiver ativo (Settings › Pages › Deploy from a branch › `main` / `root`), cada projeto fica em:

`https://pedrobarreto07.github.io/projetos_claude/<pasta-do-projeto>/`

O `404.html` da raiz é a página "voo perdido" do Aurora. O Pages só usa o 404 que estiver na raiz do repositório.
