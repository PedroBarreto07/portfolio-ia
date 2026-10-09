# ORA 60A: site imersivo 3D de produto

Site de página única, guiado por scroll, que apresenta um relógio automático de luxo em **3D em tempo real**. O relógio gira, explode em peças, vira nuvem de partículas, troca de acabamento ao vivo e termina num configurador com catálogo de peças.

Inspirado em thewatch.60fps.fr, mas **sem nenhum asset de terceiros**. O relógio, as texturas, o ambiente de estúdio e até as "fotos" da galeria são gerados por código, na hora.

- Marca fictícia: **ORA**, modelo **60A** (turbilhão, fase da lua, 60 h de reserva, 42 mm, 146 g)
- 11 seções, PT/EN, desktop + mobile, 60 fps em GPU integrada

---

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (site estático)
npm run preview   # serve o build em http://localhost:4173
```

O deploy pode ser feito em qualquer host estático (Netlify, Vercel, Cloudflare Pages, S3): basta publicar a pasta `dist/`.

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 8 (code-splitting: locales, debug e loader de GLB são chunks separados) |
| UI | Svelte 5 (runes) |
| 3D | Three.js r186: material PBR próprio, InstancedMesh, Points, pós-processamento próprio |
| Animação | GSAP 3 + ScrollTrigger + CustomEase (os 7 easings `brand.*`) |
| Scroll | Lenis (`duration: 4`, inércia longa) |
| Fontes | Unbounded, Inter e EB Garamond, auto-hospedadas via @fontsource (licença OFL) |

## Estrutura

```
src/
  main.js                     bootstrap: Lenis + ticker GSAP + WebGL + app Svelte + loader
  state/                      bus de eventos (INIT/ATTACH_PROJECT, PART_SELECT…) e stores
  webgl/
    Webgl.js                  renderer, resize, DPR adaptativo, loop
    Camera.js                 câmera orbital (raio/phi/theta) + parallax + "segure para explorar"
    PostProcessing.js         1 passe: tonemap, gamma 1.6, contraste 1.15, fundo procedural, grão, cortina, laser, foco
    ScrollTimeline.js         keyframes por seção → parâmetros da cena (determinístico, à prova de resize)
    Snapshotter.js            "estúdio fotográfico": renderiza a galeria e as fotos das peças a partir do 3D
    Interactions.js           arrastar com inércia, segurar, clique/hover nas peças
    Debug.js                  painel lil-gui (?debug)
    Materials/
      PBR/SixtyMaterial.js    PBR próprio: 2º env map aditivo, modo escuro, dissolve, vidro de safira
      Particles/              curl noise em textura, órbitas, explosão a partir das superfícies das peças
      PostProcessing/ Backdrop/
    Scene/
      WatchModel.js           relógio procedural completo (≈100 peças nomeadas)
      WatchMaterials.js       materiais a partir do JSON + grupos (acabamentos, dissolve)
      WatchScene.js           montagem, explosão, mecânica animada, partículas, picking
      GLBRig.js / GLBExport.js  pipeline para trocar pelo seu próprio modelo .glb
    textures/ProceduralTextures.js   escovado, Côtes de Genève, perlage, raiado, couro, impressão do mostrador…
    environment/StudioEnvironment.js estúdio com softboxes → PMREM (substitui o .exr)
  packages/the-watch/
    choreography.js           alturas das seções + toda a coreografia 3D (variações retrato/paisagem)
    locales/en_GB.js pt_BR.js todos os textos
    views/sections/*.svelte   uma por seção
  app/components/             Section, Reveal (SplitText + scramble), Appear, Cursor, Header, ColorPicker
  assets/jsons/configs/default.json   materiais, 4 acabamentos, 4 mostradores, 3 pulseiras, pós
```

## Seções

1. **Hero**: "ORA | 60A" gigantes, círculo de setores girando atrás do relógio, seletor de cor
2. **Timeless**: relógio em 3/4, tipografia vertical passando *através* do relógio (dentro do WebGL)
3. **Vertical**: perfil com o bracelete formando um anel
4. **Disassembly**: o relógio vira de lado e as peças saem da caixa uma a uma (mostrador e rotor primeiro, depois turbilhão e ponte, por fim platina e tambor) enquanto a caixa some suavemente. Em seguida vêm os rótulos verticais e a linha de laser. Clique numa peça para abrir o painel Nome/Função; arraste para percorrer.
5. **Mechanical Heart**: o estúdio "apaga a luz", as peças giram e se desfazem numa nuvem de partículas. Depois vem o "60 h". Na saída, o pó converge de volta sobre as peças, a luz volta e o relógio se remonta na sua frente.
6. **Curves**: close do mostrador (raiado anisotrópico), mira em cruz, depois lateral com 3 specs
7. **Profile / Bracelet**: perfil fino (11,8 mm) e macro dos elos
8. **Editions**: grid tipográfico
9. **Colors**: galeria horizontal com renders ao vivo do acabamento atual
10. **Parts**: "MODEL 146GR" com scramble, configurador (cor × mostrador × pulseira, link compartilhável) e lista de 10 peças com foto (renderizada) no hover
11. **Final**: o relógio configurado sai de cena e sobem os 4 acabamentos lado a lado, com "ORA 60A" gigante ao fundo (desenhado no WebGL, atrás dos relógios). Cada relógio gira em direção ao cursor com seu próprio atraso. No hover ele se destaca e o cursor mostra ↗ + o nome do acabamento; no clique ele gira e esse acabamento passa a valer no site inteiro. No celular os relógios ficam numa grade 2×2.

## Personalizar

- **Textos e marca**: `src/packages/the-watch/locales/*.js` (as quebras `<br/>` fazem parte do design). O título e as meta tags OG ficam em `index.html`.
- **Cores e acabamentos**: `src/assets/jsons/configs/default.json`. Abra o site com `?debug`, ajuste ao vivo e use **export default.json**.
- **Coreografia**: `src/packages/the-watch/choreography.js`. Cada keyframe só lista o que muda. `S('secao', progresso)` ancora no layout real, `P(desktop, retrato)` dá enquadramento próprio para celular e `'hold'` faz um corte seco (usado debaixo da cortina).
- **Fontes**: troque os imports `@fontsource/*` em `src/main.js` e `--font-display` em `src/styles/global.css`. Se você licenciar a Nekst, por exemplo, coloque os arquivos `.woff2` em `public/fonts` com `@font-face`.
- **Escala fluida**: todo o CSS é escrito em `rem` = pixel do Figma (320 / 768 / 1024 / 1440 / 1600).

## Usar o seu próprio modelo 3D (.glb)

O relógio procedural já segue a convenção de nomes do pipeline original (`crystal-front`, `dial-front`, `bracelet.*`, `clasp-*`, `<peça>-xploded-N`, `hand-hours-pivot`, `moon-bg`…).

1. Abra `?debug` e clique em **export watch.glb (Blender)**. Você recebe o relógio atual como GLB, com os nomes e os offsets da explosão gravados em *extras*.
2. Remodele no Blender **mantendo os nomes dos nós e dos materiais**. Os materiais do site (`glossy`, `brushed`, `glass`, `dial`, `steel`, `gilt`, `perlage`, `geneva`…) são aplicados pelo nome.
3. Exporte (Meshopt e Draco são suportados, com decodificadores auto-hospedados; o caminho Meshopt foi testado), coloque em `public/models/` e abra com `?model=/models/seu.glb`. Para tornar permanente, adicione `"model": { "url": "/models/seu.glb" }` no `default.json`.

`public/models/watch.glb` já é o modelo procedural exportado e comprimido (5 MB). Teste com `?model=/models/watch.glb`. Se o GLB falhar, o site volta automaticamente para o relógio procedural.

## Parâmetros de URL

| Parâmetro | Efeito |
|---|---|
| `?lang=pt` / `en` | idioma (padrão: idioma do navegador) |
| `?finish=pure-gold&dial=midnight&strap=leather` | configuração (o botão "copiar link" gera isso) |
| `?debug` | painel lil-gui: materiais, pós, configurador, override de qualquer parâmetro da coreografia, FPS, export JSON/GLB |
| `?autoscroll&autoscrollspeed=1.5` | rolagem automática para gravar vídeo |
| `?model=/models/x.glb` | carrega um GLB no lugar do relógio procedural |
| `?low` / `?reduced` | força qualidade baixa / modo de movimento reduzido |
| `?nocursor` | usa o cursor do sistema em vez do customizado |
| `?shots` | ganchos de QA (`window.__ora`) usados pelo script de screenshots |

## QA visual

```bash
npm run dev
npm run shots -- --out shots --size 1440x900 hero:0 disassembly:0.7 mechanism:0.9
npm run shots -- --size 390x844 --query "lang=pt&finish=rose-gold"
```

O script abre o Chrome headless com GPU, pula para cada `secao:progresso` e salva os PNGs.

## Desempenho (medido em Intel UHD integrada, 1440×900, build de produção)

- 76–159 fps conforme a seção (meta: 60). O DPR adaptativo reduz a resolução sozinho se o frame passar de 22 ms.
- Shaders pré-compilados no loader contra o render target HDR real, sem engasgo na primeira rolagem.
- InstancedMesh para elos, índices, parafusos e rubis. Sem sombras em tempo real (sombra "assada"). O render pausa com a aba oculta.
- Mobile: 14 mil partículas (desktop: 42 mil), MSAA 2×, DPR ≤ 1,5, toque nativo (`syncTouch: false`), cursor desativado.
- `prefers-reduced-motion` do sistema: só suaviza o scroll (no Windows ela é ligada quando "Efeitos de animação" está desligado, muitas vezes sem querer). O modo realmente reduzido, sem partículas e com intro instantânea, fica em `?reduced`.
- JS inicial ≈ 270 KB gzip. Debug, GLB e locales carregam sob demanda.

## Acessibilidade e SEO

Todo o texto existe no DOM (não só no canvas). `lang` muda com o idioma. Botões de cor e de peças têm `aria-*` e foco visível. As imagens da galeria têm `alt`. A página tem `<title>`, meta description e cartão OG/Twitter (`public/share-image.jpg`, 1200×630, gerado a partir do próprio hero).

## Além do original

- Ponteiros na **hora real**, com segundos em *sweep* de 8 batidas/s
- **Fase da lua real** (idade lunar calculada a partir da data)
- Turbilhão girando 1 volta/min, balanço oscilando, trem de engrenagens e rotor reagindo ao scroll e ao arraste
- **Configurador** caixa × mostrador × pulseira (aço ou couro com costura) com **URL compartilhável**
- Som de catraca da coroa ao arrastar (Web Audio sintetizado, desligado por padrão)
- Galeria e fotos das peças **renderizadas a partir do 3D**, sempre no acabamento escolhido

Ficaram de fora por dependerem de hardware ou escopo maior: AR via WebXR e versão WebGPU.

## Analytics (opcional)

Para ativar o Cloudflare Web Analytics, copie `.env.example` para `.env` e preencha `VITE_CF_BEACON`.
