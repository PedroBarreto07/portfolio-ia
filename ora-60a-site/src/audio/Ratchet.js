/*
 * Subtle crown ratchet clicks synthesised with Web Audio (no samples).
 * Off by default; enabled from the header sound toggle.
 */
export default class Ratchet {
  constructor() {
    this.enabled = false
    this.ctx = null
    this.last = 0
  }

  ensure() {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.35
    this.master.connect(this.ctx.destination)
    // shared noise buffer
    const len = this.ctx.sampleRate * 0.03
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    return this.ctx
  }

  setEnabled(on) {
    this.enabled = on
    if (on) {
      this.ensure()
      this.ctx?.resume()
      this.click(0.6)
    }
  }

  click(gain = 1) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime
    if (now - this.last < 0.035) return
    this.last = now
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.9 + Math.random() * 0.3
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3200 + Math.random() * 900
    bp.Q.value = 6
    const g = ctx.createGain()
    g.gain.value = 0.5 * gain
    src.connect(bp).connect(g).connect(this.master)
    src.start(now)
  }

  hold(on) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    // soft low "whoosh" when entering/leaving the hold zoom
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(on ? 90 : 140, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(on ? 140 : 80, ctx.currentTime + 0.5)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    o.connect(g).connect(this.master)
    o.start()
    o.stop(ctx.currentTime + 0.65)
  }
}
