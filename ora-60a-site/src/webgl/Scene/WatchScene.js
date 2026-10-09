import gsap from 'gsap'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import BackdropMaterial from '../Materials/Backdrop/BackdropMaterial.js'
import ParticlesMaterial from '../Materials/Particles/ParticlesMaterial.js'
import { GlobalUniforms } from '../Materials/PBR/SixtyMaterial.js'
import { createStudioEnvironment } from '../environment/StudioEnvironment.js'
import * as T from '../textures/ProceduralTextures.js'
import { clamp, damp, mulberry32, nextFrame } from '../utils/math.js'
import { applyParams, createMaterials } from './WatchMaterials.js'
import { buildWatch, PART_IDS } from './WatchModel.js'
import Lineup from './Lineup.js'
import bus, { EVENTS } from '../../state/bus.js'

const TAU = Math.PI * 2
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// extraction order (0 = first out)
const STAGGER = { dial: 0, weight: 0, tourbillon: 1, backplate: 1, mainplate: 2, barrel: 2 }
const STEP = 0.17

/** Parameters animated by the scroll choreography (and their defaults). */
export const STATE_DEFAULTS = {
  camRadius: 13,
  camPhi: Math.PI / 2,
  camTheta: Math.PI / 2,
  camFov: 30,
  camRoll: 0,
  parallax: 1,
  lookX: 0,
  lookY: 0,
  lookZ: 0,
  lookLocal: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  posX: 0,
  posY: 0,
  posZ: 0,
  scale: 1,
  explode: 0,
  disassembly: 0,
  spin: 0,
  caseDissolve: 0,
  movementDissolve: 0,
  darkness: 0,
  bg: 1,
  envRot: 0,
  addRot: 0,
  particles: 0,
  particlesOpacity: 0,
  particlesCloud: 1,
  backdrop: 0,
  backdropScale: 1,
  backdropX: 0,
  vText: 0,
  vTextOpacity: 0,
  overlay: 0,
  overlayDark: 0,
  laser: 0,
  laserX: 0,
  shadow: 0,
  labels: 0,
  interactive: 0,
  drag: 1,
  rowPan: 0,
  autoRotate: 0,
  lineup: 0,
  lineupText: 0,
}

// per-part personality in the "mechanical heart" spin
const SPIN = {
  dial: { z: 0.6, x: 0.25 },
  tourbillon: { z: -1.4, x: -0.2 },
  mainplate: { z: 0.9, x: 0.15 },
  barrel: { z: -1.1, x: -0.3 },
  backplate: { z: 0.7, x: 0.22 },
  weight: { z: -1.8, x: -0.12 },
}

export default class WatchScene {
  constructor({ webgl, config, quality }) {
    this.webgl = webgl
    this.config = config
    this.quality = quality
    this.scene = webgl.scene
    this.state = { ...STATE_DEFAULTS }
    this.intro = 0
    this.finishIndex = 0
    this.dialIndex = 0
    this.strapIndex = 0
    this.time = 0
    this.handsOverride = null // { h, m, s } for staged renders
    this.drag = { active: false, angle: 0, velocity: 0, tilt: 0, rowPan: 0, rowVelocity: 0 }
    this.rotor = { angle: 0, velocity: 0 }
    this.hover = { id: null, amount: {} }
    this.selected = null
    this.zoom = 0
    this.raycaster = new Raycaster()
    this.pointer = new Vector2(-10, -10)
    this._tmp = new Vector3()
    this._tmp2 = new Vector3()
    this._labelData = PART_IDS.map((id) => ({ id, x: 0, y: 0, top: 0, visible: false }))
    PART_IDS.forEach((id) => (this.hover.amount[id] = 0))
  }

  // ----------------------------------------------------------- loading

  async load(progress = () => {}) {
    const q = this.quality
    const big = q.textureSize
    let step = 0
    const STEPS = 11
    const timings = (this.timings = [])
    let t0 = performance.now()
    const tick = async (label) => {
      step++
      const now = performance.now()
      timings.push([label, Math.round(now - t0)])
      t0 = now
      progress(step / STEPS, label)
      await nextFrame()
    }

    await Promise.race([
      Promise.all([
        document.fonts.load('400 64px "Unbounded"'),
        document.fonts.load('500 64px "Inter Variable"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]).catch(() => {})
    await tick('fonts')

    const tex = (this.tex = {})
    tex.brushed = T.createBrushed(big)
    await tick('brushed')
    tex.geneva = T.createGeneva(big)
    await tick('geneva')
    tex.perlage = T.createPerlage(big)
    tex.circular = T.createCircular(big)
    await tick('perlage')
    tex.sunburst = T.createSunburst(big)
    tex.leather = T.createLeather(512)
    await tick('sunburst')
    tex.noise = T.createSmoothNoise(256)
    tex.grain = T.createGrain(256)
    tex.additiveEnv = T.createAdditiveEnv(1024)
    tex.shadow = T.createShadow(256)
    tex.moon = T.createMoonDisc(1024)
    const dial = this.config.dials[0]
    tex.dialPrint = T.createDialPrint({ color: dial.print, size: q.printSize })
    tex.rehaut = T.createRehaut({ color: dial.print === '#ffffff' ? '#2b2b2b' : '#f2f2f2', background: dial.rehaut === '#2b2b2b' ? '#e6e6e6' : dial.rehaut })
    tex.engraving = T.createEngraving([{ text: 'ORA', size: 0.16, tracking: 0.03 }, { text: 'GENÈVE · 60A', size: 0.045, font: 'Inter Variable', weight: 500, tracking: 0.012 }])
    tex.engravingPlate = T.createEngraving([
      { text: 'ORA  CALIBRE 60A', size: 0.06, tracking: 0.02 },
      { text: 'TOURBILLON · 42 JEWELS · 60H', size: 0.035, font: 'Inter Variable', weight: 500, tracking: 0.012 },
    ])
    tex.engravingRotor = T.createEngraving([{ text: 'ORA', size: 0.14, tracking: 0.04 }])
    await tick('details')

    this.env = createStudioEnvironment(this.webgl.renderer)
    this.scene.environment = this.env
    this.webgl.post.uniforms.tGrain.value = tex.grain
    await tick('environment')

    const { materials, groups } = createMaterials({ config: this.config, tex })
    this.materials = materials
    this.matGroups = groups
    this.applyFinish(0, { immediate: true })
    this.applyDial(0, { immediate: true, regenerate: false })
    await tick('materials')

    // a hand-made GLB (same naming convention) can replace the procedural model
    const modelUrl = new URLSearchParams(location.search).get('model') || this.config.model?.url
    if (modelUrl) {
      try {
        const { loadGLBRig } = await import('./GLBRig.js')
        this.rig = await loadGLBRig(modelUrl, { mats: materials, renderer: this.webgl.renderer })
      } catch (err) {
        console.warn('[ORA] GLB failed, falling back to the procedural watch:', err)
      }
    }
    if (!this.rig) this.rig = buildWatch({ mats: materials, quality: q.geometry })
    this.scene.add(this.rig.root)
    await tick('model')

    this.createParticles()
    this.lineup = new Lineup({ watchScene: this })
    this.scene.add(this.lineup.group)
    this.createBackdrop()
    this.createWordPlane()
    await tick('particles')

    // pre-compile every program so the first scroll never hitches
    const r = this.webgl.renderer
    const cam = this.webgl.cameraRig.camera
    this.rig.strap.visible = true
    this.particles.visible = true
    this.backdrop.visible = true
    this.wordPlane.visible = true
    this.lineup.group.visible = true
    // compile against the HDR target the scene really renders into: the
    // output colour space is part of the program key, compiling for the
    // canvas would recompile everything on the first frame
    r.setRenderTarget(this.webgl.post.target)
    try {
      if (r.compileAsync) await r.compileAsync(this.scene, cam)
      else r.compile(this.scene, cam)
    } catch (e) {
      r.compile(this.scene, cam)
    }
    r.setRenderTarget(null)
    // the post pass itself (screen output)
    r.compile(this.webgl.post.scene, this.webgl.post.camera)
    this.rig.strap.visible = false
    await tick('compile')
  }

  // -------------------------------------------------------- particles

  createParticles() {
    const count = this.quality.particles
    const rig = this.rig
    // sample the movement surfaces in its exploded configuration
    const saved = { ...this.state }
    Object.assign(this.state, { explode: 1, disassembly: 1, spin: 0 })
    this.applyRig(0)
    rig.root.updateMatrixWorld(true)
    const inv = new Matrix4().copy(rig.root.matrixWorld).invert()

    const meshes = []
    rig.movement.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && o.geometry.attributes.position.count > 12) meshes.push(o)
    })
    const areas = meshes.map((m) => {
      m.geometry.computeBoundingBox()
      const s = new Vector3()
      m.geometry.boundingBox.getSize(s)
      return Math.max(0.0005, s.x * s.y + s.y * s.z + s.x * s.z)
    })
    const total = areas.reduce((a, b) => a + b, 0)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 4)
    const indices = new Float32Array(count)
    const rng = mulberry32(5)
    const p = new Vector3()
    const mat = new Matrix4()
    let k = 0
    meshes.forEach((m, mi) => {
      const n = mi === meshes.length - 1 ? count - k : Math.round((areas[mi] / total) * count)
      if (n <= 0) return
      let sampler
      try {
        sampler = new MeshSurfaceSampler(m).setRandomGenerator(rng).build()
      } catch (e) {
        return
      }
      mat.multiplyMatrices(inv, m.matrixWorld)
      for (let i = 0; i < n && k < count; i++, k++) {
        sampler.sample(p)
        p.applyMatrix4(mat)
        positions.set([p.x, p.y, p.z], k * 3)
      }
    })
    for (; k < count; k++) positions.set([(rng() - 0.5) * 3, (rng() - 0.5) * 3, (rng() - 0.5) * 6], k * 3)
    for (let i = 0; i < count; i++) {
      seeds.set([rng(), rng(), rng(), rng()], i * 4)
      indices[i] = i
    }
    Object.assign(this.state, saved)
    this.applyRig(0)

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4))
    geo.setAttribute('aIndex', new BufferAttribute(indices, 1))
    this.particlesMaterial = new ParticlesMaterial({ noise: this.tex.noise, count })
    this.particles = new Points(geo, this.particlesMaterial)
    this.particles.name = 'particles'
    this.particles.frustumCulled = false
    this.particles.renderOrder = 20
    this.particles.visible = false
    this.scene.add(this.particles)
  }

  createBackdrop() {
    this.backdropMaterial = new BackdropMaterial()
    this.backdrop = new Mesh(new PlaneGeometry(2, 2), this.backdropMaterial)
    this.backdrop.name = 'backdrop'
    this.backdrop.renderOrder = -2
    this.scene.add(this.backdrop)
  }

  createWordPlane() {
    const tex = T.createWordTexture(this.config.wordmark || 'ORA 60A', { color: '#1c1c1c' })
    const aspect = tex.userData.aspect
    const h = 4.6
    this.wordMaterial = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })
    this.wordPlane = new Mesh(new PlaneGeometry(h * aspect, h), this.wordMaterial)
    this.wordPlane.rotation.z = Math.PI / 2
    this.wordPlane.name = 'vertical-wordmark'
    this.wordPlane.userData.length = h * aspect
    this.wordPlane.renderOrder = -1
    this.scene.add(this.wordPlane)
  }

  // ------------------------------------------------------ appearance

  applyFinish(index, { immediate = false, duration = 1.4 } = {}) {
    this.finishIndex = index
    const f = this.config.finishes[index]
    const g = this.matGroups
    const run = (mats, p) => {
      mats.forEach((m) => {
        if (immediate) return applyParams(m, p)
        const c = new Color(p.color)
        gsap.to(m.color, { r: c.r, g: c.g, b: c.b, duration, ease: 'brand.expoInOut' })
        gsap.to(m, {
          roughness: p.roughness,
          metalness: p.metalness,
          envMapIntensity: p.envMapIntensity ?? 1,
          additiveEnvMapIntensity: p.additiveEnvMapIntensity ?? m.additiveEnvMapIntensity,
          duration,
          ease: 'brand.expoInOut',
        })
      })
    }
    run(g.finishGlossy, f.glossy)
    run(g.finishBrushed, f.brushed)
    // crown cap & clasp engraving follow the finish
    run([this.materials.crownLogo], { ...f.glossy, color: index >= 2 ? f.glossy.color : '#f1cf8f' })
  }

  applyDial(index, { immediate = false, regenerate = true } = {}) {
    this.dialIndex = index
    const d = this.config.dials[index]
    const m = this.materials.dial
    if (immediate) {
      m.color.set(d.color)
      m.roughness = d.roughness
    } else {
      const c = new Color(d.color)
      gsap.to(m.color, { r: c.r, g: c.g, b: c.b, duration: 1.2, ease: 'brand.expoInOut' })
      gsap.to(m, { roughness: d.roughness, duration: 1.2, ease: 'brand.expoInOut' })
    }
    if (regenerate) {
      const old = this.tex.dialPrint
      this.tex.dialPrint = T.createDialPrint({ color: d.print, size: this.quality.printSize })
      this.materials.dialPrint.map = this.tex.dialPrint
      old.dispose()
      const oldR = this.tex.rehaut
      const lightPrint = d.print.toLowerCase() !== '#1d1d1d'
      this.tex.rehaut = T.createRehaut({ color: lightPrint ? '#f2f2f2' : '#2b2b2b', background: lightPrint ? d.rehaut : '#efe9dc' })
      this.materials.rehaut.map = this.tex.rehaut
      oldR.dispose()
    }
  }

  applyStrap(index) {
    this.strapIndex = index
    const s = this.config.straps[index]
    const leather = s.id !== 'bracelet'
    this.rig.bracelet.visible = !leather
    this.rig.strap.visible = leather
    if (leather) {
      this.materials.leather.color.set(s.color)
      this.materials.stitch.color.set(s.stitch)
    }
  }

  // ---------------------------------------------------- interactions

  setPointer(x, y) {
    // NDC
    this.pointer.set(x, y)
  }

  pick() {
    if (this.state.interactive < 0.5 || !this.rig) return null
    this.raycaster.setFromCamera(this.pointer, this.webgl.cameraRig.camera)
    const hits = this.raycaster.intersectObjects(this.rig.pickables, false)
    return hits.length ? hits[0].object.userData.part : null
  }

  select(id) {
    this.selected = id
    bus.emit(EVENTS.PART_SELECT, id)
  }

  dragBy(dx, dy) {
    if (this.state.interactive > 0.5) {
      this.drag.rowVelocity = dx * 0.012
      this.drag.rowPan = clamp(this.drag.rowPan + dx * 0.012, -3.4, 3.4)
    } else {
      this.drag.velocity = dx * 0.006
      this.drag.angle += dx * 0.006 * this.state.drag
      this.drag.tilt = clamp(this.drag.tilt + dy * 0.002 * this.state.drag, -0.35, 0.35)
    }
    this.rotor.velocity += dx * 0.0025
  }

  // --------------------------------------------------------- per frame

  applyRig(dt) {
    const s = this.state
    const rig = this.rig
    const e = s.explode
    const dis = s.disassembly
    PART_IDS.forEach((id, i) => {
      const part = rig.parts[id]
      const g = part.group
      const hov = this.hover.amount[id] || 0
      const sel = this.selected === id ? this.zoom : 0
      // staggered extraction: the outer parts (dial / rotor) leave the case
      // first, then tourbillon / bridge, then the core (mainplate / barrel)
      const pe = e <= 1 ? easeInOut(clamp((e - STAGGER[id] * STEP) / (1 - 2 * STEP))) : e
      const pc01 = Math.min(1, pe)
      g.position.set(-part.center.x * dis * pc01, -part.center.y * dis * pc01, part.explode * pe + s.rowPan + this.drag.rowPan * s.interactive)
      const sp = SPIN[id]
      g.rotation.set(s.spin * sp.x + hov * 0.12 + sel * 0.25, 0, s.spin * sp.z * TAU * 0.25)
      // hover lifts the part toward the viewer (local -X after the row rotation ≈ up on screen)
      g.position.y += hov * 0.12 * dis
      const sc = 1 + sel * 0.25
      g.scale.setScalar(sc)
      for (const pc of part.pieces) pc.obj.position.z = pc.base.z + pc.offsetZ * Math.min(pe, 1.2)
    })
  }

  update(dt, time, scrollVelocity = 0) {
    if (!this.rig || this.frozen) return
    this.time = time
    const s = this.state
    const rig = this.rig
    const cam = this.webgl.cameraRig
    const post = this.webgl.post.uniforms

    // ---- drag inertia & spring back
    if (!this.drag.active) {
      this.drag.angle += this.drag.velocity
      this.drag.velocity *= Math.exp(-dt * 3)
      this.drag.angle = damp(this.drag.angle, 0, 0.9, dt)
      this.drag.tilt = damp(this.drag.tilt, 0, 1.5, dt)
      this.drag.rowPan += this.drag.rowVelocity
      this.drag.rowVelocity *= Math.exp(-dt * 4)
      this.drag.rowPan = clamp(this.drag.rowPan, -3.4, 3.4)
    }
    if (s.interactive < 0.5) this.drag.rowPan = damp(this.drag.rowPan, 0, 3, dt)

    // ---- hover / selection
    const hovered = this.hoveredId
    PART_IDS.forEach((id) => {
      this.hover.amount[id] = damp(this.hover.amount[id], hovered === id && !this.selected ? 1 : 0, 8, dt)
    })
    this.zoom = damp(this.zoom, this.selected && s.interactive > 0.5 ? 1 : 0, 4, dt)
    if (s.interactive < 0.5 && this.selected) this.select(null)

    // ---- root transform (+ intro)
    const intro = this.intro
    rig.root.position.set(s.posX, s.posY, s.posZ)
    rig.root.rotation.set(s.rotX, s.rotY + (1 - intro) * -1.6, s.rotZ + (1 - intro) * 0.25)
    rig.root.scale.setScalar(s.scale)
    const swing = Math.sin(time * 0.45) * 0.55 * s.autoRotate
    rig.pivot.rotation.set(this.drag.tilt, this.drag.angle + swing, 0)
    this.applyRig(dt)

    // ---- visibility / dissolves
    // case & bracelet: smooth fade + slight outward drift (no hard cut)
    const caseD = clamp(s.caseDissolve)
    const caseFade = 1 - caseD * caseD * (3 - 2 * caseD)
    this.matGroups.case.forEach((m) => {
      m.fade = caseFade
      m.dissolve = 0
    })
    const caseScale = 1 + 0.09 * caseD
    rig.caseGroup.scale.setScalar(caseScale)
    rig.bracelet.scale.setScalar(caseScale)
    rig.strap.scale.setScalar(caseScale)
    rig.caseGroup.visible = caseD < 0.995
    rig.bracelet.visible = caseD < 0.995 && this.config.straps[this.strapIndex].id === 'bracelet'
    rig.strap.visible = caseD < 0.995 && this.config.straps[this.strapIndex].id !== 'bracelet'
    const movD = clamp(s.movementDissolve)
    const movFade = 1 - movD * movD * (3 - 2 * movD)
    this.matGroups.movement.forEach((m) => {
      m.fade = movFade
      m.dissolve = 0
    })
    rig.movement.visible = movD < 0.999
    // hand shadows only when assembled
    const shadowsOn = s.explode < 0.02 && caseD < 0.5
    Object.values(rig.animated.hands).forEach((h) => (h.shadow.visible = shadowsOn))
    rig.shadow.material.opacity = 0.42 * s.shadow
    rig.shadow.visible = s.shadow > 0.001

    // ---- mechanics
    this.animateMechanics(dt, time, scrollVelocity)

    // ---- environment
    this.scene.environmentRotation.set(0, s.envRot + cam.mouseLerped.x * 0.15, 0)
    const addRot = s.addRot + time * 0.03 + cam.mouseLerped.x * 0.4
    this.matGroups.all.forEach((m) => (m.additiveEnvMapRotation = addRot))
    GlobalUniforms.uDarknessProgress.value = s.darkness
    GlobalUniforms.uTime.value = time

    // ---- camera
    rig.root.updateMatrixWorld()
    cam.params.radius = s.camRadius
    cam.params.phi = s.camPhi
    cam.params.theta = s.camTheta
    cam.params.fov = s.camFov
    cam.params.roll = s.camRoll
    cam.params.parallax = s.parallax
    cam.radiusMul = 1 + (1 - intro) * 0.9
    this._tmp.set(s.lookX, s.lookY, s.lookZ)
    this._tmp2.copy(this._tmp).applyMatrix4(rig.root.matrixWorld)
    cam.lookAt.copy(this._tmp).lerp(this._tmp2, s.lookLocal)

    // ---- particles
    const pm = this.particlesMaterial.uniforms
    this.particles.visible = !this.quality.noParticles && s.particles > 0.001 && s.particlesOpacity > 0.001
    pm.uTime.value = time
    pm.uProgress.value = s.particles
    pm.uOpacity.value = s.particlesOpacity
    pm.uCloud.value = s.particlesCloud
    pm.uDark.value = s.darkness
    pm.uWatchMatrix.value.copy(rig.root.matrixWorld)
    pm.uPixelRatio.value = this.webgl.dpr
    pm.uViewportHeight.value = this.webgl.height

    // ---- backdrop (billboard behind the watch)
    this.backdrop.visible = s.backdrop > 0.001
    if (this.backdrop.visible) {
      const camera = cam.camera
      const dir = this._tmp.copy(rig.root.position).sub(camera.position).normalize()
      this.backdrop.position.copy(rig.root.position).addScaledVector(dir, 4.5)
      this.backdrop.quaternion.copy(camera.quaternion)
      this.backdrop.translateX(s.backdropX)
      this.backdrop.scale.setScalar(3.7 * s.backdropScale)
      const bu = this.backdropMaterial.uniforms
      bu.uOpacity.value = s.backdrop
      bu.uRotation.value = time * 0.02
      bu.uHand.value = (time * 0.35) % TAU
      bu.uDark.value = s.darkness
    }

    // ---- vertical wordmark sliding through the watch
    this.wordPlane.visible = s.vTextOpacity > 0.001
    if (this.wordPlane.visible) {
      const L = this.wordPlane.userData.length
      this.wordPlane.position.set(s.posX - 0.2, (s.vText - 0.5) * (L + 9), -1.4)
      this.wordMaterial.opacity = s.vTextOpacity
    }

    // ---- post
    post.uDarkness.value = s.darkness
    post.uBackgroundMultiplier.value = s.bg
    post.uOverlay.value = s.overlay
    post.uOverlayDark.value = s.overlayDark
    post.uLaser.value = s.laser
    post.uLaserX.value = s.laserX
    post.uLongpress.value = cam.longpress.intensity
    post.uMouse.value.copy(cam.mouseLerped)
    post.uFocus.value = this.zoom * s.interactive
    post.uZoomProgress.value = this.zoom
    if (this.selected) {
      const part = rig.parts[this.selected]
      part.group.getWorldPosition(this._tmp)
      this._tmp.project(cam.camera)
      post.uScreenX.value = this._tmp.x * 0.5 + 0.5
    }

    // ---- finale lineup
    this.lineup.update(dt, time)

    // ---- labels → DOM
    if (s.labels > 0.001 || this._labelsOn) {
      this.emitLabels()
      this._labelsOn = s.labels > 0.001
    }
  }

  animateMechanics(dt, time, scrollVelocity) {
    const a = this.rig.animated
    // real time (Date) with an 8 beats/s sweep on the seconds hand
    const now = new Date()
    let h, m, sec
    if (this.handsOverride) ({ h, m, s: sec } = this.handsOverride)
    else {
      const ms = now.getMilliseconds()
      sec = now.getSeconds() + Math.floor(ms / 125) * 0.125
      m = now.getMinutes() + sec / 60
      h = (now.getHours() % 12) + m / 60
    }
    const set = (hand, angle) => {
      hand.pivot.rotation.z = -angle
      const [ox, oy] = hand.shadow.userData.offset
      const c = Math.cos(angle)
      const sn = Math.sin(angle)
      // keep the shadow offset fixed in dial space while the hand turns
      hand.shadow.position.x = ox * c - oy * sn
      hand.shadow.position.y = ox * sn + oy * c
    }
    if (a.hands.hour) set(a.hands.hour, (h / 12) * TAU)
    if (a.hands.minute) set(a.hands.minute, (m / 60) * TAU)
    if (a.hands.second) set(a.hands.second, (sec / 60) * TAU)

    // tourbillon: cage = 1 rev/min, balance 4 Hz (shown at 2.5 Hz), escape ticks
    const cage = -((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * TAU
    a.tourbillon.cage.forEach((p) => (p.rotation.z = cage))
    const osc = Math.sin(time * TAU * 2.5)
    const tb = a.tourbillon
    if (tb.balanceMesh) tb.balanceMesh.rotation.z = osc * 2.2
    if (tb.hairspring?.children[0]) tb.hairspring.children[0].rotation.z = osc * 0.5
    if (tb.palletMesh) tb.palletMesh.rotation.z = Math.sign(osc) * 0.08
    if (tb.escapeWheel) tb.escapeWheel.rotation.z = -Math.floor(time * 5) * (TAU / 15) * 0.5

    a.train.forEach((w) => (w.obj.rotation.z = time * w.speed))
    a.barrel.forEach((b) => (b.rotation.z = -time * 0.01))
    if (a.powerHand) a.powerHand.rotation.z = -0.8 + 0.25 * Math.sin(time * 0.05)

    // moon phase from the real lunar age (synodic month)
    const age = ((now.getTime() / 86400000 - 10962.76) % 29.530588 + 29.530588) % 29.530588
    if (a.moon) a.moon.rotation.z = (age / 29.530588) * Math.PI

    // rotor: driven by scroll velocity + drag, damped pendulum toward 6 o'clock
    this.rotor.velocity += scrollVelocity * 0.0004 - Math.sin(this.rotor.angle) * dt * 0.6
    this.rotor.velocity *= Math.exp(-dt * 0.8)
    this.rotor.angle += this.rotor.velocity
    a.rotor.forEach((r) => (r.rotation.z = this.rotor.angle))
  }

  emitLabels() {
    const cam = this.webgl.cameraRig.camera
    const w = this.webgl.width
    const h = this.webgl.height
    PART_IDS.forEach((id, i) => {
      const part = this.rig.parts[id]
      const g = part.group
      // centre of the part in world space
      this._tmp.copy(part.center).setZ(0)
      g.localToWorld(this._tmp)
      const c = this._tmp.clone().project(cam)
      // top: centre + world up * radius
      this._tmp2.copy(this._tmp).add(new Vector3(0, 1.85 * this.rig.root.scale.x, 0)).project(cam)
      const L = this._labelData[i]
      L.x = (c.x * 0.5 + 0.5) * w
      L.y = (-c.y * 0.5 + 0.5) * h
      L.top = (-this._tmp2.y * 0.5 + 0.5) * h
      L.visible = c.z < 1
    })
    bus.emit(EVENTS.PARTS_SCREEN, this._labelData, this.state.labels)
  }

  /** Neutral, assembled pose → GLB (see GLBExport.js). */
  async exportGLB() {
    this.frozen = true
    const rig = this.rig
    try {
      rig.root.position.set(0, 0, 0)
      rig.root.rotation.set(0, 0, 0)
      rig.root.scale.setScalar(1)
      rig.pivot.rotation.set(0, 0, 0)
      Object.values(rig.parts).forEach((part) => {
        part.group.position.set(0, 0, 0)
        part.group.rotation.set(0, 0, 0)
        part.group.scale.setScalar(1)
        part.pieces.forEach((pc) => pc.obj.position.copy(pc.base))
      })
      rig.root.updateMatrixWorld(true)
      const { exportWatchGLB } = await import('./GLBExport.js')
      return await exportWatchGLB(rig)
    } finally {
      this.frozen = false
    }
  }

  playIntro() {
    gsap.to(this, { intro: 1, duration: this.quality.reduced ? 0.6 : 3.2, ease: 'brand.expoOut' })
  }
}
