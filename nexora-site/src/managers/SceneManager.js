import { SCENES, TRANSITIONS } from '../config.js';
import { bus } from '../core/EventBus.js';
import { smoothstep } from '../core/math.js';

/**
 * Liga/desliga cenas pela faixa de progresso. Nas fronteiras definidas em
 * TRANSITIONS, duas cenas são renderizadas e misturadas pelo PostFXManager.
 * Cenas fora da faixa ativa não são atualizadas nem renderizadas.
 */
export class SceneManager {
  constructor(ctx, sceneClasses) {
    this.ctx = ctx;
    this.list = SCENES.map((def) => new sceneClasses[def.id](ctx, def));
    this.byId = Object.fromEntries(this.list.map((s) => [s.id, s]));
    this.current = null;
    this.state = { a: null, b: null, mix: 0, type: 'fade' };
  }

  // Constrói as cenas em sequência, reportando o progresso de carregamento
  // `filter(scene)` escolhe quais cenas construir (ex.: só as não adiadas)
  async build(onProgress, filter = () => true) {
    const list = this.list.filter(filter);
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const s = list[i];
      if (s.ready) continue;
      await s.build();
      s.resize(this.ctx.sizes.width, this.ctx.sizes.height);
      s.ready = true;
      onProgress?.((i + 1) / n, s.id);
      await new Promise((r) => setTimeout(r, 0)); // deixa a UI respirar
    }
  }

  // Pré-compila shaders de todas as cenas (evita travadas na primeira aparição)
  async compile(renderer, onProgress, filter = () => true) {
    const list = this.list.filter(filter);
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const s = list[i];
      try {
        if (renderer.compileAsync) await renderer.compileAsync(s.scene, s.camera);
        else renderer.compile(s.scene, s.camera);
      } catch (e) {
        console.warn('[compile]', s.id, e);
      }
      onProgress?.((i + 1) / n);
    }
  }

  indexAt(p) {
    for (let i = 0; i < this.list.length; i++) {
      const [a, b] = this.list[i].range;
      if (p >= a && p < b) return i;
    }
    return this.list.length - 1;
  }

  resolve(p) {
    const i = this.indexAt(p);
    let a = this.list[i];
    let b = null;
    let mix = 0;
    let type = 'fade';
    for (const tr of TRANSITIONS) {
      const h = tr.width / 2;
      if (p >= tr.at - h && p <= tr.at + h) {
        const ia = this.indexAt(tr.at - 1e-6);
        const ib = this.indexAt(tr.at + 1e-6);
        a = this.list[ia];
        b = this.list[ib];
        mix = smoothstep(tr.at - h, tr.at + h, p);
        type = tr.type;
        break;
      }
    }
    return { a, b, mix, type };
  }

  update(p, dt, time) {
    const st = this.resolve(p);
    const active = new Set([st.a, st.mix > 0.0001 ? st.b : null].filter(Boolean));

    // enter / leave
    for (const s of this.list) {
      const on = active.has(s);
      if (on && !s.active) {
        s.active = true;
        s.enter();
      } else if (!on && s.active) {
        s.active = false;
        s.leave();
      }
    }

    for (const s of active) {
      if (!s.ready) continue;
      s.local = s.toLocal(p);
      s.update(s.local, dt, time, p);
    }

    const main = st.mix > 0.5 && st.b ? st.b : st.a;
    if (main !== this.current) {
      this.current = main;
      bus.emit('scene:change', main.id);
    }

    // bloom alvo segue a cena dominante
    const bloomA = st.a.bloom * st.a.bloomBoost;
    const bloomB = st.b ? st.b.bloom * st.b.bloomBoost : bloomA;
    this.ctx.postfx.state.bloomTarget = bloomA + (bloomB - bloomA) * st.mix;

    this.state = st;
    return st;
  }

  resize(w, h) {
    this.list.forEach((s) => s.resize(w, h));
  }
}
