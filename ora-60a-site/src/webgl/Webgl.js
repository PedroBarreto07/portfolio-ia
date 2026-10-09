import { NoToneMapping, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import Camera from './Camera.js'
import PostProcessing from './PostProcessing.js'
import bus, { EVENTS } from '../state/bus.js'

/*
 * Renderer, scene, camera rig, post-processing, resize and adaptive
 * resolution. The frame loop itself is driven by gsap.ticker (main.js) so
 * Lenis, ScrollTrigger and WebGL share one requestAnimationFrame.
 */
export default class Webgl {
  constructor({ container, quality }) {
    this.container = container
    this.quality = quality
    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: new URLSearchParams(location.search).has('shots'),
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NoToneMapping
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x000000, 0)
    container.appendChild(this.renderer.domElement)

    this.scene = new Scene()
    this.cameraRig = new Camera()
    this.post = new PostProcessing({ renderer: this.renderer, grain: null, samples: quality.msaa })

    this.maxDpr = quality.maxDpr
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    this.width = 1
    this.height = 1
    this.paused = false
    this.frameTimes = []
    this.lastAdapt = 0

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden
    })
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.width = w
    this.height = h
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = `${w}px`
    this.renderer.domElement.style.height = `${h}px`
    this.post.setSize(w, h, this.dpr)
    this.cameraRig.setAspect(w / h)
    bus.emit(EVENTS.RESIZE, { width: w, height: h })
  }

  /** Lower the resolution when the GPU can't keep up (never above maxDpr). */
  adapt(dt, time) {
    if (!this.quality.adaptive) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length > 90) this.frameTimes.shift()
    if (time - this.lastAdapt < 2.5 || this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    if (avg > 1 / 45 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.lastAdapt = time
      this.frameTimes.length = 0
      this.resize()
    } else if (avg < 1 / 58 && this.dpr < Math.min(window.devicePixelRatio || 1, this.maxDpr)) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25)
      this.lastAdapt = time
      this.frameTimes.length = 0
      this.resize()
    }
  }

  render(dt, time) {
    if (this.paused) return
    this.post.uniforms.uTime.value = time
    this.cameraRig.update(dt)
    this.post.render(this.scene, this.cameraRig.camera)
    this.adapt(dt, time)
  }
}
