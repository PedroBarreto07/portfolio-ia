import {
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import {
  extrude,
  facetedHand,
  gearShape,
  holeCircle,
  hullShape,
  latheZ,
  mergeAll,
  mirrorGeometry,
  planarUV,
  sectorPath,
  spiralTube,
  sweepRibbon,
} from '../utils/geometry.js'

/*
 * ORA 60A — fully procedural watch.
 *
 * Coordinates: 1 unit ≈ 10 mm, dial normal = +Z, 12 o'clock = +Y.
 * Naming follows the GLB convention used by the original pipeline
 * (crystal-front, dial-front, bracelet.*, clasp-*, *-xploded-N, ruby…)
 * so a hand-made GLB can replace this module later (see GLBRig.js).
 */

const TAU = Math.PI * 2

export const PART_IDS = ['dial', 'tourbillon', 'mainplate', 'barrel', 'backplate', 'weight']
export const CATALOG_IDS = ['dial', 'hands', 'crystal', 'bezel', 'lugs', 'strap', 'buckle', 'crown', 'caseback', 'movement']

// group offsets along Z when fully exploded
export const EXPLODE = { dial: 4.2, tourbillon: 2.5, mainplate: 0.85, barrel: -0.85, backplate: -2.5, weight: -4.1 }

const CASE_PROFILE = [
  [1.84, -0.4],
  [2.0, -0.4],
  [2.055, -0.37],
  [2.085, -0.31],
  [2.1, -0.2],
  [2.1, 0.12],
  [2.09, 0.21],
  [2.06, 0.28],
  [2.0, 0.32],
  [1.86, 0.32],
  [1.86, -0.38],
  [1.84, -0.4],
]

const BEZEL_PROFILE = [
  [1.9, 0.315],
  [2.04, 0.315],
  [2.07, 0.335],
  [2.085, 0.37],
  [2.08, 0.41],
  [2.06, 0.445],
  [2.025, 0.475],
  [1.98, 0.495],
  [1.945, 0.503],
  [1.92, 0.5],
  [1.905, 0.485],
  [1.9, 0.315],
]

const CASEBACK_PROFILE = [
  [1.4, -0.535],
  [1.58, -0.556],
  [1.9, -0.54],
  [1.985, -0.5],
  [2.02, -0.44],
  [2.0, -0.4],
  [1.4, -0.4],
  [1.4, -0.535],
]

export const BRACELET_POINTS = [
  [0, 2.6, -0.12],
  [0, 2.95, -0.45],
  [0, 3.22, -1.05],
  [0, 3.32, -1.85],
  [0, 3.12, -2.85],
  [0, 2.5, -3.85],
  [0, 1.45, -4.6],
  [0, 0.0, -4.92],
  [0, -1.45, -4.6],
  [0, -2.5, -3.85],
  [0, -3.12, -2.85],
  [0, -3.32, -1.85],
  [0, -3.22, -1.05],
  [0, -2.95, -0.45],
  [0, -2.6, -0.12],
]

function named(obj, name) {
  obj.name = name
  return obj
}

function M(geo, mat, name, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = null, order } = {}) {
  const m = new Mesh(geo, mat)
  m.name = name
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  if (order !== undefined) m.renderOrder = order
  if (parent) parent.add(m)
  return m
}

function instanced(geo, mat, name, transforms) {
  const im = new InstancedMesh(geo, mat, transforms.length)
  im.name = name
  const m = new Matrix4()
  const q = new Quaternion()
  const s = new Vector3(1, 1, 1)
  transforms.forEach((t, i) => {
    q.setFromAxisAngle(new Vector3(0, 0, 1), t.rz || 0)
    m.compose(new Vector3(t.x || 0, t.y || 0, t.z || 0), q, s.set(t.sx || 1, t.sy || 1, t.sz || 1))
    im.setMatrixAt(i, m)
  })
  im.instanceMatrix.needsUpdate = true
  im.computeBoundingSphere()
  return im
}

const cylZ = (r, h, seg = 48) => new CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2)

/** Dome-head screw / jewel geometry facing +Z. */
function domeGeo(r, h, seg = 32) {
  return latheZ(
    [
      [0, 0],
      [r, 0],
      [r, h * 0.35],
      [r * 0.75, h * 0.85],
      [0, h],
    ],
    { segments: seg, crease: 50 },
  )
}

export function buildWatch({ mats, quality = 'high' }) {
  const seg = quality === 'low' ? 96 : 180
  const root = named(new Group(), 'watch')
  const pivot = named(new Group(), 'watch-pivot')
  root.add(pivot)
  const caseGroup = named(new Group(), 'case-assembly')
  const bracelet = named(new Group(), 'bracelet-assembly')
  const strap = named(new Group(), 'strap-assembly')
  const movement = named(new Group(), 'movement')
  pivot.add(caseGroup, bracelet, strap, movement)

  const catalog = Object.fromEntries(CATALOG_IDS.map((id) => [id, []]))
  const parts = {}
  const animated = {}

  const makePart = (id, center = [0, 0]) => {
    const group = named(new Group(), id)
    movement.add(group)
    parts[id] = { id, group, pieces: [], explode: EXPLODE[id], center: new Vector3(center[0], center[1], 0) }
    return parts[id]
  }
  const piece = (part, obj, offsetZ = 0) => {
    part.group.add(obj)
    if (!obj.name) obj.name = `${part.id}-xploded-${part.pieces.length + 1}`
    obj.traverse((o) => {
      o.userData.part = part.id
    })
    part.pieces.push({ obj, base: obj.position.clone(), offsetZ })
    return obj
  }

  // ================================================================ CASE
  const caseMesh = M(latheZ(CASE_PROFILE, { segments: seg }), mats.brushed, 'case', { parent: caseGroup })
  const bezel = M(latheZ(BEZEL_PROFILE, { segments: seg }), mats.glossy, 'bezel', { parent: caseGroup })
  const rehaut = M(
    latheZ(
      [
        [1.925, 0.44],
        [1.795, 0.155],
      ],
      { segments: seg },
    ),
    mats.rehaut,
    'dial-outline',
    { parent: caseGroup },
  )

  const crystalProfile = [[1.94, 0.43]]
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const r = 1.94 * (1 - t)
    crystalProfile.push([r, 0.48 + 0.105 * (1 - (r / 1.94) ** 2)])
  }
  const crystal = M(latheZ(crystalProfile, { segments: seg, crease: 30 }), mats.glass, 'crystal-front', { parent: caseGroup, order: 10 })

  const caseback = M(latheZ(CASEBACK_PROFILE, { segments: seg }), mats.brushed, 'caseback', { parent: caseGroup })
  const backBevel = M(new TorusGeometry(1.405, 0.018, 12, seg), mats.glossy, 'caseback-bevel', { z: -0.535, parent: caseGroup })
  const crystalBack = M(new CircleGeometry(1.41, seg).rotateX(Math.PI), mats.glass, 'crystal-back', { z: -0.5, parent: caseGroup, order: 10 })

  // Crown (knurled), axis +X at 3 o'clock
  const crownGeo = latheZ(
    [
      [0, 0.08],
      [0.29, 0.08],
      [0.325, 0.12],
      [0.33, 0.2],
      [0.325, 0.29],
      [0.29, 0.33],
      [0.0, 0.335],
    ],
    {
      segments: 144,
      crease: 60,
      radiusFn: (r, phi, j) => (j >= 2 && j <= 4 ? r * (1 + 0.045 * Math.pow(Math.abs(Math.cos(phi * 15)), 0.6) - 0.03) : r),
      recomputeNormals: true,
    },
  )
  const stem = cylZ(0.1, 0.12, 32).translate(0, 0, 0.04)
  const crownMerged = mergeAll([crownGeo, stem])
  crownMerged.rotateY(Math.PI / 2)
  const crown = M(crownMerged, mats.glossy, 'crown', { x: 2.04, z: -0.04, parent: caseGroup })
  const crownCap = M(new CircleGeometry(0.17, 48).rotateY(Math.PI / 2), mats.logo, 'crown-logo', { x: 2.04 + 0.336, z: -0.04, parent: caseGroup })

  // Lugs — flanks polished (caps), top brushed (walls)
  const lugShape = new Shape()
  lugShape.moveTo(1.5, 0.3)
  lugShape.bezierCurveTo(1.95, 0.3, 2.35, 0.24, 2.68, 0.07)
  lugShape.quadraticCurveTo(2.8, 0.0, 2.79, -0.12)
  lugShape.quadraticCurveTo(2.77, -0.27, 2.62, -0.29)
  lugShape.bezierCurveTo(2.3, -0.31, 1.9, -0.35, 1.5, -0.38)
  lugShape.lineTo(1.5, 0.3)
  const lugGeo = extrude(lugShape, 0.3, { bevel: 0.03, front: false, curveSegments: 32 })
  lugGeo.applyMatrix4(new Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1))
  const lugGeoBottom = mirrorGeometry(lugGeo, 'y')
  const lugs = []
  for (const sx of [-1, 1]) {
    lugs.push(M(lugGeo, [mats.glossy, mats.brushed], `lug.${lugs.length + 1}`, { x: sx * 1.29, parent: caseGroup }))
    lugs.push(M(lugGeoBottom, [mats.glossy, mats.brushed], `lug.${lugs.length + 1}`, { x: sx * 1.29, parent: caseGroup }))
  }

  // ============================================================ BRACELET
  const curve = new CatmullRomCurve3(
    BRACELET_POINTS.map((p) => new Vector3(...p)),
    false,
    'centripetal',
  )
  const curveLength = curve.getLength()
  const rowLen = 0.43
  const rowCount = Math.floor(curveLength / rowLen)
  const claspHalf = 0.055
  const rowsT = []
  for (let i = 0; i < rowCount; i++) {
    const t = (i + 0.5) / rowCount
    if (Math.abs(t - 0.5) < claspHalf) continue
    rowsT.push(t)
  }
  const X = new Vector3(1, 0, 0)
  const basisAt = (t, out = new Matrix4(), widthScale = 1, xOffset = 0, lift = 0) => {
    const p = curve.getPointAt(t)
    const T = curve.getTangentAt(t)
    const N = new Vector3().crossVectors(X, T).normalize()
    out.makeBasis(X, T, N)
    out.scale(new Vector3(widthScale, 1, 1))
    out.setPosition(p.x + xOffset, p.y + N.y * lift, p.z + N.z * lift)
    return out
  }
  const taper = (t) => 1 - 0.14 * Math.sin(Math.PI * t)
  const centerLinks = new InstancedMesh(new RoundedBoxGeometry(0.74, rowLen * 0.97, 0.23, 3, 0.07), mats.glossy, rowsT.length)
  centerLinks.name = 'bracelet.center'
  const outerLinks = new InstancedMesh(new RoundedBoxGeometry(0.66, rowLen * 0.98, 0.21, 3, 0.05), mats.brushedLinks, rowsT.length * 2)
  outerLinks.name = 'bracelet.outer'
  const tmp = new Matrix4()
  rowsT.forEach((t, i) => {
    const w = taper(t)
    centerLinks.setMatrixAt(i, basisAt(t, tmp, w, 0, 0.012))
    // outer links are staggered half a pitch, like a real 3-row bracelet
    let to = t + 0.5 / rowCount
    if (to > 0.995 || Math.abs(to - 0.5) < claspHalf) to = t
    const wo = taper(to)
    outerLinks.setMatrixAt(i * 2, basisAt(to, tmp, wo, -0.705 * wo))
    outerLinks.setMatrixAt(i * 2 + 1, basisAt(to, tmp, wo, 0.705 * wo))
  })
  centerLinks.instanceMatrix.needsUpdate = true
  outerLinks.instanceMatrix.needsUpdate = true
  centerLinks.computeBoundingSphere()
  outerLinks.computeBoundingSphere()
  bracelet.add(centerLinks, outerLinks)

  // end links between the lugs
  const endGeo = new RoundedBoxGeometry(2.2, 0.36, 0.24, 3, 0.08)
  for (const t of [0.004, 0.996]) {
    const m = M(endGeo, mats.brushed, `bracelet.end-${t < 0.5 ? 'top' : 'bottom'}`, { parent: bracelet })
    m.matrixAutoUpdate = false
    basisAt(t, m.matrix)
  }

  // folding clasp
  const claspGroup = named(new Group(), 'clasp')
  bracelet.add(claspGroup)
  const claspMatrix = basisAt(0.5, new Matrix4(), taper(0.5))
  claspGroup.matrixAutoUpdate = false
  claspGroup.matrix.copy(claspMatrix)
  M(new RoundedBoxGeometry(2.05, claspHalf * 2 * curveLength + 0.25, 0.14, 4, 0.06), mats.glossy, 'clasp-cover', { z: 0.06, parent: claspGroup })
  M(new RoundedBoxGeometry(1.7, claspHalf * 2 * curveLength + 0.1, 0.1, 2, 0.04), mats.brushed, 'clasp-blade', { z: -0.05, parent: claspGroup })
  const claspLogo = M(new PlaneGeometry(1.3, 0.65), mats.engraving, 'clasp-logo', { z: 0.131, parent: claspGroup, order: 3 })
  claspLogo.rotation.z = Math.PI / 2

  // ======================================================= LEATHER STRAP
  const strapGeo = sweepRibbon(curve, {
    samples: 240,
    widthFn: (t) => 2.12 * (1 - 0.16 * Math.sin(Math.PI * t)),
    thickness: 0.15,
    round: 0.12,
  })
  M(strapGeo, mats.leather, 'strap.leather', { parent: strap })
  // stitches
  const stitchT = []
  const stitchCount = Math.floor(curveLength / 0.13)
  for (let i = 0; i < stitchCount; i++) {
    const t = (i + 0.5) / stitchCount
    if (Math.abs(t - 0.5) < 0.04) continue
    stitchT.push(t)
  }
  const stitches = new InstancedMesh(new RoundedBoxGeometry(0.03, 0.075, 0.02, 1, 0.01), mats.stitch, stitchT.length * 2)
  stitches.name = 'strap.stitches'
  stitchT.forEach((t, i) => {
    const w = 2.12 * (1 - 0.16 * Math.sin(Math.PI * t))
    stitches.setMatrixAt(i * 2, basisAt(t, tmp, 1, -w * 0.43, 0.075))
    stitches.setMatrixAt(i * 2 + 1, basisAt(t, tmp, 1, w * 0.43, 0.075))
  })
  stitches.instanceMatrix.needsUpdate = true
  stitches.computeBoundingSphere()
  strap.add(stitches)
  // pin buckle
  const buckle = named(new Group(), 'strap-buckle')
  buckle.matrixAutoUpdate = false
  buckle.matrix.copy(basisAt(0.5, new Matrix4(), 1, 0, 0.1))
  const frame = [
    new RoundedBoxGeometry(2.05, 0.09, 0.09, 2, 0.03).translate(0, 0.32, 0),
    new RoundedBoxGeometry(2.05, 0.09, 0.09, 2, 0.03).translate(0, -0.32, 0),
    new RoundedBoxGeometry(0.09, 0.73, 0.09, 2, 0.03).translate(-0.98, 0, 0),
    new RoundedBoxGeometry(0.09, 0.73, 0.09, 2, 0.03).translate(0.98, 0, 0),
    new RoundedBoxGeometry(0.06, 0.7, 0.05, 2, 0.02).translate(0, 0, 0.04),
  ]
  M(mergeAll(frame), mats.glossy, 'strap-buckle-frame', { parent: buckle })
  strap.add(buckle)
  strap.visible = false

  // ============================================================ MOVEMENT
  // ---------------------------------------------------------------- dial
  const dialPart = makePart('dial')
  const dialShape = new Shape()
  dialShape.absarc(0, 0, 1.8, 0, TAU, false)
  dialShape.holes.push(holeCircle(0, 0.95, 0.32), holeCircle(0, -0.88, 0.56))
  const dial = M(planarUV(extrude(dialShape, 0.025, { bevel: 0.006, curveSegments: 96 }), 0, 0, 3.6), mats.dial, 'dial-front', { z: 0.15 })
  piece(dialPart, dial, 0)
  const print = M(new CircleGeometry(1.8, 128), mats.dialPrint, 'dial-print', { z: 0.1515, order: 2 })
  piece(dialPart, print, 0.02)

  const indexTransforms = []
  for (let h = 1; h <= 12; h++) {
    if (h === 6) continue
    const a = (h / 12) * TAU
    const doubled = h === 12 || h === 3 || h === 9
    const offs = doubled ? [-0.055, 0.055] : [0]
    for (const o of offs) {
      const r = 1.46
      indexTransforms.push({
        x: Math.sin(a) * r + Math.cos(a) * o,
        y: Math.cos(a) * r - Math.sin(a) * o,
        z: 0.175,
        rz: -a,
      })
    }
  }
  const indices = instanced(new RoundedBoxGeometry(0.07, 0.27, 0.05, 2, 0.018), mats.glossy, 'indices', indexTransforms)
  piece(dialPart, indices, 0.22)

  const moonDisc = M(new CircleGeometry(0.6, 96), mats.moon, 'moon-bg', { y: 0.59, z: 0.106 })
  piece(dialPart, moonDisc, -0.25)
  animated.moon = moonDisc
  const moonRing = M(new TorusGeometry(0.32, 0.013, 10, 96), mats.glossy, 'moon-ring', { y: 0.95, z: 0.15 })
  piece(dialPart, moonRing, 0.12)
  const apertureRing = M(new TorusGeometry(0.56, 0.015, 10, 128), mats.glossy, 'tourbillon-ring', { y: -0.88, z: 0.15 })
  piece(dialPart, apertureRing, 0.12)

  // power reserve hand at 9
  const prHand = M(facetedHand({ length: 0.26, width: 0.045, tail: 0.05, ridge: 0.006 }), mats.blued, 'hand-power', { x: -0.95, z: 0.162 })
  const prHub = M(cylZ(0.025, 0.02, 24), mats.glossy, 'hand-power-hub', { x: -0.95, z: 0.165 })
  piece(dialPart, prHand, 0.35)
  piece(dialPart, prHub, 0.36)
  animated.powerHand = prHand

  // hands (part of the dial stack in the exploded view)
  const hourGeo = facetedHand({ length: 1.0, width: 0.17, tail: 0.2, ridge: 0.026, waist: 0.24 })
  const minuteGeo = facetedHand({ length: 1.5, width: 0.13, tail: 0.24, ridge: 0.024, waist: 0.2 })
  const secGeo = mergeAll([
    new RoundedBoxGeometry(0.014, 1.86, 0.008, 1, 0.003).translate(0, 0.6, 0),
    cylZ(0.055, 0.008, 32).translate(0, -0.24, 0),
    cylZ(0.035, 0.012, 24),
  ])
  const shadowMat = mats.handShadow
  const makeHand = (geo, mat, name, z, shadowOffset) => {
    const g = named(new Group(), `${name}-pivot`)
    g.position.z = z
    const mesh = M(geo, mat, name, { parent: g })
    const shadow = named(new Group(), `${name}-shadow`)
    // offset is defined in dial space (light from 10:30); re-rotated every frame
    shadow.userData.offset = shadowOffset
    shadow.position.set(shadowOffset[0], shadowOffset[1], 0.152 - z)
    const s1 = M(geo, shadowMat, `${name}-shadow-a`, { parent: shadow, order: 3 })
    s1.scale.z = 0.01
    const s2 = M(geo, shadowMat, `${name}-shadow-b`, { parent: shadow, order: 3, x: 0.012, y: -0.012 })
    s2.scale.set(1.04, 1.02, 0.01)
    g.add(shadow)
    return { pivot: g, mesh, shadow }
  }
  const hour = makeHand(hourGeo, mats.glossy, 'hand-hours', 0.186, [0.03, -0.035])
  const minute = makeHand(minuteGeo, mats.glossy, 'hand-minutes', 0.206, [0.045, -0.05])
  const second = makeHand(secGeo, mats.blued, 'hand-seconds', 0.228, [0.06, -0.065])
  const cap = M(cylZ(0.055, 0.03, 32), mats.glossy, 'hand-cap', { z: 0.24 })
  piece(dialPart, hour.pivot, 0.55)
  piece(dialPart, minute.pivot, 0.8)
  piece(dialPart, second.pivot, 1.02)
  piece(dialPart, cap, 1.12)
  animated.hands = { hour, minute, second }

  // ---------------------------------------------------------- tourbillon
  const tbPart = makePart('tourbillon', [0, -0.88])
  const TB = new Vector3(0, -0.88, 0)
  const tbBridge = M(
    extrude(hullShape([[-0.5, 0, 0.07], [0.5, 0, 0.07], [0, 0, 0.115]], { holes: [[0, 0, 0.036]] }), 0.03, { bevel: 0.008 }),
    mats.steel,
    'tourbillon-bridge',
    { x: TB.x, y: TB.y, z: 0.142 },
  )
  piece(tbPart, tbBridge, 0.55)
  const cagePivot = (name, z) => {
    const g = named(new Group(), name)
    g.position.set(TB.x, TB.y, z)
    return g
  }
  const cageShape = (r) => gearShape({ teeth: 0, radius: r, hole: 0.04, spokes: 3, rim: 0.045, hub: 0.1, spokeWidth: 0.28 })
  const cageTop = cagePivot('tourbillon-xploded-2', 0.105)
  M(extrude(cageShape(0.44), 0.022, { bevel: 0.006 }), mats.steel, 'tourbillon-cage-top', { parent: cageTop })
  M(new RoundedBoxGeometry(0.035, 0.16, 0.02, 1, 0.008).translate(0, 0.48, 0), mats.blued, 'tourbillon-seconds', { parent: cageTop, z: 0.004 })
  piece(tbPart, cageTop, 0.32)

  const balance = cagePivot('tourbillon-xploded-3', 0.06)
  const screws = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    screws.push(new SphereGeometry(0.022, 10, 8).translate(Math.cos(a) * 0.315, Math.sin(a) * 0.315, 0))
  }
  const balanceGeo = mergeAll([
    new TorusGeometry(0.29, 0.021, 10, 96),
    new RoundedBoxGeometry(0.6, 0.035, 0.02, 1, 0.008),
    new RoundedBoxGeometry(0.035, 0.6, 0.02, 1, 0.008),
    ...screws,
  ])
  const balanceMesh = M(balanceGeo, mats.gilt, 'tourbillon-balance', { parent: balance })
  piece(tbPart, balance, 0.12)

  const hairspring = cagePivot('tourbillon-xploded-4', 0.082)
  M(spiralTube({ turns: 9, r0: 0.05, r1: 0.22, wire: 0.0045 }), mats.blued, 'tourbillon-hairspring', { parent: hairspring })
  piece(tbPart, hairspring, -0.02)

  const escape = cagePivot('tourbillon-xploded-5', 0.025)
  const escapeWheel = M(extrude(gearShape({ teeth: 15, radius: 0.12, toothDepth: 0.045, type: 'escape', hole: 0.015, spokes: 4, rim: 0.02, hub: 0.03 }), 0.014, { bevel: 0.003 }), mats.gilt, 'tourbillon-escape', {
    parent: escape,
    x: 0.25,
    y: -0.17,
  })
  piece(tbPart, escape, -0.16)

  const pallet = cagePivot('tourbillon-xploded-6', 0.035)
  const palletMesh = M(extrude(hullShape([[0, 0, 0.026], [0.15, 0.05, 0.018], [0.12, -0.07, 0.018]]), 0.012, { bevel: 0.003 }), mats.steel, 'tourbillon-pallet', {
    parent: pallet,
    x: 0.08,
    y: -0.02,
  })
  piece(tbPart, pallet, -0.26)

  const cageBottom = cagePivot('tourbillon-xploded-7', -0.03)
  const pillars = [0, 1, 2].map((i) => cylZ(0.018, 0.135, 12).translate(Math.cos((i / 3) * TAU + 0.3) * 0.405, Math.sin((i / 3) * TAU + 0.3) * 0.405, 0.068))
  const cageBottomGeo = mergeAll([extrude(cageShape(0.42), 0.02, { bevel: 0.005 }), ...pillars])
  M(cageBottomGeo, mats.steel, 'tourbillon-cage-bottom', { parent: cageBottom })
  piece(tbPart, cageBottom, -0.42)
  animated.tourbillon = { cage: [cageTop, balance, hairspring, escape, pallet, cageBottom], balanceMesh, hairspring, escapeWheel, palletMesh }

  // ----------------------------------------------------------- mainplate
  const mpPart = makePart('mainplate')
  const plateShape = new Shape()
  plateShape.absarc(0, 0, 1.72, 0, TAU, false)
  plateShape.holes.push(
    holeCircle(0, -0.88, 0.6),
    holeCircle(0.75, 0.6, 0.07),
    holeCircle(-0.72, 0.35, 0.045),
    holeCircle(-0.75, -0.55, 0.045),
    holeCircle(0, 0, 0.06),
    holeCircle(1.25, -0.25, 0.04),
  )
  const plate = M(extrude(plateShape, 0.08, { bevel: 0.01, curveSegments: 96 }), [mats.perlage, mats.steel], 'mainplate', { z: -0.005 })
  const jewelGeo = domeGeo(0.034, 0.018, 24)
  const mpJewels = instanced(jewelGeo, mats.ruby, 'ruby.mainplate', [
    { x: -0.72, y: 0.35, z: -0.005 },
    { x: -0.75, y: -0.55, z: -0.005 },
    { x: 1.25, y: -0.25, z: -0.005 },
    { x: 0.55, y: 1.15, z: -0.005 },
    { x: -1.2, y: -1.05, z: -0.005 },
  ])
  plate.add(mpJewels)
  piece(mpPart, plate, 0)

  const wheel = (name, opts, x, y, z, depth = 0.02, pinion = 0.05) => {
    const g = mergeAll([extrude(gearShape(opts), depth, { bevel: 0.004, curveSegments: 32 }), cylZ(pinion, 0.16, 16).translate(0, 0, 0.05)])
    const m = M(g, mats.gilt, name, { x, y, z })
    return m
  }
  const centerWheel = wheel('center-wheel', { teeth: 64, radius: 0.36, toothDepth: 0.025, spokes: 4, rim: 0.045, hub: 0.07, hole: 0.0 }, 0, 0, -0.2)
  const thirdWheel = wheel('third-wheel', { teeth: 72, radius: 0.42, toothDepth: 0.025, spokes: 5, rim: 0.045, hub: 0.07, hole: 0.0 }, -0.72, 0.35, -0.15)
  const fourthWheel = wheel('fourth-wheel', { teeth: 60, radius: 0.34, toothDepth: 0.024, spokes: 4, rim: 0.04, hub: 0.06, hole: 0.0 }, -0.75, -0.55, -0.19)
  const crownWheel = M(extrude(gearShape({ teeth: 28, radius: 0.2, toothDepth: 0.03, hole: 0.03 }), 0.03, { bevel: 0.004 }), mats.steel, 'crown-wheel', { x: 1.25, y: -0.25, z: -0.13 })
  const keylessWheel = M(extrude(gearShape({ teeth: 20, radius: 0.13, toothDepth: 0.025, hole: 0.02 }), 0.03, { bevel: 0.004 }), mats.steel, 'keyless-wheel', { x: 1.52, y: -0.62, z: -0.13 })
  piece(mpPart, centerWheel, -0.42)
  piece(mpPart, thirdWheel, -0.3)
  piece(mpPart, fourthWheel, -0.55)
  piece(mpPart, crownWheel, -0.25)
  piece(mpPart, keylessWheel, -0.35)
  animated.train = [
    { obj: centerWheel, speed: TAU / 3600 },
    { obj: thirdWheel, speed: -TAU / 450 },
    { obj: fourthWheel, speed: TAU / 60 },
  ]

  // -------------------------------------------------------------- barrel
  const brPart = makePart('barrel', [0.75, 0.6])
  const BR = [0.75, 0.6]
  const drumGeo = mergeAll([
    latheZ(
      [
        [0, -0.24],
        [0.55, -0.24],
        [0.55, -0.125],
        [0.52, -0.125],
        [0.52, -0.22],
        [0, -0.22],
      ],
      { segments: 128 },
    ),
    extrude(gearShape({ teeth: 90, radius: 0.6, toothDepth: 0.03, hole: 0.5 }), 0.025, { bevel: 0.004, curveSegments: 64 }).translate(0, 0, -0.205),
  ])
  const drum = M(drumGeo, mats.gilt, 'barrel-xploded-1', { x: BR[0], y: BR[1] })
  piece(brPart, drum, 0)
  const springGeo = spiralTube({ turns: 13, r0: 0.1, r1: 0.5, wire: 0.01, segmentsPerTurn: 40 })
  springGeo.scale(1, 1, 6)
  springGeo.computeVertexNormals()
  const mainspring = M(springGeo, mats.steel, 'barrel-xploded-2', { x: BR[0], y: BR[1], z: -0.17 })
  piece(brPart, mainspring, 0.35)
  const coverGeo = mergeAll([planarUV(extrude(gearShape({ teeth: 0, radius: 0.53, hole: 0 }), 0.02, { bevel: 0.004 }), 0, 0, 1.1), cylZ(0.06, 0.22, 24).translate(0, 0, -0.08)])
  const cover = M(coverGeo, mats.circles, 'barrel-xploded-3', { x: BR[0], y: BR[1], z: -0.1 })
  piece(brPart, cover, 0.7)
  const ratchet = M(planarUV(extrude(gearShape({ teeth: 42, radius: 0.42, toothDepth: 0.04, type: 'ratchet', hole: 0.06 }), 0.03, { bevel: 0.004, curveSegments: 48 }), 0, 0, 0.9), mats.circles, 'barrel-xploded-4', {
    x: BR[0],
    y: BR[1],
    z: -0.325,
  })
  const ratchetScrew = M(domeGeo(0.07, 0.03).rotateX(Math.PI), mats.blued, 'barrel-ratchet-screw', { z: -0.035, parent: ratchet })
  piece(brPart, ratchet, -0.45)
  animated.barrel = [drum, ratchet]

  // ----------------------------------------------------------- backplate
  const bpPart = makePart('backplate')
  const bpShape = new Shape()
  bpShape.absarc(0, 0, 1.7, 0, TAU, false)
  bpShape.holes.push(holeCircle(0, -0.88, 0.6), holeCircle(-0.85, 0.45, 0.3), holeCircle(0.75, 0.6, 0.075))
  const backplate = M(extrude(bpShape, 0.06, { bevel: 0.01, curveSegments: 96 }), [mats.geneva, mats.steel], 'backplate-xploded-1', { z: -0.25 })
  piece(bpPart, backplate, 0)

  const screwPos = [
    [1.35, 0.78],
    [1.12, -0.98],
    [-1.32, 0.86],
    [-1.52, -0.3],
    [0.32, 1.48],
    [-0.42, -1.55],
    [0.55, -1.5],
    [1.55, 0.05],
    [-0.35, 1.5],
    [0.25, 0.2],
  ]
  const bpScrews = instanced(domeGeo(0.058, 0.03).rotateX(Math.PI), mats.blued, 'screw.backplate', screwPos.map(([x, y]) => ({ x, y, z: -0.325 })))
  piece(bpPart, bpScrews, -0.38)
  const chatonPos = [
    [0, 0],
    [-0.75, -0.55],
    [1.25, -0.25],
    [-0.15, 0.95],
    [-1.2, -0.95],
  ]
  const chatons = instanced(new TorusGeometry(0.062, 0.02, 8, 32), mats.logo, 'chaton.backplate', chatonPos.map(([x, y]) => ({ x, y, z: -0.322 })))
  piece(bpPart, chatons, -0.22)
  const bpRubies = instanced(domeGeo(0.04, 0.016).rotateX(Math.PI), mats.ruby, 'ruby.backplate', chatonPos.map(([x, y]) => ({ x, y, z: -0.322 })))
  piece(bpPart, bpRubies, -0.12)
  const engraving = M(new PlaneGeometry(2.0, 1.0).rotateY(Math.PI), mats.engravingPlate, 'backplate-engraving', { x: 0.35, y: -0.15, z: -0.3215, order: 3 })
  engraving.rotation.z = 0.5
  piece(bpPart, engraving, -0.05)

  // --------------------------------------------------------------- rotor
  const wPart = makePart('weight')
  const a0 = Math.PI * 0.5 - 1.75
  const a1 = a0 + 3.5
  const rotorShape = new Shape()
  rotorShape.moveTo(Math.cos(a0) * 1.66, Math.sin(a0) * 1.66)
  rotorShape.absarc(0, 0, 1.66, a0, a1, false)
  rotorShape.lineTo(Math.cos(a1) * 0.33, Math.sin(a1) * 0.33)
  rotorShape.absarc(0, 0, 0.33, a1, a0, true)
  rotorShape.closePath()
  rotorShape.holes.push(sectorPath(0.58, 1.3, a0 + 0.35, a0 + 1.6), sectorPath(0.58, 1.3, a0 + 1.9, a1 - 0.35))
  const rotorPlate = M(planarUV(extrude(rotorShape, 0.03, { bevel: 0.006, curveSegments: 96 }), 0, 0, 3.4), [mats.circles, mats.steel], 'weight-xploded-1', { z: -0.355 })
  const rimShape = new Shape()
  rimShape.moveTo(Math.cos(a0) * 1.69, Math.sin(a0) * 1.69)
  rimShape.absarc(0, 0, 1.69, a0, a1, false)
  rimShape.lineTo(Math.cos(a1) * 1.42, Math.sin(a1) * 1.42)
  rimShape.absarc(0, 0, 1.42, a1, a0, true)
  rimShape.closePath()
  const rotorRim = M(extrude(rimShape, 0.065, { bevel: 0.01, curveSegments: 96 }), mats.logo, 'weight-xploded-2', { z: -0.345 })
  const hubGeo = mergeAll([
    latheZ(
      [
        [0.12, -0.03],
        [0.33, -0.03],
        [0.34, 0.0],
        [0.33, 0.03],
        [0.12, 0.03],
        [0.12, -0.03],
      ],
      { segments: 96 },
    ),
    ...Array.from({ length: 10 }, (_, i) => new SphereGeometry(0.035, 12, 10).translate(Math.cos((i / 10) * TAU) * 0.225, Math.sin((i / 10) * TAU) * 0.225, -0.02)),
  ])
  const rotorHub = M(hubGeo, mats.steel, 'weight-xploded-3', { z: -0.4 })
  const rotorScrew = M(domeGeo(0.1, 0.04).rotateX(Math.PI), mats.blued, 'weight-xploded-4', { z: -0.43 })
  const rotorLogo = M(new PlaneGeometry(1.3, 0.65).rotateY(Math.PI), mats.engravingRotor, 'weight-logo', { y: -1.0, z: -0.3865, order: 3 })
  piece(wPart, rotorPlate, 0)
  piece(wPart, rotorRim, 0.08)
  piece(wPart, rotorHub, -0.28)
  piece(wPart, rotorScrew, -0.5)
  piece(wPart, rotorLogo, -0.06)
  animated.rotor = [rotorPlate, rotorRim, rotorLogo]

  // ======================================================= shadow / misc
  const shadow = M(new PlaneGeometry(7.6, 7.6), mats.shadow, 'shadow-plane', { z: -0.75, order: -1 })
  root.add(shadow)

  // pickables
  const pickables = []
  movement.traverse((o) => {
    if (o.isMesh && o.userData.part) pickables.push(o)
  })

  // catalog (isolated renders for the parts list)
  catalog.dial = [dial, print, indices, moonDisc, moonRing, apertureRing, prHand, prHub]
  catalog.hands = [hour.pivot, minute.pivot, second.pivot, cap]
  catalog.crystal = [crystal]
  catalog.bezel = [bezel]
  catalog.lugs = lugs
  catalog.strap = [centerLinks, outerLinks, ...bracelet.children.filter((c) => c.name.startsWith('bracelet.end'))]
  catalog.buckle = [claspGroup]
  catalog.crown = [crown, crownCap]
  catalog.caseback = [caseback, crystalBack, backBevel]
  catalog.movement = [parts.tourbillon.group, parts.mainplate.group, parts.barrel.group, parts.backplate.group, parts.weight.group]

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
    curve,
    shadow,
    meshes: { caseMesh, bezel, rehaut, crystal, caseback, crystalBack, crown, dial, print, lugs },
  }
}
