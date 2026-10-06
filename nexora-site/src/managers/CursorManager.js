import gsap from 'gsap';
import { CURSOR, UI_TEXT } from '../config.js';
import { bus } from '../core/EventBus.js';
import { t } from '../core/i18n.js';
import { damp, inRange } from '../core/math.js';
import { $, h } from '../ui/dom.js';
import { scramble } from '../ui/ScrambleText.js';

/**
 * Cursor customizado + dica "ROLE PARA COMEÇAR ↓" + anel "ARRASTE PARA GIRAR".
 * Também é a fonte do estado de mouse (`mouse`) e de arrasto (`drag`) usado
 * pelas cenas.
 */
export class CursorManager {
  constructor() {
    this.root = $('#cursor');
    this.fine = window.matchMedia('(pointer: fine)').matches;
    this.mouse = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, moved: false };
    this.drag = { enabled: false, active: false, dx: 0, dy: 0, vx: 0, vy: 0 };
    this.lerped = { x: this.mouse.px, y: this.mouse.py };
    this.hintPos = { x: this.mouse.px, y: this.mouse.py };
    this.hintVisible = false;
    this.ringVisible = false;
    this.started = false;

    this.build();
    bus.on('lang', () => this.build());

    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: true });
    window.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', () => this.onUp());
    window.addEventListener('pointercancel', () => this.onUp());
    document.addEventListener('pointerover', (e) => {
      const interactive = e.target.closest?.('a, button, [data-hover]');
      this.ring?.classList.toggle('is-hover', !!interactive);
    });
  }

  build() {
    this.root.innerHTML = '';
    if (this.fine) {
      document.body.classList.add('has-custom-cursor');
      this.dot = h('div', { class: 'cursor-dot' });
      this.ring = h('div', { class: 'cursor-ring' });
      this.root.append(this.ring, this.dot);
    }
    this.hint = h('div', { class: 'cursor-hint' });
    this.hint.textContent = t(UI_TEXT.scrollHint);
    const label = t(UI_TEXT.drag);
    const r = CURSOR.dragRing.size / 2;
    this.dragRing = h('div', {
      class: 'drag-ring',
      style: `width:${r * 2}px;height:${r * 2}px;margin:${-r}px 0 0 ${-r}px`,
      html: `<svg viewBox="0 0 120 120" style="animation-duration:${CURSOR.dragRing.spinSeconds}s">
          <defs><path id="ringPath" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs>
          <circle cx="60" cy="60" r="56"/>
          <circle cx="60" cy="60" r="4" style="fill:#fff;stroke:none"/>
          <text><textPath href="#ringPath">${label} • ${label} •</textPath></text>
        </svg><div class="arrows">‹ ›</div>`,
    });
    this.root.append(this.hint, this.dragRing);
    this.hintVisible = false;
    this.ringVisible = false;
  }

  onMove(e) {
    this.mouse.px = e.clientX;
    this.mouse.py = e.clientY;
    this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    this.mouse.moved = true;
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lastX;
      const dy = e.clientY - this.drag.lastY;
      this.drag.dx += dx;
      this.drag.dy += dy;
      this.drag.vx = dx;
      this.drag.vy = dy;
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
    }
  }

  onDown(e) {
    if (!this.drag.enabled || e.target.closest('button, a, #debug')) return;
    this.drag.active = true;
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    gsap.to(this.dragRing, { scale: 0.82, duration: 0.25 });
  }

  onUp() {
    if (!this.drag.active) return;
    this.drag.active = false;
    if (this.ringVisible) gsap.to(this.dragRing, { scale: 1, duration: 0.35, ease: 'back.out(2)' });
  }

  // Consome o delta acumulado (as cenas aplicam rotação)
  consumeDrag() {
    const d = { dx: this.drag.dx, dy: this.drag.dy };
    this.drag.dx = this.drag.dy = 0;
    return d;
  }

  setStarted() {
    this.started = true;
    this.startTime = performance.now();
  }

  update(dt, p, gateDone) {
    const m = this.mouse;
    // dot + ring
    if (this.dot) {
      this.dot.style.transform = `translate3d(${m.px}px,${m.py}px,0)`;
      const k = damp(0.18, dt);
      this.lerped.x += (m.px - this.lerped.x) * k;
      this.lerped.y += (m.py - this.lerped.y) * k;
      this.ring.style.transform = `translate3d(${this.lerped.x}px,${this.lerped.y}px,0)`;
    }

    // Dica de scroll: segue o mouse com atraso (lerp 5/s), 24px à direita
    const hc = CURSOR.scrollHint;
    const showHint =
      this.started && performance.now() - this.startTime > hc.delay && (inRange(p, hc.range) || !gateDone) && p < hc.range[1];
    if (showHint !== this.hintVisible) {
      this.hintVisible = showHint;
      this.hint.classList.toggle('is-visible', showHint);
      if (showHint) scramble(this.hint, t(UI_TEXT.scrollHint), { duration: 0.8 });
    }
    const ax = this.fine ? m.px + hc.offsetX : innerWidth / 2 - 60;
    const ay = this.fine ? m.py : innerHeight - 90;
    const kh = 1 - Math.exp(-hc.lerp * dt);
    this.hintPos.x += (ax - this.hintPos.x) * kh;
    this.hintPos.y += (ay - this.hintPos.y) * kh;
    this.hint.style.transform = `translate3d(${this.hintPos.x}px,${this.hintPos.y}px,0)`;

    // Anel "arraste para girar"
    const ring = inRange(p, CURSOR.dragRing.range);
    this.drag.enabled = ring;
    if (ring !== this.ringVisible) {
      this.ringVisible = ring;
      gsap.to(this.dragRing, {
        scale: ring ? 1 : 0,
        duration: CURSOR.dragRing.scaleDuration,
        ease: ring ? 'back.out(1.6)' : 'power2.in',
      });
      this.ring?.style.setProperty('opacity', ring ? '0' : '1');
      if (!ring) this.drag.active = false;
    }
    const rx = this.fine ? this.lerped.x : innerWidth / 2;
    const ry = this.fine ? this.lerped.y : innerHeight * 0.72;
    this.dragRing.style.left = `${rx}px`;
    this.dragRing.style.top = `${ry}px`;
  }
}
