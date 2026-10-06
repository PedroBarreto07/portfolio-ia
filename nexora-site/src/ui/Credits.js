import { BRAND, CREDITS } from '../config.js';
import { bus } from '../core/EventBus.js';
import { t } from '../core/i18n.js';
import { $, h } from './dom.js';

/**
 * Créditos finais dentro da faixa de letterbox:
 *   frase 1 → frase 2 → tela final (estúdio, chamada, e-mail, REPLAY).
 */
export class Credits {
  constructor({ onReplay }) {
    this.root = $('#credits');
    this.onReplay = onReplay;
    this.state = {};
    this.build();
    bus.on('lang', () => this.build());
  }

  build() {
    const c = CREDITS;
    this.root.innerHTML = '';
    this.p1 = h('p', { class: 'credit-phrase', html: t(c.phrase1) });
    this.p2 = h('p', { class: 'credit-phrase', html: t(c.phrase2) });
    this.final = h('div', { class: 'credit-final' }, [
      h('div', { class: 'studio', text: BRAND.studio }),
      h('p', { class: 'line', html: t(c.final.line) }),
      h('a', { class: 'email', href: `mailto:${BRAND.email}`, text: `[ ${BRAND.email} ]` }),
      h('button', { class: 'replay', type: 'button', text: t(c.final.replay), onclick: () => this.onReplay?.() }),
      h('p', { class: 'asset-credits', text: BRAND.assetCredits }),
    ]);
    this.root.append(this.p1, this.p2, this.final);
    this.state = {};
  }

  toggle(key, el, on) {
    if (this.state[key] === on) return;
    this.state[key] = on;
    el.classList.toggle('on', on);
  }

  update(p) {
    const [a, b] = CREDITS.range;
    const l = (p - a) / (b - a);
    const c = CREDITS;
    this.toggle('p1', this.p1, l >= c.phrase1.at && l < c.phrase1.out);
    this.toggle('p2', this.p2, l >= c.phrase2.at && l < c.phrase2.out);
    this.toggle('final', this.final, l >= c.final.at);
  }
}
