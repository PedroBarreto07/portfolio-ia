export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => clamp((v - a) / (b - a))
export const mapRange = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v))
export const smoothstep = (a, b, v) => {
  const t = invLerp(a, b, v)
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent exponential smoothing. */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Window [a,b] → 0..1 → 0 (a "bump"): handy for "visible between" values. */
export const windowed = (v, a, b, fade = 0.1) => smoothstep(a, a + fade, v) * (1 - smoothstep(b - fade, b, v))

/** Deterministic PRNG so procedural assets look identical on every load. */
export function mulberry32(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))
