import gsap from 'gsap'
import { Group, Mesh, PlaneGeometry, Raycaster, ShaderMaterial, Sphere, Vector3 } from 'three'
import { createWordTexture } from '../textures/ProceduralTextures.js'
import { clamp, damp } from '../utils/math.js'
import { applyParams } from './WatchMaterials.js'
import bus from '../../state/bus.js'

const TAU = Math.PI * 2
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

// parts hidden behind the dial from the front: not cloned
const DROP = ['strap-assembly', 'barrel', 'backplate', 'weight']
// objects animated on the main watch, mirrored on every twin
const ANIMATED = [
  'hand-hours-pivot',
  'hand-minutes-pivot',
  'hand-seconds-pivot',
  'hand-hours-shadow',
  'hand-minutes-shadow',
  'hand-seconds-shadow',
  'hand-power',
  'moon-bg',
  'tourbillon-xploded-2',
  'tourbillon-xploded-3',
  'tourbillon-xploded-4',
  'tourbillon-xploded-5',
  'tourbillon-xploded-6',
  'tourbillon-xploded-7',
  'tourbillon-balance',
  'tourbillon-hairspring',
  'tourbillon-escape',
  'tourbillon-pallet',
  'center-wheel',
  'third-wheel',
  'fourth-wheel',
]

/*
 * Finale: the four finishes side by side, each watch turning toward the
 * cursor with its own delay, the model name huge in the background (drawn
 * in WebGL so it sits *behind* the watches). Hover lifts a watch, click
 * picks the finish for the whole site.
 */
export default class Lineup {
  constructor({ watchScene }) {
    this.ws = watchScene
    const { rig, materials: m, config } = watchScene
    this.group = new Group()
    this.group.name = 'lineup'
    this.group.visible = false
    this.items = []
    this.hovered = null
    this.raycaster = new Raycaster()
    this._v = new Vector3()
    this._sphere = new Sphere()
    this.screen = config.finishes.map(() => ({ x: 0, y: 0, hovered: false }))

    config.finishes.forEach((finish, i) => {
      // per-finish copies of the finish-driven materials, everything else shared
      const map = new Map()
      const twin = (src, params) => {
        const c = src.clone()
        applyParams(c, params)
        map.set(src, c)
      }
      twin(m.glossy, finish.glossy)
      twin(m.glossyDial, finish.glossy)
      twin(m.brushed, finish.brushed)
      twin(m.brushedLinks, finish.brushed)
      twin(m.crownLogo, { ...finish.glossy, color: i >= 2 ? finish.glossy.color : '#f1cf8f' })

      const pivot = rig.pivot.clone(true)
      DROP.forEach((name) => pivot.getObjectByName(name)?.removeFromParent())
      pivot.position.set(0, 0, 0)
      pivot.rotation.set(0, 0, 0)
      pivot.traverse((o) => {
        if (!o.isMesh) return
        o.material = Array.isArray(o.material) ? o.material.map((mt) => map.get(mt) || mt) : map.get(o.material) || o.material
        delete o.userData.part
      })
      const pairs = ANIMATED.map((name) => [pivot.getObjectByName(name), rig.pivot.getObjectByName(name)]).filter(([a, b]) => a && b)

      const item = new Group() // rotation (cursor follow, spin)
      item.add(pivot)
      const holder = new Group() // layout position
      holder.add(item)
      this.group.add(holder)
      this.items.push({ holder, item, pairs, yaw: -0.55, pitch: 0.08, lift: 0, scale: 1, spin: { value: 0 }, lag: [5.2, 4.3, 3.5, 2.8][i] ?? 3 })
    })

    // the model name, behind the watches, revealed from the bottom
    const tex = createWordTexture(watchScene.config.wordmark || 'ORA 60A', { font: 'Unbounded', weight: 300, color: '#121212', height: 512, tracking: -0.015 })
    this.textAspect = tex.userData.aspect
    this.textMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: tex }, uReveal: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float uReveal;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          float edge = uReveal * 1.3 - 0.15 + sin(vUv.x * 9.0 + uTime * 0.6) * 0.03;
          float m = 1.0 - smoothstep(edge - 0.08, edge, vUv.y);
          gl_FragColor = vec4(t.rgb, t.a * m * smoothstep(0.0, 0.25, uReveal));
        }`,
    })
    this.text = new Mesh(new PlaneGeometry(1, 1), this.textMaterial)
    this.text.name = 'lineup-wordmark'
    this.text.renderOrder = -1
    this.group.add(this.text)
  }

  layout(aspect) {
    const portrait = aspect < 0.8
    const n = this.items.length
    if (portrait) {
      return this.items.map((_, i) => ({ x: (i % 2 ? 1 : -1) * 1.55, y: i < 2 ? 1.9 : -2.3, s: 0.46 }))
    }
    const spread = clamp(aspect / 1.6, 0.75, 1.2)
    return this.items.map((_, i) => ({ x: (i - (n - 1) / 2) * 3.25 * spread, y: -0.35, s: 0.6 * clamp(spread, 0.85, 1.05) }))
  }

  update(dt, time) {
    const s = this.ws.state
    const show = s.lineup > 0.001
    this.group.visible = show
    if (!show) {
      if (this.hovered !== null) this.hovered = null
      return
    }
    const camRig = this.ws.webgl.cameraRig
    const camera = camRig.camera
    const mouse = camRig.mouse
    const slots = this.layout(camera.aspect)
    const w = this.ws.webgl.width
    const h = this.ws.webgl.height

    this.items.forEach((it, i) => {
      const slot = slots[i]
      // staggered rise from below with a turn
      const pe = easeOut(clamp((s.lineup - i * 0.1) / 0.7))
      it.holder.position.set(slot.x, slot.y - (1 - pe) * 9 + Math.sin(time * 0.8 + i * 1.7) * 0.06, 0)
      // follow the cursor: yaw toward the pointer relative to the watch on screen
      this._v.copy(it.holder.position).project(camera)
      const sx = this._v.x
      const sy = this._v.y
      const targetYaw = -0.5 + clamp((mouse.x - sx) * 0.75, -0.95, 0.95)
      const targetPitch = 0.08 + clamp(-(mouse.y - sy) * 0.45, -0.5, 0.5)
      it.yaw = damp(it.yaw, targetYaw, it.lag, dt)
      it.pitch = damp(it.pitch, targetPitch, it.lag, dt)
      const hov = this.hovered === i
      it.lift = damp(it.lift, hov ? 1 : 0, 6, dt)
      it.item.rotation.set(it.pitch, it.yaw + (1 - pe) * -2.4 + it.spin.value, 0)
      it.item.position.z = it.lift * 0.7
      it.item.scale.setScalar(slot.s * (1 + it.lift * 0.06))
      // mirror the live mechanics (hands, tourbillon, moon…)
      for (const [dst, src] of it.pairs) {
        dst.rotation.copy(src.rotation)
        dst.position.copy(src.position)
      }
      const sc = this.screen[i]
      sc.x = (sx * 0.5 + 0.5) * w
      sc.y = (-this._v.copy(it.holder.position).setY(it.holder.position.y - 3.4 * slot.s).project(camera).y * 0.5 + 0.5) * h
      sc.hovered = hov
      sc.visible = pe > 0.6
    })

    // the wordmark fills the screen width behind the watches, slight parallax
    const depth = 4.5
    const dist = camera.position.distanceTo(this._v.set(0, 0, -depth))
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
    const visW = visH * camera.aspect
    const tw = visW * (camera.aspect < 0.8 ? 1.15 : 0.98)
    this.text.scale.set(tw, tw / this.textAspect, 1)
    this.text.position.set(-mouse.x * 0.35, (camera.aspect < 0.8 ? 5.6 : 0.35) - mouse.y * 0.15, -depth)
    this.textMaterial.uniforms.uReveal.value = s.lineupText
    this.textMaterial.uniforms.uTime.value = time

    bus.emit('LINEUP_SCREEN', this.screen, s.lineup)
  }

  /** Pointer (NDC) → index of the watch under it, or null. */
  pick(pointer) {
    if (!this.group.visible || this.ws.state.lineup < 0.8) return null
    this.raycaster.setFromCamera(pointer, this.ws.webgl.cameraRig.camera)
    const ray = this.raycaster.ray
    let best = null
    let bestD = Infinity
    this.items.forEach((it, i) => {
      it.holder.getWorldPosition(this._v)
      const r = 2.6 * it.item.scale.x
      this._sphere.set(this._v, r)
      if (!ray.intersectsSphere(this._sphere)) return
      const d = ray.distanceToPoint(this._v)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }

  select(i) {
    const it = this.items[i]
    if (!it) return
    gsap.to(it.spin, { value: it.spin.value + TAU, duration: 1.8, ease: 'brand.expoOut' })
  }
}
