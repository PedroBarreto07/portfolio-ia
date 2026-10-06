import { ASSETS, SPLASH, UI_TEXT } from '../config.js';
import { t, getLang, setLang } from '../core/i18n.js';
import { bus } from '../core/EventBus.js';
import { $ } from './dom.js';
import { logoHTML } from './Logo.js';

const HEADPHONES_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15v-3a9 9 0 0 1 18 0v3"/><rect x="2.5" y="14" width="4.5" height="7" rx="1.2"/><rect x="17" y="14" width="4.5" height="7" rx="1.2"/></svg>`;

/**
 * Splash: logo, título em 3 linhas, subtítulo, barra de loading real
 * (que vira o CTA com cantoneiras) e aviso de fones.
 * Atrás: vídeo da Terra (se configurado) ou a própria cena 3D da órbita ao vivo.
 */
export class LoadingScreen {
  constructor() {
    this.el = $('#splash');
    this.progress = 0;
    this.shown = 0;
    this.tipIndex = 0;
    this.render();
    bus.on('lang', () => this.render(true));
    this.tipTimer = setInterval(() => this.nextTip(), 2200);
  }

  render(keep = false) {
    const title = t(SPLASH.title)
      .map((l) => `<span><i>${l}</i></span>`)
      .join('');
    const video = ASSETS.videos.splash
      ? `<video class="splash-video" src="${ASSETS.videos.splash}" autoplay muted loop playsinline></video>`
      : '';
    const ready = this.el.classList.contains('is-ready');
    this.el.innerHTML = `
      ${video}
      <div class="splash-overlay"></div>
      <div class="splash-logo">${logoHTML()}</div>
      <h1 class="splash-title" id="splash-title">${title}</h1>
      <p class="splash-sub">${t(SPLASH.subtitle)}</p>
      <div class="cta-slot">
        <div class="loader" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="loader-row"><span>${t(UI_TEXT.loading)}</span><span class="loader-pct">0%</span></div>
          <div class="loader-bar"><i></i></div>
          <div class="loader-tip"></div>
        </div>
        <div class="cta-wrap">
          <button class="cta" type="button"><span class="cta-label">${t(SPLASH.cta)}</span></button>
        </div>
      </div>
      <div class="headphones">${HEADPHONES_SVG}<span>${t(SPLASH.headphones)}</span></div>
      <div class="splash-lang"><button class="ui-btn lang-toggle" type="button" aria-label="Idioma / Language">${
        getLang() === 'pt' ? '<b>PT</b> <span>/ EN</span>' : '<span>PT /</span> <b>EN</b>'
      }</button></div>
    `;
    if (keep && ready) this.el.classList.add('is-ready');
    $('.cta', this.el).addEventListener('click', () => this.start());
    $('.lang-toggle', this.el).addEventListener('click', () => setLang(getLang() === 'pt' ? 'en' : 'pt'));
    this.setProgress(this.progress, true);
    this.nextTip();
  }

  nextTip() {
    const tips = t(SPLASH.tips);
    const el = $('.loader-tip', this.el);
    if (el) el.textContent = tips[this.tipIndex++ % tips.length];
  }

  setProgress(p, instant = false) {
    this.progress = Math.max(this.progress, p);
    const pct = Math.round(this.progress * 100);
    const bar = $('.loader-bar i', this.el);
    if (bar) bar.style.transform = `scaleX(${this.progress})`;
    const label = $('.loader-pct', this.el);
    if (label) label.textContent = `${pct}%`;
    $('.loader', this.el)?.setAttribute('aria-valuenow', pct);
    if (instant && bar) bar.style.transition = 'none';
  }

  ready() {
    clearInterval(this.tipTimer);
    this.setProgress(1);
    setTimeout(() => {
      this.el.classList.add('is-ready');
      $('.cta', this.el)?.focus({ preventScroll: true });
    }, 450);
  }

  start() {
    if (this.started) return;
    this.started = true;
    bus.emit('cta');
    this.el.classList.add('is-hidden');
    setTimeout(() => (this.el.style.display = 'none'), 1400);
  }
}
