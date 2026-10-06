// Utilitários numéricos usados por todas as cenas.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
// Mapeia v de [a,b] para 0..1 (com clamp)
export const range = (v, a, b) => invLerp(a, b, v);
export const smoothstep = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
// Fator de amortecimento independente de FPS (equivalente a `lerp k` a 60fps)
export const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // power2.inOut
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
// Janela: sobe em [a, a+f], fica 1, desce em [b-f, b]
export const windowFade = (v, a, b, f = 0.006) =>
  Math.min(smoothstep(a, a + f, v), 1 - smoothstep(b - f, b, v));
export const inRange = (v, [a, b]) => v >= a && v <= b;

// PRNG determinístico (mulberry32) — cenas idênticas a cada carregamento
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isMobile = () =>
  window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
