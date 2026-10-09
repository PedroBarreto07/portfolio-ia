import gsap from 'gsap'
import { Box3, PerspectiveCamera, UnsignedByteType, Vector3, WebGLRenderTarget } from 'three'
import { get } from 'svelte/store'
import PostProcessing from './PostProcessing.js'
import { GlobalUniforms } from './Materials/PBR/SixtyMaterial.js'
import { CATALOG_IDS } from './Scene/WatchModel.js'
import { applyParams } from './Scene/WatchMaterials.js'
import * as store from '../state/store.js'

const H = Math.PI / 2

/*
 * "Photo studio": renders the live 3D watch offscreen into still images
 * (gallery shots per finish, isolated parts for the catalog list). This
 * replaces first_1..5.webp / parts/*.jpg — the pictures always match the
 * configured finish, dial and strap. Work is spread over idle frames.
 */

const GALLERY = [
  { id: 'three-quarter', rot: [0.18, -0.62, 0.05], look: [0, 0, 0], radius: 10.8, phi: H - 0.04 },
  { id: 'dial', rot: [0.08, -0.28, 0.0], look: [0.25, 0.35, 0.2], radius: 4.4, phi: H },
  { id: 'profile', rot: [-H, 0, -H], look: [0, 0, 0], radius: 8.2, phi: H - 0.12 },
  { id: 'caseback', rot: [0.12, Math.PI - 0.45, 0], look: [0, 0, 0], radius: 8.6, phi: H - 0.05 },
  { id: 'bracelet', rot: [-H, 0, -H], look: [0, -1.4, -4.6], radius: 3.4, phi: H + 0.4 },
]

const PART_POSES = {
  dial: [0.05, -0.35, 0],
  hands: [0.05, -0.2, 0],
  crystal: [0.65, -0.3, 0],
  bezel: [0.55, -0.35, 0],
  lugs: [0.25, -0.8, 0],
  strap: [0.15, -1.15, 0],
  buckle: [0.1, Math.PI - 0.4, 0],
  crown: [0.1, -1.1, 0],
  caseback: [0.15, Math.PI - 0.35, 0],
  movement: [0.15, Math.PI - 0.4, 0],
}

export default class Snapshotter {
  constructor({ webgl, scene, config, quality }) {
    this.webgl = webgl
    this.scene = scene
    this.config = config
    this.quality = quality
    this.queue = []
    this.busy = false
    this.size = quality.low ? [560, 700] : [880, 1100]
    this.camera = new PerspectiveCamera(30, this.size[0] / this.size[1], 0.1, 100)
    this.post = new PostProcessing({ renderer: webgl.renderer, grain: scene.tex?.grain, samples: quality.msaa })
    this.post.setSize(this.size[0], this.size[1], 1)
    this.output = new WebGLRenderTarget(this.size[0], this.size[1], { type: UnsignedByteType })
    this.pixels = new Uint8Array(this.size[0] * this.size[1] * 4)
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.size[0]
    this.canvas.height = this.size[1]
    this.ctx = this.canvas.getContext('2d')
    this.cache = new Map()
    this._box = new Box3()
    this._v = new Vector3()
  }

  key(finish = get(store.finish)) {
    return `${finish}-${get(store.dial)}-${get(store.strap)}`
  }

  start() {
    this.post.uniforms.tGrain.value = this.scene.tex.grain
    const post = this.config.post
    Object.assign(this.post.uniforms.uExposure, { value: post.exposure })
    // queue current configuration first, other finishes later
    const enqueueAll = () => {
      const f = get(store.finish)
      this.enqueueParts(f)
      this.enqueueGallery(f)
      this.config.finishes.forEach((_, i) => i !== f && this.enqueueGallery(i))
    }
    let t = 0
    const debounced = () => {
      clearTimeout(t)
      t = setTimeout(enqueueAll, 600)
    }
    store.finish.subscribe(debounced)
    store.dial.subscribe(debounced)
    store.strap.subscribe(debounced)
    gsap.ticker.add(this.tick)
  }

  enqueueGallery(finish) {
    const k = `gallery:${this.key(finish)}`
    if (this.cache.has(k) || this.queue.some((q) => q.k === k)) return
    this.queue.push({ k, type: 'gallery', finish })
  }

  enqueueParts(finish) {
    const k = `parts:${this.key(finish)}`
    if (this.cache.has(k) || this.queue.some((q) => q.k === k)) return
    this.queue.push({ k, type: 'parts', finish })
  }

  tick = () => {
    if (this.busy || !this.queue.length || !get(store.introDone)) return
    if (Math.abs(store.engine.lenis?.velocity || 0) > 2) return
    const job = this.queue[0]
    this.busy = true
    this.runJob(job).finally(() => {
      this.busy = false
    })
  }

  async runJob(job) {
    const items = job.type === 'gallery' ? GALLERY.map((g) => ({ ...g, kind: 'gallery' })) : CATALOG_IDS.map((id) => ({ id, kind: 'part' }))
    const urls = job.type === 'gallery' ? [] : {}
    for (const item of items) {
      // one render per frame, after the main render
      await new Promise((r) => requestAnimationFrame(() => r()))
      const url = await this.renderShot(item, job.finish)
      if (job.type === 'gallery') urls.push(url)
      else urls[item.id] = url
    }
    this.queue.shift()
    this.cache.set(job.k, urls)
    store.snapshots.update((s) => ({ ...s, [job.k]: urls }))
  }

  async renderShot(item, finish) {
    const { scene, webgl } = this
    const rig = scene.rig
    const r = webgl.renderer
    const saved = this.saveState()
    try {
      this.prepareScene(finish)
      if (item.kind === 'gallery') this.poseGallery(item)
      else this.posePart(item.id)
      this.post.uniforms.uTime.value = 12.5
      this.post.uniforms.uBackgroundMultiplier.value = 0.85
      this.post.render(scene.scene, this.camera, this.output)
      r.readRenderTargetPixels(this.output, 0, 0, this.size[0], this.size[1], this.pixels)
      r.setRenderTarget(null)
    } finally {
      this.restoreState(saved)
    }
    // flip Y into the 2D canvas
    const [w, h] = this.size
    const img = this.ctx.createImageData(w, h)
    const row = w * 4
    for (let y = 0; y < h; y++) img.data.set(this.pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row)
    this.ctx.putImageData(img, 0, 0)
    const blob = await new Promise((res) => this.canvas.toBlob(res, 'image/webp', 0.9))
    return blob ? URL.createObjectURL(blob) : this.canvas.toDataURL('image/jpeg', 0.9)
  }

  saveState() {
    const rig = this.scene.rig
    const vis = []
    rig.root.traverse((o) => vis.push([o, o.visible, o.position.clone(), o.rotation.clone(), o.scale.clone()]))
    const mats = this.scene.matGroups.all.map((m) => [m, m.color.clone(), m.roughness, m.metalness, m.envMapIntensity, m.additiveEnvMapIntensity, m.dissolve, m.fade])
    return {
      vis,
      mats,
      env: this.scene.scene.environmentRotation.clone(),
      extras: [this.scene.particles, this.scene.backdrop, this.scene.wordPlane, this.scene.lineup.group].map((o) => [o, o.visible]),
      darkness: this.scene.state.darkness,
      handsOverride: this.scene.handsOverride,
    }
  }

  restoreState(s) {
    s.vis.forEach(([o, v, p, r, sc]) => {
      o.visible = v
      o.position.copy(p)
      o.rotation.copy(r)
      o.scale.copy(sc)
    })
    s.mats.forEach(([m, c, ro, me, ei, ai, d, f]) => {
      m.color.copy(c)
      m.roughness = ro
      m.metalness = me
      m.envMapIntensity = ei
      m.additiveEnvMapIntensity = ai
      m.dissolve = d
      m.fade = f
    })
    this.scene.scene.environmentRotation.copy(s.env)
    s.extras.forEach(([o, v]) => (o.visible = v))
    this.scene.handsOverride = s.handsOverride
    GlobalUniforms.uDarknessProgress.value = s.darkness
    this.scene.rig.root.updateMatrixWorld(true)
  }

  prepareScene(finish) {
    const { scene } = this
    const rig = scene.rig
    const f = this.config.finishes[finish]
    scene.matGroups.finishGlossy.forEach((m) => applyParams(m, f.glossy))
    scene.matGroups.finishBrushed.forEach((m) => applyParams(m, f.brushed))
    scene.matGroups.all.forEach((m) => {
      m.dissolve = 0
      m.fade = 1
    })
    rig.caseGroup.scale.setScalar(1)
    rig.bracelet.scale.setScalar(1)
    rig.strap.scale.setScalar(1)
    scene.particles.visible = false
    scene.backdrop.visible = false
    scene.wordPlane.visible = false
    scene.lineup.group.visible = false
    rig.shadow.visible = false
    rig.caseGroup.visible = true
    rig.movement.visible = true
    const leather = this.config.straps[get(store.strap)].id !== 'bracelet'
    rig.bracelet.visible = !leather
    rig.strap.visible = leather
    // assembled
    Object.values(rig.parts).forEach((part) => {
      part.group.position.set(0, 0, 0)
      part.group.rotation.set(0, 0, 0)
      part.group.scale.setScalar(1)
      part.pieces.forEach((pc) => pc.obj.position.copy(pc.base))
    })
    Object.values(rig.animated.hands).forEach((h) => (h.shadow.visible = true))
    rig.pivot.rotation.set(0, 0, 0)
    rig.root.position.set(0, 0, 0)
    rig.root.scale.setScalar(1)
    scene.scene.environmentRotation.set(0, 0.6, 0)
    GlobalUniforms.uDarknessProgress.value = 0
  }

  aim(look, radius, phi = H, theta = H) {
    const c = this.camera
    c.position.set(look.x + radius * Math.sin(phi) * Math.cos(theta), look.y + radius * Math.cos(phi), look.z + radius * Math.sin(phi) * Math.sin(theta))
    c.lookAt(look)
    c.updateMatrixWorld()
  }

  poseGallery(g) {
    const rig = this.scene.rig
    rig.root.rotation.set(...g.rot)
    rig.root.updateMatrixWorld(true)
    const look = this._v.set(...g.look).applyMatrix4(rig.root.matrixWorld)
    this.aim(look.clone(), g.radius, g.phi)
  }

  posePart(id) {
    const rig = this.scene.rig
    const keep = new Set()
    const objs = rig.catalog[id]
    objs.forEach((o) => {
      o.traverse((c) => keep.add(c))
      let p = o.parent
      while (p) {
        keep.add(p)
        p = p.parent
      }
    })
    rig.root.traverse((o) => {
      if (!keep.has(o)) o.visible = false
      else if (o.isMesh || o.isGroup || o.isInstancedMesh) o.visible = true
    })
    // hand shadows make no sense in isolation
    Object.values(rig.animated.hands).forEach((h) => (h.shadow.visible = false))
    if (id === 'strap') {
      const leather = this.config.straps[get(store.strap)].id !== 'bracelet'
      rig.bracelet.visible = !leather
      rig.strap.visible = leather
      if (leather) rig.strap.traverse((o) => (o.visible = true))
    }
    rig.root.rotation.set(...PART_POSES[id])
    rig.root.updateMatrixWorld(true)
    // frame the bounding box
    this._box.makeEmpty()
    objs.forEach((o) => this._box.expandByObject(o))
    if (id === 'strap' && rig.strap.visible) this._box.expandByObject(rig.strap)
    const center = this._box.getCenter(new Vector3())
    const size = this._box.getSize(new Vector3())
    const fit = Math.max(size.y, size.x / this.camera.aspect, size.z * 0.6)
    const radius = (fit * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360) * 1.35 + size.z * 0.5
    this.aim(center, radius, H - 0.06)
  }
}
