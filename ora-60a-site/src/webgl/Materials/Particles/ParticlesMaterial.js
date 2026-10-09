import { CustomBlending, Matrix4, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial } from 'three'
import vertexShader from './particles.vert.glsl?raw'
import fragmentShader from './particles.frag.glsl?raw'

export default class ParticlesMaterial extends ShaderMaterial {
  constructor({ noise, count }) {
    super({
      vertexShader,
      fragmentShader,
      defines: { PARTICLES_COUNT: count },
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uSize: { value: 5.6 },
        uPixelRatio: { value: 1 },
        uViewportHeight: { value: 900 },
        uOpacity: { value: 1 },
        uCloud: { value: 1 },
        uDark: { value: 1 },
        uNoise: { value: noise },
        uWatchMatrix: { value: new Matrix4() },
      },
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    })
  }
}
