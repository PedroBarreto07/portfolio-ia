import gsap from 'gsap';
import * as THREE from 'three';
import { LABELS, MAP_HUD } from '../config.js';
import { bus } from '../core/EventBus.js';
import { t } from '../core/i18n.js';
import { isMobile } from '../core/math.js';
import { $, h } from './dom.js';
import { scramble } from './ScrambleText.js';

const v = new THREE.Vector3();

/**
 * Labels HTML presos a pontos 3D. Cada cena chama
 * `labels.setAnchor(id, worldPosition, camera)` durante seu update;
 * aqui projetamos para a tela e posicionamos o elemento.
 * Estrutura: anel pulsante + linha + coluna de texto (direita ou acima).
 */
export class LabelManager {
  constructor() {
    this.root = $('#label-layer');
    this.hudRoot = $('#hud-layer');
    this.anchors = {};
    this.items = {};
    this.build();
    bus.on('lang', () => this.build());
  }

  build() {
    this.root.innerHTML = '';
    this.items = {};
    const mobile = isMobile();
    for (const [id, def] of Object.entries(LABELS)) {
      const side = mobile ? 'above' : def.side;
      const title = h('div', { class: 'label3d-title', text: t(def.title) });
      const text = h('div', { class: 'label3d-text' }, [title]);
      if (def.subtitle) text.append(h('div', { class: 'label3d-sub', text: t(def.subtitle) }));
      let lines = [];
      if (def.lines) {
        lines = t(def.lines).map((l) => h('div', { text: l }));
        text.append(h('div', { class: 'label3d-lines' }, lines));
      }
      const el = h('div', { class: `label3d side-${side}` }, [
        h('div', { class: 'label3d-ring', html: '<i></i>' }),
        h('div', { class: 'label3d-line' }),
        text,
      ]);
      this.root.append(el);
      this.items[id] = { def, el, title, lines, visible: false, timers: [] };
    }

    // HUD do mapa: moldura com cantos chanfrados
    this.hudRoot.innerHTML = '';
    this.mapHud = h('div', {
      class: 'map-hud',
      html: `<svg viewBox="0 0 190 190">
        <path class="frame" d="M18 0 H172 L190 18 V172 L172 190 H18 L0 172 V18 Z"/>
        <path class="tick" d="M18 0 H52 M138 190 H172 M0 18 V40 M190 150 V172"/>
        <path class="cross" d="M95 70 V84 M95 106 V120 M70 95 H84 M106 95 H120"/>
      </svg><div class="map-hud-tag">◢ TARGET LOCK</div>`,
    });
    this.mapHud.querySelector('.frame').style.fill = `rgba(0,0,0,${MAP_HUD.bgOpacity})`;
    this.hudRoot.append(this.mapHud);
    this.hudVisible = false;
  }

  setAnchor(id, position, camera) {
    const a = (this.anchors[id] ||= { pos: new THREE.Vector3(), camera: null, frame: -1 });
    a.pos.copy(position);
    a.camera = camera;
    a.frame = this.frame;
  }

  project(id) {
    const a = this.anchors[id];
    if (!a || a.frame !== this.frame || !a.camera) return null;
    v.copy(a.pos).project(a.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  showItem(it) {
    it.el.classList.add('is-visible');
    scramble(it.title, t(it.def.title), { duration: 0.9, delay: 0.3 });
    it.lines.forEach((l, i) =>
      it.timers.push(
        setTimeout(() => {
          l.classList.add('on');
          bus.emit('sfx', 'hudText');
        }, 600 + i * 160)
      )
    );
  }

  hideItem(it) {
    it.el.classList.remove('is-visible');
    it.timers.forEach(clearTimeout);
    it.timers = [];
    it.lines.forEach((l) => l.classList.remove('on'));
  }

  // chamado antes das cenas atualizarem
  beginFrame() {
    this.frame = (this.frame || 0) + 1;
  }

  update(p) {
    for (const [id, it] of Object.entries(this.items)) {
      const [a, b] = it.def.range;
      const s = p >= a && p <= b ? this.project(id) : null;
      const vis = !!s;
      if (vis !== it.visible) {
        it.visible = vis;
        if (vis) this.showItem(it);
        else this.hideItem(it);
      }
      if (s) it.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`;
    }

    // HUD do mapa
    const [h0, h1] = MAP_HUD.range;
    const sp = p >= h0 && p <= h1 ? this.project('mapNode') : null;
    const hudVis = !!sp;
    if (hudVis !== this.hudVisible) {
      this.hudVisible = hudVis;
      gsap.killTweensOf(this.mapHud);
      if (hudVis) {
        const tl = gsap.timeline();
        tl.fromTo(
          this.mapHud,
          { scale: MAP_HUD.openFrom, opacity: 0 },
          { scale: 1, opacity: 1, duration: MAP_HUD.openDuration, ease: 'power3.out' }
        );
        for (let i = 0; i < MAP_HUD.blinks; i++) {
          tl.to(this.mapHud, { opacity: 0.1, duration: 0.01 }, `+=${MAP_HUD.blinkInterval}`);
          tl.to(this.mapHud, { opacity: 1, duration: 0.01 }, `+=${MAP_HUD.blinkInterval}`);
        }
        bus.emit('sfx', 'hudText');
      } else gsap.to(this.mapHud, { opacity: 0, scale: 1.08, duration: 0.35 });
    }
    if (sp) {
      this.mapHud.style.left = `${sp.x}px`;
      this.mapHud.style.top = `${sp.y}px`;
    }
  }
}
