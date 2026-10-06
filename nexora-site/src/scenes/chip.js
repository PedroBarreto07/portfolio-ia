import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addFresnel, canvasTexture } from './helpers.js';

// Textura do heat spreader: gravação "NX-Q1" + trilhas finas
function lidTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#2a2622');
    grd.addColorStop(0.5, '#3a342d');
    grd.addColorStop(1, '#221f1c');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(232,180,106,0.35)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const y = 40 + i * 17;
      g.beginPath();
      g.moveTo(30, y);
      g.lineTo(120 + ((i * 37) % 90), y);
      g.lineTo(140 + ((i * 37) % 90), y + 10);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,220,170,0.9)';
    g.font = '600 64px "General Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText('NX-Q1', w * 0.62, h * 0.52);
    g.font = '400 20px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(255,220,170,0.55)';
    g.fillText('QUANTUM INFERENCE UNIT', w * 0.62, h * 0.6);
    g.fillText('4096 LQ · 12 mK', w * 0.62, h * 0.65);
    g.strokeStyle = 'rgba(255,220,170,0.6)';
    g.lineWidth = 3;
    g.strokeRect(24, 24, w - 48, h - 48);
  });
}

/**
 * Chip procedural: substrato, pinos dourados, die e tampa gravada.
 * Retorna { group, fresnel (uniforms), edges (material das bordas) }.
 */
export function createChip(assets) {
  const group = new THREE.Group();
  const gltf = assets?.model('chip');
  if (gltf) {
    group.add(gltf.scene);
    return { group, fresnel: null, edges: null };
  }

  const substrate = new THREE.MeshPhysicalMaterial({
    color: 0x0e1a14,
    roughness: 0.45,
    metalness: 0.2,
    clearcoat: 0.6,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a54a, metalness: 1, roughness: 0.22 });
  const lid = new THREE.MeshPhysicalMaterial({
    map: lidTexture(),
    metalness: 0.85,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const fresnel = addFresnel(lid, { color: new THREE.Color(1.0, 0.62, 0.22), power: 2.2, intensity: 0 });

  const base = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.09, 1.7, 3, 0.04), substrate);
  group.add(base);

  // pinos dourados nas bordas (instanciados)
  const pinGeo = new THREE.BoxGeometry(0.035, 0.02, 0.12);
  const pins = new THREE.InstancedMesh(pinGeo, gold, 4 * 22);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < 22; i++) {
      const t = -0.74 + (i / 21) * 1.48;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2);
      const p = new THREE.Vector3(t, 0.052, 0.78).applyQuaternion(q);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      pins.setMatrixAt(k++, m);
    }
  group.add(pins);

  // capacitores SMD
  const capMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66, metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.04), capMat);
    c.position.set(-0.6 + (i % 5) * 0.3, 0.065, i < 5 ? -0.62 : 0.62);
    group.add(c);
  }

  const spreader = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.1, 1.15, 3, 0.03), lid);
  spreader.position.y = 0.09;
  group.add(spreader);

  // bordas brilhantes
  const edges = new THREE.LineBasicMaterial({
    color: new THREE.Color(1.0, 0.7, 0.35),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const e1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, 0.09, 1.7)), edges);
  const e2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.15, 0.1, 1.15)), edges);
  e2.position.y = 0.09;
  group.add(e1, e2);

  return { group, fresnel, edges, materials: [substrate, gold, lid, capMat] };
}
