/**
 * Efeitos sonoros sintetizados com Web Audio (sem arquivos).
 * Cada função recebe (ctx, destino, volume) e agenda os nós imediatamente.
 */

export function createImpulse(ctx, seconds = 3, decay = 2.5) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

let noiseBuf = null;
function noiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function env(ctx, g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
}

function tone(ctx, dest, { type = 'sine', f0, f1, t = ctx.currentTime, a = 0.005, d = 0.3, peak = 0.3, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(ctx, g, t, a, peak, d);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + a + d + 0.05);
  return o;
}

function noise(ctx, dest, { t = ctx.currentTime, a = 0.01, d = 0.3, peak = 0.3, filter = 'bandpass', f0 = 1000, f1, q = 1 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  if (f1) bq.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  const g = ctx.createGain();
  env(ctx, g, t, a, peak, d);
  s.connect(bq).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + a + d + 0.05);
}

export const SFX = {
  click(ctx, out, v) {
    tone(ctx, out, { f0: 2200, f1: 700, d: 0.07, peak: 0.5 * v });
    tone(ctx, out, { f0: 110, f1: 55, d: 0.25, peak: 0.6 * v });
    noise(ctx, out, { d: 0.04, peak: 0.3 * v, f0: 4000, q: 0.7 });
  },

  ringPulse(ctx, out, v) {
    const t = ctx.currentTime;
    [660, 990, 1320].forEach((f, i) =>
      tone(ctx, out, { f0: f, f1: f * 0.98, t: t + i * 0.07, a: 0.01, d: 1.2, peak: (0.25 / (i + 1)) * v })
    );
  },

  diamondArrive(ctx, out, v) {
    const t = ctx.currentTime;
    [1568, 2093, 2637, 3136, 4186].forEach((f, i) =>
      tone(ctx, out, { f0: f, t: t + i * 0.035, a: 0.003, d: 1.6 - i * 0.15, peak: 0.12 * v })
    );
    tone(ctx, out, { f0: 90, f1: 38, a: 0.01, d: 1.2, peak: 0.7 * v });
    noise(ctx, out, { d: 0.9, peak: 0.25 * v, f0: 6000, f1: 800, q: 0.6 });
  },

  whoosh(ctx, out, v) {
    noise(ctx, out, { a: 0.6, d: 0.9, peak: 0.5 * v, f0: 250, f1: 2600, q: 1.8 });
    noise(ctx, out, { t: ctx.currentTime + 0.5, a: 0.2, d: 1.0, peak: 0.25 * v, f0: 2600, f1: 180, q: 1.2 });
  },

  rack(ctx, out, v) {
    const t = ctx.currentTime;
    tone(ctx, out, { f0: 70, f1: 32, a: 0.005, d: 0.9, peak: 0.9 * v });
    noise(ctx, out, { a: 0.002, d: 0.35, peak: 0.4 * v, filter: 'lowpass', f0: 1800, f1: 200 });
    [523, 784, 1175].forEach((f, i) =>
      tone(ctx, out, { type: 'triangle', f0: f, t: t + 0.05 + i * 0.09, d: 0.5, peak: 0.08 * v })
    );
    noise(ctx, out, { t: t + 0.2, a: 0.5, d: 1.5, peak: 0.18 * v, f0: 400, f1: 4000, q: 4 });
  },

  computeCore(ctx, out, v) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'sawtooth';
    o.frequency.value = 55;
    o2.frequency.value = 55.6;
    f.type = 'lowpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(80, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
    f.frequency.exponentialRampToValueAtTime(90, t + 3);
    env(ctx, g, t, 0.05, 0.9 * v, 3);
    o.connect(f);
    o2.connect(f);
    f.connect(g).connect(out);
    o.start(t);
    o2.start(t);
    o.stop(t + 3.2);
    o2.stop(t + 3.2);
  },

  hudText(ctx, out, v) {
    tone(ctx, out, { type: 'square', f0: 2400 + Math.random() * 600, d: 0.03, peak: 0.08 * v });
  },

  scramble(ctx, out, v) {
    const t = ctx.currentTime;
    for (let i = 0; i < 14; i++)
      tone(ctx, out, {
        type: 'square',
        f0: 1200 + Math.random() * 2400,
        t: t + i * 0.035 + Math.random() * 0.01,
        d: 0.018,
        peak: 0.05 * v,
      });
  },

  intelligenceLayer(ctx, out, v) {
    const t = ctx.currentTime;
    noise(ctx, out, { a: 1.6, d: 0.4, peak: 0.35 * v, f0: 300, f1: 9000, q: 2 });
    tone(ctx, out, { type: 'sawtooth', f0: 110, f1: 880, a: 1.6, d: 0.2, peak: 0.12 * v });
    tone(ctx, out, { f0: 73.4, f1: 36.7, t: t + 1.8, a: 0.005, d: 2.5, peak: 0.9 * v });
    [587, 880, 1175].forEach((f) => tone(ctx, out, { f0: f, t: t + 1.8, a: 0.005, d: 2.6, peak: 0.08 * v }));
  },

  matrixGrid(ctx, out, v) {
    const t = ctx.currentTime;
    for (let i = 0; i < 22; i++) {
      const tt = t + i * 0.028;
      tone(ctx, out, { type: 'square', f0: [220, 330, 440, 660, 880][i % 5] * (1 + (i % 3)), t: tt, d: 0.02, peak: 0.05 * v });
    }
    noise(ctx, out, { a: 0.01, d: 0.6, peak: 0.2 * v, f0: 3000, f1: 300, q: 5 });
  },

  /* ---------------- loops (retornam um handle) ---------------- */

  chipLoop(ctx, out, v) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(v * 0.25, ctx.currentTime + 0.3);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const trem = ctx.createGain();
    o1.frequency.value = 220;
    o2.frequency.value = 331;
    o2.type = 'triangle';
    lfo.frequency.value = 6;
    lfoG.gain.value = 0.5;
    trem.gain.value = 0.5;
    lfo.connect(lfoG).connect(trem.gain);
    o1.connect(trem);
    o2.connect(trem);
    trem.connect(g).connect(out);
    [o1, o2, lfo].forEach((o) => o.start());
    return {
      stop(fade = 0.8) {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        [o1, o2, lfo].forEach((o) => o.stop(t + fade + 0.05));
      },
    };
  },

  quantumLoop(ctx, out, v) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(v * 0.3, ctx.currentTime + 0.4);
    const base = [146.8, 220, 293.7, 440];
    const oscs = base.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      return o;
    });
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    filt.Q.value = 6;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const am = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 8;
    lfoG.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lfoG).connect(am.gain);
    oscs.forEach((o) => o.connect(filt));
    filt.connect(am).connect(g).connect(out);
    oscs.forEach((o) => o.start());
    lfo.start();
    return {
      setRate(r) {
        const t = ctx.currentTime;
        oscs.forEach((o, i) => o.frequency.setTargetAtTime(base[i] * r, t, 0.08));
        lfo.frequency.setTargetAtTime(8 * r, t, 0.08);
        filt.frequency.setTargetAtTime(900 * r * r, t, 0.08);
      },
      stop(fade = 0.5) {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        [...oscs, lfo].forEach((o) => o.stop(t + fade + 0.05));
      },
    };
  },
};
