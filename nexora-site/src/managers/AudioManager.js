import { ASSETS, AUDIO, SFX_CUES } from '../config.js';
import { bus } from '../core/EventBus.js';
import { clamp } from '../core/math.js';
import { ProceduralMusic } from '../audio/ProceduralMusic.js';
import { SFX, createImpulse } from '../audio/Synth.js';

const STEMS = ['melody', 'bass', 'instruments'];
// Envio de efeitos por stem (aplicado depois do ganho do stem)
const SENDS = { melody: { reverb: 0.55, delay: 0.45 }, bass: { reverb: 0.05, delay: 0 }, instruments: { reverb: 0.5, delay: 0.25 } };

/**
 * Stems musicais em loop sincronizados + SFX por evento.
 * Só inicia após um gesto do usuário (política de autoplay).
 * Se ASSETS.audio tiver os 3 arquivos, usa-os; senão sintetiza a trilha.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this.mixIndex = -1;
    this.prevProgress = 0;
    this.loops = {};
    bus.on('sfx', (name) => this.play(name));
  }

  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    if (ctx.state === 'suspended') await ctx.resume();

    // master → compressor → saída
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.comp).connect(ctx.destination);

    // efeitos compartilhados
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = createImpulse(ctx, 3.2, 2.8);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.6;
    this.reverb.connect(revOut).connect(this.master);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / AUDIO.bpm) * 0.75; // colcheia pontuada
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dFilt = ctx.createBiquadFilter();
    dFilt.type = 'lowpass';
    dFilt.frequency.value = 3200;
    this.delay.connect(dFilt).connect(fb).connect(this.delay);
    dFilt.connect(this.master);
    dFilt.connect(this.reverb);

    // stems
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.stems = {};
    for (const s of STEMS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.music);
      const r = ctx.createGain();
      r.gain.value = SENDS[s].reverb;
      g.connect(r).connect(this.reverb);
      if (SENDS[s].delay) {
        const d = ctx.createGain();
        d.gain.value = SENDS[s].delay;
        g.connect(d).connect(this.delay);
      }
      this.stems[s] = g;
    }

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    const sfxRev = ctx.createGain();
    sfxRev.gain.value = 0.25;
    this.sfxBus.connect(sfxRev).connect(this.reverb);

    await this.startMusic();
  }

  async startMusic() {
    const ctx = this.ctx;
    const files = ASSETS.audio;
    const useFiles = STEMS.every((s) => files[s]);
    if (useFiles) {
      try {
        const buffers = await Promise.all(
          STEMS.map((s) =>
            fetch(files[s])
              .then((r) => r.arrayBuffer())
              .then((b) => ctx.decodeAudioData(b))
          )
        );
        const t = ctx.currentTime + 0.1; // mesmo instante → stems sincronizados
        buffers.forEach((buf, i) => {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(this.stems[STEMS[i]]);
          src.start(t);
        });
        return;
      } catch (e) {
        console.warn('[audio] falha ao carregar stems, usando trilha sintetizada', e);
      }
    }
    this.generator = new ProceduralMusic(ctx, this.stems);
    this.generator.bpm = AUDIO.bpm;
    this.generator.start();
  }

  // Chamado no clique do CTA
  start() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : AUDIO.master, t + AUDIO.fadeIn);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(m) {
    this.muted = m;
    bus.emit('audio:muted', m);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(m ? 0 : AUDIO.master, t + AUDIO.muteFade);
    if (!m && this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name) {
    if (!this.ctx || !this.started || !SFX[name]) return;
    const v = AUDIO.sfx[name] ?? 0.4;
    SFX[name](this.ctx, this.sfxBus, v);
  }

  startLoop(name) {
    if (!this.ctx || !this.started || this.loops[name]) return;
    this.loops[name] = SFX[name](this.ctx, this.sfxBus, AUDIO.sfx[name] ?? 0.3);
  }

  stopLoop(name, fade) {
    const l = this.loops[name];
    if (!l) return;
    l.stop(fade);
    delete this.loops[name];
  }

  update(progress, velocity) {
    if (!this.ctx || !this.started) return;

    // Mix de stems por cena
    const idx = AUDIO.mix.findIndex((m) => progress >= m.range[0] && progress <= m.range[1]);
    if (idx !== this.mixIndex && idx >= 0) {
      this.mixIndex = idx;
      const m = AUDIO.mix[idx];
      const t = this.ctx.currentTime;
      for (const s of STEMS) this.stems[s].gain.setTargetAtTime(m[s], t, AUDIO.stemCrossfade / 3);
    }

    // SFX por cruzamento de pontos (apenas avançando)
    const prev = this.prevProgress;
    if (progress > prev && progress - prev < 0.05) {
      for (const c of SFX_CUES) if (prev < c.at && progress >= c.at) this.play(c.sfx);
    }
    this.prevProgress = progress;

    // Loop quântico: pitch/velocidade acompanha a velocidade do scroll
    const inQuantum = progress > 0.54 && progress < 0.62;
    if (inQuantum) {
      this.startLoop('quantumLoop');
      const rate = 1 + clamp(Math.abs(velocity) * 25, 0, AUDIO.quantumMaxRate - 1);
      this.loops.quantumLoop?.setRate(rate);
    } else this.stopLoop('quantumLoop', AUDIO.quantumLoopFadeOut);
  }
}
