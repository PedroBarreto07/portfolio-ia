import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from './BaseScene.js';
import { CameraPath } from '../managers/CameraController.js';
import { noise } from '../shaders/noise.js';
import { glowSprite, particleMaterial, randomPointsGeometry, solarTexture } from './helpers.js';
import { easeInOut, rng, smoothstep, windowFade } from '../core/math.js';
import { ASSETS } from '../config.js';

const R = 100; // raio da Terra (unidades da cena)
const EARTH_C = new THREE.Vector3(0, -106, -40);
const SUN = new THREE.Vector3(0.85, 0.42, -0.32).normalize();

/* ---------------------------- shaders ---------------------------- */
const earthVert = /* glsl */ `
  varying vec3 vObj; varying vec3 vNw; varying vec3 vWp;
  void main(){
    vObj = normalize(position);
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position,1.0);
    vWp = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const earthFrag = /* glsl */ `
  uniform vec3 uSun; uniform float uTime; uniform vec3 uCam;
  varying vec3 vObj; varying vec3 vNw; varying vec3 vWp;
  ${noise}
  void main(){
    vec3 p = vObj;
    vec3 N = normalize(vNw);
    vec3 V = normalize(uCam - vWp);
    float ndl = dot(N, uSun);

    // continentes
    float c = fbm(p*6.5) + 0.4*fbm(p*21.0+3.1);
    float land = smoothstep(0.22, 0.28, c);
    float detail = fbm(p*48.0);
    vec3 ocean = mix(vec3(0.004,0.018,0.05), vec3(0.01,0.05,0.12), smoothstep(-0.2,0.1,c));
    vec3 green = vec3(0.045,0.075,0.035);
    vec3 desert = vec3(0.15,0.12,0.08);
    vec3 landCol = mix(green, desert, smoothstep(-0.25,0.35,detail + fbm(p*9.0)*0.6));
    landCol *= 0.8 + 0.4*fbm(p*120.0);
    float ice = smoothstep(0.72, 0.8, abs(p.y) + detail*0.06);
    vec3 surf = mix(ocean, landCol, land);
    surf = mix(surf, vec3(0.75,0.8,0.85), ice);

    // nuvens (girando devagar)
    vec3 cp = p*13.0 + vec3(uTime*0.006, 0.0, uTime*0.003);
    float cl = fbm(cp) + 0.55*fbm(cp*3.3) + 0.25*fbm(cp*9.0);
    float clouds = smoothstep(0.32, 0.8, cl);
    float cloudShadow = smoothstep(0.32, 0.8, fbm(cp + vec3(0.03,0.0,0.0)) + 0.55*fbm(cp*3.3));

    float day = smoothstep(-0.15, 0.25, ndl);
    float diff = max(ndl, 0.0);
    vec3 col = surf * (diff*1.25 + 0.012) * (1.0 - cloudShadow*0.55*(1.0-clouds));

    // brilho especular do oceano
    vec3 H = normalize(uSun + V);
    float spec = pow(max(dot(N,H),0.0), 60.0) * (1.0-land) * (1.0-clouds);
    col += vec3(1.0,0.85,0.65) * spec * 2.2 * diff;

    // nuvens iluminadas
    col = mix(col, vec3(1.0,0.98,0.95) * (diff*1.05 + 0.008), clouds*0.9);

    // luzes de cidades no lado noturno
    float cities = smoothstep(0.5, 0.85, fbm(p*150.0)) * smoothstep(0.0,0.4,fbm(p*30.0)) * land * (1.0-ice);
    col += vec3(1.0,0.6,0.25) * cities * (1.0-day) * (1.0-clouds) * 1.6;

    // terminador alaranjado + atmosfera na borda
    float fres = pow(1.0 - max(dot(N,V),0.0), 7.0);
    float sunset = smoothstep(-0.1,0.02,ndl)*smoothstep(0.12,0.0,ndl);
    col += vec3(1.0,0.45,0.15) * sunset * 0.035;
    col = mix(col, vec3(0.25,0.55,1.0) * (0.1 + diff*1.1), fres * 0.8 * smoothstep(-0.25,0.2,ndl));
    col += vec3(0.05,0.12,0.25) * (0.3 + diff) * 0.25; // espalhamento atmosférico

    gl_FragColor = vec4(col, 1.0);
  }`;

const atmoFrag = /* glsl */ `
  uniform vec3 uSun; uniform float uEdge; uniform vec3 uCam;
  varying vec3 vNw; varying vec3 vWp;
  void main(){
    // |N·V| na face de trás: 0 na borda da casca, uEdge rente ao limbo da Terra
    float z = abs(dot(normalize(vNw), normalize(uCam - vWp)));
    float a = pow(clamp(z / uEdge, 0.0, 1.0), 2.2);
    float l = smoothstep(-0.35, 0.45, dot(normalize(vNw), uSun));
    vec3 col = mix(vec3(0.22,0.5,1.0), vec3(0.55,0.8,1.2), l) * (0.15 + l*1.65);
    gl_FragColor = vec4(col * a, a);
  }`;
const atmoVert = /* glsl */ `
  varying vec3 vNw; varying vec3 vWp;
  void main(){
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position,1.0);
    vWp = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const nebulaFrag = /* glsl */ `
  uniform float uTime; varying vec3 vDir;
  ${noise}
  void main(){
    vec3 d = normalize(vDir);
    float n = fbm(d*2.5 + vec3(0.0, uTime*0.003, 0.0));
    float n2 = fbm(d*6.0 + 4.0);
    float band = smoothstep(0.65, 0.0, abs(d.y - 0.25 + n*0.25));
    vec3 col = mix(vec3(0.03,0.02,0.08), vec3(0.02,0.07,0.14), n2*0.5+0.5) * band * (0.6 + n);
    col += vec3(0.08,0.03,0.12) * smoothstep(0.3,0.8,n2) * band * 0.6;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

const auroraFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; varying vec2 vUv;
  ${noise}
  void main(){
    float curtain = fbm3(vec3(vUv.x*18.0, uTime*0.12, 0.0))*0.5+0.5;
    float rays = pow(clamp(snoise(vec3(vUv.x*90.0, uTime*0.4, 1.0))*0.5+0.5, 0.0, 1.0), 3.0);
    float h = vUv.y;
    float base = smoothstep(0.0, 0.08, h) * pow(max(1.0 - h, 0.0), 2.2);
    float a = base * (curtain*0.8 + rays*0.6) * smoothstep(0.0,0.15,vUv.x) * smoothstep(1.0,0.85,vUv.x);
    vec3 col = mix(vec3(0.1,1.0,0.55), vec3(0.45,0.25,1.0), smoothstep(0.25, 0.9, h));
    gl_FragColor = vec4(col * a * 1.6 * uOpacity, a * uOpacity);
  }`;

const plexusVert = /* glsl */ `
  attribute float aT; attribute float aSeed;
  varying float vT; varying float vSeed; varying vec3 vWp;
  void main(){
    vT = aT; vSeed = aSeed;
    vec4 wp = modelMatrix * vec4(position,1.0);
    vWp = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const plexusFrag = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uScan; uniform vec3 uColor; uniform vec3 uPulse;
  varying float vT; varying float vSeed; varying vec3 vWp;
  void main(){
    float pulse = smoothstep(0.09, 0.0, abs(fract(uTime*0.35 + vSeed) - vT));
    float scan = smoothstep(6.0, 0.0, abs(vWp.x - uScan));
    vec3 col = uColor * 0.5 + uPulse * (pulse * 1.4 + scan * 1.1);
    float a = (0.18 + pulse*0.55 + scan*0.4) * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }`;

/* ---------------- Terra com dados reais da NASA ---------------- */
const earthTexFrag = /* glsl */ `
  uniform sampler2D uDay; uniform sampler2D uDetail; uniform sampler2D uNight;
  uniform sampler2D uClouds; uniform sampler2D uCloudsDetail;
  uniform vec4 uBounds; uniform float uHasDetail;
  uniform vec3 uSun; uniform vec3 uCam; uniform float uTime; uniform float uCloudShift;
  varying vec2 vUv; varying vec3 vNw; varying vec3 vWp;
  ${noise}
  void main(){
    vec2 uv = vUv;
    // região "herói" em alta resolução (Blue Marble 21600 recortado)
    float lon = uv.x * 360.0 - 180.0;
    float lat = uv.y * 180.0 - 90.0;
    vec2 duv = vec2((lon - uBounds.x) / (uBounds.y - uBounds.x), (lat - uBounds.w) / (uBounds.z - uBounds.w));
    float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
    float edge = inside * uHasDetail * smoothstep(0.0, 0.05, duv.x) * smoothstep(1.0, 0.95, duv.x) * smoothstep(0.0, 0.05, duv.y) * smoothstep(1.0, 0.95, duv.y);
    vec2 cduv = clamp(duv, 0.0, 1.0);
    vec3 day = mix(texture2D(uDay, uv).rgb, texture2D(uDetail, cduv).rgb, edge);

    // nuvens reais (deriva lenta) + detalhe fino procedural
    vec2 cuv = uv + vec2(uCloudShift, 0.0);
    vec2 dscale = vec2(360.0 / (uBounds.y - uBounds.x), 180.0 / (uBounds.z - uBounds.w));
    vec2 cduv2 = clamp(duv + vec2(uCloudShift, 0.0) * dscale, 0.0, 1.0);
    float cl = mix(texture2D(uClouds, cuv).r, texture2D(uCloudsDetail, cduv2).r, edge);
    float fine = snoise(vec3(uv * vec2(900.0, 450.0), 1.0)) * 0.5 + 0.5;
    float clouds = smoothstep(0.1, 0.85, cl + (fine - 0.5) * 0.12 * cl);
    // sombra das nuvens (amostra deslocada)
    vec2 sh = vec2(0.0009, 0.0006);
    float clShadow = mix(texture2D(uClouds, cuv - sh).r, texture2D(uCloudsDetail, clamp(cduv2 - sh * dscale, 0.0, 1.0)).r, edge);

    vec3 N = normalize(vNw);
    vec3 V = normalize(uCam - vWp);
    vec3 L = uSun;
    float ndl = dot(N, L);
    float lit = max(ndl, 0.0);

    // superfície
    vec3 dayG = sqrt(max(day, 0.0));
    float ocean = smoothstep(0.03, 0.12, dayG.b - dayG.r) * smoothstep(0.55, 0.25, dayG.g);
    vec3 col = day * (lit * 2.3 + 0.002) * (1.0 - smoothstep(0.1, 0.8, clShadow) * 0.55 * (1.0 - clouds));

    // reflexo do sol no oceano
    vec3 H = normalize(L + V);
    float nh = max(dot(N, H), 0.0);
    float spec = pow(nh, 220.0) * 6.0 + pow(nh, 30.0) * 0.35;
    col += vec3(1.0, 0.9, 0.75) * spec * ocean * (1.0 - clouds) * lit;

    // nuvens iluminadas
    vec3 cloudCol = vec3(1.0, 0.99, 0.97) * (lit * 2.15 + 0.003);
    col = mix(col, cloudCol, clouds * 0.95);

    // tom quente no nascer do sol
    col *= mix(vec3(1.0, 0.62, 0.42), vec3(1.0), smoothstep(0.0, 0.35, ndl));

    // luzes noturnas (Black Marble)
    vec3 night = texture2D(uNight, uv).rgb;
    float nightF = smoothstep(0.1, -0.12, ndl);
    col += night * night * 4.0 * vec3(1.0, 0.78, 0.5) * nightF * (1.0 - clouds * 0.85);

    // atmosfera (espalhamento ao longo do caminho óptico)
    float mu = max(dot(N, V), 0.0);
    float haze = 1.0 - exp(-0.09 / (mu + 0.035));
    float atmLit = smoothstep(-0.25, 0.35, ndl);
    vec3 atm = mix(vec3(0.95, 0.45, 0.2), vec3(0.32, 0.56, 1.0), smoothstep(-0.05, 0.3, ndl));
    col = mix(col, atm * (0.05 + lit * 1.5), clamp(haze, 0.0, 1.0) * 0.78 * atmLit);

    gl_FragColor = vec4(col, 1.0);
  }`;
const earthTexVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vNw; varying vec3 vWp;
  void main(){
    vUv = uv;
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWp = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// Céu: mapa estelar da NASA (equiretangular) com fundo escurecido
const starsFrag = /* glsl */ `
  uniform sampler2D uStars; uniform float uIntensity; varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5);
    vec3 c = texture2D(uStars, uv).rgb;
    c = max(c - 0.012, 0.0) * 1.05;
    c = c * c * 2.2 + c * 0.25;
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }`;

// Ponto (lat, lon) → direção no espaço do objeto (mesmo mapeamento UV da SphereGeometry)
function latLonToObj(lat, lon) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = (1 - (lat + 90) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

/* ------------------------------ cena ------------------------------ */
export class OrbitScene extends BaseScene {
  async build() {
    const s = this.scene;
    this.camera.far = 3000;
    this.camera.updateProjectionMatrix();
    const rand = rng(11);
    s.environment = this.buildSpaceEnv();
    s.environmentIntensity = 1;

    // luzes para o satélite
    s.add(new THREE.AmbientLight(0x223344, 0.6));
    const sunLight = new THREE.DirectionalLight(0xfff1dd, 4.2);
    sunLight.position.copy(SUN).multiplyScalar(100);
    s.add(sunLight);
    // preenchimento vindo do lado da câmera (luz refletida pela Terra/lua) para o satélite não ficar em contraluz
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.6);
    fill.position.set(-0.5, 0.4, 1);
    s.add(fill);
    const earthBounce = new THREE.DirectionalLight(0x3a6dff, 0.9);
    earthBounce.position.set(0, -1, 0.2);
    s.add(earthBounce);

    const starTex = this.ctx.assets.texture('starmap');
    if (starTex) {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1500, 64, 32),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          uniforms: { uStars: { value: starTex }, uIntensity: { value: 1 } },
          vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
          fragmentShader: starsFrag,
        })
      );
      sky.rotation.set(0.6, 2.2, -0.3); // Via Láctea cruzando o céu atrás da Terra
      s.add(sky);
    }
    // fundo procedural: nebulosa + estrelas
    const neb = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: nebulaFrag,
      })
    );
    this.nebula = neb;
    if (!starTex) s.add(neb);

    const starGeo = randomPointsGeometry(
      3500,
      (v) => {
        v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(1200);
      },
      rand
    );
    this.starMat = particleMaterial({ size: starTex ? 14 : 26, twinkle: 0.6, color: new THREE.Color(1.2, 1.2, 1.3), opacity: starTex ? 0.35 : 1 });
    s.add(new THREE.Points(starGeo, this.starMat));

    // Terra
    const A = this.ctx.assets;
    const day = A.texture('earthDay');
    this.textured = !!day;
    if (this.textured) {
      const detail = A.texture('earthDayDetail');
      const b = ASSETS.earthDetail;
      const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      black.needsUpdate = true;
      const aniso = this.ctx.renderer.capabilities.getMaxAnisotropy();
      [day, detail].forEach((t) => t && (t.anisotropy = aniso));
      this.earthMat = new THREE.ShaderMaterial({
        uniforms: {
          uDay: { value: day },
          uDetail: { value: detail || day },
          uNight: { value: A.texture('earthNight') || black },
          uClouds: { value: A.texture('earthClouds') || black },
          uCloudsDetail: { value: A.texture('earthCloudsDetail') || A.texture('earthClouds') || black },
          uBounds: { value: new THREE.Vector4(b.lon0, b.lon1, b.lat0, b.lat1) },
          uHasDetail: { value: detail ? 1 : 0 },
          uSun: { value: SUN },
          uCam: { value: new THREE.Vector3() },
          uTime: { value: 0 },
          uCloudShift: { value: 0 },
        },
        vertexShader: earthTexVert,
        fragmentShader: earthTexFrag,
      });
    } else {
      this.earthMat = new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SUN }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
        vertexShader: earthVert,
        fragmentShader: earthFrag,
      });
    }
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 192), this.earthMat);
    earth.position.copy(EARTH_C);
    if (this.textured) earth.quaternion.copy(this.earthOrientation());
    else earth.rotation.set(0.35, 0.8, 0.1);
    this.earth = earth;
    s.add(earth);

    const atmoR = R * 1.028;
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(atmoR, 128, 96),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uSun: { value: SUN }, uEdge: { value: Math.sqrt(1 - (R / atmoR) ** 2) }, uCam: { value: new THREE.Vector3() } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
      })
    );
    atmo.position.copy(EARTH_C);
    this.atmo = atmo;
    s.add(atmo);

    // Aurora: cortina em arco sobre o horizonte distante
    this.auroraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.8 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: auroraFrag,
    });
    const aurora = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.88, R * 0.9, 16, 160, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      this.auroraMat
    );
    aurora.position.copy(EARTH_C).add(new THREE.Vector3(0, R * 0.47 + 8, 0));
    if (!this.textured) s.add(aurora);

    // Sol + flare anamórfico
    const sunPos = SUN.clone().multiplyScalar(900).add(new THREE.Vector3(0, -60, 0));
    const sun = glowSprite(new THREE.Color(1.3, 1.15, 0.95), 180);
    sun.position.copy(sunPos);
    const streak = glowSprite(new THREE.Color(0.6, 0.8, 1.4), 1, 0.5);
    streak.scale.set(1400, 18, 1);
    streak.position.copy(sunPos);
    s.add(sun, streak);

    // Satélite
    this.sat = this.buildSatellite();
    s.add(this.sat);
    this.halo = glowSprite(new THREE.Color(0.7, 0.85, 1.3), 3.2, 0.0);
    this.sat.add(this.halo);

    // Plexus: nós em órbita conectados por linhas finas
    this.buildPlexus(rand);

    this.path = new CameraPath([
      { t: 0.0, pos: [0, 1.4, 17], target: [-2.6, -1.2, 0], fov: 42 },
      { t: 0.4, pos: [-0.6, 1.0, 13], target: [-2.4, -0.6, 0], fov: 40 },
      { t: 0.6, pos: [4.2, 1.6, 9.2], target: [0.9, 0.0, 0], fov: 38 },
      { t: 0.8, pos: [6.5, 3.2, 3.5], target: [1.5, -9, -34], fov: 44 },
      { t: 1.0, pos: [4.0, -3.2, -22], target: [3, -22, -64], fov: 58 },
    ]);
    this.hovering = false;
    this.ray = new THREE.Raycaster();
    this.tmp = new THREE.Vector3();
  }

  // Gira o globo para que ASSETS.earthNadir fique sob o satélite e o leste aponte para o sol
  earthOrientation() {
    const { lat, lon } = ASSETS.earthNadir;
    const P = latLonToObj(lat, lon);
    const phi = ((lon + 180) / 360) * Math.PI * 2;
    const E = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
    const Nn = new THREE.Vector3().crossVectors(P, E).normalize();
    const U = new THREE.Vector3().copy(EARTH_C).negate().normalize();
    const Ew = SUN.clone().addScaledVector(U, -SUN.dot(U)).normalize();
    const Nw = new THREE.Vector3().crossVectors(U, Ew).normalize();
    const Mo = new THREE.Matrix4().makeBasis(E, Nn, P);
    const Mw = new THREE.Matrix4().makeBasis(Ew, Nw, U);
    return new THREE.Quaternion().setFromRotationMatrix(Mw.multiply(Mo.transpose()));
  }

  // Ambiente de reflexo: espaço negro, Terra azul embaixo e o sol
  buildSpaceEnv() {
    const env = new THREE.Scene();
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uSun: { value: SUN }, uDown: { value: EARTH_C.clone().normalize() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uSun; uniform vec3 uDown; varying vec3 vDir;
        void main(){
          float down = dot(vDir, uDown);
          vec3 earth = mix(vec3(0.08,0.16,0.3), vec3(0.55,0.65,0.8), smoothstep(0.2, 0.9, down)) * smoothstep(0.25, 0.4, down);
          float limb = smoothstep(0.32, 0.38, down) * smoothstep(0.48, 0.38, down);
          vec3 c = earth * 0.9 + vec3(0.4,0.65,1.0) * limb * 0.6;
          c += vec3(30.0, 28.0, 25.0) * smoothstep(0.9995, 0.9999, dot(vDir, uSun));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), m));
    return this.ctx.pmrem.fromScene(env, 0).texture;
  }

  buildSatellite() {
    const g = new THREE.Group();
    const model = this.ctx.assets.model('satellite');
    if (model) {
      const m = model.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const k = 7.2 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(k);
      m.position.copy(center).multiplyScalar(-k);
      const holder = new THREE.Group();
      holder.add(m);
      holder.rotation.set(0.25, 0.4, 0);
      g.add(holder);
      // painéis solares = malhas com material "SolarPanel": encolhem/expandem no eixo das asas
      this.panels = [];
      m.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mt) => {
          mt.envMapIntensity = 1.2;
          if (/solarpanel/i.test(mt.name)) {
            mt.metalness = Math.max(mt.metalness ?? 0, 0.35);
            mt.roughness = Math.min(mt.roughness ?? 1, 0.35);
          }
        });
        if (mats.some((mt) => /solarpanel/i.test(mt.name))) this.panels.push(o);
      });
      if (!model.animations?.length && this.panels.length) {
        this.deploy = { v: 0 };
        this.applyDeployPanels = () => this.panels.forEach((p) => (p.scale.x = 0.06 + 0.94 * this.deploy.v));
        this.applyDeployPanels();
        return g;
      }
      if (model.animations?.length) {
        this.mixer = new THREE.AnimationMixer(m);
        const clip = THREE.AnimationClip.findByName(model.animations, 'Deploy') || model.animations[0];
        this.deployAction = this.mixer.clipAction(clip);
        this.deployAction.clampWhenFinished = true;
        this.deployAction.setLoop(THREE.LoopOnce, 1);
      }
      this.deploy = { v: 1 };
      return g;
    }

    const metal = new THREE.MeshStandardMaterial({ color: 0xb9bcc6, metalness: 0.85, roughness: 0.32 });
    const foil = new THREE.MeshStandardMaterial({ color: 0xc8962f, metalness: 1, roughness: 0.28, emissive: 0x1a0f00 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.6, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.05), metal);
    g.add(body);
    const foilTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), foil);
    foilTop.position.y = 0.1;
    g.add(foilTop);
    // antenas phased array
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.32), dark);
      a.position.set(-0.55 + i * 0.37, -0.1, 0.18);
      g.add(a);
    }
    // parabólica
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.32),
      new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide })
    );
    dish.rotation.x = Math.PI;
    dish.position.set(0.55, -0.32, -0.25);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25), metal);
    boom.position.set(0.55, -0.2, -0.25);
    g.add(dish, boom);

    // asa solar em sanfona (4 segmentos)
    const solarMat = new THREE.MeshStandardMaterial({
      map: solarTexture(),
      metalness: 0.55,
      roughness: 0.22,
      emissive: 0x0a1630,
      emissiveIntensity: 1.2,
    });
    const segW = 0.62;
    const segs = [];
    const makeWing = (dir) => {
      const root = new THREE.Group();
      root.position.set((dir * 1.7) / 2, 0.02, 0);
      g.add(root);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.04), metal);
      strut.position.x = dir * 0.1;
      root.add(strut);
      let parent = root;
      let x = dir * 0.2;
      for (let i = 0; i < 4; i++) {
        const hinge = new THREE.Group();
        hinge.position.x = x;
        parent.add(hinge);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.02, 0.018, 0.92), [metal, metal, solarMat, dark, metal, metal]);
        panel.position.x = (dir * segW) / 2;
        hinge.add(panel);
        segs.push({ hinge, i, dir });
        parent = hinge;
        x = dir * segW;
      }
    };
    makeWing(1);
    makeWing(-1);
    this.segs = segs;
    this.deploy = { v: 0 };
    this.applyDeploy();

    // luzes de navegação
    this.navLights = [glowSprite(new THREE.Color(3, 0.2, 0.2), 0.2), glowSprite(new THREE.Color(0.2, 3, 0.5), 0.2)];
    this.navLights[0].position.set(-0.85, 0.12, 0.5);
    this.navLights[1].position.set(0.85, 0.12, 0.5);
    g.add(...this.navLights);
    return g;
  }

  // Ângulos de dobra: dobrado = sanfona compacta, aberto = asa reta
  applyDeploy() {
    this.applyDeployPanels?.();
    if (!this.segs) return;
    const d = this.deploy.v;
    for (const s of this.segs) {
      const fold = (1 - d) * Math.PI * 0.96;
      s.hinge.rotation.z = s.i === 0 ? s.dir * (1 - d) * -0.4 : (s.i % 2 ? 1 : -1) * fold * s.dir;
    }
  }

  playDeploy() {
    if (this.deployed) return;
    this.deployed = true;
    if (this.deployAction) {
      this.deployAction.reset().play();
      return;
    }
    gsap.to(this.deploy, { v: 1, duration: 2.6, ease: 'power2.inOut', onUpdate: () => this.applyDeploy() });
  }

  buildPlexus(rand) {
    const nodes = [];
    const v = new THREE.Vector3();
    // distribui nós numa calota ao redor do ponto da órbita do satélite
    const satDir = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), EARTH_C).normalize();
    const orbitR = EARTH_C.length();
    while (nodes.length < 46) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      if (v.dot(satDir) < 0.9) continue;
      const r = orbitR + (rand() - 0.5) * 3;
      const n = v.clone().multiplyScalar(r).add(EARTH_C);
      if (n.length() < 9 || n.z > 6) continue; // nada colado na câmera
      nodes.push(n);
    }
    // conecta cada nó aos 2–3 vizinhos mais próximos
    const pairs = new Set();
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((x) => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2 + (i % 2));
      near.forEach(({ j }) => pairs.add(i < j ? `${i}-${j}` : `${j}-${i}`));
    });
    const SUB = 8; // subdivisões por linha (para o pulso viajar)
    const staticPairs = [...pairs].map((k) => k.split('-').map(Number));
    // + linhas do satélite para os 5 nós mais próximos (dinâmicas)
    this.satLinks = nodes
      .map((n, j) => ({ j, d: n.length() }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((x) => x.j);
    const total = staticPairs.length + this.satLinks.length;
    const pos = new Float32Array(total * SUB * 2 * 3);
    const at = new Float32Array(total * SUB * 2);
    const seed = new Float32Array(total * SUB * 2);
    let k = 0;
    const writeLine = (a, b, sd) => {
      for (let sIdx = 0; sIdx < SUB; sIdx++) {
        const t0 = sIdx / SUB;
        const t1 = (sIdx + 1) / SUB;
        [t0, t1].forEach((tt) => {
          v.lerpVectors(a, b, tt);
          v.toArray(pos, k * 3);
          at[k] = tt;
          seed[k] = sd;
          k++;
        });
      }
    };
    staticPairs.forEach(([i, j]) => writeLine(nodes[i], nodes[j], rand()));
    this.satLineStart = k;
    this.satLinks.forEach((j) => writeLine(new THREE.Vector3(), nodes[j], rand()));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aT', new THREE.BufferAttribute(at, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.plexusMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uScan: { value: -30 },
        uColor: { value: new THREE.Color(0.6, 0.8, 1.0) },
        uPulse: { value: new THREE.Color(1.0, 0.75, 0.4) },
      },
      vertexShader: plexusVert,
      fragmentShader: plexusFrag,
    });
    this.plexus = new THREE.LineSegments(geo, this.plexusMat);
    this.plexus.frustumCulled = false;
    this.scene.add(this.plexus);
    this.nodes = nodes;
    this.SUB = SUB;

    const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodes);
    const n = nodes.length;
    nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n).map(() => 0.6 + rand()), 1));
    nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).map(() => rand()), 1));
    this.nodeMat = particleMaterial({ size: 9, twinkle: 0.5, color: new THREE.Color(1.1, 0.95, 0.75), opacity: 0 });
    this.scene.add(new THREE.Points(nodeGeo, this.nodeMat));
  }

  updateSatLines(satPos) {
    const pos = this.plexus.geometry.attributes.position;
    const v = new THREE.Vector3();
    let k = this.satLineStart;
    for (const j of this.satLinks) {
      const b = this.nodes[j];
      for (let sIdx = 0; sIdx < this.SUB; sIdx++) {
        for (const tt of [sIdx / this.SUB, (sIdx + 1) / this.SUB]) {
          v.lerpVectors(satPos, b, tt);
          pos.setXYZ(k++, v.x, v.y, v.z);
        }
      }
    }
    pos.needsUpdate = true;
  }

  update(l, dt, time, global) {
    const scroll = this.ctx.scroll;
    const intro = easeInOut(Math.min(1, scroll.intro));

    // Satélite: voo de entrada pelo intro gate
    const from = new THREE.Vector3(-16, 5, -30);
    const to = new THREE.Vector3(0, 0, 0);
    this.sat.position.lerpVectors(from, to, intro);
    this.sat.position.y += Math.sin(time * 0.6) * 0.06;
    this.sat.rotation.set(0.35 + (1 - intro) * 0.8 + l * 0.3, -0.6 + (1 - intro) * 2.4 + l * 1.4, 0.15 + Math.sin(time * 0.3) * 0.03);
    this.sat.visible = intro > 0.001;
    if (intro > 0.82) this.playDeploy();
    this.mixer?.update(dt);

    if (this.navLights) {
      const blink = Math.sin(time * 5) > 0.6 ? 1 : 0.1;
      this.navLights.forEach((n, i) => (n.material.opacity = i ? 1 - blink * 0.9 : blink));
    }

    // Halo de luz no satélite (cresce com a label)
    this.halo.material.opacity = 0.12 + windowFade(global, 0.055, 0.13, 0.01) * 0.35;

    // Plexus aparece após o título e some antes do mergulho
    const plexOn = smoothstep(0.02, 0.05, global) * (1 - smoothstep(0.115, 0.135, global));
    this.plexusMat.uniforms.uOpacity.value = plexOn;
    this.nodeMat.uniforms.uOpacity.value = plexOn;
    this.plexusMat.uniforms.uTime.value = time;
    this.plexusMat.uniforms.uScan.value = -40 + ((time * 14) % 80);
    this.updateSatLines(this.sat.position);

    this.earthMat.uniforms.uTime.value = time;
    if (this.textured) this.earthMat.uniforms.uCloudShift.value = time * 0.00004; // deriva das nuvens
    else this.earth.rotation.y = 0.8 + time * 0.004;
    this.auroraMat.uniforms.uTime.value = time;
    this.starMat.uniforms.uTime.value = time;
    this.nebula.material.uniforms.uTime.value = time;

    // Câmera
    const cam = this.camera;
    this.path.apply(cam, l);
    // em retrato o texto fica embaixo: centraliza o satélite em vez de deslocá-lo à direita
    if (cam.aspect < 1) cam.translateX(Math.min(2.4, (1 - cam.aspect) * 4) * (1 - smoothstep(0.6, 0.85, l)));
    this.ctx.cameraFX.applyParallax(cam, 1 - smoothstep(0.85, 1, l));
    this.earthMat.uniforms.uCam.value.copy(cam.position);
    this.atmo.material.uniforms.uCam.value.copy(cam.position);

    // Label "NX-1 CORE" presa ao satélite
    this.tmp.copy(this.sat.position).add(new THREE.Vector3(0.9, 0.25, 0));
    this.ctx.labels.setAnchor('satellite', this.tmp, cam);

    this.bloomBoost = 1 + windowFade(global, 0.06, 0.12, 0.01) * 0.3;

    // Hover no satélite → loop sonoro do chip
    const m = this.ctx.mouse;
    if (m.moved && this.sat.visible) {
      this.ray.setFromCamera({ x: m.x, y: m.y }, cam);
      const hit = this.ray.ray.distanceSqToPoint(this.sat.position) < 2.2 * 2.2;
      if (hit !== this.hovering) {
        this.hovering = hit;
        if (hit) this.ctx.audio.startLoop('chipLoop');
        else this.ctx.audio.stopLoop('chipLoop', this.ctx.audioCfg.chipLoopFadeOut);
      }
    }
  }

  leave() {
    if (this.hovering) {
      this.hovering = false;
      this.ctx.audio.stopLoop('chipLoop', this.ctx.audioCfg.chipLoopFadeOut);
    }
  }
}
