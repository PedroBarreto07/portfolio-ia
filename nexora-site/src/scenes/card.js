import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CARDS } from '../config.js';
import { t } from '../core/i18n.js';
import { canvasTexture } from './helpers.js';

export const CARD_W = 2.4;
export const CARD_H = 3.3;
export const CARD_D = 0.08;
const RADIUS = 0.16;

function roundedRectPoints(w, h, r, seg = 8) {
  const pts = [];
  const corners = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (Math.PI * 3) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  pts.push(pts[0].clone());
  return pts;
}

export function glassMaterial(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.28,
    transmission: 1,
    thickness: 0.6,
    ior: 1.45,
    specularIntensity: 1,
    envMap,
    envMapIntensity: 0.8,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    attenuationColor: new THREE.Color(1.0, 0.9, 0.8),
    attenuationDistance: 2.5,
  });
}

// Corpo de vidro + borda luminosa (sem conteúdo) — usado no morph do chip
export function createCardShell(envMap) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 4, RADIUS * 0.5), glassMaterial(envMap));
  group.add(body);
  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(1.1, 1.0, 0.9),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(roundedRectPoints(CARD_W - 0.01, CARD_H - 0.01, RADIUS)), edgeMat);
  edge.position.z = CARD_D / 2 + 0.002;
  group.add(edge);
  return { group, body, edgeMat };
}

// Texto do card desenhado em canvas (General Sans + JetBrains Mono)
export function cardTextTexture(card, index) {
  const W = 1024;
  const H = Math.round((W * CARD_H) / CARD_W);
  return canvasTexture(W, H, (g) => {
    const pad = 80;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = '500 30px "JetBrains Mono", monospace';
    g.fillText(`0${index + 1}`, pad, pad + 20);
    g.textAlign = 'right';
    g.fillText('◢', W - pad, pad + 20);
    g.textAlign = 'left';

    // título (quebra em linhas)
    const title = t(card.title);
    g.fillStyle = '#fff';
    let size = 104;
    g.font = `700 ${size}px "General Sans", sans-serif`;
    const words = title.split(' ');
    let lines = [];
    const wrap = () => {
      lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (g.measureText(test).width > W - pad * 2 && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      lines.push(line);
    };
    wrap();
    while (lines.some((l) => g.measureText(l).width > W - pad * 2) && size > 60) {
      size -= 6;
      g.font = `700 ${size}px "General Sans", sans-serif`;
      wrap();
    }
    const titleTop = H * 0.56;
    // subtítulo pequeno em caixa alta
    g.font = '500 28px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(255,214,160,0.9)';
    g.fillText(t(card.eyebrow).toUpperCase(), pad, titleTop - 26, W - pad * 2);
    g.fillStyle = '#fff';
    g.font = `700 ${size}px "General Sans", sans-serif`;
    lines.forEach((l, i) => g.fillText(l, pad, titleTop + size * 0.95 * (i + 1)));

    // bullets
    g.font = '400 32px "JetBrains Mono", monospace';
    const by = titleTop + size * 0.95 * lines.length + 70;
    t(card.bullets).forEach((b, i) => {
      g.fillStyle = 'rgba(255,214,160,0.95)';
      g.fillText('+', pad, by + i * 52);
      g.fillStyle = 'rgba(255,255,255,0.78)';
      g.fillText(b, pad + 40, by + i * 52);
    });
    // linha divisória
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(pad, titleTop - 90, W - pad * 2, 2);
  });
}

/* ------------------------- objetos 3D dos cards ------------------------- */

function graphObject() {
  const g = new THREE.Group();
  const nodes = [];
  const levels = [1, 2, 4, 3];
  levels.forEach((n, li) =>
    Array.from({ length: n }).forEach((_, i) => nodes.push(new THREE.Vector3((i - (n - 1) / 2) * 0.32, 0.45 - li * 0.3, Math.sin(i + li) * 0.12)))
  );
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffb060, emissiveIntensity: 0.9, roughness: 0.3 });
  nodes.forEach((p) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), nodeMat);
    m.position.copy(p);
    g.add(m);
  });
  const seg = [];
  let start = 0;
  for (let li = 0; li < levels.length - 1; li++) {
    const a = start;
    const b = start + levels[li];
    for (let i = 0; i < levels[li]; i++)
      for (let j = 0; j < levels[li + 1]; j++) seg.push(nodes[a + i], nodes[b + j]);
    start = b;
  }
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.2, 0.85, 0.5), transparent: true, opacity: 0.5 });
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lineMat));
  g.userData.tick = (time) => {
    g.rotation.y = Math.sin(time * 0.5) * 0.5;
    nodeMat.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.3;
  };
  return g;
}

function sphereObject(envMap) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffd9a8,
    metalness: 0.6,
    roughness: 0.2,
    flatShading: true,
    envMap,
    envMapIntensity: 0.55,
    iridescence: 0.6,
  });
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat);
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 1)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 1.0, 0.6), transparent: true, opacity: 0.45 })
  );
  g.add(ico, wire);
  g.userData.tick = (time) => {
    ico.rotation.set(time * 0.3, time * 0.45, 0);
    wire.rotation.set(-time * 0.2, time * 0.25, 0);
  };
  return g;
}

function agentsObject() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffa040, emissiveIntensity: 1.4 })
  );
  g.add(core);
  const agents = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 0.7, roughness: 0.25 });
  for (let i = 0; i < 8; i++) {
    const a = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat);
    a.userData = { r: i < 4 ? 0.36 : 0.58, o: (i % 4) * (Math.PI / 2), s: i < 4 ? 1 : -0.7, tilt: i < 4 ? 0.3 : -0.4 };
    agents.push(a);
    g.add(a);
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(agents.length * 6), 3)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(1.2, 0.8, 0.45), transparent: true, opacity: 0.4 })
  );
  g.add(lines);
  g.userData.tick = (time) => {
    const pos = lines.geometry.attributes.position;
    agents.forEach((a, i) => {
      const u = a.userData;
      const ang = u.o + time * u.s;
      a.position.set(Math.cos(ang) * u.r, Math.sin(ang) * u.r * u.tilt, Math.sin(ang) * u.r);
      a.rotation.y = time * 2;
      pos.setXYZ(i * 2, 0, 0, 0);
      pos.setXYZ(i * 2 + 1, a.position.x, a.position.y, a.position.z);
    });
    pos.needsUpdate = true;
  };
  return g;
}

function cubesObject(envMap) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffb35c,
    roughness: 0.08,
    transmission: 0.85,
    thickness: 0.3,
    ior: 1.5,
    envMap,
    envMapIntensity: 1.5,
    attenuationColor: new THREE.Color(1.0, 0.55, 0.15),
    attenuationDistance: 0.4,
    emissive: 0x3a1800,
  });
  const geo = new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.03);
  const cubes = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const c = new THREE.Mesh(geo, mat);
        c.userData.base = new THREE.Vector3(x, y, z).multiplyScalar(0.23);
        cubes.push(c);
        g.add(c);
      }
  g.userData.tick = (time) => {
    const e = 1 + (Math.sin(time * 0.9) * 0.5 + 0.5) * 0.45;
    cubes.forEach((c, i) => {
      c.position.copy(c.userData.base).multiplyScalar(e);
      c.rotation.set(time * 0.2 + i, time * 0.3, 0);
    });
    g.rotation.set(time * 0.15, time * 0.25, 0);
  };
  return g;
}

export function createCard(index, envMap) {
  const card = CARDS[index];
  const shell = createCardShell(envMap);
  const { group } = shell;
  const textMat = new THREE.MeshBasicMaterial({
    map: cardTextTexture(card, index),
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(0.8, 0.8, 0.8),
  });
  const text = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), textMat);
  text.position.z = CARD_D / 2 + 0.004;
  group.add(text);

  const makers = { graph: graphObject, sphere: sphereObject, agents: agentsObject, cubes: cubesObject };
  const obj = makers[card.object](envMap);
  obj.position.set(0, CARD_H * 0.2, 0.35);
  group.add(obj);
  return { ...shell, text, textMat, obj, index };
}
