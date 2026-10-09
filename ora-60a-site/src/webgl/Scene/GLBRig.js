import { Box3, Group, Mesh, PlaneGeometry, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { CATALOG_IDS, EXPLODE, PART_IDS } from './WatchModel.js'

/*
 * Builds the same "rig" interface as WatchModel.buildWatch() from a GLB.
 *
 * Naming convention (node names):
 *   case-assembly / bracelet-assembly / strap-assembly / movement   (groups)
 *   dial | tourbillon | mainplate | barrel | backplate | weight      (part groups)
 *   <part>-xploded-N                                                 (pieces)
 *   crystal-front, crystal-back, bezel, case, caseback, crown, lug.*, clasp…
 *   hand-hours-pivot, hand-minutes-pivot, hand-seconds-pivot, moon-bg…
 * Material names select the site's own shaders (glossy, brushed, glass,
 * dial, steel, gilt, perlage, geneva, circles, blued, ruby, logo…).
 * Exploded offsets come from glTF extras (explode, center, offsetZ) or
 * fall back to sensible defaults, so any model following the names works.
 */

export async function loadGLBRig(url, { mats, renderer, onProgress }) {
  const loader = new GLTFLoader()
  // decoders are self-hosted (three ships them, Vite emits them as assets)
  const draco = new DRACOLoader()
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder(MeshoptDecoder)
  if (renderer) loader.setKTX2Loader(new KTX2Loader().detectSupport(renderer))
  const gltf = await loader.loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total))
  draco.dispose()
  return buildRigFromScene(gltf.scene, { mats })
}

const ALIASES = {
  'metal-glossy': 'glossy',
  'metal-brushed': 'brushed',
  'metal-semiGlossy': 'glossy',
  'metal-geneva': 'geneva',
  'metal-circles': 'circles',
  'metal-perlage': 'perlage',
  numbers: 'rehaut',
  white: 'dialPrint',
}

export function buildRigFromScene(scene, { mats }) {
  // ---- materials: bind the site's shaders by material name
  scene.traverse((o) => {
    if (!o.isMesh) return
    const swap = (m) => {
      const key = ALIASES[m.name] || m.name
      return mats[key] || mats.glossy
    }
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material)
    o.frustumCulled = true
    // glTF has no render order: restore the transparent layering by name
    if (/^dial-print/.test(o.name)) o.renderOrder = 2
    else if (/^crystal-/.test(o.name)) o.renderOrder = 10
    else if (/shadow|engraving|logo/.test(o.name)) o.renderOrder = 3
  })

  const byName = (name) => scene.getObjectByName(name)
  const all = (re) => {
    const out = []
    scene.traverse((o) => re.test(o.name) && out.push(o))
    return out
  }
  const ensureGroup = (name, re) => {
    let g = byName(name)
    if (!g) {
      g = new Group()
      g.name = name
      all(re).forEach((o) => g.attach(o))
    }
    return g
  }

  const root = new Group()
  root.name = 'watch'
  const pivot = new Group()
  pivot.name = 'watch-pivot'
  root.add(pivot)

  const caseGroup = ensureGroup('case-assembly', /^(case|bezel|crystal|caseback|crown|lug|dial-outline)/)
  const bracelet = ensureGroup('bracelet-assembly', /^(bracelet|clasp)/)
  const strap = byName('strap-assembly') || Object.assign(new Group(), { name: 'strap-assembly' })
  const movement = ensureGroup('movement', /^(dial|tourbillon|mainplate|barrel|backplate|weight)/)
  pivot.add(caseGroup, bracelet, strap, movement)

  // ---- exploded parts
  const parts = {}
  PART_IDS.forEach((id) => {
    let group = movement.getObjectByName(id)
    if (!group) {
      group = new Group()
      group.name = id
      all(new RegExp(`^${id}-xploded-\\d+$`)).forEach((o) => group.attach(o))
      movement.add(group)
    }
    const center = group.userData.center ? new Vector3(group.userData.center[0], group.userData.center[1], 0) : centerOf(group)
    const pieces = group.children.map((obj, i, arr) => ({
      obj,
      base: obj.position.clone(),
      offsetZ: obj.userData.offsetZ ?? (i - (arr.length - 1) / 2) * -0.16,
    }))
    group.traverse((o) => (o.userData.part = id))
    parts[id] = { id, group, pieces, explode: group.userData.explode ?? EXPLODE[id], center }
  })

  // ---- animated pieces (all optional)
  const hand = (name) => {
    const pivotObj = byName(`${name}-pivot`)
    if (!pivotObj) return null
    const shadow = pivotObj.getObjectByName(`${name}-shadow`) || new Group()
    shadow.userData.offset ||= [0.03, -0.035]
    return { pivot: pivotObj, mesh: pivotObj.children[0], shadow }
  }
  const animated = {
    hands: Object.fromEntries(
      [
        ['hour', 'hand-hours'],
        ['minute', 'hand-minutes'],
        ['second', 'hand-seconds'],
      ]
        .map(([k, n]) => [k, hand(n)])
        .filter(([, v]) => v),
    ),
    tourbillon: {
      cage: ['tourbillon-xploded-2', 'tourbillon-xploded-3', 'tourbillon-xploded-4', 'tourbillon-xploded-5', 'tourbillon-xploded-6', 'tourbillon-xploded-7'].map(byName).filter(Boolean),
      balanceMesh: byName('tourbillon-balance'),
      hairspring: byName('tourbillon-xploded-4'),
      escapeWheel: byName('tourbillon-escape'),
      palletMesh: byName('tourbillon-pallet'),
    },
    train: [
      ['center-wheel', Math.PI / 1800],
      ['third-wheel', -Math.PI / 225],
      ['fourth-wheel', Math.PI / 30],
    ]
      .map(([n, speed]) => ({ obj: byName(n), speed }))
      .filter((w) => w.obj),
    barrel: ['barrel-xploded-1', 'barrel-xploded-4'].map(byName).filter(Boolean),
    powerHand: byName('hand-power'),
    moon: byName('moon-bg'),
    rotor: ['weight-xploded-1', 'weight-xploded-2', 'weight-logo'].map(byName).filter(Boolean),
  }

  const pickables = []
  movement.traverse((o) => o.isMesh && o.userData.part && pickables.push(o))

  const catalogNames = {
    dial: /^(dial-front|dial-print|indices|moon|tourbillon-ring|hand-power)/,
    hands: /^(hand-(hours|minutes|seconds)-pivot|hand-cap)$/,
    crystal: /^crystal-front$/,
    bezel: /^bezel$/,
    lugs: /^lug/,
    strap: /^bracelet\./,
    buckle: /^clasp$/,
    crown: /^crown/,
    caseback: /^(caseback|crystal-back)/,
    movement: /^(tourbillon|mainplate|barrel|backplate|weight)$/,
  }
  const catalog = Object.fromEntries(CATALOG_IDS.map((id) => [id, all(catalogNames[id])]))

  const shadow = new Mesh(new PlaneGeometry(7.6, 7.6), mats.shadow)
  shadow.name = 'shadow-plane'
  shadow.position.z = -0.75
  shadow.renderOrder = -1
  root.add(shadow)

  return {
    root,
    pivot,
    caseGroup,
    bracelet,
    strap,
    movement,
    parts,
    animated,
    pickables,
    catalog,
    shadow,
    meshes: {},
    fromGLB: true,
  }
}

function centerOf(group) {
  const box = new Box3().setFromObject(group)
  if (box.isEmpty()) return new Vector3()
  const c = box.getCenter(new Vector3())
  return new Vector3(c.x, c.y, 0)
}
