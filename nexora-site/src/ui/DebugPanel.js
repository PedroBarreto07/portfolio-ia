import { SCENES, SCROLL } from '../config.js';
import { h } from './dom.js';

/**
 * Modo debug (tecla D): progresso, FPS, cena ativa, DPR e salto para
 * qualquer ponto da experiência.
 */
export class DebugPanel {
  constructor(exp) {
    this.exp = exp;
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
    this.el = h('div', { id: 'debug', 'data-no-scroll': true });
    this.el.innerHTML = `
      <div class="row"><b>DEBUG</b><span>[D] fecha</span></div>
      <div class="row"><span>progress</span><span data-k="p"></span></div>
      <div class="row"><span>fps</span><span data-k="fps"></span></div>
      <div class="row"><span>cena</span><span data-k="scene"></span></div>
      <div class="row"><span>transição</span><span data-k="mix"></span></div>
      <div class="row"><span>dpr / draw calls</span><span data-k="dpr"></span></div>
      <input type="range" min="0" max="1" step="0.0005" aria-label="progress" />
      <div class="jumps"></div>`;
    const jumps = this.el.querySelector('.jumps');
    const pts = [...new Set([...SCENES.map((s) => s.range[0]), ...SCROLL.snap.points])].sort((a, b) => a - b);
    pts.forEach((p) => jumps.append(h('button', { type: 'button', text: p.toFixed(3), onclick: () => exp.scroll.jump(p) })));
    this.slider = this.el.querySelector('input');
    this.slider.addEventListener('input', () => exp.scroll.jump(parseFloat(this.slider.value)));
    document.body.append(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') this.toggle();
    });
    this.q = (k) => this.el.querySelector(`[data-k="${k}"]`);
  }

  toggle() {
    this.open = !this.open;
    this.el.classList.toggle('is-open', this.open);
  }

  update(dt) {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.frames = 0;
      this.acc = 0;
    }
    if (!this.open) return;
    const e = this.exp;
    const st = e.scenes.state;
    this.q('p').textContent = e.scroll.progress.toFixed(4) + (e.scroll.gateDone ? '' : ` (gate ${(e.scroll.intro * 100) | 0}%)`);
    this.q('fps').textContent = this.fps;
    this.q('scene').textContent = st.a?.id + (st.b && st.mix > 0 ? ` → ${st.b.id}` : '');
    this.q('mix').textContent = st.mix > 0 ? `${st.type} ${(st.mix * 100) | 0}%` : '—';
    this.q('dpr').textContent = `${e.sizes.dpr.toFixed(2)} / ${e.renderer.info.render.calls}`;
    if (document.activeElement !== this.slider) this.slider.value = e.scroll.progress;
  }
}
