import { MeshStandardMaterial } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/*
 * Exports the procedural watch as a lightweight GLB (geometry + named
 * materials + exploded-view metadata in extras). Open it in Blender to
 * re-model / bake AO, keep the node and material names, export, drop it
 * in public/models/watch.glb and load the site with ?model=/models/watch.glb
 */
export async function exportWatchGLB(rig) {
  const swapped = []
  // flat placeholder materials: the site re-binds its own shaders by name
  rig.root.traverse((o) => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    const plain = list.map(
      (m) =>
        new MeshStandardMaterial({
          name: m.userData?.matKey || m.name || 'glossy',
          color: m.color ? m.color.clone() : 0xffffff,
          roughness: m.roughness ?? 0.3,
          metalness: m.metalness ?? 1,
          transparent: m.transparent,
          opacity: m.opacity ?? 1,
        }),
    )
    swapped.push([o, o.material])
    o.material = Array.isArray(o.material) ? plain : plain[0]
  })
  // exploded-view metadata → glTF extras
  Object.values(rig.parts).forEach((part) => {
    part.group.userData.explode = part.explode
    part.group.userData.center = [part.center.x, part.center.y]
    part.pieces.forEach((pc) => (pc.obj.userData.offsetZ = pc.offsetZ))
  })
  rig.root.remove(rig.shadow)
  try {
    const exporter = new GLTFExporter()
    return await exporter.parseAsync(rig.root, { binary: true, onlyVisible: false })
  } finally {
    swapped.forEach(([o, m]) => (o.material = m))
    rig.root.add(rig.shadow)
  }
}

export function downloadBuffer(buffer, name = 'watch.glb') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
  a.download = name
  a.click()
}
