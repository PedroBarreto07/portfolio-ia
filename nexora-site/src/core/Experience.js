import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AUDIO, POSTFX } from '../config.js';
import { bus } from './EventBus.js';
import { isMobile } from './math.js';
import { ScrollManager } from '../managers/ScrollManager.js';
import { SceneManager } from '../managers/SceneManager.js';
import { TransitionManager } from '../managers/TransitionManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { CursorManager } from '../managers/CursorManager.js';
import { PostFXManager } from '../managers/PostFXManager.js';
import { CameraController } from '../managers/CameraController.js';
import { OverlayManager } from '../managers/OverlayManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { TextOverlay } from '../ui/TextOverlay.js';
import { LabelManager } from '../ui/Labels.js';
import { Credits } from '../ui/Credits.js';
import { DebugPanel } from '../ui/DebugPanel.js';
import { ReadingMode } from '../ui/ReadingMode.js';
import { sceneClasses } from '../scenes/index.js';

/**
 * Orquestrador: cria o renderer e os managers, conduz o carregamento,
 * e roda o loop (scroll → cenas → overlays → áudio → pós-processamento).
 */
export class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    const mobile = isMobile();
    this.sizes = {
      width: innerWidth,
      height: innerHeight,
      mobile,
      maxDpr: mobile ? POSTFX.maxDpr.mobile : POSTFX.maxDpr.desktop,
      dpr: 1,
    };
    this.sizes.dpr = Math.min(devicePixelRatio || 1, this.sizes.maxDpr);

    const renderer = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA nos render targets
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    }));
    renderer.setPixelRatio(this.sizes.dpr);
    renderer.setSize(this.sizes.width, this.sizes.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = POSTFX.exposure;
    renderer.info.autoReset = false;
    renderer.shadowMap.enabled = true; // só a cena do carro tem luz com sombra
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Ambiente de reflexo padrão (PMREM) para materiais físicos
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.scroll = new ScrollManager();
    this.cursor = new CursorManager();
    this.cameraFX = new CameraController(this.cursor.mouse);
    this.audio = new AudioManager();
    this.transitions = new TransitionManager();
    this.postfx = new PostFXManager(renderer, this.sizes);
    this.assets = new AssetManager(renderer);
    this.labels = new LabelManager();
    this.text = new TextOverlay();
    this.loading = new LoadingScreen();
    this.reading = new ReadingMode();
    this.overlay = new OverlayManager({
      audio: this.audio,
      onChapter: (p) => this.goTo(p),
      onReading: () => this.reading.open(),
    });
    this.credits = new Credits({ onReplay: () => this.goTo(0) });

    this.ctx = {
      renderer,
      sizes: this.sizes,
      assets: this.assets,
      audio: this.audio,
      audioCfg: AUDIO,
      mouse: this.cursor.mouse,
      cursor: this.cursor,
      scroll: this.scroll,
      labels: this.labels,
      cameraFX: this.cameraFX,
      postfx: this.postfx,
      pmrem: this.pmrem,
      envMap: this.envMap,
    };
    this.scenes = new SceneManager(this.ctx, sceneClasses);
    this.ctx.scenesById = this.scenes.byId;
    this.debug = new DebugPanel(this);

    this.time = 0;
    this.last = performance.now();
    this.perf = { acc: 0, frames: 0, checks: 0 };

    bus.on('cta', () => this.start());
    bus.on('reading', (open) => (this.scroll.locked = open));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (!this.audio.ctx) return;
      if (document.hidden) this.audio.ctx.suspend();
      else this.audio.ctx.resume();
    });

    // atalho para testes / console
    window.__exp = this;
  }

  async load() {
    const L = this.loading;
    const weights = { fonts: 0.1, assets: 0.25, build: 0.35, compile: 0.3 };
    let base = 0;
    const step = (w) => (p) => L.setProgress(base + w * p);

    // fontes (com timeout para não travar offline)
    const fontLoads = [
      '300 40px "General Sans"',
      '600 40px "General Sans"',
      '700 40px "General Sans"',
      '400 14px "JetBrains Mono"',
    ].map((f) => document.fonts?.load(f).catch(() => {}));
    await Promise.race([Promise.all(fontLoads), new Promise((r) => setTimeout(r, 3500))]);
    L.setProgress((base += weights.fonts));

    // grupo crítico (Terra, estrelas, satélite) antes do botão de início
    await this.assets.load('critical', step(weights.assets));
    L.setProgress((base += weights.assets));

    const now = (s) => !s.constructor.deferred;
    await this.scenes.build(step(weights.build), now);
    L.setProgress((base += weights.build));
    this.scenes.resize(this.sizes.width, this.sizes.height);

    // começa a renderizar a órbita atrás do splash enquanto compila o resto
    this.loop();

    await this.scenes.compile(this.renderer, step(weights.compile), now);
    L.ready();

    // cenas pesadas (carro + HDRI + texturas) carregam em segundo plano
    this.loadDeferred();
  }

  async loadDeferred() {
    const later = (s) => !!s.constructor.deferred;
    await this.assets.load('deferred');
    await this.scenes.build(null, later);
    await this.scenes.compile(this.renderer, null, later);
    this.deferredReady = true;
  }

  async start() {
    document.body.classList.remove('bands-intro');
    document.body.classList.add('bands-open', 'started');
    setTimeout(() => document.body.classList.remove('bands-open'), 1800);
    this.cursor.setStarted();
    this.scroll.enable();
    try {
      await this.audio.init();
      this.audio.start();
      this.audio.play('click');
    } catch (e) {
      console.warn('[audio]', e);
    }
  }

  goTo(p) {
    this.transitions.through(() => this.scroll.jump(p));
  }

  resize() {
    const s = this.sizes;
    s.width = innerWidth;
    s.height = innerHeight;
    s.mobile = isMobile();
    s.dpr = Math.min(devicePixelRatio || 1, s.maxDpr, s.dprCap ?? Infinity);
    this.renderer.setPixelRatio(s.dpr);
    this.renderer.setSize(s.width, s.height, false);
    this.postfx.resize();
    this.scenes.resize(s.width, s.height);
  }

  // Reduz a resolução se o FPS ficar baixo por alguns segundos
  adaptQuality(dt) {
    if (!POSTFX.adaptiveQuality || this.perf.checks > 4) return;
    this.perf.acc += dt;
    this.perf.frames++;
    if (this.perf.acc < 2.5) return;
    const fps = this.perf.frames / this.perf.acc;
    this.perf.acc = 0;
    this.perf.frames = 0;
    if (fps < 40 && this.sizes.dpr > 1) {
      this.perf.checks++;
      this.sizes.dprCap = Math.max(1, this.sizes.dpr - 0.25);
      this.resize();
    }
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.renderer.info.reset();

    this.scroll.update(dt);
    const p = this.scroll.progress;
    this.cameraFX.update(dt);
    this.labels.beginFrame();
    const st = this.scenes.update(p, dt, this.time);

    this.labels.update(p);
    this.text.update(p);
    this.overlay.update(p);
    this.credits.update(p);
    this.cursor.update(dt, p, this.scroll.gateDone);
    this.audio.update(p, this.scroll.velocity);

    this.postfx.render(st.a, st.b, st.mix, st.type, dt, this.time);
    this.debug.update(dt);
    if (this.scroll.enabled) this.adaptQuality(dt);
  };
}
