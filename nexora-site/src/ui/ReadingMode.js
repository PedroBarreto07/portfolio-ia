import { BRAND, CARDS, CHAPTERS, CREDITS, LABELS, SPLASH, TEXTS, UI_TEXT } from '../config.js';
import { bus } from '../core/EventBus.js';
import { t } from '../core/i18n.js';
import { h } from './dom.js';

// "Pranchas" ilustrativas em CSS para cada capítulo (sem WebGL)
const PLATES = [
  'radial-gradient(120% 80% at 50% 120%, #2b5f9e 0%, #0b1a33 35%, #02040a 60%), #000',
  'linear-gradient(160deg, #c9b38f 0%, #9c8463 40%, #4f5a63 100%)',
  'radial-gradient(40% 70% at 50% 0%, rgba(255,190,110,.55), transparent 70%), linear-gradient(#0a0807, #000)',
  'radial-gradient(50% 50% at 50% 50%, #ffcf86 0%, #8a4b12 30%, #120804 70%)',
  'radial-gradient(80% 60% at 30% 40%, #b8661c 0%, #3a1606 50%, #0a0402 100%)',
  'linear-gradient(180deg, #b9cfe0 0%, #e8eef2 45%, #5b6e63 70%, #2d3a33 100%)',
];

/**
 * Modo leitura: todo o conteúdo da experiência em uma página rolável e
 * acessível. Também é a base do fallback sem WebGL.
 */
export class ReadingMode {
  constructor({ fallback = false } = {}) {
    this.fallback = fallback;
    this.el = h('div', { class: 'reading', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Modo leitura', 'data-no-scroll': true });
    document.body.append(this.el);
    this.render();
    bus.on('lang', () => this.render());
    this.el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    window.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  render() {
    const T = (id) => TEXTS.find((x) => x.id === id);
    const arr = (v) => (Array.isArray(v) ? v.join(' ') : v);
    const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
    const sec = (i, inner) =>
      `<section><div class="plate" style="background:${PLATES[i]}" data-n="0${i + 1} — ${t(CHAPTERS[i].label).toUpperCase()}"></div>${inner}</section>`;

    const orbit = T('orbit-title');
    const map = T('map-block');
    const dc = T('dc-title');
    const arrayT = T('dc-array');
    const spec = T('dc-spec');
    const chip = T('dc-chip');
    const layer = T('q-layer');

    this.el.innerHTML = `
      ${this.fallback ? '' : `<button class="ui-btn reading-close" type="button">${t(UI_TEXT.close)} ✕</button>`}
      <div class="reading-inner">
        ${this.fallback ? `<div class="notice">${t(UI_TEXT.noWebgl)}</div>` : ''}
        <h1>${t(SPLASH.title).join('<br>')}</h1>
        <p class="lead">${BRAND.name} — ${t(SPLASH.subtitle)}</p>
        ${sec(0, `<h2>${arr(t(orbit.title))}</h2><p>${t(orbit.body)}</p>
          <h3>${t(LABELS.satellite.title)}</h3><p>${t(LABELS.satellite.subtitle)}</p>`)}
        ${sec(1, `<h2>${arr(t(map.title))}</h2><h3>${t(map.eyebrow)}</h3>${list(t(map.items))}
          <h3>${t(LABELS.mapNode.title)}</h3>${list(t(LABELS.mapNode.lines))}`)}
        ${sec(2, `<h2>${arr(t(dc.title))}</h2><p>${t(dc.body)}</p>
          <h3>${t(arrayT.eyebrow)}</h3>${list(t(arrayT.items))}
          <h3>${t(spec.eyebrow)}</h3>${list(t(spec.rows).map(([k, v]) => `${k}: ${v}`))}
          <h3>${arr(t(chip.title))}</h3><p>${t(chip.body)}</p>`)}
        ${sec(3, `<h2>${arr(t(layer.title))}</h2>`)}
        ${sec(
          4,
          CARDS.map((c) => `<h3>${t(c.eyebrow)}</h3><h2>${t(c.title)}</h2>${list(t(c.bullets))}`).join('')
        )}
        ${sec(
          5,
          `<h2>${arr(t(T('car-msg-1').title))} ${arr(t(T('car-msg-2').title))}</h2>
          <p style="margin-top:60px">${t(CREDITS.phrase1)} ${t(CREDITS.phrase2)}</p>
          <p>${t(CREDITS.final.line)} — <a href="mailto:${BRAND.email}" style="color:#fff">[ ${BRAND.email} ]</a></p>`
        )}
      </div>`;
    this.el.querySelector('.reading-close')?.addEventListener('click', () => this.close());
  }

  open() {
    this.el.classList.add('is-open');
    this.el.querySelector('.reading-close')?.focus();
    bus.emit('reading', true);
  }

  close() {
    if (this.fallback || !this.el.classList.contains('is-open')) return;
    this.el.classList.remove('is-open');
    bus.emit('reading', false);
  }
}
