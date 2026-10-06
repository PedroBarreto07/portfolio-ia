import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { noise } from '../shaders/noise.js';
import { particleMaterial, randomPointsGeometry } from './helpers.js';
import { CARD_W, cardTextTexture, createCard } from './card.js';
import { CARDS } from '../config.js';
import { bus } from '../core/EventBus.js';
import { damp, easeInOut, range, rng, smoothstep } from '../core/math.js';
import { CARD_CAM_Z } from './QuantumScene.js';
import { fitFov } from '../managers/CameraController.js';

/*
 * Cena 4 (0.62–0.71) — carrossel horizontal de 4 cards de vidro.
 * Também é renderizada em textura para a tela central do carro (cena 5).
 */

const GAP = CARD_W + 0.7;

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const bgFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uRipple; uniform float uAspect;
  varying vec2 vUv;
  ${noise}
  void main(){
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float n = fbm(vec3(p * 1.3, uTime * 0.04));
    float n2 = fbm(vec3(p * 3.2 + n, uTime * 0.06 + 7.0));
    vec3 deep = vec3(0.05,0.018,0.006);
    vec3 warm = vec3(0.55,0.22,0.05);
    vec3 hot = vec3(1.0,0.62,0.28);
    vec3 col = mix(deep, warm, smoothstep(-0.3, 0.6, n) * smoothstep(1.2, 0.1, length(p - vec2(0.2, 0.1))));
    col += hot * pow(smoothstep(0.2, 0.9, n2), 3.0) * 0.6;
    // ripple do clique
    float age = uTime - uRipple.z;
    if (age > 0.0 && age < 3.0) {
      float d = length(p - uRipple.xy);
      float ring = smoothstep(0.05, 0.0, abs(d - age * 0.45)) * (1.0 - age / 3.0);
      col += hot * ring * 1.6;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

const ribbonVert = /* glsl */ `
  uniform float uTime; uniform float uSeed;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.35 + uSeed * 10.0;
    p.y += sin(p.x * 0.25 + t) * 1.6 + sin(p.x * 0.55 - t * 1.3) * 0.5;
    p.z += cos(p.x * 0.2 + t * 0.7) * 2.0;
    // torção da fita
    float tw = sin(p.x * 0.3 + t) * 0.8;
    p.y += (uv.y - 0.5) * cos(tw) * 0.6;
    p.z += (uv.y - 0.5) * sin(tw) * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const ribbonFrag = /* glsl */ `
  uniform float uOpacity; varying vec2 vUv;
  void main(){
    float edge = pow(max(1.0 - abs(vUv.y - 0.5) * 2.0, 0.0), 2.0);
    float along = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    float a = edge * along * uOpacity;
    vec3 col = mix(vec3(1.0,0.55,0.15), vec3(1.4,1.1,0.7), edge);
    gl_FragColor = vec4(col * a, a);
  }`;

export class CardsScene extends BaseScene {
  async build() {
    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(77);
    s.environment = ctx.envMap;
    s.environmentIntensity = 0.6;
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();

    this.bgMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRipple: { value: new THREE.Vector3(0, 0, -10) },
        uAspect: { value: 1.6 },
      },
      vertexShader: vert,
      fragmentShader: bgFrag,
    });
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(64, 40), this.bgMat);
    this.bg.position.z = -12;
    s.add(this.bg);

    // fitas de luz
    this.ribbons = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uSeed: { value: rand() }, uOpacity: { value: 0.35 + rand() * 0.4 } },
        vertexShader: ribbonVert,
        fragmentShader: ribbonFrag,
      });
      const r = new THREE.Mesh(new THREE.PlaneGeometry(46, 0.5 + rand() * 0.6, 240, 1), m);
      r.position.set(GAP * 1.5, -2.5 + rand() * 5, -4 - rand() * 5);
      r.rotation.z = (rand() - 0.5) * 0.3;
      r.frustumCulled = false;
      this.ribbons.push(r);
      s.add(r);
    }

    const pg = randomPointsGeometry(900, (v) => v.set(-6 + rand() * (GAP * 3 + 12), (rand() - 0.5) * 9, -1 - rand() * 9), rand);
    this.partMat = particleMaterial({ size: 1.6, twinkle: 0.6, color: new THREE.Color(1.3, 0.8, 0.4), opacity: 0.9 });
    s.add(new THREE.Points(pg, this.partMat));

    // luzes
    s.add(new THREE.AmbientLight(0x442211, 0.8));
    const key = new THREE.DirectionalLight(0xffd2a0, 1.5);
    key.position.set(3, 4, 6);
    const rim = new THREE.PointLight(0xff9040, 7, 20, 2);
    rim.position.set(GAP * 1.5, 0, -3);
    s.add(key, rim);

    // cards
    this.cards = CARDS.map((_, i) => {
      const c = createCard(i, ctx.envMap);
      c.group.position.x = i * GAP;
      c.tilt = { x: 0, y: 0 };
      c.hover = 0;
      s.add(c.group);
      return c;
    });
    bus.on('lang', () =>
      this.cards.forEach((c) => {
        c.textMat.map.dispose();
        c.textMat.map = cardTextTexture(CARDS[c.index], c.index);
      })
    );

    this.ray = new THREE.Raycaster();
    this.hovered = null;
    this.time = 0;
    window.addEventListener('pointerdown', (e) => this.onClick(e));
  }

  onClick(e) {
    if (!this.active || e.target.closest('button, a')) return;
    // posição do clique projetada no plano de fundo (espaço "p" do shader = mundo / 40)
    const cam = this.camera;
    const dist = cam.position.z - this.bg.position.z;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const wx = (e.clientX / innerWidth - 0.5) * visH * cam.aspect + (cam.position.x - this.bg.position.x);
    const wy = -(e.clientY / innerHeight - 0.5) * visH;
    this.bgMat.uniforms.uRipple.value.set(wx / 40, wy / 40, this.time);
  }

  // estado do carrossel para um progresso local
  layout(l) {
    // foco: 0 → 3 com pausas em cada card
    const f = easeInOut(range(l, 0.04, 0.82)) * 3;
    const out = easeInOut(range(l, 0.82, 1)); // recua para mostrar os 4 cards
    const cx = f * GAP * (1 - out) + GAP * 1.5 * out;
    const z = CARD_CAM_Z + out * 9.5;
    return { cx, z, out };
  }

  update(l, dt, time) {
    this.time = time;
    const cam = this.camera;
    const { cx, z, out } = this.layout(l);
    const fov = fitFov(42, cam.aspect);
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.position.set(cx, 0, z);
    cam.lookAt(cx, 0, 0);
    if (!this.renderingToTexture) this.ctx.cameraFX.applyParallax(cam, 0.35 * (1 - out));

    this.bgMat.uniforms.uTime.value = time;
    this.bg.position.x = cx * 0.85;
    this.ribbons.forEach((r) => (r.material.uniforms.uTime.value = time));
    this.partMat.uniforms.uTime.value = time;

    // hover (somente na tela principal)
    let hovered = null;
    if (!this.renderingToTexture && this.ctx.mouse.moved) {
      this.ray.setFromCamera({ x: this.ctx.mouse.x, y: this.ctx.mouse.y }, cam);
      const hit = this.ray.intersectObjects(this.cards.map((c) => c.body), false)[0];
      hovered = hit ? this.cards.find((c) => c.body === hit.object) : null;
    }
    const k = damp(0.1, dt);
    this.cards.forEach((c, i) => {
      const isH = c === hovered;
      c.hover += ((isH ? 1 : 0) - c.hover) * k;
      const tx = isH ? -this.ctx.mouse.y * 0.25 : 0;
      const ty = isH ? (this.ctx.mouse.x - (i * GAP - cx) / 6) * 0.3 : 0;
      c.tilt.x += (tx - c.tilt.x) * k;
      c.tilt.y += (ty - c.tilt.y) * k;
      // cards fora de foco giram levemente (sensação de carrossel)
      const rel = (i * GAP - cx) / GAP;
      c.group.rotation.set(c.tilt.x, c.tilt.y - rel * 0.18 * (1 - out), 0);
      c.group.position.z = -Math.abs(rel) * 0.4 * (1 - out) + c.hover * 0.15;
      c.edgeMat.opacity = 0.45 + c.hover * 0.5;
      c.textMat.color.setScalar(0.78 + c.hover * 0.07);
      c.obj.userData.tick(time + i * 3);
      // card #0 entra a partir do card vazio da cena quântica
      const reveal = i === 0 ? smoothstep(0.0, 0.05, l) : 1;
      c.textMat.opacity = reveal;
      c.obj.scale.setScalar(Math.max(0.001, reveal));
    });
    document.body.classList.toggle('cards-hover', !!hovered);
    this.bloomBoost = 1 + (hovered ? 0.15 : 0);
  }

  // Renderiza a cena em uma textura (tela do carro) com proporção própria
  renderTo(renderer, rt, l, dt, time) {
    const aspect = this.camera.aspect;
    this.renderingToTexture = true;
    this.camera.aspect = rt.width / rt.height;
    this.camera.updateProjectionMatrix();
    this.update(l, dt, time);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderingToTexture = false;
  }

  leave() {
    document.body.classList.remove('cards-hover');
  }
}
