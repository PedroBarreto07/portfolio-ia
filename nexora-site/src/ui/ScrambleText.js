// Efeito scramble/decode: caracteres embaralham até formar o texto final.
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/()+*<>';

export function scramble(el, text, { duration = 1.1, delay = 0, stagger = 0.6 } = {}) {
  const t0 = performance.now() + delay * 1000;
  const len = text.length;
  let raf = 0;
  // cada caractere tem seu próprio instante de "travamento"
  const lockAt = Array.from({ length: len }, (_, i) => (i / len) * stagger + Math.random() * (1 - stagger));
  const tick = (now) => {
    const t = (now - t0) / 1000 / duration;
    if (t < 0) {
      el.textContent = '';
      raf = requestAnimationFrame(tick);
      return;
    }
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = text[i];
      if (c === ' ' || t >= lockAt[i]) out += c;
      else if (t > lockAt[i] - 0.45) out += CHARS[(Math.random() * CHARS.length) | 0];
      else out += ' ';
    }
    el.textContent = out;
    if (t < 1) raf = requestAnimationFrame(tick);
    else el.textContent = text;
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// Digitação com cursor "_"
export function typeText(el, text, { speed = 38, delay = 0, onChar } = {}) {
  let i = 0;
  let timer = 0;
  el.innerHTML = '<span class="caret">_</span>';
  const step = () => {
    i++;
    el.innerHTML = `${escapeHTML(text.slice(0, i))}<span class="caret">_</span>`;
    onChar?.(i);
    if (i < text.length) timer = setTimeout(step, speed + Math.random() * speed * 0.6);
  };
  timer = setTimeout(step, delay * 1000);
  return () => clearTimeout(timer);
}

const escapeHTML = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
