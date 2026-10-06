import gsap from 'gsap';
import { SCROLL } from '../config.js';
import { clamp, damp } from '../core/math.js';
import { bus } from '../core/EventBus.js';

/**
 * Scroll virtual. Não existe scroll nativo: wheel / touch / teclado alimentam
 * um alvo "raw" que é suavizado (lerp) e convertido em `progress` 0 → 1.
 *
 * Faixas esticadas: no espaço raw, uma faixa com factor 2 ocupa o dobro de
 * pixels, então o usuário precisa rolar mais para atravessá-la.
 */
export class ScrollManager {
  constructor() {
    this.enabled = false;
    this.locked = false;
    this.gateDone = false;
    this.gatePx = 0;
    this.intro = 0; // 0..1 suavizado (voo de entrada do satélite)

    this.buildSegments();
    this.target = 0; // raw
    this.current = 0; // raw
    this.progress = 0;
    this.velocity = 0; // progresso / segundo (suavizado)
    this.direction = 1;

    this.lastInput = performance.now();
    this.snapTween = null;
    this.touch = { active: false, y: 0, v: 0, lastT: 0 };

    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onKey = this.onKey.bind(this);

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKey);
  }

  /* ---------------- mapeamento progress <-> raw ---------------- */

  buildSegments() {
    const pts = new Set([0, 1]);
    SCROLL.stretch.forEach((s) => {
      pts.add(s.from);
      pts.add(s.to);
    });
    const sorted = [...pts].sort((a, b) => a - b);
    this.segments = [];
    let raw = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const mid = (a + b) / 2;
      const s = SCROLL.stretch.find((x) => mid >= x.from && mid < x.to);
      const f = s ? s.factor : 1;
      const len = (b - a) * f;
      this.segments.push({ a, b, f, r0: raw, r1: raw + len });
      raw += len;
    }
    this.rawTotal = raw;
  }

  rawFromProgress(p) {
    p = clamp(p);
    for (const s of this.segments) if (p <= s.b) return s.r0 + (p - s.a) * s.f;
    return this.rawTotal;
  }

  progressFromRaw(r) {
    r = clamp(r, 0, this.rawTotal);
    for (const s of this.segments) if (r <= s.r1) return s.a + (r - s.r0) / s.f;
    return 1;
  }

  /* ---------------- entrada ---------------- */

  addPixels(px) {
    if (!this.enabled || this.locked) return;
    this.lastInput = performance.now();
    this.killSnap();
    if (px !== 0) this.direction = Math.sign(px);

    // Intro gate: os primeiros pixels só trazem o satélite para o quadro.
    if (!this.gateDone) {
      this.gatePx = clamp(this.gatePx + px, 0, SCROLL.introGatePx);
      if (this.gatePx >= SCROLL.introGatePx) {
        this.gateDone = true;
        bus.emit('gate:done');
      }
      return;
    }
    this.target = clamp(this.target + px / SCROLL.totalScrollPx, 0, this.rawTotal);
  }

  onWheel(e) {
    if (e.ctrlKey) return; // pinch-zoom do trackpad
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    this.addPixels(clamp(d, -240, 240));
  }

  onTouchStart(e) {
    if (e.target.closest?.('[data-no-scroll]')) return;
    const y = e.touches[0].clientY;
    this.touch = { active: true, y, v: 0, lastT: performance.now() };
  }

  onTouchMove(e) {
    if (!this.touch.active) return;
    if (e.cancelable) e.preventDefault();
    const y = e.touches[0].clientY;
    const now = performance.now();
    const dy = this.touch.y - y;
    const scale = SCROLL.totalScrollPx / SCROLL.touchScrollPx;
    const dt = Math.max(1, now - this.touch.lastT);
    this.touch.v = 0.8 * ((dy * scale) / dt) * 16.67 + 0.2 * this.touch.v; // px/frame
    this.touch.y = y;
    this.touch.lastT = now;
    this.addPixels(dy * scale);
  }

  onTouchEnd() {
    this.touch.active = false;
  }

  onKey(e) {
    if (!this.enabled || e.target.closest?.('input, textarea, [contenteditable]')) return;
    const step = SCROLL.keyStep * 2000;
    const map = {
      ArrowDown: step,
      ArrowUp: -step,
      PageDown: step * 5,
      PageUp: -step * 5,
      ' ': e.shiftKey ? -step * 5 : step * 5,
    };
    if (e.key in map) {
      e.preventDefault();
      this.addPixels(map[e.key]);
    } else if (e.key === 'Home') this.scrollTo(0);
    else if (e.key === 'End') this.scrollTo(1);
  }

  /* ---------------- navegação programática ---------------- */

  killSnap() {
    if (this.snapTween) {
      this.snapTween.kill();
      this.snapTween = null;
    }
  }

  // Anima o alvo (o lerp cuida da suavização) — passa pelas cenas do caminho.
  scrollTo(p, duration = 0) {
    this.killSnap();
    this.gateDone = true;
    this.gatePx = SCROLL.introGatePx;
    const raw = this.rawFromProgress(p);
    if (!duration) {
      this.target = raw;
      return;
    }
    this.snapTween = gsap.to(this, { target: raw, duration, ease: 'power2.inOut' });
  }

  // Pula instantaneamente (usado após um fade para preto).
  jump(p) {
    this.killSnap();
    this.gateDone = true;
    this.gatePx = SCROLL.introGatePx;
    this.intro = 1;
    this.target = this.current = this.rawFromProgress(p);
    this.progress = clamp(p);
    this.velocity = 0;
    this.touch.v = 0;
  }

  enable() {
    this.enabled = true;
  }

  /* ---------------- loop ---------------- */

  update(dt) {
    // Inércia do toque
    if (!this.touch.active && Math.abs(this.touch.v) > 0.5) {
      this.addPixels(this.touch.v * dt * 60);
      this.touch.v *= Math.pow(SCROLL.touchInertia, dt * 60);
    }

    // Snap após ficar parado
    const idle = (performance.now() - this.lastInput) / 1000;
    if (this.enabled && this.gateDone && !this.snapTween && idle > SCROLL.snap.idleDelay && !this.touch.active) {
      const p = this.progressFromRaw(this.target);
      for (const sp of SCROLL.snap.points) {
        const d = Math.abs(p - sp);
        if (d < SCROLL.snap.radius && d > 1e-4) {
          this.snapTween = gsap.to(this, {
            target: this.rawFromProgress(sp),
            duration: SCROLL.snap.duration,
            ease: 'power2.inOut',
            onComplete: () => (this.snapTween = null),
          });
          break;
        }
      }
      this.lastInput = performance.now() + 1e9; // não tenta de novo até nova entrada
    }

    const k = damp(SCROLL.lerpSpeed, dt);
    const prev = this.progress;
    this.current += (this.target - this.current) * k;
    if (Math.abs(this.target - this.current) < 1e-6) this.current = this.target;
    this.progress = this.progressFromRaw(this.current);

    const gateT = this.gatePx / SCROLL.introGatePx;
    this.intro += (gateT - this.intro) * damp(0.06, dt);
    if (this.gateDone && this.progress > 0.002) this.intro += (1 - this.intro) * damp(0.1, dt);

    const v = dt > 0 ? (this.progress - prev) / dt : 0;
    this.velocity += (v - this.velocity) * damp(0.2, dt);
  }
}
