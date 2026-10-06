import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { CameraPath } from '../managers/CameraController.js';
import { noise } from '../shaders/noise.js';
import { glowSprite } from './helpers.js';
import { easeInOut, easeOut, range, rng, smoothstep } from '../core/math.js';

/*
 * Cena 1 (0.14–0.28)
 *  A) cristal de vidro com raios de luz e cáusticas sobre fundo azul-acinzentado
 *  B) o cristal mergulha → flash de luz → vista aérea de uma cidade no deserto
 *     com grid de infraestrutura luminoso, nuvens e sombras de nuvens.
 */

const MAP_SIZE = 400;
const NODE = new THREE.Vector3(18, 0, -10); // destino do diamante no mapa

/* --------- mapa procedural de cidade no deserto (vista de satélite) --------- */
const mapFrag = /* glsl */ `
  uniform float uTime; uniform sampler2D uImage; uniform float uUseImage;
  varying vec2 vUv;
  ${noise}
  // distância até a rua mais próxima numa grade levemente distorcida
  float roads(vec2 p, float cell, float w){
    vec2 g = abs(fract(p / cell) - 0.5) * cell;
    return min(g.x, g.y) - w;
  }
  void main(){
    vec2 p = (vUv - 0.5) * ${MAP_SIZE.toFixed(1)};
    if (uUseImage > 0.5) {
      // imagem real: cor em gamma + grade genérica no alfa (formato do bake)
      vec2 gI = abs(fract((p + 3.5) / 42.0) - 0.5) * 42.0;
      gl_FragColor = vec4(pow(texture2D(uImage, vUv).rgb, vec3(1.0/2.2)), smoothstep(0.45, 0.0, min(gI.x, gI.y)));
      return;
    }
    float n = fbm(vec3(p * 0.012, 1.0));
    float n2 = fbm(vec3(p * 0.06, 3.0));
    // deserto com dunas
    vec3 sand = mix(vec3(0.66,0.52,0.36), vec3(0.82,0.69,0.5), n*0.5+0.5);
    sand *= 0.93 + 0.08 * sin(p.x*0.6 + p.y*0.25 + n2*5.0);
    sand = mix(sand, vec3(0.55,0.42,0.3), smoothstep(0.3,0.7, fbm(vec3(p*0.03, 11.0)))*0.35);
    // mancha urbana (densa no centro, rarefeita na periferia)
    float cityR = length(p*vec2(1.0,1.2) + vec2(n*30.0, n2*14.0));
    float city = smoothstep(108.0, 60.0, cityR);
    float density = smoothstep(110.0, 10.0, cityR);
    vec2 wp = p + vec2(fbm(vec3(p*0.006,7.0)), fbm(vec3(p*0.006,9.0))) * 5.0;
    float r1 = roads(wp, 7.0, 0.3);
    float r2 = roads(wp + 3.5, 42.0, 1.05); // avenidas
    float rd = min(r1, r2);
    float road = 1.0 - smoothstep(0.0, 0.18, rd);
    float sidewalk = 1.0 - smoothstep(0.0, 0.25, rd - 0.35);
    // lotes (sub-grade de cada quarteirão)
    float LS = 7.0 / 3.0;
    vec2 lotUv = fract(wp / LS);
    vec2 lotId = floor(wp / LS);
    float bh = hash12(lotId);
    float bh2 = hash12(lotId + 17.0);
    float ins = 0.1 + bh2 * 0.15;
    float lot = step(ins, lotUv.x) * step(ins, lotUv.y) * step(lotUv.x, 1.0 - ins*0.6) * step(lotUv.y, 1.0 - ins*0.6);
    float built = step(1.0 - density * 1.05, bh);
    vec3 roof = mix(vec3(0.83,0.76,0.64), vec3(0.6,0.55,0.48), bh2);
    roof = mix(roof, vec3(0.93,0.91,0.87), step(0.82, bh2));
    roof = mix(roof, vec3(0.62,0.38,0.26), step(0.93, bh) * 0.8);
    roof *= 0.92 + 0.08 * step(0.5, fract(lotUv.x * 3.0 + bh)); // telhado de duas águas
    // sombra projetada (sol baixo)
    vec2 sUv = fract((wp + vec2(0.32, 0.28)) / LS);
    float sh = step(ins, sUv.x) * step(ins, sUv.y) * step(sUv.x, 1.0 - ins*0.6) * step(sUv.y, 1.0 - ins*0.6);
    float shadow = sh * (1.0 - lot) * built * (0.45 + bh * 0.55);
    // piscinas e árvores nos quintais
    float pool = step(0.965, hash12(lotId + 5.0)) * smoothstep(0.13, 0.09, length(lotUv - vec2(0.82, 0.18)));
    float tree = step(0.62, hash12(lotId + 9.0)) * smoothstep(0.11, 0.05, length(lotUv - vec2(0.14, 0.86)));
    vec3 ground = mix(vec3(0.6,0.53,0.43), sand, 0.4);
    vec3 blocks = ground * (1.0 - shadow * 0.55);
    blocks = mix(blocks, vec3(0.3,0.38,0.22), tree * 0.9);
    blocks = mix(blocks, vec3(0.22,0.58,0.68), pool);
    blocks = mix(blocks, roof, lot * built);
    vec3 col = mix(sand, blocks, city);
    // pivôs irrigados fora da cidade
    vec2 pc = fract(p / 22.0) - 0.5;
    float pivot = smoothstep(0.42, 0.4, length(pc)) * step(0.55, hash12(floor(p / 22.0))) * step(0.15, fbm(vec3(p*0.012, 21.0))) * smoothstep(112.0, 130.0, cityR);
    col = mix(col, vec3(0.24,0.33,0.16) * (0.8 + n2*0.3), pivot * 0.85);
    // ruas e calçadas
    float roadMask = smoothstep(0.0, 0.3, city + 0.04);
    col = mix(col, vec3(0.7,0.66,0.6), sidewalk * roadMask * 0.55);
    col = mix(col, vec3(0.2,0.2,0.21), road * roadMask);
    // rodovia saindo da cidade
    float hw = abs(wp.y - wp.x * 0.35 - 8.0);
    col = mix(col, vec3(0.24,0.24,0.25), smoothstep(1.4, 1.0, hw) * (1.0 - city));
    // sombras de nuvens passando
    float cs = smoothstep(0.1, 0.5, fbm(vec3(p*0.008 + vec2(uTime*0.012, uTime*0.004), 5.0)));
    col *= 1.0 - cs * 0.42;
    gl_FragColor = vec4(col * 0.9, 1.0);
  }`;

/* --------- versão "assada" do mapa: gerada uma vez numa textura --------- */
const bakeFrag = mapFrag
  .replace('float cs = smoothstep(0.1, 0.5, fbm(vec3(p*0.008 + vec2(uTime*0.012, uTime*0.004), 5.0)));', 'float cs = 0.0;')
  .replace('    gl_FragColor = vec4(col * 0.9, 1.0);', `    vec2 gA = abs(fract((wp + 3.5) / 42.0) - 0.5) * 42.0;
    float avenue = smoothstep(0.45, 0.0, min(gA.x, gA.y));
    gl_FragColor = vec4(pow(clamp(col * 0.9, 0.0, 1.0), vec3(1.0/2.2)), avenue);`);

// Mapa em tempo real: lê a textura assada + sombras de nuvens (barato)
const mapRuntimeFrag = /* glsl */ `
  uniform float uTime; uniform sampler2D uMap;
  varying vec2 vUv;
  ${noise}
  void main(){
    vec2 p = (vUv - 0.5) * ${MAP_SIZE.toFixed(1)};
    vec3 col = pow(texture2D(uMap, vUv).rgb, vec3(2.2));
    float cs = smoothstep(0.1, 0.5, fbm3(vec3(p*0.008 + vec2(uTime*0.012, uTime*0.004), 5.0)));
    col *= 1.0 - cs * 0.42;
    gl_FragColor = vec4(col, 1.0);
  }`;

/* --------- grid de infraestrutura: linhas sobre as ruas com pulsos --------- */
const gridFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform vec2 uNode; uniform sampler2D uMap;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * ${MAP_SIZE.toFixed(1)};
    vec2 wp = p;
    float line = texture2D(uMap, vUv).a;
    float d = length(p - uNode);
    // ondas de dados saindo do nó
    float wave = smoothstep(3.0, 0.0, abs(fract(d / 60.0 - uTime * 0.25) - 0.5) * 60.0);
    float pulseX = smoothstep(2.5, 0.0, abs(fract(wp.x / 70.0 + uTime * 0.18) - 0.5) * 70.0);
    float pulseY = smoothstep(2.5, 0.0, abs(fract(wp.y / 70.0 - uTime * 0.14) - 0.5) * 70.0);
    float fade = smoothstep(190.0, 60.0, d);
    float a = line * (0.25 + wave * 1.5 + (pulseX + pulseY) * 0.9) * fade * uOpacity;
    vec3 col = mix(vec3(0.3,0.75,1.0), vec3(1.0,0.75,0.4), wave);
    gl_FragColor = vec4(col * a * 1.8, a);
  }`;

/* --------- nuvens (planos com fbm) --------- */
const cloudFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uSeed;
  varying vec2 vUv;
  ${noise}
  void main(){
    vec2 c = vUv - 0.5;
    float n = fbm(vec3(vUv*3.0 + vec2(uTime*0.01, 0.0), uSeed));
    float a = smoothstep(0.5, 0.15, length(c)) * smoothstep(-0.05, 0.45, n);
    vec3 col = mix(vec3(0.62,0.64,0.7), vec3(0.88), smoothstep(0.1,0.6,n));
    gl_FragColor = vec4(col, a * uOpacity);
  }`;

/* --------- fundo do diamante: azul-acinzentado com cáusticas --------- */
const bgFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity;
  varying vec2 vUv;
  ${noise}
  // cáusticas de água (rede fina de luz)
  float caustic(vec2 uv){
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 5; n++) {
      float t = uTime * 0.25 * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 5.0;
    c = 1.17 - pow(max(c, 0.0), 1.4);
    return pow(abs(c), 8.0);
  }
  void main(){
    vec2 p = vUv - 0.5;
    vec3 top = vec3(0.34,0.43,0.52);
    vec3 bot = vec3(0.12,0.16,0.21);
    vec3 col = mix(bot, top, smoothstep(-0.5, 0.6, p.y));
    float cs = caustic(p * 1.6 + 0.3);
    col += vec3(0.85,0.93,1.0) * clamp(cs, 0.0, 1.5) * 0.16 * smoothstep(0.6, 0.05, length(p));
    col *= 1.0 - dot(p,p)*0.9;
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }`;

const shaftFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uSeed;
  varying vec2 vUv;
  void main(){
    float x = abs(vUv.x - 0.5) * 2.0;
    float a = pow(max(1.0 - x, 0.0), 3.0) * smoothstep(0.0, 0.6, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    a *= 0.6 + 0.4 * sin(uTime * 0.7 + uSeed * 6.0);
    gl_FragColor = vec4(vec3(0.9,0.95,1.0) * a * uOpacity * 0.55, a * uOpacity);
  }`;

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

/* --------- geometria de diamante lapidado --------- */
function diamondGeometry(r = 1, segments = 32) {
  // perfil de uma lapidação brilhante redonda (proporções de Tolkowsky)
  const pts = [
    new THREE.Vector2(0.0001, -0.86 * r), // culet
    new THREE.Vector2(r * 0.52, -0.42 * r), // facetas inferiores do pavilhão
    new THREE.Vector2(r * 1.0, -0.02 * r), // cintura
    new THREE.Vector2(r * 1.0, 0.02 * r),
    new THREE.Vector2(r * 0.8, 0.2 * r), // facetas superiores da coroa
    new THREE.Vector2(r * 0.56, 0.32 * r), // estrela
    new THREE.Vector2(0.0001, 0.32 * r), // mesa
  ];
  const g = new THREE.LatheGeometry(pts, segments);
  return g.toNonIndexed(); // facetado (normais por face)
}

export class DiamondMapScene extends BaseScene {
  async build() {
    const s = this.scene;
    const ctx = this.ctx;
    const rand = rng(23);
    s.environment = ctx.envMap;
    this.camera.far = 2000;
    this.camera.updateProjectionMatrix();

    /* ---------------- parte A: diamante ---------------- */
    this.partA = new THREE.Group();
    s.add(this.partA);

    this.bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: vert,
      fragmentShader: bgFrag,
    });
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(120, 70), this.bgMat);
    this.bg.position.set(0, 0, -30);
    this.partA.add(this.bg);

    // raios de luz (light shafts)
    this.shafts = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uSeed: { value: rand() } },
        vertexShader: vert,
        fragmentShader: shaftFrag,
      });
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2 + rand() * 3, 40), m);
      sh.position.set(-8 + i * 2.6 + rand(), 10, -12 - rand() * 6);
      sh.rotation.z = -0.35 + rand() * 0.15;
      this.shafts.push(sh);
      this.partA.add(sh);
    }

    // diamante de vidro (transmissão física + dispersão)
    const model = ctx.assets.model('diamond');
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 1.4,
      ior: 2.2,
      dispersion: 4,
      iridescence: 0.35,
      iridescenceIOR: 1.6,
      specularIntensity: 1,
      envMapIntensity: 2.2,
      flatShading: true,
      attenuationColor: new THREE.Color(0.85, 0.92, 1.0),
      attenuationDistance: 3,
    });
    this.glass = glass;
    this.diamond = model ? model.scene : new THREE.Mesh(diamondGeometry(1.7, 32), glass);
    this.partA.add(this.diamond);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 6, 4);
    const rim = new THREE.PointLight(0x9fc4ff, 30, 30);
    rim.position.set(-4, 2, -3);
    this.partA.add(key, rim);
    this.diamondGlow = glowSprite(new THREE.Color(1.2, 1.25, 1.4), 9, 0.25);
    this.diamondGlow.position.z = -1.5;
    this.diamond.add(this.diamondGlow);

    /* ---------------- parte B: mapa ---------------- */
    this.partB = new THREE.Group();
    s.add(this.partB);
    const cityTex = ctx.assets.texture('cityMap');
    this.mapTex = await this.bakeMap(cityTex);
    if (this.mapTex) {
      this.mapMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uMap: { value: this.mapTex } },
        vertexShader: vert,
        fragmentShader: mapRuntimeFrag,
      });
    } else {
      // plano B: mapa calculado ao vivo (mais pesado, mas sempre visível)
      this.mapMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uImage: { value: cityTex }, uUseImage: { value: cityTex ? 1 : 0 } },
        vertexShader: vert,
        fragmentShader: mapFrag,
      });
      const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      fallback.needsUpdate = true;
      this.mapTex = fallback;
    }
    // deserto além das bordas do mapa (vistas mais altas)
    const desert = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE * 6, MAP_SIZE * 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.5, 0.36).multiplyScalar(0.62) })
    );
    desert.rotation.x = -Math.PI / 2;
    desert.position.y = -0.2;
    this.partB.add(desert);
    const map = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), this.mapMat);
    map.rotation.x = -Math.PI / 2;
    this.partB.add(map);

    this.gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uNode: { value: new THREE.Vector2(NODE.x, -NODE.z) }, uMap: { value: this.mapTex } },
      vertexShader: vert,
      fragmentShader: gridFrag,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), this.gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.05;
    this.partB.add(grid);

    // nuvens em camadas (parallax)
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.55 }, uSeed: { value: rand() * 10 } },
        vertexShader: vert,
        fragmentShader: cloudFrag,
      });
      const c = new THREE.Mesh(new THREE.PlaneGeometry(60 + rand() * 50, 60 + rand() * 50), m);
      c.rotation.x = -Math.PI / 2;
      c.position.set(-120 + rand() * 240, 26 + rand() * 30, -120 + rand() * 200);
      c.userData.speed = 1 + rand() * 1.5;
      this.clouds.push(c);
      this.partB.add(c);
    }

    // diamante destino + mini-diamantes nos outros nós
    const small = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      transmission: 0.9,
      thickness: 0.6,
      ior: 2,
      envMapIntensity: 3,
      flatShading: true,
      emissive: 0x334455,
    });
    this.nodeDiamond = new THREE.Mesh(diamondGeometry(1, 24), small);
    this.partB.add(this.nodeDiamond);
    this.beam = this.makeBeam(new THREE.Color(1.0, 0.85, 0.6), 2.2);
    this.beam.position.copy(NODE);
    this.partB.add(this.beam);
    this.nodeGlow = glowSprite(new THREE.Color(1.4, 1.1, 0.7), 14, 0);
    this.nodeGlow.position.copy(NODE).setY(1);
    this.partB.add(this.nodeGlow);

    this.minis = [];
    const spots = [
      [-40, -30],
      [55, 25],
      [-25, 45],
      [70, -55],
      [-70, 10],
      [10, 60],
      [35, -70],
    ];
    spots.forEach(([x, z], i) => {
      const d = new THREE.Mesh(diamondGeometry(0.7, 16), small);
      d.position.set(x, 3, z);
      d.userData.delay = i * 0.08;
      const b = this.makeBeam(new THREE.Color(0.5, 0.8, 1.2), 1.1);
      b.position.set(x, 0, z);
      d.userData.beam = b;
      this.partB.add(d, b);
      this.minis.push(d);
    });

    this.partB.add(new THREE.HemisphereLight(0xdde8ff, 0x6b5a44, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.5);
    sun.position.set(40, 80, 30);
    this.partB.add(sun);

    // Câmera A (diamante) e B (mapa) — trocadas no flash
    this.pathA = new CameraPath([
      { t: 0, pos: [0, 0.6, 14], target: [0, 0, 0], fov: 40 },
      { t: 1, pos: [0, 1.6, 7.5], target: [0, -0.4, 0], fov: 38 },
    ]);
    this.pathB = new CameraPath([
      { t: 0.0, pos: [0, 260, 40], target: [0, 0, 0], fov: 45 },
      { t: 0.35, pos: [8, 120, 30], target: [14, 0, -8], fov: 45 },
      { t: 0.7, pos: [30, 82, 46], target: [18, 0, -10], fov: 42 },
      { t: 1.0, pos: [44, 70, 62], target: [16, 0, -16], fov: 40 },
    ]);

    this.flash = 0;
    this.tmp = new THREE.Vector3();
  }

  // Renderiza o mapa procedural (caro) uma única vez numa textura com mipmaps
  /*
   * Renderiza o mapa procedural (caro) numa textura com mipmaps.
   * Feito em blocos pequenos espalhados por vários quadros: um único desenho de
   * 4096² com esse shader pode estourar o tempo limite da GPU (watchdog do Chrome
   * em GPUs integradas) e deixar a textura preta. No fim, confere alguns pixels;
   * se falhar, retorna null e a cena usa o shader ao vivo.
   */
  async bakeMap(image) {
    const renderer = this.ctx.renderer;
    const size = this.ctx.sizes.mobile ? 2048 : 4096;
    const TILE = 512;
    const PER_FRAME = 2; // blocos por quadro
    const work = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, generateMipmaps: false });
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uImage: { value: image }, uUseImage: { value: image ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: bakeFrag,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const cam = new THREE.Camera();
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const autoClear = renderer.autoClear;

    const drawTiles = async (tiles) => {
      for (let i = 0; i < tiles.length; i++) {
        const [x, y] = tiles[i];
        const prev = renderer.getRenderTarget();
        renderer.autoClear = false;
        work.scissorTest = true;
        work.scissor.set(x, y, TILE, TILE);
        renderer.setRenderTarget(work);
        renderer.render(scene, cam);
        work.scissorTest = false;
        renderer.setRenderTarget(prev);
        renderer.autoClear = autoClear;
        if (i % PER_FRAME === PER_FRAME - 1) await nextFrame();
      }
    };
    const allTiles = [];
    for (let y = 0; y < size; y += TILE) for (let x = 0; x < size; x += TILE) allTiles.push([x, y]);

    // confere o centro de cada bloco; devolve os blocos que vieram vazios
    const px = new Uint8Array(4);
    const emptyTiles = (tiles) =>
      tiles.filter(([x, y]) => {
        renderer.readRenderTargetPixels(work, x + (TILE >> 1), y + (TILE >> 1), 1, 1, px);
        return px[0] + px[1] + px[2] === 0;
      });

    await drawTiles(allTiles);
    let bad = emptyTiles(allTiles);
    if (bad.length) {
      console.warn(`[map] ${bad.length} blocos vazios no bake — refazendo`);
      await nextFrame();
      await drawTiles(bad);
      bad = emptyTiles(bad);
    }
    mat.dispose();
    quad.geometry.dispose();
    if (bad.length) {
      console.warn('[map] bake falhou — usando o mapa procedural ao vivo');
      work.dispose();
      return null;
    }

    // cópia única para a textura final, que gera os mipmaps de uma vez
    const rt = new THREE.WebGLRenderTarget(size, size, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const copy = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { tSrc: { value: work.texture } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tSrc, vUv); }',
        depthTest: false,
        depthWrite: false,
      })
    );
    copy.frustumCulled = false;
    const copyScene = new THREE.Scene();
    copyScene.add(copy);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(copyScene, cam);
    renderer.setRenderTarget(prev);
    copy.geometry.dispose();
    copy.material.dispose();
    work.dispose();
    this.mapRT = rt;
    return rt.texture;
  }


  makeBeam(color, width) {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: color } },
      vertexShader: vert,
      fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float x = abs(vUv.x-0.5)*2.0; float a = pow(max(1.0-x,0.0),2.0)*pow(max(1.0-vUv.y,0.0),1.5)*uOpacity;
        gl_FragColor = vec4(uColor*a*2.0, a); }`,
    });
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(width, 60), m);
      p.position.y = 30;
      p.rotation.y = (i * Math.PI) / 2;
      g.add(p);
    }
    g.userData.mat = m;
    return g;
  }

  /*
   * Linha do tempo local (0..1 da faixa 0.14–0.28):
   *   0.00–0.32  diamante girando, raios de luz
   *   0.32–0.42  diamante mergulha (zoom) → flash
   *   0.40–1.00  mapa: descida, diamante chega ao nó (≈0.62), mini-diamantes
   */
  update(l, dt, time, global) {
    const cam = this.camera;
    const dive = range(l, 0.3, 0.42);
    const showB = l > 0.405;
    this.partA.visible = !showB;
    this.partB.visible = showB;

    // flash de luz no mergulho (HDR → bloom)
    this.flash = Math.pow(1 - Math.abs(range(l, 0.37, 0.45) * 2 - 1), 3) * (l > 0.37 && l < 0.45 ? 1 : 0);
    this.bloomBoost = 1 + this.flash * 3;

    if (!showB) {
      const a = range(l, 0, 0.3);
      this.pathA.apply(cam, a);
      // diamante: gira e "mergulha" em direção à câmera-baixo
      const d = this.diamond;
      d.rotation.y = time * 0.35 + l * 4;
      d.rotation.x = 0.25 + Math.sin(time * 0.5) * 0.06;
      const e = easeInOut(dive);
      d.position.set(0, Math.sin(time * 0.8) * 0.1 - e * 4.5, e * 4);
      d.scale.setScalar(1 + e * 0.6);
      this.diamondGlow.material.opacity = 0.2 + e * 0.8 + this.flash;
      this.bgMat.uniforms.uTime.value = time;
      this.bgMat.uniforms.uOpacity.value = 1 + this.flash * 4;
      this.shafts.forEach((sh) => {
        sh.material.uniforms.uTime.value = time;
        sh.material.uniforms.uOpacity.value = 1 + this.flash * 3;
      });
      this.glass.emissive = this.glass.emissive || new THREE.Color();
      this.glass.emissive.setScalar(this.flash * 2);
      this.ctx.cameraFX.applyParallax(cam, 0.6);
      return;
    }

    // ---- mapa ----
    const b = range(l, 0.405, 1);
    this.pathB.apply(cam, b);
    this.ctx.cameraFX.applyParallax(cam, 3);
    this.mapMat.uniforms.uTime.value = time;
    this.gridMat.uniforms.uTime.value = time;
    this.gridMat.uniforms.uOpacity.value = smoothstep(0.45, 0.6, l);

    // diamante desce do céu até o nó
    const arrive = easeOut(range(l, 0.42, 0.62));
    this.nodeDiamond.position.set(NODE.x, 180 * (1 - arrive) + 4 + Math.sin(time * 1.2) * 0.4, NODE.z);
    this.nodeDiamond.rotation.y = time * 0.8;
    this.nodeDiamond.scale.setScalar(2.2);
    const landed = smoothstep(0.6, 0.64, l);
    this.beam.userData.mat.uniforms.uOpacity.value = landed;
    this.nodeGlow.material.opacity = landed * (0.6 + Math.sin(time * 3) * 0.15);

    // mini-diamantes surgem em outros pontos
    this.minis.forEach((d) => {
      const k = easeOut(range(l, 0.66 + d.userData.delay * 0.6, 0.72 + d.userData.delay * 0.6));
      d.scale.setScalar(Math.max(0.0001, k * 1.6));
      d.rotation.y = time + d.userData.delay * 10;
      d.position.y = 3 + Math.sin(time + d.userData.delay * 20) * 0.3;
      d.userData.beam.userData.mat.uniforms.uOpacity.value = k * 0.7;
    });

    // nuvens passando (parallax pela altura)
    this.clouds.forEach((c) => {
      c.material.uniforms.uTime.value = time;
      c.position.x += dt * c.userData.speed * 2;
      if (c.position.x > 160) c.position.x = -160;
      c.material.uniforms.uOpacity.value = 0.55 * (1 - smoothstep(0.75, 1, b) * 0.6);
    });

    // âncora do nó para label e HUD
    this.tmp.copy(NODE).setY(4);
    this.ctx.labels.setAnchor('mapNode', this.tmp, cam);
  }
}
