import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { CameraPath } from '../managers/CameraController.js';
import { noise } from '../shaders/noise.js';
import { canvasTexture, glowSprite, particleMaterial, randomPointsGeometry } from './helpers.js';
import { createChip } from './chip.js';
import { createCardShell } from './card.js';
import { easeInOut, range, rng, smoothstep } from '../core/math.js';
import { CHIP_CAM_OFFSET } from './DataCenterScene.js';

/*
 * Cena 3 (0.54–0.62) — local:
 *   0.00–0.25  chip dourado (fresnel), onda de cubos
 *   0.19–0.50  chip encolhe e vira o card #0 (morph)
 *   0.31–0.69  véu de matriz explode
 *   0.45–1.00  campo de energia + nebulosa, card centralizado (= início da cena 4)
 */

const CHIP_ROT_X = 0.6; // mesma orientação final do data center
export const CARD_CAM_Z = 6.2; // distância câmera→card no início da cena 4

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Onda de cubos instanciados
const cubeVert = /* glsl */ `
  uniform float uTime; uniform float uWave; attribute vec3 aOffset; attribute float aSeed;
  varying float vH; varying vec3 vN; varying float vSeed;
  void main(){
    float d = length(aOffset.xz);
    float front = uWave * 26.0;
    float k = smoothstep(4.0, 0.0, abs(d - front));
    float h = k * (1.2 + aSeed * 1.8) + sin(uTime * 2.0 + aSeed * 20.0 + d) * 0.05;
    vec3 p = position;
    p.y *= 1.0 + h * 6.0;
    p.y += h * 0.6;
    vH = k; vSeed = aSeed;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aOffset, 1.0);
  }`;
const cubeFrag = /* glsl */ `
  uniform float uOpacity; varying float vH; varying vec3 vN; varying float vSeed;
  void main(){
    float l = 0.25 + max(dot(vN, normalize(vec3(0.3,1.0,0.5))), 0.0) * 0.75;
    vec3 base = vec3(0.04,0.03,0.025) * l;
    vec3 hot = vec3(1.0,0.6,0.25) * (1.5 + vSeed * 2.0);
    vec3 col = mix(base, hot, vH * vH);
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }`;

// Véu de matriz: grade de caracteres que explode a partir do centro
const matrixVert = /* glsl */ `
  uniform float uExplode; attribute vec2 aCell; attribute float aSeed; attribute float aChar;
  varying vec2 vUv; varying float vSeed; varying float vChar; varying float vFade;
  void main(){
    vUv = uv; vSeed = aSeed; vChar = aChar;
    vec3 p = position;
    vec2 dir = normalize(aCell + 0.0001);
    float dist = length(aCell);
    float e = max(0.0, uExplode * 1.6 - dist * 0.04);
    p.xy += dir * e * e * (6.0 + aSeed * 10.0);
    p.z += e * e * (4.0 + aSeed * 8.0);
    vFade = 1.0 - smoothstep(0.4, 1.0, e);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + vec3(aCell * 0.22, 0.0), 1.0);
  }`;
const matrixFrag = /* glsl */ `
  uniform sampler2D uGlyphs; uniform float uTime; uniform float uOpacity;
  varying vec2 vUv; varying float vSeed; varying float vChar; varying float vFade;
  void main(){
    float idx = mod(floor(vChar + uTime * (2.0 + vSeed * 8.0)), 16.0);
    vec2 uv = vec2((mod(idx, 4.0) + vUv.x) / 4.0, (floor(idx / 4.0) + vUv.y) / 4.0);
    float g = texture2D(uGlyphs, uv).r;
    vec3 col = mix(vec3(1.0,0.75,0.4), vec3(1.4,1.2,1.0), step(0.93, vSeed));
    float a = g * uOpacity * vFade * (0.35 + vSeed * 0.65);
    gl_FragColor = vec4(col * a * 1.6, a);
  }`;

// Nebulosa / campo de energia (fundo)
const nebulaFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; varying vec2 vUv;
  ${noise}
  void main(){
    vec2 p = (vUv - 0.5) * vec2(2.0, 1.2);
    float r = length(p);
    float n = fbm(vec3(p * 1.6, uTime * 0.05));
    float n2 = fbm(vec3(p * 4.0 + n, uTime * 0.08 + 3.0));
    float swirl = sin(atan(p.y, p.x) * 3.0 + r * 6.0 - uTime * 0.6 + n * 4.0) * 0.5 + 0.5;
    vec3 col = vec3(0.6,0.25,0.06) * smoothstep(1.1, 0.0, r) * (0.6 + n);
    col += vec3(1.0,0.65,0.3) * pow(clamp(swirl, 0.0, 1.0), 6.0) * smoothstep(0.9, 0.15, r) * (0.4 + n2) * 0.8;
    col += vec3(0.25,0.12,0.35) * smoothstep(0.2, 0.8, n2) * 0.4;
    gl_FragColor = vec4(max(col, 0.0) * uOpacity * 0.55, 1.0);
  }`;

function glyphAtlas() {
  const chars = '01ABCDEF<>/#%+*X';
  return canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#fff';
      g.font = '500 44px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < 16; i++) g.fillText(chars[i], (i % 4) * 64 + 32, 256 - (Math.floor(i / 4) * 64 + 32));
    },
    { srgb: false }
  );
}

export class QuantumScene extends BaseScene {
  async build() {
    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(57);
    s.environment = ctx.envMap;
    s.environmentIntensity = 0.5;

    // fundo
    this.nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: vert,
      fragmentShader: nebulaFrag,
      depthWrite: false,
    });
    this.nebula = new THREE.Mesh(new THREE.PlaneGeometry(60, 36), this.nebMat);
    this.nebula.position.z = -14;
    s.add(this.nebula);

    // luzes
    s.add(new THREE.AmbientLight(0x332211, 0.6));
    const key = new THREE.PointLight(0xffb060, 18, 12, 2);
    key.position.set(1.5, 2, 2.5);
    const rim = new THREE.PointLight(0xff8040, 14, 12, 2);
    rim.position.set(-2, -1, -1.5);
    s.add(key, rim);

    // chip
    this.chip = createChip(ctx.assets);
    s.add(this.chip.group);
    this.chipGlow = glowSprite(new THREE.Color(1.2, 0.75, 0.35), 4.0, 0.35);
    this.chipGlow.position.z = -0.3;
    s.add(this.chipGlow);

    // card de vidro (alvo do morph)
    this.card = createCardShell(ctx.envMap);
    this.card.group.visible = false;
    s.add(this.card.group);

    // onda de cubos
    const N = 44;
    const cubeGeo = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(0.18, 0.18, 0.18));
    const offs = [];
    const seeds = [];
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) {
        offs.push((x - N / 2) * 0.24, 0, (z - N / 2) * 0.24);
        seeds.push(rand());
      }
    cubeGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
    cubeGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
    cubeGeo.instanceCount = N * N;
    this.cubeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWave: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: cubeVert,
      fragmentShader: cubeFrag,
    });
    this.cubes = new THREE.Mesh(cubeGeo, this.cubeMat);
    this.cubes.frustumCulled = false;
    this.cubes.position.set(0, -1.6, -3);
    s.add(this.cubes);

    // véu de matriz
    const cols = 70;
    const rows = 40;
    const base = new THREE.PlaneGeometry(0.16, 0.2);
    const mg = new THREE.InstancedBufferGeometry().copy(base);
    const cells = [];
    const ms = [];
    const mc = [];
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        cells.push(x - cols / 2, y - rows / 2);
        ms.push(rand());
        mc.push(Math.floor(rand() * 16));
      }
    mg.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cells), 2));
    mg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(ms), 1));
    mg.setAttribute('aChar', new THREE.InstancedBufferAttribute(new Float32Array(mc), 1));
    mg.instanceCount = cols * rows;
    this.matrixMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uGlyphs: { value: glyphAtlas() }, uTime: { value: 0 }, uOpacity: { value: 0 }, uExplode: { value: 0 } },
      vertexShader: matrixVert,
      fragmentShader: matrixFrag,
    });
    this.matrix = new THREE.Mesh(mg, this.matrixMat);
    this.matrix.frustumCulled = false;
    s.add(this.matrix);

    // partículas do campo de energia (warp em direção à câmera)
    const pg = randomPointsGeometry(
      1600,
      (v) => {
        const a = rand() * Math.PI * 2;
        const r = 0.8 + rand() * 7;
        v.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, -rand() * 30);
      },
      rand
    );
    this.partMat = particleMaterial({ size: 2.2, twinkle: 0.4, color: new THREE.Color(1.3, 0.85, 0.45), opacity: 0 });
    this.particles = new THREE.Points(pg, this.partMat);
    s.add(this.particles);

    const camStart = CHIP_CAM_OFFSET.toArray();
    this.path = new CameraPath([
      { t: 0.0, pos: camStart, target: [0, 0, 0], fov: 40 },
      { t: 0.19, pos: [0.4, 0.5, 3.4], target: [0, 0, 0], fov: 40 },
      { t: 0.5, pos: [0, 0.1, CARD_CAM_Z - 0.6], target: [0, 0, 0], fov: 42 },
      { t: 1.0, pos: [0, 0, CARD_CAM_Z], target: [0, 0, 0], fov: 42 },
    ]);
  }

  update(l, dt, time) {
    const cam = this.camera;
    this.path.apply(cam, l);
    this.ctx.cameraFX.applyParallax(cam, 0.25);

    // chip → card
    const morph = easeInOut(range(l, 0.19, 0.5));
    const chip = this.chip.group;
    chip.visible = morph < 0.98;
    chip.rotation.set(CHIP_ROT_X + morph * (Math.PI / 2 - CHIP_ROT_X), Math.sin(time * 0.4) * 0.15 * (1 - morph), 0);
    chip.scale.setScalar(1 - morph * 0.55);
    if (this.chip.fresnel) this.chip.fresnel.uFresnel.value = 1.5 + Math.sin(time * 2) * 0.25 + morph * 1.5;
    if (this.chip.edges) this.chip.edges.opacity = 0.9 * (1 - morph);
    this.chip.materials?.forEach((m) => {
      m.transparent = morph > 0.01;
      m.opacity = 1 - smoothstep(0.55, 0.95, morph);
    });

    const cardIn = smoothstep(0.4, 0.6, l);
    this.card.group.visible = cardIn > 0.001;
    this.card.group.scale.set(0.5 + cardIn * 0.5, 0.5 + cardIn * 0.5, 1);
    this.card.edgeMat.opacity = cardIn * 0.55;
    this.chipGlow.material.opacity = 0.32 * (1 - morph) + Math.sin(time * 3) * 0.03 * (1 - morph);

    // cubos
    this.cubeMat.uniforms.uTime.value = time;
    this.cubeMat.uniforms.uWave.value = range(l, 0.0, 0.45);
    this.cubeMat.uniforms.uOpacity.value = 1 - smoothstep(0.35, 0.5, l);
    this.cubes.visible = l < 0.5;

    // véu de matriz
    const veil = smoothstep(0.3, 0.38, l) * (1 - smoothstep(0.62, 0.7, l));
    this.matrixMat.uniforms.uOpacity.value = veil;
    this.matrixMat.uniforms.uTime.value = time;
    this.matrixMat.uniforms.uExplode.value = range(l, 0.4, 0.7);
    this.matrix.position.set(0, 0, cam.position.z - 3.2);
    this.matrix.visible = veil > 0.001;

    // campo de energia
    const field = smoothstep(0.42, 0.7, l);
    this.nebMat.uniforms.uOpacity.value = field;
    this.nebMat.uniforms.uTime.value = time;
    this.partMat.uniforms.uOpacity.value = field;
    this.partMat.uniforms.uTime.value = time;
    this.particles.position.z = ((time * 4) % 30) * 0.15 + l * 12;

    // velocidade do scroll acelera o campo (mesma sensação do áudio)
    const v = Math.min(1, Math.abs(this.ctx.scroll.velocity) * 30);
    this.particles.scale.z = 1 + v * 3;

    this.bloomBoost = 1 + (1 - morph) * 0.4 + this.matrixMat.uniforms.uOpacity.value * 0.3;
  }
}
