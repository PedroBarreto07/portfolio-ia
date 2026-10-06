import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POSTFX } from '../config.js';
import { BlendShader, FinalShader, TRANSITION_TYPES } from '../shaders/post.js';
import { prefersReducedMotion } from '../core/math.js';

/**
 * Pipeline:
 *   cena A → rtA ┐
 *   cena B → rtB ┴→ Blend(transição) → Bloom → Output(ACES + sRGB) → Final(CA, blur, vinheta, grão) → tela
 */
export class PostFXManager {
  constructor(renderer, sizes) {
    this.renderer = renderer;
    this.sizes = sizes;
    this.reduced = prefersReducedMotion();

    const opts = { type: THREE.HalfFloatType, samples: sizes.mobile ? 2 : 4 };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);

    this.composer = new EffectComposer(renderer);

    this.blendPass = new ShaderPass(BlendShader, '__none');
    this.blendPass.uniforms.tA.value = this.rtA.texture;
    this.blendPass.uniforms.tB.value = this.rtB.texture;
    this.composer.addPass(this.blendPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, POSTFX.bloomRadius, POSTFX.bloomThreshold);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());

    this.finalPass = new ShaderPass(FinalShader);
    this.finalPass.uniforms.uRes.value = new THREE.Vector2();
    this.composer.addPass(this.finalPass);

    // Valores animáveis (TransitionManager / créditos escrevem aqui)
    this.state = {
      bloomTarget: 0.8,
      bloom: 0.8,
      caBoost: 0,
      blur: 0,
      darken: 0,
    };

    this.resize();
  }

  resize() {
    const { width, height, dpr } = this.sizes;
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width * Math.min(dpr, 1.25), height * Math.min(dpr, 1.25));
    this.finalPass.uniforms.uRes.value.set(w, h);
    this.blendPass.uniforms.uAspect.value = width / height;
  }

  /**
   * @param {object} a  cena principal (BaseScene)
   * @param {object|null} b  segunda cena durante transições
   * @param {number} mix 0..1
   * @param {string} type tipo de transição
   */
  render(a, b, mix, type, dt, time) {
    if (a) a.render(this.renderer, this.rtA);
    else this.clear(this.rtA);
    const blending = b && mix > 0.0001;
    if (blending) b.render(this.renderer, this.rtB);

    const u = this.blendPass.uniforms;
    u.uMix.value = blending ? mix : 0;
    u.uType.value = this.reduced ? 0 : TRANSITION_TYPES[type] ?? 0;
    u.uTime.value = time;

    // Bloom com fade (POSTFX.bloomFade segundos)
    const k = 1 - Math.exp(-dt / Math.max(0.01, POSTFX.bloomFade / 3));
    const s = this.state;
    s.bloom += (s.bloomTarget - s.bloom) * k;
    this.bloomPass.strength = s.bloom;

    const f = this.finalPass.uniforms;
    f.uTime.value = time;
    f.uGrain.value = this.reduced ? 0 : POSTFX.grain;
    f.uVignette.value = POSTFX.vignette;
    const transitionCA = blending && type === 'chromatic' ? Math.sin(Math.PI * mix) * 0.02 : 0;
    f.uCA.value = this.reduced ? 0 : POSTFX.chromatic + s.caBoost + transitionCA;
    f.uBlur.value = s.blur;
    f.uDarken.value = s.darken;

    this.composer.render(dt);
  }

  clear(rt) {
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
  }
}

