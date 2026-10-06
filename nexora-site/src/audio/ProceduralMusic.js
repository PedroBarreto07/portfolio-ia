import { rng } from '../core/math.js';

/**
 * Trilha generativa em 3 stems sincronizados (mesmo relógio), usada quando
 * não há arquivos de áudio. Ré menor, ~84 BPM, progressão de 4 compassos:
 *   Dm9 → B♭maj7 → Fmaj7 → Csus2
 *
 *  - instruments: pad de serras desafinadas + arpejo pluck
 *  - bass: pulso em colcheias com sub
 *  - melody: sino FM com delay pontuado
 */
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { root: 38, pad: [53, 57, 60, 64], arp: [62, 65, 69, 72, 76] }, // Dm9
  { root: 34, pad: [50, 53, 57, 60], arp: [58, 62, 65, 69, 74] }, // Bbmaj7
  { root: 41, pad: [52, 57, 60, 64], arp: [60, 64, 65, 69, 72] }, // Fmaj7
  { root: 36, pad: [55, 60, 62, 67], arp: [60, 62, 67, 72, 74] }, // Csus2
];
const SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81]; // ré menor pentatônica

export class ProceduralMusic {
  constructor(ctx, stems) {
    this.ctx = ctx;
    this.stems = stems; // { melody, bass, instruments } GainNodes
    this.bpm = 84;
    this.step = 0; // semicolcheia
    this.nextTime = 0;
    this.rand = rng(7);
    this.phrase = this.makePhrase();
    this.timer = null;
  }

  makePhrase() {
    // 32 semicolcheias (2 compassos), notas esparsas
    const notes = [];
    for (let i = 0; i < 32; i++) {
      const hit = i % 4 === 0 ? this.rand() < 0.55 : i % 2 === 0 ? this.rand() < 0.2 : false;
      notes.push(hit ? SCALE[Math.floor(this.rand() * SCALE.length)] : null);
    }
    return notes;
  }

  start() {
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    clearInterval(this.timer);
  }

  schedule() {
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  playStep(step, t, dur) {
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chord = CHORDS[bar % 4];

    // PAD — muda a cada compasso
    if (inBar === 0) chord.pad.forEach((n) => this.pad(midi(n), t, dur * 16));

    // ARPEJO — colcheias
    if (inBar % 2 === 0) {
      const n = chord.arp[(inBar / 2 + bar) % chord.arp.length];
      this.pluck(midi(n), t, inBar % 4 === 0 ? 0.07 : 0.045);
    }

    // BAIXO — pulso em colcheias, raiz + oitava
    if (inBar % 2 === 0) {
      const oct = inBar === 6 || inBar === 14 ? 12 : 0;
      this.bass(midi(chord.root + oct), t, dur * 1.8, inBar === 0 ? 1 : 0.6);
    }

    // MELODIA — frase de 2 compassos, muda a cada 8 compassos
    if (step % 128 === 0 && step > 0) this.phrase = this.makePhrase();
    const m = this.phrase[step % 32];
    if (m) this.bell(midi(m), t);
  }

  // Notas entram no stem; reverb/delay são enviados depois do ganho do stem
  // (AudioManager), então um stem mudo não vaza pelos efeitos.
  out(stem) {
    const g = this.ctx.createGain();
    g.connect(this.stems[stem]);
    return g;
  }

  pad(f, t, len) {
    const c = this.ctx;
    const g = this.out('instruments');
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(500, t);
    filt.frequency.linearRampToValueAtTime(1100, t + len * 0.5);
    filt.frequency.linearRampToValueAtTime(600, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 1.2);
    g.gain.setValueAtTime(0.035, t + len - 0.2);
    g.gain.linearRampToValueAtTime(0, t + len + 1.6);
    [-7, 7].forEach((det) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filt);
      o.start(t);
      o.stop(t + len + 1.7);
    });
    filt.connect(g);
  }

  pluck(f, t, v) {
    const c = this.ctx;
    const g = this.out('instruments');
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.4);
  }

  bass(f, t, len, v) {
    const c = this.ctx;
    const g = this.out('bass');
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 4;
    filt.frequency.setValueAtTime(700, t);
    filt.frequency.exponentialRampToValueAtTime(140, t + len);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const sub = c.createOscillator();
    sub.frequency.value = f / 2;
    const sg = c.createGain();
    sg.gain.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(filt).connect(g);
    sub.connect(sg).connect(g);
    o.start(t);
    sub.start(t);
    o.stop(t + len + 0.05);
    sub.stop(t + len + 0.05);
  }

  bell(f, t) {
    const c = this.ctx;
    const g = this.out('melody');
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const mg = c.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    car.connect(g);
    car.start(t);
    mod.start(t);
    car.stop(t + 2.5);
    mod.stop(t + 2.5);
  }
}
