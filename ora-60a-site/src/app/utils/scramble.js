const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/*
 * Text scramble: letters cycle through random glyphs and settle from left
 * to right ("ELEGUMNT" → "ELEGANT"). Returns a cancel function.
 */
export function scramble(el, finalText, { duration = 900, delay = 0, glyphs = GLYPHS } = {}) {
  let raf = 0
  let start = 0
  const chars = [...finalText]
  const settleAt = chars.map((_, i) => (i / Math.max(1, chars.length)) * 0.65 + Math.random() * 0.3)
  const frame = (now) => {
    if (!start) start = now + delay
    const t = Math.max(0, (now - start) / duration)
    let out = ''
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i]
      if (c === ' ' || t >= settleAt[i]) out += c
      else out += glyphs[(Math.random() * glyphs.length) | 0]
    }
    el.textContent = out
    if (t < 1) raf = requestAnimationFrame(frame)
    else el.textContent = finalText
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
