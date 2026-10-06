# NEXORA — Inteligência em escala planetária

Experiência WebGL cinematográfica, controlada 100% pelo scroll: uma viagem contínua de câmera
**órbita → mapa → data center → chip quântico → interfaces de IA → carro autônomo → créditos**.

A experiência usa **dados e modelos reais**: Terra com imagens da NASA (Blue Marble, Black Marble e nuvens),
céu com o mapa estelar da NASA, satélite 3D da NASA, carro PBR (Khronos Car Concept) e um cenário fotográfico
dos Alpes (HDRI da Poly Haven). Créditos e licenças em [CREDITS.md](CREDITS.md).

Se algum desses arquivos faltar, a cena correspondente volta para a versão procedural (tudo continua funcionando).

> Estrutura, técnica e ritmo inspirados em edolus.com (peça de portfólio do estúdio Vertex3D).
> Marca, textos, modelos, sons e números são originais deste projeto.

---

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera /dist
npm run preview    # serve /dist em http://localhost:4173
```

Requisitos: Node 18+ e um navegador com WebGL2.

> **Windows com Smart App Control:** o Vite 8 usa um binário nativo (Rolldown) que pode ser bloqueado
> pela política de aplicativos do Windows. Por isso o projeto está fixado no **Vite 6**.

### Controles

| Ação | Desktop | Mobile |
|---|---|---|
| Avançar / voltar | roda do mouse, ↑ ↓, PageUp/PageDown, espaço, Home/End | arrastar o dedo (com inércia) |
| Girar o chip (0.44–0.46) | arrastar com o mouse | arrastar |
| Capítulos | pontos na lateral direita | pontos na lateral direita |
| Modo debug | tecla **D** | — |
| Modo leitura | botão "Modo leitura" (Esc fecha) | idem |

---

## Estrutura

```
index.html                 meta tags (SEO / Open Graph / Twitter), fontes, camadas HTML
src/
  config.js                ← TUDO que é ajustável: faixas, textos PT/EN, volumes, assets, pós-FX
  main.js                  detecção de WebGL2 → experiência ou fallback estático
  core/
    Experience.js          renderer, carregamento, loop (scroll → cenas → UI → áudio → pós)
    EventBus.js · i18n.js · math.js
  managers/
    ScrollManager.js       scroll virtual, lerp, faixas esticadas, intro gate, snap, toque, teclado
    SceneManager.js        liga/desliga cenas por faixa e define as janelas de transição
    TransitionManager.js   fade para cor sólida (saltos de capítulo e replay)
    AudioManager.js        stems sincronizados + mix por cena + SFX por evento + loops
    CursorManager.js       cursor custom, "ROLE PARA COMEÇAR", anel "ARRASTE PARA GIRAR", arrasto
    PostFXManager.js       blend de transição → bloom → ACES/sRGB → CA, blur, vinheta, grão
    CameraController.js    caminhos de câmera por keyframes, mouse look, parallax, FOV em retrato
    OverlayManager.js      logo (claro/escuro), idioma, áudio, capítulos, letterbox, legendas
    AssetManager.js        GLTF + Draco + Meshopt + KTX2 (opcionais)
  scenes/
    OrbitScene.js          Terra procedural, atmosfera, aurora, estrelas, satélite, plexus
    DiamondMapScene.js     diamante de vidro + cáusticas → cidade no deserto (mapa "assado")
    DataCenterScene.js     corredor de racks, piso refletivo, cone volumétrico, dissolve, NXR-96
    QuantumScene.js        chip dourado, onda de cubos, véu de matriz, campo de energia, morph → card
    CardsScene.js          4 cards de vidro (transmissão real), fitas de luz, hover/tilt, ripple
    CarScene.js            interior + tela (render-to-texture dos cards), estrada, lago, montanhas
    chip.js · card.js · helpers.js · BaseScene.js
  shaders/                 ruído (simplex/fbm), shaders de transição e do passo final
  audio/                   ProceduralMusic.js (trilha generativa) · Synth.js (SFX sintetizados)
  ui/                      LoadingScreen, TextOverlay, Labels (3D + HUD do mapa), Credits,
                           DebugPanel, ReadingMode, ScrambleText, Logo
  styles/main.css
public/
  assets/{models,videos,audio,textures,images}   ← coloque seus arquivos aqui
  decoders/                Draco + Basis (copiados do three no postinstall)
  favicon.svg · og-image.png
scripts/                   ferramentas de teste visual (Chrome headless)
```

---

## Linha do tempo (progress 0 → 1)

| Faixa | Cena | Destaques |
|---|---|---|
| 0.00–0.14 | Órbita | voo de entrada (intro gate de 1200 px), painéis se abrindo, plexus, "INTELIGÊNCIA ORBITAL", label NX-1 CORE |
| 0.14–0.28 | Diamante → mapa | transição por nuvens, cristal com dispersão, flash, HUD de alvo (0.20–0.23), nó primário, mini-diamantes |
| 0.28–0.54 | Data center | rack com dissolve, "// Núcleo_Computacional", texto 3D NXR-96, ficha NEX-128, chip arrastável (0.44–0.46) |
| 0.54–0.62 | Camada quântica | chip dourado, cubos, matriz que explode, "CAMADA DE INTELIGÊNCIA", chip vira o card #0 |
| 0.62–0.71 | Cards | Raciocínio · Topologia do conhecimento · Orquestração multiagente · Emergência |
| 0.71–0.84 | Carro | a câmera recua da tela do painel, sai pelo teto e persegue o carro; mensagens finais |
| 0.83–1.00 | Créditos | letterbox fecha em faixa fina, cena escurece com blur, frases, tela final + REPLAY |

Faixas esticadas, snap, mix de áudio e todos os textos estão em `src/config.js`.

---

## Assets reais (NASA / Khronos / Poly Haven)

Os arquivos otimizados já estão em `public/assets` (~43 MB). Para regenerá-los a partir dos originais:

```bash
npm run assets          # baixa os originais (~200 MB em /assets-src) e gera as versões web
```

- **Terra:** Blue Marble 21600×10800 reduzido para 4096 + um recorte em alta resolução da região que a câmera vê
  (costa do Brasil / Atlântico Sul, `ASSETS.earthDetail`). Nuvens reais com deriva, sombra das nuvens, reflexo do sol
  no oceano, luzes noturnas da Black Marble no terminador e atmosfera calculada por caminho óptico.
- **Ponto sob o satélite:** `ASSETS.earthNadir` (latitude/longitude) gira o globo para mostrar qualquer lugar.
- **Carro:** variantes de pintura via `ASSETS.carVariant` (`Carmine Candy`, `Pearly Swirly`, `Torched Graphite`).
  A cena do carro e seus arquivos carregam em segundo plano depois do botão de início.
- **Cenário:** `ASSETS.roadHdriRotation` gira o HDRI; o chão PBR se dissolve no próprio fundo fotográfico na distância.

## Como trocar o conteúdo

### Marca, e-mail e textos
Edite `BRAND`, `SPLASH`, `TEXTS`, `LABELS`, `CARDS` e `CREDITS` em `src/config.js`.
Cada texto tem versão `pt` e `en`. O "O" do logo (círculo animado) é a letra em `BRAND.circleIndex`.
Troque também `<title>`, description e Open Graph no `index.html` e rode `npm run og-image`
(com o `npm run dev` ativo) para regerar `public/og-image.png`.

### Modelos 3D (GLB)
1. Exporte em GLB (de preferência com Draco ou Meshopt; texturas KTX2 funcionam).
2. Coloque em `public/assets/models/`.
3. Informe o caminho em `ASSETS.models` (ex.: `satellite: '/assets/models/satellite.glb'`).

| Chave | Observação |
|---|---|
| `satellite` | se tiver uma animação chamada **`Deploy`**, ela toca quando o satélite entra em quadro |
| `diamond` | substitui o cristal procedural (mantenha materiais de vidro/transmissão) |
| `chip` | usado no data center e na cena quântica (o brilho fresnel é do placeholder) |
| `car` | substitui a carroceria procedural; o interior e a tela continuam sendo os do projeto |
| `rack` | usado nos dois racks em destaque do data center (com dissolve); as fileiras continuam instanciadas |

A escala/posição pode precisar de ajuste no `build()` da cena correspondente.
Use modelos com licença adequada (Sketchfab CC, Poly Haven, modelagem própria).

### Vídeos e imagens
- `ASSETS.videos.splash`: vídeo em loop da Terra para o fundo do splash (senão é a Terra 3D ao vivo).
  A NASA tem material de domínio público.
- `ASSETS.textures.cityMap`: imagem aérea quadrada (ex.: Sentinel/Copernicus) que substitui o mapa procedural.

### Áudio
Preencha `ASSETS.audio.melody`, `.bass` e `.instruments` com 3 arquivos **do mesmo tamanho**
(mesmo BPM, mesmo número de compassos). Eles começam no mesmo instante e fazem loop juntos;
o volume de cada stem segue `AUDIO.mix`. Sem os três arquivos, a trilha generativa é usada.
Os SFX são sintetizados (`src/audio/Synth.js`); os gatilhos ficam em `SFX_CUES` no config.

---

## Performance e acessibilidade

- `devicePixelRatio` limitado a 2 (desktop) / 1.5 (mobile) e reduzido automaticamente se o FPS cair.
- Só as cenas da faixa ativa são atualizadas e renderizadas; shaders são pré-compilados no loading.
- O mapa procedural é renderizado **uma vez** numa textura 4096² (2048² no mobile).
- Proteção contra NaN/Inf no buffer HDR (um único pixel inválido apagaria a tela via bloom).
- `prefers-reduced-motion`: sem grão, sem aberração, sem parallax/mouse look; transições viram fades.
- Sem WebGL2: versão estática completa (modo leitura) com todos os textos.
- Legendas para leitores de tela (`aria-live`) acompanham o texto ativo; botões com rótulos acessíveis.
- Idioma PT/EN persistido por visitante.

---

## Testes

Com `npm run dev` rodando (os scripts usam o Chrome instalado; defina `CHROME=...` se o caminho for outro):

```bash
npm run test:smoke                     # CTA, scroll real, gate, teclado, debug, leitura, idioma, capítulos, replay, mute
npm run test:errors                    # carrega a página e lista erros
npm run shots -- http://localhost:5173/ 0.07,0.3,0.64 shots    # screenshots em pontos do progresso
W=390 H=844 npm run shots -- http://localhost:5173/ 0.07 shots  # viewport de celular
```
