import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BaseScene } from './BaseScene.js';
import { CameraPath } from '../managers/CameraController.js';
import { noise } from '../shaders/noise.js';
import { addDissolve, canvasTexture, glowSprite, glowTexture, particleMaterial, randomPointsGeometry } from './helpers.js';
import { createChip } from './chip.js';
import { damp, easeInOut, range, rng, smoothstep } from '../core/math.js';

/*
 * Cena 2 (0.28–0.54) — linha do tempo local:
 *   0.00–0.12  corredor escuro, cone de luz, poeira (mouse look)
 *   0.12–0.23  rack NXR-96 aparece com dissolve
 *   0.23–0.46  câmera avança; texto 3D gigante "NXR-96" + HUD
 *   0.46–0.56  rack NEX-128 (ficha técnica)
 *   0.56–0.615 chip sai do rack
 *   0.615–0.69 arrastar para girar
 *   0.69–1.00  chip levita, ambiente apaga, brilho dourado → cena quântica
 */

const HERO_Z = -26;
const CORE_Z = -17;
export const CHIP_END = new THREE.Vector3(0, 1.9, -15);
export const CHIP_CAM_OFFSET = new THREE.Vector3(0, 0.35, 2.6);

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Frente dos racks: grade de LEDs piscando (por instância)
const ledVert = /* glsl */ `
  attribute float aSeed; varying vec2 vUv; varying float vSeed; varying float vDepth;
  void main(){
    vUv = uv; vSeed = aSeed;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const ledFrag = /* glsl */ `
  uniform float uTime; uniform float uDim; varying vec2 vUv; varying float vSeed; varying float vDepth;
  ${noise}
  void main(){
    // 14 servidores por rack; LEDs pequenos concentrados à direita de cada unidade
    float units = 14.0;
    float uy = vUv.y * units;
    float unitId = floor(uy);
    float fy = fract(uy);
    vec2 grid = vec2(16.0, units * 3.0);
    vec2 id = floor(vUv * grid);
    vec2 f = fract(vUv * grid);
    float cellAspect = (0.72 / grid.x) / (2.15 / grid.y);
    float dotm = smoothstep(0.32, 0.12, length((f - 0.5) * vec2(cellAspect, 1.0)));
    float h = hash12(id + vSeed * 91.0);
    float col01 = vUv.x;
    float zone = step(0.62, col01) * step(col01, 0.95) + step(0.06, col01) * step(col01, 0.12) * 0.6;
    float on = step(0.35, h) * zone * step(0.5, fract(sin(uTime * (0.6 + h * 3.0) + h * 40.0) * 0.5 + 0.5 + h));
    vec3 c = h > 0.93 ? vec3(1.0,0.45,0.15) : (h > 0.7 ? vec3(0.25,1.0,0.55) : vec3(0.35,0.65,1.0));
    // frentes das unidades: grade de ventilação + bordas
    float bezel = step(0.06, fy) * step(fy, 0.94) * step(0.04, vUv.x) * step(vUv.x, 0.96);
    float vent = step(0.5, fract(vUv.x * 60.0)) * step(0.15, col01) * step(col01, 0.58) * step(0.3, fy) * step(fy, 0.7);
    vec3 base = vec3(0.016,0.018,0.022) * bezel + vec3(0.01) * vent;
    base += vec3(0.05,0.055,0.06) * (1.0 - bezel) * step(0.02, vUv.x) * step(vUv.x, 0.98);
    float fog = exp(-vDepth * 0.03);
    vec3 col = base * fog + c * dotm * on * 1.6 * uDim * fog;
    gl_FragColor = vec4(col, 1.0);
  }`;

// Cone de luz volumétrica
const coneVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
  void main(){
    vH = uv.y; vP = position;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const coneFrag = /* glsl */ `
  uniform float uTime; uniform float uIntensity; uniform vec3 uColor;
  varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
  ${noise}
  void main(){
    float facing = abs(dot(vN, vV));
    float soft = pow(clamp(facing, 0.0, 1.0), 2.5);
    float n = fbm3(vec3(vP.x*0.6, vP.y*0.25 - uTime*0.15, vP.z*0.6))*0.5+0.5;
    float a = soft * pow(clamp(vH, 0.0, 1.0), 1.2) * (0.55 + n*0.6) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }`;

// Piso: camada fosca sobre o espelho
const floorFrag = /* glsl */ `
  uniform float uDim; varying vec2 vUv;
  ${noise}
  void main(){
    vec2 p = vUv * vec2(24.0, 120.0);
    vec2 tile = abs(fract(p) - 0.5);
    float seam = smoothstep(0.49, 0.5, max(tile.x, tile.y));
    float rough = fbm3(vec3(vUv * 40.0, 1.0)) * 0.5 + 0.5;
    float a = mix(0.62, 0.86, rough) + seam * 0.1;
    gl_FragColor = vec4(vec3(0.01, 0.011, 0.013) + seam*0.01, a);
  }`;

function textLayersTexture(text) {
  return canvasTexture(2048, 512, (g, w, h) => {
    g.fillStyle = '#fff';
    g.font = '600 380px "General Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 20);
  });
}

function rackFaceTexture(accent = '#e8b46a') {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const y = 20 + i * 30;
      g.fillStyle = '#0d0f12';
      g.fillRect(14, y, w - 28, 24);
      g.fillStyle = i % 5 === 0 ? accent : '#1e2a36';
      g.fillRect(20, y + 10, 40, 3);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = Math.random() > 0.5 ? '#3cf08a' : '#2a6cff';
        g.globalAlpha = Math.random() > 0.3 ? 1 : 0.2;
        g.fillRect(w - 30 - k * 9, y + 9, 4, 4);
        g.globalAlpha = 1;
      }
    }
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
}

export class DataCenterScene extends BaseScene {
  async build() {
    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(41);
    s.fog = new THREE.FogExp2(0x020203, 0.028);
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    s.environment = ctx.envMap;
    s.environmentIntensity = 0.08;

    /* ---- piso refletivo ---- */
    const mobile = ctx.sizes.mobile;
    const rw = Math.floor((innerWidth * (mobile ? 0.4 : 0.6)) | 0);
    const rh = Math.floor((innerHeight * (mobile ? 0.4 : 0.6)) | 0);
    this.mirror = new Reflector(new THREE.PlaneGeometry(40, 200), {
      textureWidth: rw,
      textureHeight: rh,
      color: 0x8a8a8a,
      clipBias: 0.003,
    });
    this.mirror.rotation.x = -Math.PI / 2;
    this.mirror.position.set(0, 0, -60);
    s.add(this.mirror);
    this.floorMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uDim: { value: 1 } },
      vertexShader: vert,
      fragmentShader: floorFrag,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.005, -60);
    s.add(floor);

    /* ---- fileiras de racks (instanciadas) ---- */
    const rackGeo = new THREE.BoxGeometry(0.8, 2.3, 1.1);
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.75, roughness: 0.42 });
    const faceGeo = new THREE.PlaneGeometry(0.72, 2.15);
    this.ledMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDim: { value: 1 } },
      vertexShader: ledVert,
      fragmentShader: ledFrag,
      fog: false,
    });
    const perRow = 46;
    const count = perRow * 4;
    const racks = new THREE.InstancedMesh(rackGeo, rackMat, count);
    const faces = new THREE.InstancedMesh(faceGeo, this.ledMat, count);
    const seeds = new Float32Array(count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (const side of [-1, 1])
      for (const off of [0, 1]) {
        // duas fileiras por lado (a de trás aparece pelos vãos)
        const x = side * (3.2 + off * 2.6);
        for (let i = 0; i < perRow; i++) {
          const z = 6 - i * 0.84 - (i > 14 ? 1.2 : 0);
          m4.makeTranslation(x, 1.15, z);
          racks.setMatrixAt(k, m4);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? -Math.PI / 2 : Math.PI / 2);
          m4.compose(new THREE.Vector3(x - side * 0.56, 1.15, z), q, new THREE.Vector3(1, 1, 1));
          faces.setMatrixAt(k, m4);
          seeds[k] = rand();
          k++;
        }
      }
    faces.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    s.add(racks, faces);
    this.racks = racks;

    // passarelas de cabos no teto (linhas finas)
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.8, roughness: 0.4 });
    for (const x of [-3.2, 3.2]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 120), trayMat);
      tray.position.set(x, 3.4, -50);
      s.add(tray);
    }

    /* ---- luzes ---- */
    s.add(new THREE.AmbientLight(0x1a2030, 0.35));
    const spot = new THREE.SpotLight(0xffc27a, 160, 30, Math.PI / 7, 0.6, 1.6);
    spot.position.set(0, 13, HERO_Z + 3);
    spot.target.position.set(0, 0, HERO_Z + 3);
    s.add(spot, spot.target);
    this.spot = spot;
    const coreSpot = new THREE.SpotLight(0xffd7a0, 0, 20, Math.PI / 8, 0.7, 1.5);
    coreSpot.position.set(0, 10, CORE_Z);
    coreSpot.target.position.set(0, 0, CORE_Z);
    s.add(coreSpot, coreSpot.target);
    this.coreSpot = coreSpot;
    const fill = new THREE.PointLight(0x4f7dff, 6, 18, 1.8);
    fill.position.set(0, 2.5, 2);
    s.add(fill);

    /* ---- cone volumétrico ---- */
    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.9 }, uColor: { value: new THREE.Color(1.0, 0.7, 0.38) } },
      vertexShader: coneVert,
      fragmentShader: coneFrag,
    });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 4.2, 13, 64, 1, true), this.coneMat);
    cone.position.set(0, 6.5, HERO_Z + 3);
    // uv.y: 0 embaixo → 1 em cima; queremos mais forte em cima e suave embaixo
    s.add(cone);
    this.cone = cone;

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: new THREE.Color(1.0, 0.62, 0.3),
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.02, HERO_Z + 3);
    s.add(pool);
    this.pool = pool;

    /* ---- poeira + bokeh ---- */
    const dustGeo = randomPointsGeometry(
      1400,
      (v) => {
        const r = Math.sqrt(rand()) * 4;
        const a = rand() * Math.PI * 2;
        v.set(Math.cos(a) * r, rand() * 11, HERO_Z + 3 + Math.sin(a) * r);
      },
      rand
    );
    this.dustMat = particleMaterial({ size: 1.4, twinkle: 0.5, color: new THREE.Color(1.4, 0.95, 0.55), opacity: 0.9 });
    this.dust = new THREE.Points(dustGeo, this.dustMat);
    s.add(this.dust);
    const bokehGeo = randomPointsGeometry(
      60,
      (v) => v.set((rand() - 0.5) * 7, 0.5 + rand() * 4, -2 - rand() * 26),
      rand
    );
    this.bokehMat = particleMaterial({ size: 9, twinkle: 0.3, color: new THREE.Color(1.0, 0.7, 0.4), opacity: 0.18 });
    s.add(new THREE.Points(bokehGeo, this.bokehMat));

    /* ---- rack herói NXR-96 (dissolve) ---- */
    this.hero = this.makeHeroRack('#e8b46a', 1.25, 2.7);
    this.hero.group.position.set(0, 0, HERO_Z);
    s.add(this.hero.group);

    /* ---- rack NEX-128 Compute Core ---- */
    this.core = this.makeHeroRack('#ffcf86', 1.0, 2.4, true);
    this.core.group.position.set(0, 0, CORE_Z);
    s.add(this.core.group);

    /* ---- texto 3D gigante (camadas empilhadas = extrusão) ---- */
    const tex = textLayersTexture('NXR-96');
    this.bigText = new THREE.Group();
    const layers = 26;
    this.textMats = [];
    for (let i = 0; i < layers; i++) {
      const front = i === layers - 1;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        color: front ? new THREE.Color(1.6, 1.35, 1.0) : new THREE.Color(0.07, 0.06, 0.05).multiplyScalar(1 + i / layers),
        opacity: 0,
        fog: false,
      });
      mat.userData.baseOpacity = 1;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), mat);
      p.position.z = i * 0.014;
      this.bigText.add(p);
      this.textMats.push(mat);
    }
    this.bigText.position.set(0, 4.6, HERO_Z - 1.2);
    s.add(this.bigText);

    /* ---- chip ---- */
    this.chip = createChip(ctx.assets);
    this.chip.group.scale.setScalar(0.0001);
    s.add(this.chip.group);
    this.chipGlow = glowSprite(new THREE.Color(1.3, 0.8, 0.4), 3.5, 0);
    this.chip.group.add(this.chipGlow);
    this.drag = { rx: 0, ry: 0, vx: 0, vy: 0 };
    this.chipLight = new THREE.PointLight(0xffb060, 0, 6, 2);
    s.add(this.chipLight);

    this.path = new CameraPath([
      { t: 0.0, pos: [0, 1.7, 9], target: [0, 1.4, -20], fov: 42 },
      { t: 0.23, pos: [0, 1.6, 1], target: [0, 1.5, HERO_Z], fov: 42 },
      { t: 0.46, pos: [-1.3, 2.2, -8.5], target: [0, 2.9, HERO_Z], fov: 44 },
      { t: 0.56, pos: [1.6, 1.7, -11.8], target: [-0.9, 1.3, CORE_Z], fov: 40 },
      { t: 0.615, pos: [0, 1.6, -12.6], target: [0, 1.45, -16], fov: 40 },
      { t: 0.69, pos: [0, 1.65, -12.4], target: [0, 1.5, -15.5], fov: 40 },
      {
        t: 1.0,
        pos: CHIP_END.clone().add(CHIP_CAM_OFFSET).toArray(),
        target: CHIP_END.toArray(),
        fov: 40,
      },
    ]);
  }

  makeHeroRack(accent, w, hgt, glassDoor = false) {
    const group = new THREE.Group();
    // GLB opcional (config.ASSETS.models.rack): recebe o mesmo dissolve dos placeholders
    const gltf = this.ctx.assets.model('rack');
    if (gltf) {
      const model = gltf.scene.clone(true);
      const dis = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        dis.push(addDissolve(o.material));
      });
      group.add(model);
      group.visible = false;
      return { group, dis, stripMat: new THREE.MeshBasicMaterial() };
    }
    const body = new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0.85, roughness: 0.35 });
    const face = new THREE.MeshStandardMaterial({
      map: rackFaceTexture(accent),
      emissiveMap: rackFaceTexture(accent),
      emissive: new THREE.Color(1.3, 1.1, 0.9),
      metalness: 0.3,
      roughness: 0.4,
    });
    const dis = [addDissolve(body), addDissolve(face)];
    const box = new THREE.Mesh(new RoundedBoxGeometry(w, hgt, 1.2, 2, 0.03), body);
    box.position.y = hgt / 2;
    group.add(box);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.88, hgt * 0.94), face);
    front.position.set(0, hgt / 2, 0.61);
    group.add(front);
    // frisos de luz
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.8), transparent: true, opacity: 0 });
    for (const x of [-w / 2 - 0.01, w / 2 + 0.01]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, hgt * 0.96, 0.02), stripMat);
      st.position.set(x, hgt / 2, 0.6);
      group.add(st);
    }
    if (glassDoor) {
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.9, hgt * 0.95),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transmission: 0.6,
          roughness: 0.15,
          thickness: 0.05,
          transparent: true,
          opacity: 0.35,
        })
      );
      glass.position.set(0, hgt / 2, 0.64);
      group.add(glass);
      this.coreGlass = glass;
    }
    group.visible = false;
    return { group, dis, stripMat };
  }

  setDissolve(rack, v) {
    rack.group.visible = v > 0.001;
    rack.dis.forEach((u) => (u.uDissolve.value = v));
    rack.stripMat.opacity = smoothstep(0.7, 1, v);
  }

  update(l, dt, time, global) {
    const cam = this.camera;
    this.path.apply(cam, l);
    this.ctx.cameraFX.applyLook(cam, global);

    this.ledMat.uniforms.uTime.value = time;
    this.coneMat.uniforms.uTime.value = time;
    this.dustMat.uniforms.uTime.value = time;
    this.bokehMat.uniforms.uTime.value = time;
    this.dust.position.y = ((time * 0.08) % 1) * 0.6;

    // apagar o ambiente no final (chip assume o quadro)
    const outro = smoothstep(0.7, 0.96, l);
    const dim = 1 - outro * 0.9;
    this.ledMat.uniforms.uDim.value = dim;
    this.spot.intensity = 160 * (1 - outro);
    this.coneMat.uniforms.uIntensity.value = 0.9 * (1 - outro * 0.85);
    this.pool.material.opacity = 0.45 * (1 - outro);
    this.mirror.visible = outro < 0.98;

    // racks heróis
    this.setDissolve(this.hero, easeInOut(range(l, 0.12, 0.23)) * (1 - smoothstep(0.8, 0.95, l)));
    this.setDissolve(this.core, easeInOut(range(l, 0.44, 0.53)) * (1 - smoothstep(0.75, 0.9, l)));
    this.coreSpot.intensity = 90 * smoothstep(0.44, 0.53, l) * (1 - outro);

    // texto gigante
    const tIn = smoothstep(0.24, 0.33, l) * (1 - smoothstep(0.5, 0.56, l));
    this.textMats.forEach((m, i) => (m.opacity = tIn * (i === this.textMats.length - 1 ? 1 : 0.9)));
    this.bigText.visible = tIn > 0.001;
    this.bigText.position.y = 4.6 + (1 - tIn) * -0.4;

    // chip: sai do rack, pode ser girado, levita
    const out = easeInOut(range(l, 0.56, 0.615));
    const rise = easeInOut(range(l, 0.69, 1));
    const chip = this.chip.group;
    const slot = new THREE.Vector3(0, 1.3, CORE_Z + 0.4);
    const front = new THREE.Vector3(0, 1.45, -15.6);
    chip.position.lerpVectors(slot, front, out);
    chip.position.lerp(CHIP_END, rise);
    chip.scale.setScalar(Math.max(0.0001, 0.35 + out * 0.65));
    chip.visible = l > 0.55;

    // arrastar para girar (com inércia) e voltar à orientação canônica
    const d = this.ctx.cursor.consumeDrag();
    const dr = this.drag;
    if (this.ctx.cursor.drag.enabled) {
      dr.vx += d.dx * 0.006;
      dr.vy += d.dy * 0.004;
    }
    dr.ry += dr.vx;
    dr.rx += dr.vy;
    dr.vx *= Math.pow(0.9, dt * 60);
    dr.vy *= Math.pow(0.9, dt * 60);
    if (l > 0.69) {
      const k = damp(0.06, dt);
      dr.ry += (Math.round(dr.ry / (Math.PI * 2)) * Math.PI * 2 - dr.ry) * k;
      dr.rx += (0 - dr.rx) * k;
    }
    const idle = l < 0.69 ? Math.sin(time * 0.6) * 0.25 : 0;
    chip.rotation.set(1.05 - out * 0.15 - rise * 0.3 + dr.rx, idle + dr.ry, 0);

    // brilho dourado crescente
    const glow = smoothstep(0.62, 1, l);
    if (this.chip.fresnel) this.chip.fresnel.uFresnel.value = glow * 1.5;
    if (this.chip.edges) this.chip.edges.opacity = glow * 0.9;
    this.chipGlow.material.opacity = out * 0.12 + glow * 0.28;
    this.chipLight.position.copy(chip.position).add(new THREE.Vector3(0, 0.8, 0.8));
    this.chipLight.intensity = 3 + glow * 10;
    this.bloomBoost = 1 + glow * 0.7;
  }
}
