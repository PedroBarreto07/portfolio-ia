import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BaseScene } from './BaseScene.js';
import { CameraPath } from '../managers/CameraController.js';
import { noise } from '../shaders/noise.js';
import { glowSprite } from './helpers.js';
import { CREDITS } from '../config.js';
import { rng, smoothstep } from '../core/math.js';

/*
 * Cena 5 + 6 (0.71–1.00)
 *   local 0.00–0.08  câmera colada na tela central (cards) → recua no interior
 *   local 0.08–0.16  sobe pelo teto de vidro
 *   local 0.16–0.30  contorna e vai para trás do carro
 *   local 0.30–1.00  câmera de perseguição; créditos sobre a cena escurecida
 */

export const CAR_X = 1.75; // faixa da direita
export const SPEED = 24; // m/s do "esteira" do mundo
const SCREEN = { w: 0.46, h: 0.2875 }; // 16:10
const SCREEN_POS = new THREE.Vector3(CAR_X, 1.19, -0.97); // flutuando sobre o painel
const SCREEN_TILT = -0.22;

/* ---------------- ruído JS (montanhas / distribuição) ---------------- */
function makeNoise2D(seed) {
  const r = rng(seed);
  const P = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i).sort(() => r() - 0.5);
  for (let i = 0; i < 512; i++) P[i] = base[i & 255];
  const grad = (h, x, y) => ((h & 1 ? -x : x) + (h & 2 ? -y : y));
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = P[X] + Y;
    const b = P[X + 1] + Y;
    const l1 = grad(P[a], x, y) + u * (grad(P[b], x - 1, y) - grad(P[a], x, y));
    const l2 = grad(P[a + 1], x, y - 1) + u * (grad(P[b + 1], x - 1, y - 1) - grad(P[a + 1], x, y - 1));
    return l1 + v * (l2 - l1); // ~[-1,1]
  };
}

/* ---------------- shaders ---------------- */
const skyFrag = /* glsl */ `
  uniform vec3 uSun; varying vec3 vDir;
  ${noise}
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 zen = vec3(0.16,0.32,0.62);
    vec3 hor = vec3(0.78,0.85,0.92);
    vec3 col = mix(hor, zen, pow(clamp(smoothstep(-0.02, 0.55, h), 0.0, 1.0), 0.7));
    float sd = max(dot(d, uSun), 0.0);
    col += vec3(1.0,0.85,0.6) * pow(sd, 8.0) * 0.35 + vec3(1.4,1.25,1.0) * pow(sd, 900.0) * 18.0;
    // nuvens altas finas
    vec2 cp = d.xz / max(h, 0.06) * 0.6;
    float c = smoothstep(0.15, 0.7, fbm(vec3(cp, 1.0)) + 0.2) * smoothstep(0.0, 0.25, h);
    col = mix(col, vec3(1.0,0.99,0.97), c * 0.35);
    gl_FragColor = vec4(col, 1.0);
  }`;

const roadFrag = /* glsl */ `
  uniform float uOffset; varying vec2 vUv; varying vec3 vWp;
  ${noise}
  void main(){
    float x = (vUv.x - 0.5) * 8.0;
    float z = vWp.z + uOffset;
    float grain = hash12(floor(vWp.xz * 40.0 + vec2(0.0, uOffset * 40.0)));
    vec3 asphalt = vec3(0.075,0.078,0.085) * (0.85 + grain * 0.3);
    asphalt *= 0.9 + 0.15 * (snoise(vec3(vWp.x*0.3, z*0.05, 1.0))*0.5+0.5);
    // marcas
    float edgeL = smoothstep(0.08, 0.0, abs(x + 3.55));
    float edgeR = smoothstep(0.08, 0.0, abs(x - 3.55));
    float dash = smoothstep(0.06, 0.0, abs(x)) * step(0.5, fract(z / 9.0));
    vec3 col = mix(asphalt, vec3(0.85), clamp(edgeL + edgeR + dash, 0.0, 1.0));
    // acostamento
    col = mix(col, vec3(0.16,0.15,0.13), smoothstep(3.7, 3.9, abs(x)));
    gl_FragColor = vec4(col, 1.0);
  }`;
const roadVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vWp;
  #include <fog_pars_vertex>
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position,1.0);
    vWp = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const waterShader = {
  name: 'LakeShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uFog: { value: new THREE.Color(0.78, 0.85, 0.92) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix; varying vec4 vUvR; varying vec3 vWp;
    void main(){
      vUvR = textureMatrix * vec4(position,1.0);
      vWp = (modelMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uCam; uniform vec3 uFog;
    varying vec4 vUvR; varying vec3 vWp;
    ${noise}
    void main(){
      vec2 q = vWp.xz * vec2(0.08, 0.25);
      vec2 dist = vec2(snoise(vec3(q, uTime*0.4)), snoise(vec3(q + 9.0, uTime*0.4))) * 0.006;
      vec4 uvr = vUvR; uvr.xy += dist * uvr.w;
      vec3 refl = texture2DProj(tDiffuse, uvr).rgb;
      vec3 V = normalize(uCam - vWp);
      float fres = 0.12 + 0.55 * pow(1.0 - max(V.y, 0.0), 4.0);
      vec3 deep = vec3(0.012,0.04,0.05);
      vec3 col = mix(deep, refl * 0.75, fres);
      // brilho do sol na água
      float glint = pow(max(snoise(vec3(vWp.xz * vec2(0.6, 0.15), uTime * 1.5)), 0.0), 6.0);
      col += vec3(1.0,0.9,0.75) * glint * 0.6 * smoothstep(40.0, 300.0, -vWp.z + vWp.x * 0.5);
      // névoa (o Reflector não usa a névoa da cena)
      float d = length(uCam - vWp);
      col = mix(col, uFog, smoothstep(120.0, 1100.0, d));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class CarSceneProcedural extends BaseScene {
  async build() {
    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(91);
    this.camera.far = 1800;
    this.camera.near = 0.03;
    this.camera.updateProjectionMatrix();
    const horizon = new THREE.Color(0.78, 0.85, 0.92);
    s.fog = new THREE.Fog(horizon, 90, 950);
    this.sunDir = new THREE.Vector3(0.55, 0.32, -0.77).normalize(); // sol sobre o lago

    /* ---- céu ---- */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSun: { value: this.sunDir } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: skyFrag,
      })
    );
    this.sky = sky;
    s.add(sky);

    /* ---- montanhas ---- */
    this.mountains = this.buildMountains();
    s.add(this.mountains);

    // ambiente de reflexo a partir do próprio céu + montanhas
    const envScene = new THREE.Scene();
    envScene.add(sky.clone(), this.mountains.clone());
    envScene.add(new THREE.HemisphereLight(0xdde8ff, 0x445544, 2));
    this.env = ctx.pmrem.fromScene(envScene, 0.02).texture;
    s.environment = this.env;
    s.environmentIntensity = 0.9;

    /* ---- luz ---- */
    s.add(new THREE.HemisphereLight(0xd8e6ff, 0x46523f, 1.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
    sun.position.copy(this.sunDir).multiplyScalar(50);
    s.add(sun);

    /* ---- chão, estrada, lago ---- */
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x46513f, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 1400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-400 + 4.2, -0.05, -500);
    s.add(ground);
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(6, 1400), new THREE.MeshStandardMaterial({ color: 0x5b5d52, roughness: 1 }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(7, -0.06, -500);
    s.add(shore);

    this.roadMat = new THREE.ShaderMaterial({
      uniforms: { uOffset: { value: 0 }, ...THREE.UniformsLib.fog },
      vertexShader: roadVert,
      fragmentShader: roadFrag.replace('gl_FragColor = vec4(col, 1.0);', 'gl_FragColor = vec4(col, 1.0);\n#include <fog_fragment>').replace('varying vec3 vWp;', 'varying vec3 vWp;\n#include <fog_pars_fragment>'),
      fog: true,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 1400, 1, 1), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -500);
    s.add(road);

    const mobile = ctx.sizes.mobile;
    this.lake = new Reflector(new THREE.PlaneGeometry(1200, 1400), {
      textureWidth: Math.floor(innerWidth * (mobile ? 0.35 : 0.5)),
      textureHeight: Math.floor(innerHeight * (mobile ? 0.35 : 0.5)),
      clipBias: 0.003,
      shader: waterShader,
      multisample: mobile ? 0 : 2,
    });
    this.lake.rotation.x = -Math.PI / 2;
    this.lake.position.set(10 + 600, -0.12, -500);
    s.add(this.lake);

    /* ---- pinheiros + balizas (esteira) ---- */
    this.trees = this.buildTrees(rand);
    s.add(this.trees.mesh);
    this.posts = this.buildPosts();
    s.add(this.posts.mesh);

    /* ---- carro ---- */
    this.car = this.buildCar();
    this.car.group.position.x = CAR_X;
    s.add(this.car.group);

    // tela central: recebe a cena dos cards (render-to-texture)
    this.screenRT = new THREE.WebGLRenderTarget(1024, 640, { type: THREE.HalfFloatType, samples: 2 });
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screenRT.texture, toneMapped: true });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
    screen.position.copy(SCREEN_POS);
    screen.rotation.x = SCREEN_TILT;
    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(SCREEN.w + 0.03, SCREEN.h + 0.03, 0.02, 2, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.3, metalness: 0.5 })
    );
    bezel.position.set(0, 0, -0.012);
    screen.add(bezel);
    s.add(screen);
    this.screen = screen;

    this.buildPath();
    this.dist = 0;
  }

  buildMountains() {
    const n1 = makeNoise2D(5);
    const n2 = makeNoise2D(9);
    const fbm = (x, y) => {
      let f = 0;
      let a = 0.5;
      for (let i = 0; i < 6; i++) {
        f += a * (1 - Math.abs(n1(x, y))); // ridged
        x *= 2.03;
        y *= 2.03;
        a *= 0.5;
      }
      return f;
    };
    const geo = new THREE.PlaneGeometry(1800, 700, 300, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const snow = new THREE.Color(0.95, 0.97, 1.0);
    const rock = new THREE.Color(0.32, 0.35, 0.4);
    const forest = new THREE.Color(0.08, 0.13, 0.1);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 520; // grupo começa longe
      // distância do vale (estrada + lago)
      const far = smoothstep(-200, -520, z);
      const sideL = smoothstep(30, 140, -(x + 40));
      const sideR = smoothstep(110, 300, x);
      const mask = Math.max(far, sideL * 0.55, sideR * 0.85);
      let h = Math.pow(fbm(x * 0.0042, z * 0.0042), 2.2) * 260 * mask;
      h += n2(x * 0.02, z * 0.02) * 6 * mask;
      pos.setY(i, h - 2);
      const sn = smoothstep(95, 130, h + n2(x * 0.05, z * 0.05) * 25);
      const fo = 1 - smoothstep(10, 45, h);
      c.copy(rock).lerp(forest, fo).lerp(snow, sn);
      c.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
    mesh.position.z = -520;
    return mesh;
  }

  buildTrees(rand) {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6);
    trunk.translate(0, 0.7, 0);
    parts.push(trunk);
    [
      [1.9, 3.2, 1.6],
      [1.5, 2.6, 3.0],
      [1.0, 2.0, 4.3],
    ].forEach(([r, h, y]) => {
      const cone = new THREE.ConeGeometry(r, h, 8);
      cone.translate(0, y, 0);
      parts.push(cone);
    });
    const geo = mergeSimple(parts);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const N = 900;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const items = [];
    for (let i = 0; i < N; i++) {
      const x = -(9 + Math.pow(rand(), 1.4) * 120);
      const z = -380 + rand() * 420;
      const s = 0.55 + rand() * 0.75 + Math.min(1, -x / 120) * 0.5;
      items.push({ x, z, s, r: rand() * Math.PI });
      mesh.setColorAt(i, new THREE.Color().setHSL(0.36 + rand() * 0.06, 0.18 + rand() * 0.12, 0.11 + rand() * 0.07));
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, items, len: 420, min: -380 };
  }

  buildPosts() {
    const geo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, emissive: 0x111111 });
    const N = 30;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const items = Array.from({ length: N }, (_, i) => ({ x: 4.3, z: -380 + i * 14, s: 1, r: 0 }));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, items, len: 420, min: -380 };
  }

  // Avança o mundo (o carro fica parado) com wrap infinito
  scroll(set, dz) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    set.items.forEach((it, i) => {
      it.z += dz;
      if (it.z > set.min + set.len) it.z -= set.len;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.r);
      v.set(it.x, 0, it.z);
      sc.setScalar(it.s);
      m.compose(v, q, sc);
      set.mesh.setMatrixAt(i, m);
    });
    set.mesh.instanceMatrix.needsUpdate = true;
  }

  buildCar() {
    const group = new THREE.Group();
    const gltf = this.ctx.assets.model('car');
    const paint = new THREE.MeshPhysicalMaterial({
      color: 0x2c3036,
      metalness: 0.75,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.2,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0b1015,
      metalness: 0.2,
      roughness: 0.05,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.6, metalness: 0.3 });

    if (gltf) {
      group.add(gltf.scene);
    } else {
      const L = 4.75;
      const W = 1.9;
      // perfil lateral (u = comprimento traseira→frente, v = altura)
      const body = new THREE.Shape();
      body.moveTo(0.02, 0.3);
      body.lineTo(0.0, 0.72);
      body.bezierCurveTo(0.02, 0.92, 0.2, 1.0, 0.45, 1.0);
      body.lineTo(3.55, 1.0);
      body.bezierCurveTo(3.95, 0.97, 4.45, 0.9, 4.66, 0.76);
      body.bezierCurveTo(4.76, 0.66, 4.76, 0.42, 4.68, 0.3);
      body.lineTo(0.02, 0.3);
      const bodyGeo = new THREE.ExtrudeGeometry(body, {
        depth: W - 0.2,
        bevelEnabled: true,
        bevelSize: 0.1,
        bevelThickness: 0.1,
        bevelSegments: 5,
        curveSegments: 24,
      });
      bodyGeo.translate(-L / 2, 0, -(W - 0.2) / 2);
      bodyGeo.rotateY(Math.PI / 2); // comprimento ao longo de z (frente = -z)
      const bodyMesh = new THREE.Mesh(bodyGeo, paint);
      this.bodyMesh = bodyMesh;
      group.add(bodyMesh);

      // estufa de vidro (teto panorâmico)
      const cab = new THREE.Shape();
      cab.moveTo(0.5, 0.98);
      cab.bezierCurveTo(0.9, 1.3, 1.4, 1.45, 1.9, 1.46);
      cab.lineTo(2.6, 1.46);
      cab.bezierCurveTo(3.0, 1.44, 3.3, 1.2, 3.6, 0.98);
      cab.lineTo(0.5, 0.98);
      const cabGeo = new THREE.ExtrudeGeometry(cab, {
        depth: W - 0.42,
        bevelEnabled: true,
        bevelSize: 0.07,
        bevelThickness: 0.08,
        bevelSegments: 4,
        curveSegments: 20,
      });
      cabGeo.translate(-L / 2, 0, -(W - 0.42) / 2);
      cabGeo.rotateY(Math.PI / 2);
      this.canopy = new THREE.Mesh(cabGeo, glass);
      group.add(this.canopy);

      // barra de lanternas (EV) + difusor
      this.tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.1, 0.07) });
      const tail = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.06, 0.04, 2, 0.02), this.tailMat);
      tail.position.set(0, 0.86, L / 2 + 0.08);
      group.add(tail);
      const diff = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.1), dark);
      diff.position.set(0, 0.34, L / 2 + 0.05);
      group.add(diff);
      const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.2) });
      for (const x of [-0.7, 0.7]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), head);
        h.position.set(x, 0.74, -L / 2 - 0.06);
        group.add(h);
      }

      // rodas
      this.wheels = [];
      const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 32);
      tireGeo.rotateZ(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.26, 10);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 0.9, roughness: 0.25 });
      for (const [x, z] of [
        [-0.86, -1.45],
        [0.86, -1.45],
        [-0.86, 1.5],
        [0.86, 1.5],
      ]) {
        const w = new THREE.Group();
        w.add(new THREE.Mesh(tireGeo, dark), new THREE.Mesh(rimGeo, rimMat));
        // raios
        for (let k = 0; k < 5; k++) {
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.4), rimMat);
          sp.rotation.x = (k / 5) * Math.PI;
          w.add(sp);
        }
        w.position.set(x, 0.36, z);
        this.wheels.push(w);
        group.add(w);
      }

      // interior
      const interior = new THREE.Group();
      const dash = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.22, 0.5, 3, 0.08), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.7 }));
      dash.position.set(0, 0.93, -1.25);
      interior.add(dash);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 12, 40), dark);
      wheel.position.set(-0.4, 1.02, -0.92);
      wheel.rotation.x = -0.35;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), dark);
      hub.rotation.x = Math.PI / 2 - 0.35;
      hub.position.copy(wheel.position);
      interior.add(wheel, hub);
      // colunas A + travessa do teto (enquadram o para-brisa)
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.7 });
      for (const sx of [-1, 1]) {
        const p0 = new THREE.Vector3(sx * 0.8, 1.0, -1.35);
        const p1 = new THREE.Vector3(sx * 0.68, 1.43, -0.42);
        const len = p0.distanceTo(p1);
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.1), pillarMat);
        pillar.position.copy(p0).lerp(p1, 0.5);
        pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        interior.add(pillar);
      }
      // capô visto de dentro (a carroceria real fica oculta enquanto a câmera está no interior)
      const hood = new THREE.Mesh(
        new THREE.PlaneGeometry(1.75, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.35, metalness: 0.6 })
      );
      hood.rotation.x = -Math.PI / 2 + 0.12;
      hood.position.set(0, 0.95, -2.05);
      interior.add(hood);
      // linha de luz ambiente no painel
      const amb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.6) }));
      amb.position.set(0, 1.0, -1.0);
      interior.add(amb);
      group.add(interior);
      this.interior = interior;
    }

    // sombra suave
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.6),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `varying vec2 vUv; void main(){ vec2 p=(vUv-0.5)*2.0; float a=smoothstep(1.0,0.35,length(p*vec2(1.0,0.85))); gl_FragColor=vec4(0.0,0.0,0.0,a*0.75);} `,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    group.add(shadow);

    // flares das lanternas
    this.flares = [];
    for (const x of [-0.78, 0.78]) {
      const f = glowSprite(new THREE.Color(1.8, 0.1, 0.07), 0.7, 0.45);
      f.position.set(x, 0.86, 2.48);
      group.add(f);
      this.flares.push(f);
    }
    const streak = glowSprite(new THREE.Color(1.2, 0.1, 0.06), 1, 0.2);
    streak.scale.set(4.5, 0.12, 1);
    streak.position.set(0, 0.86, 2.5);
    group.add(streak);
    this.streak = streak;

    return { group, paint };
  }

  buildPath() {
    const S = SCREEN_POS;
    const n = new THREE.Vector3(0, Math.sin(-SCREEN_TILT), Math.cos(SCREEN_TILT)).normalize();
    const d = (SCREEN.h / 2 / Math.tan(THREE.MathUtils.degToRad(21))) * 0.94; // leve overfill
    const start = S.clone().addScaledVector(n, d);
    const cx = CAR_X;
    this.path = new CameraPath([
      { t: 0.0, pos: start.toArray(), target: S.toArray(), fov: 42 },
      { t: 0.08, pos: [cx, 1.36, 0.22], target: [cx, 1.02, -4], fov: 58 },
      { t: 0.16, pos: [cx + 0.25, 3.1, 0.8], target: [cx, 0.9, -7], fov: 52 },
      { t: 0.3, pos: [cx + 3.2, 2.1, 6.5], target: [cx, 0.9, 0], fov: 42 },
      { t: 0.45, pos: [cx + 0.9, 1.55, 7.6], target: [cx - 0.2, 1.75, -6], fov: 40 },
      { t: 0.7, pos: [cx - 1.4, 1.9, 9.8], target: [cx - 0.3, 2.0, -12], fov: 40 },
      { t: 1.0, pos: [cx - 2.6, 2.5, 12.5], target: [cx - 0.8, 2.3, -20], fov: 38 },
    ]);
  }

  update(l, dt, time, global) {
    const cam = this.camera;
    this.path.apply(cam, l);
    this.ctx.cameraFX.applyLook(cam, global);

    // movimento do mundo
    const dz = SPEED * dt;
    this.dist += dz;
    this.roadMat.uniforms.uOffset.value = -this.dist;
    this.scroll(this.trees, dz);
    this.scroll(this.posts, dz);
    this.wheels?.forEach((w) => (w.rotation.x -= dz / 0.36));
    this.car.group.position.y = Math.sin(time * 9) * 0.004;
    this.lake.material.uniforms.uTime.value = time;
    this.lake.material.uniforms.uCam.value.copy(cam.position);

    // flares pulsam levemente
    this.flares.forEach((f) => (f.material.opacity = 0.42 + Math.sin(time * 2) * 0.04));
    this.streak.material.opacity = 0.2 * smoothstep(0.2, 0.35, l);

    // tela só existe enquanto o interior está visível
    this.screenOn = l < 0.2;
    this.screen.visible = this.screenOn;
    if (this.interior) this.interior.visible = l < 0.22;
    // dentro do carro o vidro some (vemos a estrada direto); fora ele volta
    if (this.canopy) this.canopy.visible = l > 0.115;
    if (this.bodyMesh) this.bodyMesh.visible = l > 0.115;
    this.wheels?.forEach((w) => (w.visible = l > 0.115));

    // créditos: escurece 50% e aplica blur
    const [c0] = CREDITS.range;
    const k = smoothstep(c0, CREDITS.bandsClosedAt, global);
    this.ctx.postfx.state.darken = k * CREDITS.darken;
    this.ctx.postfx.state.blur = k * CREDITS.blur;

    this.bloomBoost = 1 - k * 0.4;
    this.time = time;
    this.dt = dt;
  }

  render(renderer, target) {
    // a cena dos cards é renderizada na tela do painel antes do quadro principal
    if (this.screenOn) {
      const cards = this.ctx.scenesById?.cards;
      if (cards?.ready) cards.renderTo(renderer, this.screenRT, 1, this.dt || 0.016, this.time || 0);
    }
    super.render(renderer, target);
  }

  leave() {
    this.ctx.postfx.state.darken = 0;
    this.ctx.postfx.state.blur = 0;
  }
}

// Junta geometrias simples (posição + normal) sem depender de BufferGeometryUtils
function mergeSimple(geos) {
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  nonIdx.forEach((g) => (total += g.attributes.position.count));
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  nonIdx.forEach((g) => {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
