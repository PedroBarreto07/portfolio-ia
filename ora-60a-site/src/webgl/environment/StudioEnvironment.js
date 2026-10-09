import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
} from 'three'

/*
 * Procedural replacement for envmap.exr: a photo studio built from emissive
 * "lightformers" (softboxes, strip lights, kickers) rendered once into a
 * PMREM cube. Long vertical strips give the classic product-shot streaks on
 * polished steel, the large top softbox the soft gradient on brushed parts.
 */

function lightformer(scene, { w, h, intensity, color = '#ffffff', position, rotation = [0, 0, 0], round = false }) {
  const mat = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), side: 2, toneMapped: false })
  const mesh = new Mesh(new PlaneGeometry(w, h), mat)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  if (round) mesh.lookAt(0, 0, 0)
  scene.add(mesh)
  return mesh
}

export function createStudioEnvironment(renderer, { variant = 'studio' } = {}) {
  const scene = new Scene()

  // Room: vertical gradient, darker floor, soft grey walls.
  const room = new Mesh(
    new BoxGeometry(1, 1, 1),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new Color(variant === 'studio' ? 0.72 : 0.02, variant === 'studio' ? 0.72 : 0.02, variant === 'studio' ? 0.74 : 0.025) },
        uBottom: { value: new Color(variant === 'studio' ? 0.16 : 0.0, variant === 'studio' ? 0.16 : 0.0, variant === 'studio' ? 0.17 : 0.0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec3 vPos;
        void main() {
          float t = smoothstep(-0.45, 0.35, vPos.y);
          gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
        }`,
    }),
  )
  room.scale.set(40, 24, 40)
  scene.add(room)

  const k = variant === 'studio' ? 1 : 1.4

  // Key: huge overhead softbox
  lightformer(scene, { w: 16, h: 9, intensity: 3.2 * k, position: [0, 11, 2], rotation: [Math.PI / 2, 0, 0] })
  // Tall strip lights left/right (the long streaks on polished steel)
  lightformer(scene, { w: 1.2, h: 16, intensity: 9 * k, position: [-12, 2, 3], rotation: [0, Math.PI / 2, 0] })
  lightformer(scene, { w: 1.2, h: 16, intensity: 9 * k, position: [12, 2, 3], rotation: [0, -Math.PI / 2, 0] })
  lightformer(scene, { w: 0.6, h: 14, intensity: 6 * k, position: [-9, 1, -9], round: true })
  lightformer(scene, { w: 0.6, h: 14, intensity: 6 * k, position: [9, 1, -9], round: true })
  // Front fill (what the dial reflects head-on)
  lightformer(scene, { w: 14, h: 5, intensity: variant === 'studio' ? 1.15 : 0.35, position: [0, 3, 16], rotation: [0, Math.PI, 0] })
  // Warm/cool kickers for depth
  lightformer(scene, { w: 3, h: 3, intensity: 7 * k, color: '#fff1e0', position: [6, 6, 10], round: true })
  lightformer(scene, { w: 2, h: 2, intensity: 6 * k, color: '#e8f0ff', position: [-7, 5, 9], round: true })
  // Floor bounce card
  lightformer(scene, { w: 20, h: 8, intensity: variant === 'studio' ? 0.5 : 0.05, position: [0, -10, 4], rotation: [-Math.PI / 2, 0, 0] })
  // Back rim strips
  lightformer(scene, { w: 10, h: 0.8, intensity: 5 * k, position: [0, 6, -14], round: true })

  const pmrem = new PMREMGenerator(renderer)
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100)
  pmrem.dispose()
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose()
      o.material.dispose()
    }
  })
  return rt.texture
}
