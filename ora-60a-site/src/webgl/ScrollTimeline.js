import gsap from 'gsap'

/*
 * Scroll-scrubbed keyframe timeline.
 *
 * Keyframes are sparse "poses": { at, ease, values: { param: value } }.
 * Each param becomes its own track, so a pose only touches what it
 * mentions. Evaluation is stateless (pure function of the scroll position,
 * in viewport-height units), which keeps scrubbing, resizing and jumping
 * to the middle of the page 100% deterministic. Easing uses GSAP's parser,
 * so CustomEase names ("brand.posIn"…) work everywhere.
 */

const HOLD = (t) => (t >= 1 ? 1 : 0)
const parse = (ease) => {
  if (!ease) return gsap.parseEase('sine.inOut')
  if (ease === 'hold' || ease === 'step') return HOLD
  if (typeof ease === 'function') return ease
  return gsap.parseEase(ease) || gsap.parseEase('sine.inOut')
}

export default class ScrollTimeline {
  constructor(defaults) {
    this.defaults = { ...defaults }
    this.tracks = {}
    this.keys = Object.keys(defaults)
  }

  build(keyframes) {
    const sorted = [...keyframes].sort((a, b) => a.at - b.at)
    const tracks = {}
    for (const k of this.keys) tracks[k] = [{ at: -1e9, v: this.defaults[k], ease: HOLD }]
    for (const kf of sorted) {
      const ease = parse(kf.ease)
      for (const [k, v] of Object.entries(kf.values)) {
        if (!tracks[k]) {
          console.warn('[ScrollTimeline] unknown param', k)
          continue
        }
        const tr = tracks[k]
        // first explicit key also defines the value before it
        if (tr.length === 1) tr[0].v = v
        tr.push({ at: kf.at, v, ease: kf.easeFor?.[k] ? parse(kf.easeFor[k]) : ease })
      }
    }
    this.tracks = tracks
    return this
  }

  evaluate(x, out = {}) {
    for (const k of this.keys) {
      const tr = this.tracks[k]
      let i = 1
      while (i < tr.length && tr[i].at <= x) i++
      if (i >= tr.length) {
        out[k] = tr[tr.length - 1].v
        continue
      }
      const a = tr[i - 1]
      const b = tr[i]
      const span = b.at - a.at
      const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (x - a.at) / span))
      out[k] = a.v + (b.v - a.v) * b.ease(t)
    }
    return out
  }
}
