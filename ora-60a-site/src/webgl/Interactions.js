import { get } from 'svelte/store'
import { activeSection, cursor, engine, finish, longpress } from '../state/store.js'

const INTERACTIVE = 'a, button, input, label, select, [data-interactive]'

/*
 * Pointer handling for the canvas layer: mouse parallax, drag (with
 * inertia, handled by the scene), long-press "hold to explore", click to
 * select a movement part. Listens on window because the HTML text layer
 * sits above the canvas with pointer-events: none.
 */
export default class Interactions {
  constructor({ scene, webgl, audio, quality }) {
    this.scene = scene
    this.webgl = webgl
    this.audio = audio
    this.quality = quality
    this.down = null
    this.dragging = false
    this.holding = false
    this.holdTimer = 0
    this.lastAngle = 0
    this.moved = 0

    window.addEventListener('pointermove', this.onMove, { passive: true })
    window.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onCancel)
    window.addEventListener('blur', this.onCancel)
  }

  isUI(target) {
    return target && target.closest && target.closest(INTERACTIVE)
  }

  onMove = (e) => {
    const w = window.innerWidth
    const h = window.innerHeight
    const nx = (e.clientX / w) * 2 - 1
    const ny = -(e.clientY / h) * 2 + 1
    if (e.pointerType === 'mouse') this.webgl.cameraRig.mouse.set(nx, ny)
    this.scene.setPointer(nx, ny)
    if (!this.down) return
    const dx = e.clientX - this.down.x
    const dy = e.clientY - this.down.y
    this.moved = Math.max(this.moved, Math.hypot(dx, dy))
    if (!this.dragging && this.moved > 6) {
      // touch: only claim horizontal gestures, vertical ones scroll the page
      if (e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) return
      this.dragging = true
      this.cancelHold()
      this.scene.drag.active = true
    }
    if (this.dragging) {
      const mx = e.clientX - this.down.lx
      const my = e.clientY - this.down.ly
      this.scene.dragBy(mx, my)
      this.down.lx = e.clientX
      this.down.ly = e.clientY
      this.tickSound()
    }
  }

  onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    if (this.isUI(e.target)) return
    this.down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), type: e.pointerType }
    this.scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    this.moved = 0
    this.dragging = false
    clearTimeout(this.holdTimer)
    if (this.scene.state.interactive < 0.5) {
      this.holdTimer = setTimeout(() => this.startHold(), e.pointerType === 'mouse' ? 220 : 380)
    }
  }

  onUp = (e) => {
    if (!this.down) return
    const wasDrag = this.dragging
    const wasHold = this.holding
    this.cancelHold()
    this.scene.drag.active = false
    this.dragging = false
    if (!wasDrag && !wasHold && this.moved < 6 && !this.isUI(e.target)) this.click()
    this.down = null
  }

  onCancel = () => {
    this.cancelHold()
    this.scene.drag.active = false
    this.dragging = false
    this.down = null
  }

  startHold() {
    if (!this.down || this.dragging) return
    this.holding = true
    this.webgl.cameraRig.longpress.target = 1
    longpress.set(1)
    this.audio?.hold(true)
  }

  cancelHold() {
    clearTimeout(this.holdTimer)
    if (this.holding) this.audio?.hold(false)
    this.holding = false
    this.webgl.cameraRig.longpress.target = 0
    longpress.set(0)
  }

  click() {
    const lineup = this.scene.lineup
    const picked = lineup?.group.visible ? (lineup.hovered ?? lineup.pick(this.scene.pointer)) : null
    if (picked !== null && picked !== undefined) {
      const i = picked
      lineup.select(i)
      finish.set(i)
      this.audio?.click(1)
      return
    }
    const id = this.scene.pick()
    if (this.scene.state.interactive > 0.5) this.scene.select(id && id !== this.scene.selected ? id : null)
    else engine.onCanvasClick?.(get(activeSection))
  }

  /** Called every frame: hover picking in the interactive section. */
  update() {
    const s = this.scene
    // finale: which watch of the lineup is under the cursor
    if (s.lineup?.group.visible && !this.dragging) {
      const i = this.quality.mobile ? null : s.lineup.pick(s.pointer)
      if (i !== s.lineup.hovered) {
        s.lineup.hovered = i
        cursor.update((c) => ({ ...c, pick: i }))
      }
    } else if (s.lineup && s.lineup.hovered !== null) {
      s.lineup.hovered = null
      cursor.update((c) => ({ ...c, pick: null }))
    }
    if (s.state.interactive > 0.5 && !this.dragging && !this.quality.mobile) {
      const id = s.pick()
      if (id !== s.hoveredId) {
        s.hoveredId = id
        cursor.update((c) => ({ ...c, hover: !!id }))
      }
    } else if (s.hoveredId) {
      s.hoveredId = null
      cursor.update((c) => ({ ...c, hover: false }))
    }
  }

  tickSound() {
    if (!this.audio) return
    const a = this.scene.drag.angle + this.scene.drag.rowPan
    if (Math.abs(a - this.lastAngle) > 0.14) {
      this.lastAngle = a
      this.audio.click()
    }
  }
}
