import * as THREE from 'three';
import { noise } from '../shaders/noise.js';

/* -------------------------------------------------------------------------- */
/*  Texturas procedurais (canvas)                                             */
/* -------------------------------------------------------------------------- */

export function canvasTexture(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

let glowTex = null;
// Gradiente radial suave (halos, bokeh, flares)
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTexture(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  return glowTex;
}

export function glowSprite(color, scale, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

// Painel solar: células azul-escuras com grade prateada
export function solarTexture() {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#0a1426';
    g.fillRect(0, 0, w, h);
    const cw = w / 4;
    const ch = h / 10;
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 4; x++) {
        const l = 12 + Math.random() * 10;
        g.fillStyle = `hsl(220, 55%, ${l}%)`;
        g.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 6);
        g.strokeStyle = 'rgba(160,180,220,0.25)';
        g.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          g.beginPath();
          g.moveTo(x * cw + 3, y * ch + (ch * i) / 4);
          g.lineTo(x * cw + cw - 3, y * ch + (ch * i) / 4);
          g.stroke();
        }
      }
    g.strokeStyle = '#8e97a8';
    g.lineWidth = 4;
    g.strokeRect(0, 0, w, h);
  });
}

// Texto em canvas (labels de mundo, telas, cards)
export function textTexture(lines, { w = 1024, h = 256, font = '600 120px "General Sans"', color = '#fff', align = 'center', lineHeight = 1.1 } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = color;
    g.font = font;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const size = parseInt(font.match(/(\d+)px/)[1], 10);
    const total = lines.length * size * lineHeight;
    lines.forEach((l, i) => {
      const x = align === 'center' ? w / 2 : align === 'right' ? w - 10 : 10;
      g.fillText(l, x, h / 2 - total / 2 + size * lineHeight * (i + 0.5));
    });
  });
}

/* -------------------------------------------------------------------------- */
/*  Material com dissolve por ruído (racks, chip)                             */
/*  Injeta no MeshStandard/Physical: uDissolve 0 = invisível, 1 = completo    */
/* -------------------------------------------------------------------------- */
export function addDissolve(material, { edgeColor = new THREE.Color(1.0, 0.6, 0.25), scale = 2.2, edge = 0.06 } = {}) {
  const uniforms = {
    uDissolve: { value: 1 },
    uEdgeColor: { value: edgeColor },
    uNoiseScale: { value: scale },
    uEdge: { value: edge },
  };
  material.userData.dissolve = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDisPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDisPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDisPos;
        uniform float uDissolve; uniform vec3 uEdgeColor; uniform float uNoiseScale; uniform float uEdge;
        ${noise}`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dn = fbm3(vDisPos * uNoiseScale) * 0.5 + 0.5;
        float dth = uDissolve * (1.0 + uEdge * 2.0) - uEdge;
        if (dn > dth + uEdge) discard;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float dEdge = smoothstep(dth + uEdge, dth, dn);
        totalEmissiveRadiance += uEdgeColor * (1.0 - dEdge) * 6.0 * step(uDissolve, 0.999);`
      );
  };
  material.customProgramCacheKey = () => 'dissolve';
  return uniforms;
}

/* -------------------------------------------------------------------------- */
/*  Fresnel emissivo (chip quântico, bordas)                                  */
/* -------------------------------------------------------------------------- */
export function addFresnel(material, { color = new THREE.Color(1.0, 0.65, 0.25), power = 2.5, intensity = 2 } = {}) {
  const uniforms = { uFresnelColor: { value: color }, uFresnelPower: { value: power }, uFresnel: { value: intensity } };
  material.userData.fresnel = uniforms;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFresnelColor; uniform float uFresnelPower; uniform float uFresnel;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float fr = pow(max(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0), uFresnelPower);
        totalEmissiveRadiance += uFresnelColor * fr * uFresnel;`
      );
  };
  const prevKey = material.customProgramCacheKey?.() ?? '';
  material.customProgramCacheKey = () => prevKey + 'fresnel';
  return uniforms;
}

/* -------------------------------------------------------------------------- */
/*  Partículas genéricas (poeira, bokeh, estrelas)                            */
/* -------------------------------------------------------------------------- */
export function particleMaterial({ color = new THREE.Color(1, 1, 1), size = 4, opacity = 1, twinkle = 0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uTwinkle: { value: twinkle },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform float uSize; uniform float uPixelRatio; uniform float uTwinkle;
      varying float vAlpha;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 40.0));
        vAlpha = tw;
        gl_PointSize = uSize * aSize * uPixelRatio * (40.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * a * a, a * uOpacity * vAlpha);
      }`,
  });
}

export function randomPointsGeometry(count, fn, seedRand = Math.random) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    fn(v, i);
    v.toArray(pos, i * 3);
    size[i] = 0.4 + seedRand() * 1.2;
    seed[i] = seedRand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}

// Plano de tela cheia preso à câmera (fundos, véus)
export function screenQuad(material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.frustumCulled = false;
  return m;
}

// Aplica opacidade a todos os materiais de um grupo
export function setGroupOpacity(group, o) {
  group.traverse((c) => {
    if (!c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach((m) => {
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = o;
      else {
        m.transparent = true;
        m.opacity = o * (m.userData.baseOpacity ?? 1);
      }
    });
  });
  group.visible = o > 0.001;
}
