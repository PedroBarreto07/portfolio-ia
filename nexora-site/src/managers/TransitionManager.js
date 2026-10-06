import gsap from 'gsap';
import { TRANSITION_DEFAULT } from '../config.js';
import { $ } from '../ui/dom.js';

/**
 * Fades para cor sólida (padrão #000, 0.7s) sobre tudo — usado em saltos
 * (capítulos, replay) para nunca haver corte seco.
 */
export class TransitionManager {
  constructor() {
    this.el = $('#fade');
    this.busy = false;
  }

  fadeOut({ color = TRANSITION_DEFAULT.color, duration = TRANSITION_DEFAULT.duration } = {}) {
    this.el.style.background = color;
    return new Promise((resolve) =>
      gsap.to(this.el, { opacity: 1, duration, ease: 'power2.inOut', onComplete: resolve })
    );
  }

  fadeIn({ duration = TRANSITION_DEFAULT.duration } = {}) {
    return new Promise((resolve) =>
      gsap.to(this.el, { opacity: 0, duration, ease: 'power2.inOut', onComplete: resolve })
    );
  }

  // fade → ação no meio (ex.: pular progresso) → fade de volta
  async through(action, opts = {}) {
    if (this.busy) return;
    this.busy = true;
    await this.fadeOut(opts);
    await action?.();
    await new Promise((r) => setTimeout(r, 120));
    await this.fadeIn(opts);
    this.busy = false;
  }
}
