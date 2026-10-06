import { BRAND } from '../config.js';

// Logo com letras espaçadas; a letra em BRAND.circleIndex vira um círculo SVG
// que se desenha e apaga em loop (anti-horário a partir de -90°).
export function logoHTML() {
  const letters = BRAND.name.split('');
  const parts = letters.map((ch, i) =>
    i === BRAND.circleIndex
      ? `<svg class="logo-o" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" pathLength="100"/></svg>`
      : `<span aria-hidden="true">${ch}</span>`
  );
  return `<div class="logo" role="img" aria-label="${BRAND.name}">${parts.join('')}</div>`;
}
