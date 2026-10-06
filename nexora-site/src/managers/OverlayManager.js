import { CHAPTERS, CREDITS, OVERLAY, SCENES, TEXTS, UI_TEXT } from '../config.js';
import { bus } from '../core/EventBus.js';
import { getLang, setLang, t } from '../core/i18n.js';
import { smoothstep } from '../core/math.js';
import { $, h } from '../ui/dom.js';
import { logoHTML } from '../ui/Logo.js';

/**
 * Camada HTML persistente: logo (claro/escuro), idioma, modo leitura,
 * botão de áudio com equalizador, barra de capítulos, linha de progresso,
 * faixas de letterbox e legendas para leitores de tela.
 */
export class OverlayManager {
  constructor({ audio, onChapter, onReading }) {
    this.audio = audio;
    this.onChapter = onChapter;
    this.onReading = onReading;
    this.root = $('#ui');
    this.dark = false;
    this.activeChapter = -1;
    this.captionId = null;
    this.build();
    bus.on('lang', () => this.build());
    bus.on('audio:muted', (m) => this.syncAudio(m));
  }

  build() {
    const pt = getLang() === 'pt';
    this.root.innerHTML = '';
    this.logo = h('a', { class: 'ui-logo', href: '#', 'aria-label': 'Início', html: logoHTML() });
    this.logo.addEventListener('click', (e) => {
      e.preventDefault();
      this.onChapter?.(0.0);
    });

    const lang = h('button', {
      class: 'ui-btn lang-toggle',
      type: 'button',
      'aria-label': pt ? 'Switch to English' : 'Mudar para português',
      html: pt ? '<b>PT</b> <span>/ EN</span>' : '<span>PT /</span> <b>EN</b>',
      onclick: () => setLang(pt ? 'en' : 'pt'),
    });
    const reading = h('button', {
      class: 'ui-btn',
      type: 'button',
      text: t(UI_TEXT.reading),
      onclick: () => this.onReading?.(),
    });
    this.audioBtn = h('button', {
      class: 'audio-btn',
      type: 'button',
      'aria-pressed': 'true',
      'aria-label': t(UI_TEXT.audioOn),
      html: '<i></i><i></i><i></i><i></i>',
      onclick: () => this.audio.toggleMute(),
    });
    const tr = h('div', { class: 'ui-top-right' }, [lang, reading, this.audioBtn]);

    this.chapters = h(
      'nav',
      { class: 'chapters', 'aria-label': pt ? 'Capítulos' : 'Chapters' },
      CHAPTERS.map((c, i) =>
        h(
          'button',
          {
            class: 'chapter',
            type: 'button',
            'aria-label': `${i + 1}. ${t(c.label)}`,
            onclick: () => this.onChapter?.(c.goto),
          },
          [h('span', { text: `0${i + 1} — ${t(c.label)}` })]
        )
      )
    );

    this.progressLine = h('div', { class: 'progress-line' }, [h('i')]);
    this.root.append(this.logo, tr, this.chapters, this.progressLine);
    this.syncAudio(this.audio.muted);
    this.activeChapter = -1;
  }

  syncAudio(muted) {
    this.audioBtn.classList.toggle('is-muted', muted);
    this.audioBtn.setAttribute('aria-pressed', String(!muted));
    this.audioBtn.setAttribute('aria-label', t(muted ? UI_TEXT.audioOff : UI_TEXT.audioOn));
  }

  update(p) {
    // Logo escuro na cena clara do carro
    const [a, b] = OVERLAY.logoDark.range;
    const f = OVERLAY.logoDark.fade;
    const darkAmt = smoothstep(a - f, a, p) * (1 - smoothstep(b - f, b, p));
    const dark = darkAmt > 0.5;
    if (dark !== this.dark) {
      this.dark = dark;
      this.root.classList.toggle('ui-dark', dark);
    }

    // Capítulo ativo
    const sceneIdx = SCENES.findIndex((s) => p >= s.range[0] && p < s.range[1]);
    const ch = sceneIdx < 0 ? SCENES.length - 1 : SCENES[sceneIdx].chapter;
    if (ch !== this.activeChapter) {
      this.activeChapter = ch;
      [...this.chapters.children].forEach((c, i) => {
        c.classList.toggle('is-active', i === ch);
        c.setAttribute('aria-current', i === ch ? 'step' : 'false');
      });
    }

    this.progressLine.firstChild.style.transform = `scaleX(${p})`;

    // Letterbox dos créditos: fecha até virar uma faixa fina
    const [c0] = CREDITS.range;
    const close = smoothstep(c0, CREDITS.bandsClosedAt, p);
    if (close > 0 || this.bandsWereClosing) {
      const band = close * (50 - CREDITS.stripHeight / 2);
      document.body.style.setProperty('--band', `${band}svh`);
      this.bandsWereClosing = close > 0;
    }

    // Legendas: anuncia o texto ativo para leitores de tela
    const active = TEXTS.find((x) => p >= x.range[0] && p <= x.range[1]);
    const id = active?.id ?? null;
    if (id !== this.captionId) {
      this.captionId = id;
      if (active) {
        const parts = [active.eyebrow, active.title, active.body].map((v) => t(v)).filter(Boolean);
        $('#sr-captions').textContent = parts.map((v) => (Array.isArray(v) ? v.join(' ') : v)).join('. ');
      }
    }
  }
}

