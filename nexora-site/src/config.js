/**
 * ============================================================================
 *  CONFIG CENTRAL — tudo que é ajustável vive aqui.
 *  Faixas de progresso (0 → 1), textos (PT/EN), volumes, assets e pós-FX.
 *  Altere estes valores sem mexer no resto do código.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/*  MARCA                                                                     */
/* -------------------------------------------------------------------------- */
export const BRAND = {
  name: 'NEXORA',
  // A letra no índice `circleIndex` vira um círculo SVG que se desenha em loop.
  circleIndex: 3, // N E X [O] R A
  studio: 'SEU ESTÚDIO',
  email: 'contato@seuestudio.com',
  // atribuições exibidas nos créditos finais (o carro exige CC BY 4.0)
  assetCredits: 'Imagens da Terra e satélite: NASA · Carro: Car Concept © Darmstadt Graphics Group, CC BY 4.0 · Ambiente e texturas: Poly Haven (CC0)',
  url: 'https://seuestudio.com',
};

export const DEFAULT_LANG = 'pt'; // 'pt' | 'en'

/* -------------------------------------------------------------------------- */
/*  ASSETS                                                                    */
/*  Caminhos relativos a /public. `null` = usa o placeholder procedural.      */
/*  Os arquivos atuais são gerados por `npm run assets` (fontes: NASA,        */
/*  Khronos, Poly Haven — ver README / CREDITS).                              */
/*  group 'deferred' = carrega em segundo plano depois do botão de início.    */
/* -------------------------------------------------------------------------- */
export const ASSETS = {
  models: {
    satellite: '/assets/models/satellite_ssl1300.glb', // NASA 3D Resources (SSL-1300); animação "Deploy" opcional
    diamond: null,
    rack: null,
    chip: null,
    car: { url: '/assets/models/car_concept.glb', group: 'deferred' }, // Khronos Car Concept (CC BY 4.0)
  },
  // Variante de pintura do carro (KHR_materials_variants): 'Carmine Candy' | 'Pearly Swirly' | 'Torched Graphite'
  carVariant: 'Carmine Candy',
  videos: {
    splash: null, // vídeo em loop da Terra para o splash (senão usa a Terra 3D ao vivo)
  },
  textures: {
    cityMap: null, // imagem aérea de cidade (senão o mapa é procedural)
    // Terra — NASA Blue Marble / Black Marble / nuvens
    earthDay: '/assets/earth/day_4k.jpg',
    earthDayDetail: '/assets/earth/day_detail.jpg',
    earthNight: '/assets/earth/night_4k.jpg',
    earthClouds: { url: '/assets/earth/clouds_4k.jpg', linear: true },
    earthCloudsDetail: { url: '/assets/earth/clouds_detail.jpg', linear: true },
    // Céu — NASA SVS Deep Star Maps 2020
    starmap: '/assets/space/starmap_4k.jpg',
    // Cena do carro — Poly Haven (CC0)
    roadBackplate: { url: '/assets/hdri/lago_disola_8k.jpg', mobile: '/assets/hdri/lago_disola_4k.jpg', group: 'deferred' },
    asphaltDiff: { url: '/assets/textures/asphalt_02_diff.jpg', repeat: true, group: 'deferred' },
    asphaltNor: { url: '/assets/textures/asphalt_02_nor.jpg', repeat: true, linear: true, group: 'deferred' },
    asphaltArm: { url: '/assets/textures/asphalt_02_arm.jpg', repeat: true, linear: true, group: 'deferred' },
    snowDiff: { url: '/assets/textures/snow_02_diff.jpg', repeat: true, group: 'deferred' },
    snowNor: { url: '/assets/textures/snow_02_nor.jpg', repeat: true, linear: true, group: 'deferred' },
    snowArm: { url: '/assets/textures/snow_02_arm.jpg', repeat: true, linear: true, group: 'deferred' },
    rocksDiff: { url: '/assets/textures/rocks_ground_02_diff.jpg', repeat: true, group: 'deferred' },
    rocksNor: { url: '/assets/textures/rocks_ground_02_nor.jpg', repeat: true, linear: true, group: 'deferred' },
    rocksArm: { url: '/assets/textures/rocks_ground_02_arm.jpg', repeat: true, linear: true, group: 'deferred' },
  },
  hdri: {
    road: { url: '/assets/hdri/lago_disola_2k.hdr', group: 'deferred' }, // iluminação/reflexos do carro
  },
  // Região da Terra coberta pela textura de alta resolução (graus) — igual ao scripts/process-assets.mjs
  earthDetail: { lon0: -75, lon1: -5, lat0: 15, lat1: -40 },
  // Ponto da Terra sob o satélite (graus) e rotação do HDRI da estrada (radianos)
  earthNadir: { lat: -11, lon: -39 },
  roadHdriRotation: Math.PI, // estrada aponta para o lago congelado e os Alpes
  audio: {
    // Stems sincronizados em loop. Se algum for null, a trilha é sintetizada ao vivo.
    melody: null,
    bass: null,
    instruments: null,
  },
};

/* -------------------------------------------------------------------------- */
/*  SCROLL                                                                    */
/* -------------------------------------------------------------------------- */
export const SCROLL = {
  totalScrollPx: 24000, // pixels de roda para ir de 0 a 1 (desktop)
  touchScrollPx: 4000, // deslocamento do dedo para ir de 0 a 1 (mobile)
  lerpSpeed: 0.1, // current += (target - current) * lerpSpeed (a 60fps)
  keyStep: 0.12, // passo das setas (× 2000px de roda ≈ 1% de progresso)
  touchInertia: 0.94, // fricção da inércia do toque (por frame a 60fps)
  introGatePx: 1200, // scroll inicial que só traz o satélite para o quadro

  // Faixas "esticadas": o scroll anda mais devagar (factor = quanto mais lento)
  stretch: [
    { from: 0.06, to: 0.085, factor: 1.5 }, // satélite
    { from: 0.205, to: 0.28, factor: 1.6 }, // mapa
    { from: 0.545, to: 0.57, factor: 2.5 }, // chip quantum
    { from: 0.57, to: 0.705, factor: 1.5 }, // cards de UI
    { from: 0.715, to: 0.84, factor: 1.5 }, // mensagens do carro
  ],

  snap: {
    points: [0.06, 0.145, 0.205, 0.44, 0.52, 0.61, 1],
    radius: 0.014,
    idleDelay: 1, // segundos parado antes de atrair
    duration: 1.1,
  },
};

/* -------------------------------------------------------------------------- */
/*  CENAS + TRANSIÇÕES                                                        */
/* -------------------------------------------------------------------------- */
export const SCENES = [
  { id: 'orbit', range: [0.0, 0.14], bloom: 0.9, chapter: 0 },
  { id: 'diamondMap', range: [0.14, 0.28], bloom: 0.55, chapter: 1 },
  { id: 'dataCenter', range: [0.28, 0.54], bloom: 0.45, chapter: 2 },
  { id: 'quantum', range: [0.54, 0.62], bloom: 1.25, chapter: 3 },
  { id: 'cards', range: [0.62, 0.71], bloom: 1.0, chapter: 4 },
  { id: 'car', range: [0.71, 1.0], bloom: 0.7, chapter: 5 },
];

// Transições entre cenas consecutivas. `width` = largura total da janela de mistura.
// Tipos: 'fade' | 'clouds' | 'flash' | 'chromatic' | 'black'
export const TRANSITIONS = [
  { at: 0.14, width: 0.016, type: 'clouds' },
  { at: 0.28, width: 0.016, type: 'chromatic' },
  { at: 0.54, width: 0.01, type: 'fade' },
  { at: 0.62, width: 0.01, type: 'flash' },
  { at: 0.71, width: 0.006, type: 'fade' },
];

export const TRANSITION_DEFAULT = { color: '#000', duration: 0.7 };

export const CHAPTERS = [
  { label: { pt: 'Órbita', en: 'Orbit' }, goto: 0.06 },
  { label: { pt: 'Mapa', en: 'Map' }, goto: 0.205 },
  { label: { pt: 'Data center', en: 'Data center' }, goto: 0.3 },
  { label: { pt: 'Camada quântica', en: 'Quantum layer' }, goto: 0.555 },
  { label: { pt: 'Interfaces', en: 'Interfaces' }, goto: 0.635 },
  { label: { pt: 'Mundo real', en: 'Real world' }, goto: 0.75 },
];

/* -------------------------------------------------------------------------- */
/*  CÂMERA / INTERAÇÃO                                                        */
/* -------------------------------------------------------------------------- */
export const CAMERA = {
  parallaxOrbit: 0.6, // força do parallax do mouse na órbita
  mouseLookA: { range: [0.28, 0.4], pitch: 3, yaw: 4, smoothing: 0.06 },
  mouseLookB: { range: [0.71, 0.85], pitch: 2.5, yaw: 5, smoothing: 0.05 },
  dragRotate: { range: [0.44, 0.46] },
};

export const CURSOR = {
  scrollHint: { range: [0.0, 0.1], delay: 600, lerp: 5, offsetX: 24 },
  dragRing: { range: [0.44, 0.46], size: 120, spinSeconds: 6, scaleDuration: 0.45 },
};

/* -------------------------------------------------------------------------- */
/*  OVERLAY                                                                    */
/* -------------------------------------------------------------------------- */
export const OVERLAY = {
  logoWidth: 156,
  logoWidthMobile: 108,
  margin: 40,
  marginMobile: 20,
  mobileBreakpoint: 768,
  logoDark: { range: [0.752, 0.752], fade: 0.02 }, // cena final fotográfica: logo claro
};

/* -------------------------------------------------------------------------- */
/*  PÓS-PROCESSAMENTO                                                         */
/* -------------------------------------------------------------------------- */
export const POSTFX = {
  bloomRadius: 0.55,
  bloomThreshold: 0.86,
  bloomFade: 0.8, // segundos de fade do bloom ao trocar de cena
  grain: 0.06,
  vignette: 0.32,
  chromatic: 0.0018, // aberração nas bordas (base)
  exposure: 1.0,
  maxDpr: { desktop: 2, mobile: 1.5 },
  adaptiveQuality: true, // reduz DPR se o FPS cair
};

/* -------------------------------------------------------------------------- */
/*  ÁUDIO                                                                     */
/* -------------------------------------------------------------------------- */
export const AUDIO = {
  master: 0.8,
  fadeIn: 2,
  stemCrossfade: 1.2,
  muteFade: 1,
  bpm: 84,
  mix: [
    { range: [0.0, 0.01], melody: 0, bass: 0, instruments: 1 }, // intro
    { range: [0.01, 0.14], melody: 0.8, bass: 0.6, instruments: 1 }, // órbita
    { range: [0.14, 0.28], melody: 0.6, bass: 0, instruments: 1 }, // mapa
    { range: [0.28, 0.54], melody: 0.8, bass: 0, instruments: 0.2 }, // data center
    { range: [0.54, 0.62], melody: 1, bass: 1, instruments: 1 }, // quantum
    { range: [0.62, 0.71], melody: 0.5, bass: 0.6, instruments: 1 }, // cards
    { range: [0.71, 0.84], melody: 1, bass: 0.9, instruments: 1 }, // carro (clímax)
    { range: [0.84, 1.0], melody: 0.35, bass: 0.15, instruments: 0.55 }, // créditos (fade)
  ],
  sfx: {
    click: 0.7,
    ringPulse: 0.4,
    diamondArrive: 0.6,
    rack: 0.4,
    computeCore: 0.2,
    hudText: 0.5,
    scramble: 0.25,
    intelligenceLayer: 0.55,
    matrixGrid: 0.45,
    chipLoop: 0.3,
    quantumLoop: 0.35,
    whoosh: 0.35,
  },
  chipLoopFadeOut: 0.8,
  quantumLoopFadeOut: 0.5,
  quantumMaxRate: 2,
};

// Eventos sonoros disparados ao cruzar um ponto do progresso (só na ida).
export const SFX_CUES = [
  { at: 0.062, sfx: 'ringPulse' },
  { at: 0.142, sfx: 'whoosh' },
  { at: 0.226, sfx: 'diamondArrive' },
  { at: 0.315, sfx: 'rack' },
  { at: 0.4, sfx: 'computeCore' },
  { at: 0.572, sfx: 'matrixGrid' },
  { at: 0.578, sfx: 'intelligenceLayer' },
  { at: 0.712, sfx: 'whoosh' },
];

/* -------------------------------------------------------------------------- */
/*  TEXTOS                                                                    */
/*  type: 'scramble' | 'type' | 'fade' | 'hud' | 'list'                       */
/*  pos : classe de posicionamento definida no CSS                            */
/* -------------------------------------------------------------------------- */
export const SPLASH = {
  title: {
    pt: ['INTELIGÊNCIA', 'EM ESCALA', 'PLANETÁRIA'],
    en: ['INTELLIGENCE', 'AT PLANETARY', 'SCALE'],
  },
  subtitle: {
    pt: 'Uma jornada da órbita ao asfalto',
    en: 'A journey from orbit to asphalt',
  },
  cta: { pt: 'ATIVAR SISTEMA', en: 'ACTIVATE SYSTEM' },
  headphones: { pt: 'EXPERIÊNCIA COM FONES DE OUVIDO', en: 'EXPERIENCE WITH HEADPHONES' },
  tips: {
    pt: ['Role para avançar', 'Arraste para girar objetos', 'Tecla D: modo debug'],
    en: ['Scroll to advance', 'Drag to rotate objects', 'Press D: debug mode'],
  },
};

export const TEXTS = [
  /* ---------------- CENA 0 — ÓRBITA ---------------- */
  {
    id: 'orbit-title',
    range: [0.012, 0.056],
    pos: 'left-center',
    type: 'scramble',
    title: { pt: ['INTELIGÊNCIA', 'ORBITAL'], en: ['ORBITAL', 'INTELLIGENCE'] },
    body: {
      pt: 'Sistemas orbitais autônomos coordenam, sincronizam e retransmitem inteligência pelo planeta em tempo real.',
      en: 'Autonomous orbital systems coordinate, synchronize and relay intelligence across the planet in real time.',
    },
  },

  /* ---------------- CENA 1 — MAPA ---------------- */
  {
    id: 'map-block',
    range: [0.232, 0.276],
    pos: 'left-bottom',
    type: 'list',
    eyebrow: { pt: '+ Sistemas urbanos', en: '+ Urban systems' },
    title: { pt: ['Orquestração', 'regional'], en: ['Regional', 'orchestration'] },
    items: {
      pt: ['Roteamento de inferência', 'Sincronização', 'Escala autônoma', 'Coordenação de borda'],
      en: ['Inference routing', 'Synchronization', 'Autonomous scaling', 'Edge coordination'],
    },
  },

  /* ---------------- CENA 2 — DATA CENTER ---------------- */
  {
    id: 'dc-title',
    range: [0.298, 0.352],
    pos: 'left-center',
    type: 'type',
    title: { pt: ['// Núcleo_Computacional'], en: ['// Compute_Core'] },
    body: {
      pt: 'Infraestrutura computacional massiva transformando poder de processamento em inteligência escalável.',
      en: 'Massive compute infrastructure turning raw processing power into scalable intelligence.',
    },
  },
  {
    id: 'dc-array',
    range: [0.358, 0.402],
    pos: 'right-center',
    type: 'hud',
    eyebrow: { pt: '+ NXR-96 Compute Array', en: '+ NXR-96 Compute Array' },
    items: {
      pt: [
        'Paralelismo multinó',
        'Troca térmica dinâmica',
        'Roteamento preditivo de carga',
        'Malha de latência ultrabaixa',
      ],
      en: [
        'Multi-Node Parallelism',
        'Dynamic Thermal Exchange',
        'Predictive Workload Routing',
        'Ultra-Low Latency Fabric',
      ],
    },
  },
  {
    id: 'dc-spec',
    range: [0.405, 0.438],
    pos: 'left-center',
    type: 'spec',
    eyebrow: { pt: '// NEX-128 Compute Core', en: '// NEX-128 Compute Core' },
    rows: {
      pt: [
        ['Arquitetura', 'Malha neural distribuída'],
        ['Densidade', '6.2 ExaOPS'],
        ['Memória', 'Unificada adaptativa 96 TB'],
        ['Térmica', 'Imersão bifásica'],
        ['Latência', '< 0.6 ms'],
        ['Energia', '22 MW escala dinâmica'],
      ],
      en: [
        ['Architecture', 'Distributed Neural Fabric'],
        ['Density', '6.2 ExaOPS'],
        ['Memory', 'Adaptive Unified 96 TB'],
        ['Thermal', 'Two-phase immersion'],
        ['Latency', '< 0.6 ms'],
        ['Power', '22 MW Dynamic Scaling'],
      ],
    },
  },
  {
    id: 'dc-chip',
    range: [0.462, 0.528],
    pos: 'right-bottom',
    type: 'scramble',
    small: true,
    title: { pt: ['NX-Q1'], en: ['NX-Q1'] },
    body: {
      pt: 'Unidade de inferência quântica. 4.096 qubits lógicos refrigerados a 12 mK.',
      en: 'Quantum inference unit. 4,096 logical qubits cooled to 12 mK.',
    },
  },

  /* ---------------- CENA 3 — QUANTUM ---------------- */
  {
    id: 'q-layer',
    range: [0.576, 0.612],
    pos: 'center',
    type: 'split',
    title: { pt: ['CAMADA DE', 'INTELIGÊNCIA'], en: ['INTELLIGENCE', 'LAYER'] },
  },

  /* ---------------- CENA 5 — CARRO ---------------- */
  {
    id: 'car-msg-1',
    range: [0.758, 0.795],
    pos: 'top-center',
    type: 'fade',
    title: { pt: ['Do gêmeo digital', 'à estrada real,'], en: ['From digital twin', 'to the open road,'] },
  },
  {
    id: 'car-msg-2',
    range: [0.8, 0.838],
    pos: 'top-center',
    type: 'fade',
    title: {
      pt: ['a inteligência une percepção,', 'previsão e ação autônoma.'],
      en: ['intelligence fuses perception,', 'prediction and autonomous action.'],
    },
  },
];

// Labels 3D presos a objetos (posição projetada a cada frame)
export const LABELS = {
  satellite: {
    range: [0.06, 0.128],
    title: { pt: 'NX-1 CORE', en: 'NX-1 CORE' },
    subtitle: { pt: 'Núcleo de inferência autônomo', en: 'Autonomous Inference Core' },
    side: 'right', // desktop; no mobile vira 'above'
  },
  mapNode: {
    range: [0.2, 0.278],
    title: { pt: 'NÓ PRIMÁRIO 07', en: 'PRIMARY NODE 07' },
    lines: {
      pt: ['HUB REGIONAL DE COMPUTAÇÃO', 'STATUS — ATIVO', 'LATÊNCIA — 9ms', 'UPLINK — ESTÁVEL'],
      en: ['REGIONAL COMPUTE HUB', 'STATUS — ACTIVE', 'LATENCY — 9ms', 'UPLINK — STABLE'],
    },
    side: 'right',
  },
};

export const MAP_HUD = {
  range: [0.2, 0.23],
  openFrom: 0.82,
  openDuration: 0.55,
  blinks: 2,
  blinkInterval: 0.12,
  bgOpacity: 0.35,
};

export const CARDS = [
  {
    eyebrow: { pt: 'Arquitetura de decisão adaptativa', en: 'Adaptive decision architecture' },
    title: { pt: 'RACIOCÍNIO', en: 'REASONING' },
    bullets: {
      pt: ['Avaliação preditiva', 'Seleção dinâmica de rotas', 'Inferência sensível ao contexto'],
      en: ['Predictive evaluation', 'Dynamic route selection', 'Context-aware inference'],
    },
    object: 'graph',
  },
  {
    eyebrow: { pt: 'Mapeamento semântico distribuído', en: 'Distributed semantic mapping' },
    title: { pt: 'TOPOLOGIA DO CONHECIMENTO', en: 'KNOWLEDGE TOPOLOGY' },
    bullets: {
      pt: ['Agrupamento semântico', 'Grafos de memória relacional', 'Modelagem contextual do mundo'],
      en: ['Semantic clustering', 'Relational memory graphs', 'Contextual world modeling'],
    },
    object: 'sphere',
  },
  {
    eyebrow: { pt: 'Sistemas autônomos coordenados', en: 'Coordinated autonomous systems' },
    title: { pt: 'ORQUESTRAÇÃO MULTIAGENTE', en: 'MULTI-AGENT ORCHESTRATION' },
    bullets: {
      pt: ['Sincronização de frota', 'Decisão distribuída', 'Coordenação autônoma'],
      en: ['Fleet synchronization', 'Distributed decision systems', 'Autonomous coordination'],
    },
    object: 'agents',
  },
  {
    eyebrow: { pt: 'Comportamento auto-organizado', en: 'Self-organizing intelligence behavior' },
    title: { pt: 'EMERGÊNCIA', en: 'EMERGENCE' },
    bullets: {
      pt: ['Evolução adaptativa do sistema', 'Formação de padrões', 'Otimização recursiva'],
      en: ['Adaptive system evolution', 'Behavioral pattern formation', 'Recursive optimization'],
    },
    object: 'cubes',
  },
];

export const CREDITS = {
  range: [0.83, 1.0],
  bandsClosedAt: 0.87,
  stripHeight: 40, // vh da faixa visível
  darken: 0.5,
  blur: 1,
  phrase1: { at: 0.25, out: 0.52, pt: `${BRAND.name} nunca existiu.`, en: `${BRAND.name} never existed.` },
  phrase2: {
    at: 0.55,
    out: 0.85,
    pt: 'A experiência <b>sim</b>.',
    en: 'The experience <b>did</b>.',
  },
  final: {
    at: 0.88,
    line: { pt: 'Agora <b>imagine a sua</b>.', en: 'Now <b>imagine yours</b>.' },
    replay: { pt: 'REVER EXPERIÊNCIA', en: 'REPLAY EXPERIENCE' },
  },
};

export const UI_TEXT = {
  scrollHint: { pt: 'ROLE PARA COMEÇAR ↓', en: 'SCROLL TO BEGIN ↓' },
  drag: { pt: 'ARRASTE PARA GIRAR', en: 'DRAG TO ROTATE' },
  audioOn: { pt: 'Som ligado', en: 'Sound on' },
  audioOff: { pt: 'Som desligado', en: 'Sound off' },
  reading: { pt: 'Modo leitura', en: 'Reading mode' },
  close: { pt: 'Fechar', en: 'Close' },
  loading: { pt: 'CARREGANDO SISTEMAS', en: 'LOADING SYSTEMS' },
  noWebgl: {
    pt: 'Seu navegador não suporta WebGL. Exibindo a versão estática da experiência.',
    en: 'Your browser does not support WebGL. Showing the static version of the experience.',
  },
};
