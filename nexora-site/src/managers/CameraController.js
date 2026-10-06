import * as THREE from 'three';
import { CAMERA } from '../config.js';
import { clamp, damp, easeInOut, prefersReducedMotion, smoothstep } from '../core/math.js';

/**
 * Em telas estreitas (retrato) abre o FOV vertical para que o enquadramento
 * horizontal pensado para 16:10 continue cabendo (com limite para não distorcer).
 */
export function fitFov(fov, aspect, ref = 1.5) {
  if (aspect >= ref) return fov;
  const k = Math.min(2.0, Math.pow(ref / aspect, 0.8));
  const half = THREE.MathUtils.degToRad(fov / 2);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * k));
}

/**
 * Caminho de câmera por keyframes.
 * keys: [{ t, pos:[x,y,z], target:[x,y,z], fov?, roll?, ease? }]
 * Posições e alvos usam spline Catmull-Rom (movimento contínuo, sem quinas);
 * o tempo entre keyframes recebe easing power2.inOut por padrão.
 */
export class CameraPath {
  constructor(keys) {
    this.keys = keys;
    this.posCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
    this.tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.target)), false, 'centripetal');
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  // Converte t global em parâmetro u da spline (keyframes igualmente espaçados na curva)
  sample(t) {
    const k = this.keys;
    t = clamp(t);
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1].t) i++;
    const a = k[i];
    const b = k[i + 1];
    let f = clamp((t - a.t) / Math.max(1e-6, b.t - a.t));
    f = (b.ease ?? easeInOut)(f);
    const u = (i + f) / (k.length - 1);
    this.posCurve.getPoint(u, this._p);
    this.tgtCurve.getPoint(u, this._t);
    const fov = (a.fov ?? 45) + ((b.fov ?? 45) - (a.fov ?? 45)) * f;
    const roll = (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * f;
    return { pos: this._p, target: this._t, fov, roll };
  }

  apply(camera, t) {
    const s = this.sample(t);
    camera.position.copy(s.pos);
    camera.lookAt(s.target);
    if (s.roll) camera.rotateZ(s.roll);
    const fov = fitFov(s.fov, camera.aspect);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    return s;
  }
}

/**
 * Efeitos globais de câmera: parallax e "mouse look" por faixa de progresso.
 * As cenas chamam `applyLook(camera, global)` depois de posicionar a câmera.
 */
export class CameraController {
  constructor(mouse) {
    this.mouse = mouse;
    this.reduced = prefersReducedMotion();
    this.look = { x: 0, y: 0 };
    this.parallax = { x: 0, y: 0 };
  }

  update(dt) {
    const m = this.mouse;
    const k = damp(CAMERA.mouseLookA.smoothing, dt);
    this.look.x += (m.x - this.look.x) * k;
    this.look.y += (m.y - this.look.y) * k;
    const kp = damp(0.04, dt);
    this.parallax.x += (m.x - this.parallax.x) * kp;
    this.parallax.y += (m.y - this.parallax.y) * kp;
  }

  // Intensidade de um mouse look (com fade nas bordas da faixa)
  weight(cfg, p) {
    const [a, b] = cfg.range;
    return smoothstep(a, a + 0.01, p) * (1 - smoothstep(b - 0.01, b, p));
  }

  applyLook(camera, p) {
    if (this.reduced) return;
    for (const cfg of [CAMERA.mouseLookA, CAMERA.mouseLookB]) {
      const w = this.weight(cfg, p);
      if (w <= 0) continue;
      camera.rotateY(-this.look.x * THREE.MathUtils.degToRad(cfg.yaw) * w);
      camera.rotateX(this.look.y * THREE.MathUtils.degToRad(cfg.pitch) * w);
    }
  }

  // Desloca a câmera no plano da tela (parallax leve)
  applyParallax(camera, strength = 1) {
    if (this.reduced) return;
    const s = strength * CAMERA.parallaxOrbit;
    camera.translateX(this.parallax.x * s);
    camera.translateY(this.parallax.y * s * 0.6);
  }
}
