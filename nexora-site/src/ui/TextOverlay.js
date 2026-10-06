import { TEXTS } from '../config.js';
import { bus } from '../core/EventBus.js';
import { t } from '../core/i18n.js';
import { $, h } from './dom.js';
import { scramble, typeText } from './ScrambleText.js';

/**
 * Blocos de texto HTML ativados por faixa de progresso (definidos em TEXTS).
 * Cada tipo tem sua animação de entrada:
 *   scramble → decode dos caracteres     type → digitação com cursor "_"
 *   hud/list → linhas aparecem uma a uma  spec → ficha técnica linha a linha
 *   split    → duas linhas que se fecham ao centro  fade → fade simples
 */
export class TextOverlay {
  constructor() {
    this.root = $('#text-layer');
    this.blocks = [];
    this.build();
    bus.on('lang', () => this.build());
  }

  build() {
    this.blocks.forEach((b) => b.cancel?.());
    this.root.innerHTML = '';
    this.blocks = TEXTS.map((def) => {
      const el = h('section', {
        class: `tb pos-${def.pos} type-${def.type}${def.small ? ' small' : ''}${def.dark ? ' dark' : ''}`,
        'aria-hidden': 'true',
      });
      const parts = {};
      if (def.eyebrow) el.append((parts.eyebrow = h('div', { class: 'tb-eyebrow', text: t(def.eyebrow) })));
      if (def.title) {
        parts.lines = t(def.title).map((l) => h('span', { text: l }));
        el.append((parts.title = h('h2', { class: 'tb-title' }, parts.lines)));
      }
      if (def.items) {
        parts.items = t(def.items).map((l) => h('li', { text: l }));
        el.append(h('ul', { class: 'tb-list' }, parts.items));
      }
      if (def.rows) {
        parts.rows = t(def.rows).map(([k, v]) => h('div', { class: 'spec-row' }, [h('span', { text: k }), h('span', { text: v })]));
        el.append(h('div', { class: 'spec' }, parts.rows));
      }
      if (def.body) el.append((parts.body = h('p', { class: 'tb-body', text: t(def.body) })));
      this.root.append(el);
      return { def, el, parts, visible: false, timers: [], cancel: null };
    });
  }

  show(b) {
    const { def, el, parts } = b;
    el.classList.add('is-visible');
    const timers = (b.timers = []);
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const cancels = [];

    if (def.type === 'scramble') {
      bus.emit('sfx', 'scramble');
      t(def.title).forEach((line, i) => cancels.push(scramble(parts.lines[i], line, { duration: 1.1, delay: i * 0.18 })));
      if (parts.body) cancels.push(scramble(parts.body, t(def.body), { duration: 1.6, delay: 0.4, stagger: 0.9 }));
    } else if (def.type === 'type') {
      parts.lines.forEach((ln, i) =>
        cancels.push(
          typeText(ln, t(def.title)[i], {
            speed: 42,
            delay: 0.15,
            onChar: (n) => n % 3 === 0 && bus.emit('sfx', 'hudText'),
          })
        )
      );
      if (parts.body) {
        parts.body.style.opacity = '0';
        later(() => {
          parts.body.style.transition = 'opacity .8s';
          parts.body.style.opacity = '1';
        }, 900);
      }
    }

    const seq = parts.items || parts.rows;
    if (seq) {
      seq.forEach((li, i) =>
        later(() => {
          li.classList.add('on');
          if (def.type === 'hud' || def.type === 'spec') bus.emit('sfx', 'hudText');
        }, 350 + i * 170)
      );
      if (def.type === 'hud' && parts.eyebrow) cancels.push(scramble(parts.eyebrow, t(def.eyebrow), { duration: 0.7 }));
    }
    b.cancel = () => {
      cancels.forEach((c) => c());
      timers.forEach(clearTimeout);
    };
  }

  hide(b) {
    b.el.classList.remove('is-visible');
    b.cancel?.();
    const { parts } = b;
    setTimeout(() => {
      if (b.visible) return;
      (parts.items || parts.rows || []).forEach((li) => li.classList.remove('on'));
    }, 600);
  }

  update(p) {
    for (const b of this.blocks) {
      const [a, z] = b.def.range;
      const vis = p >= a && p <= z;
      if (vis !== b.visible) {
        b.visible = vis;
        if (vis) this.show(b);
        else this.hide(b);
      }
    }
  }
}
