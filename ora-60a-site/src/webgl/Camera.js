import { PerspectiveCamera, Vector2, Vector3 } from 'three'
import { damp } from './utils/math.js'

/*
 * Orbital camera in spherical coordinates around a look-at target.
 * radius / phi / theta / lookAt / fov come from the scroll choreography;
 * on top: mouse parallax (lerped), long-press zoom ("hold to explore")
 * which also amplifies the parallax.
 *
 * pos = lookAt + radius·radiusMul·(sin(φ+animφ)cos(θ+animθ), cos(φ+animφ), sin(φ+animφ)sin(θ+animθ))
 */
export default class Camera {
  constructor() {
    this.camera = new PerspectiveCamera(30, 1, 0.1, 250)
    this.params = { radius: 13, phi: Math.PI / 2, theta: Math.PI / 2, fov: 30, parallax: 1, roll: 0 }
    this.lookAt = new Vector3()
    this.lookAtLerped = new Vector3()
    this.mouse = new Vector2()
    this.mouseLerped = new Vector2()
    this.longpress = { target: 0, intensity: 0 }
    this.radiusMul = 1
    this.longpressZoomMul = 0.16
    this.parallaxPhi = 0.05
    this.parallaxTheta = 0.08
    this._fov = 0
    this._first = true
  }

  setAspect(aspect) {
    this.camera.aspect = aspect
    // keep the product framed on portrait screens: widen the vertical FOV
    this.portraitBoost = aspect < 1 ? Math.min(1.75, 1 / aspect) * 0.62 + 0.38 : 1
    this.camera.updateProjectionMatrix()
  }

  update(dt) {
    this.mouseLerped.x = damp(this.mouseLerped.x, this.mouse.x, 3, dt)
    this.mouseLerped.y = damp(this.mouseLerped.y, this.mouse.y, 3, dt)
    this.longpress.intensity = damp(this.longpress.intensity, this.longpress.target, this.longpress.target ? 2.2 : 3.5, dt)

    if (this._first) {
      this.lookAtLerped.copy(this.lookAt)
      this._first = false
    } else {
      this.lookAtLerped.x = damp(this.lookAtLerped.x, this.lookAt.x, 10, dt)
      this.lookAtLerped.y = damp(this.lookAtLerped.y, this.lookAt.y, 10, dt)
      this.lookAtLerped.z = damp(this.lookAtLerped.z, this.lookAt.z, 10, dt)
    }

    const lp = this.longpress.intensity
    const par = this.params.parallax * (1 + lp * 1.5)
    const animPhi = this.mouseLerped.y * this.parallaxPhi * par
    const animTheta = -this.mouseLerped.x * this.parallaxTheta * par
    const radius = this.params.radius * this.radiusMul * (1 - this.longpressZoomMul * lp) * (this.portraitBoost || 1)
    const phi = this.params.phi + animPhi
    const theta = this.params.theta + animTheta

    const c = this.camera
    c.position.set(
      this.lookAtLerped.x + radius * Math.sin(phi) * Math.cos(theta),
      this.lookAtLerped.y + radius * Math.cos(phi),
      this.lookAtLerped.z + radius * Math.sin(phi) * Math.sin(theta),
    )
    c.up.set(Math.sin(this.params.roll), Math.cos(this.params.roll), 0)
    c.lookAt(this.lookAtLerped)

    if (Math.abs(this._fov - this.params.fov) > 0.001) {
      this._fov = this.params.fov
      c.fov = this.params.fov
      c.updateProjectionMatrix()
    }
  }
}
