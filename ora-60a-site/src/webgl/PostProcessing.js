import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import fragmentShader from './Materials/PostProcessing/post.frag.glsl?raw'

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16)
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/*
 * One full-screen pass: the scene is rendered (linear, HDR, MSAA) into a
 * render target with a transparent clear; this pass tone-maps it and
 * composites it over the procedural studio backdrop where alpha = 0,
 * then applies contrast/gamma, overlays and grain.
 */
export default class PostProcessing {
  constructor({ renderer, grain, samples = 4 }) {
    this.renderer = renderer
    this.target = new WebGLRenderTarget(4, 4, {
      type: HalfFloatType,
      samples,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    })

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))

    this.uniforms = {
      tScene: { value: this.target.texture },
      tGrain: { value: grain },
      uResolution: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uExposure: { value: 1.0 },
      uContrast: { value: 1.15 },
      uGamma: { value: 1.6 },
      uSaturation: { value: 1.0 },
      uBackgroundMultiplier: { value: 1 },
      uDarkness: { value: 0 },
      uMouse: { value: new Vector2() },
      uLongpress: { value: 0 },
      uNoise: { value: 0.05 },
      uFisheye: { value: 0 },
      uVignette: { value: 1 },
      uOverlay: { value: 0 },
      uOverlayDark: { value: 0 },
      uFocus: { value: 0 },
      uScreenX: { value: 0.5 },
      uZoomProgress: { value: 0 },
      uLaser: { value: 0 },
      uLaserX: { value: 0 },
      uLightA: { value: hex('#ebebeb') },
      uLightB: { value: hex('#a1a1a1') },
      uDarkA: { value: hex('#050505') },
      uDarkB: { value: hex('#1d1d1f') },
    }

    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: fragmentShader.replace('precision highp float;', ''),
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new Mesh(geo, this.material)
    this.quad.frustumCulled = false
    this.scene = new Scene()
    this.scene.add(this.quad)
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  setSize(width, height, dpr) {
    const w = Math.max(1, Math.floor(width * dpr))
    const h = Math.max(1, Math.floor(height * dpr))
    this.target.setSize(w, h)
    this.uniforms.uResolution.value.set(w, h)
  }

  render(scene, camera, outputTarget = null) {
    const r = this.renderer
    r.setRenderTarget(this.target)
    r.setClearColor(0x000000, 0)
    r.clear(true, true, false)
    r.render(scene, camera)
    r.setRenderTarget(outputTarget)
    r.render(this.scene, this.camera)
  }

  dispose() {
    this.target.dispose()
    this.material.dispose()
  }
}

export { hex }
