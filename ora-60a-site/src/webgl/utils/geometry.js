import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Procedural modelling toolkit for the watch. Everything is built around
 * the watch axis (Z = dial normal, +Y = 12 o'clock), so the generated
 * parts can be exploded along Z without any re-orientation.
 */

/**
 * Lathe around Z with analytic normals and hard edges.
 * profile: [[r, z], ...] — normals follow (dz, -dr), so traverse the
 * profile counter-clockwise in (r, z) for outward-facing surfaces.
 * Angle is measured clockwise from +Y (watch convention) so u = "minutes".
 */
export function latheZ(profile, { segments = 128, crease = 40, phiStart = 0, phiLength = Math.PI * 2, radiusFn = null, recomputeNormals = false } = {}) {
  const segN = []
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, z0] = profile[i]
    const [r1, z1] = profile[i + 1]
    const dr = r1 - r0
    const dz = z1 - z0
    const l = Math.hypot(dr, dz) || 1
    segN.push([dz / l, -dr / l])
  }
  const cosCrease = Math.cos((crease * Math.PI) / 180)
  const pts = []
  let s = 0
  for (let i = 0; i < profile.length; i++) {
    const [r, z] = profile[i]
    if (i > 0) s += Math.hypot(r - profile[i - 1][0], z - profile[i - 1][1])
    const a = segN[i - 1]
    const b = segN[i]
    if (!a) pts.push({ r, z, n: b, s })
    else if (!b) pts.push({ r, z, n: a, s })
    else if (a[0] * b[0] + a[1] * b[1] < cosCrease) {
      pts.push({ r, z, n: a, s, split: true })
      pts.push({ r, z, n: b, s })
    } else {
      const nx = a[0] + b[0]
      const nz = a[1] + b[1]
      const l = Math.hypot(nx, nz) || 1
      pts.push({ r, z, n: [nx / l, nz / l], s })
    }
  }
  const total = s || 1
  const rows = pts.length
  const pos = []
  const nor = []
  const uv = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const phi = phiStart + t * phiLength
    const sp = Math.sin(phi)
    const cp = Math.cos(phi)
    for (let j = 0; j < rows; j++) {
      const p = pts[j]
      const rr = radiusFn ? radiusFn(p.r, phi, j, p) : p.r
      pos.push(rr * sp, rr * cp, p.z)
      nor.push(p.n[0] * sp, p.n[0] * cp, p.n[1])
      uv.push(t, p.s / total)
    }
  }
  const idx = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows - 1; j++) {
      if (pts[j].split) continue
      const a = i * rows + j
      const b = (i + 1) * rows + j
      const c = (i + 1) * rows + j + 1
      const d = i * rows + j + 1
      idx.push(a, d, b, b, d, c)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  if (recomputeNormals) g.computeVertexNormals()
  return g
}

/** Extrude a 2D shape along Z, centred so the *front* cap sits at z = 0. */
export function extrude(shape, depth, { bevel = 0.008, bevelSegments = 2, curveSegments = 64, front = true } = {}) {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments,
    curveSegments,
  })
  g.translate(0, 0, front ? -(depth + bevel) : -(depth / 2))
  g.computeVertexNormals()
  return g
}

/** Re-map UVs as a planar projection (for centred dial/rotor textures). */
export function planarUV(g, cx = 0, cy = 0, size = 1) {
  const p = g.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - cx) / size + 0.5
    uv[i * 2 + 1] = (p.getY(i) - cy) / size + 0.5
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  return g
}

export function circlePath(path, x, y, r, clockwise = false) {
  path.absarc(x, y, r, 0, Math.PI * 2, clockwise)
  return path
}

export function holeCircle(x, y, r) {
  const p = new Path()
  p.absarc(x, y, r, 0, Math.PI * 2, true)
  return p
}

/** Annular sector path (spoke windows, rotor skeleton). */
export function sectorPath(rIn, rOut, a0, a1, cx = 0, cy = 0) {
  const p = new Path()
  p.moveTo(cx + Math.cos(a0) * rOut, cy + Math.sin(a0) * rOut)
  p.absarc(cx, cy, rOut, a0, a1, false)
  p.lineTo(cx + Math.cos(a1) * rIn, cy + Math.sin(a1) * rIn)
  p.absarc(cx, cy, rIn, a1, a0, true)
  p.closePath()
  return p
}

/**
 * Gear wheel with trapezoidal teeth, optional spoke windows and arbor hole.
 * type: 'involute' (approx.), 'escape' (club teeth), 'ratchet' (sawtooth)
 */
export function gearShape({ teeth = 60, radius = 0.5, toothDepth = 0.035, hole = 0.03, spokes = 0, rim = 0.06, hub = 0.1, type = 'involute', spokeWidth = 0.35 } = {}) {
  const shape = new Shape()
  const rRoot = radius - toothDepth
  const pitch = (Math.PI * 2) / Math.max(teeth, 1)
  const pts = []
  if (teeth <= 0) {
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
  } else {
    for (let k = 0; k < teeth; k++) {
      const a = k * pitch
      if (type === 'ratchet') {
        pts.push([a, rRoot], [a + pitch * 0.85, radius], [a + pitch * 0.98, rRoot])
      } else if (type === 'escape') {
        pts.push([a, rRoot], [a + pitch * 0.55, radius], [a + pitch * 0.68, radius * 0.985], [a + pitch * 0.72, rRoot])
      } else {
        pts.push([a, rRoot], [a + pitch * 0.12, rRoot], [a + pitch * 0.27, radius], [a + pitch * 0.48, radius], [a + pitch * 0.63, rRoot])
      }
    }
    pts.forEach(([a, r], i) => {
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
  }
  if (hole > 0) shape.holes.push(holeCircle(0, 0, hole))
  if (spokes > 0) {
    const rOut = rRoot - rim
    const rIn = hub
    if (rOut > rIn + 0.02) {
      const step = (Math.PI * 2) / spokes
      const half = (step * spokeWidth) / 2
      for (let s = 0; s < spokes; s++) {
        const a0 = s * step + half + 0.3
        const a1 = (s + 1) * step - half + 0.3
        shape.holes.push(sectorPath(rIn, rOut, a0, a1))
      }
    }
  }
  return shape
}

/** Monotone-chain convex hull of circles → organic "bridge" outlines. */
export function hullShape(circles, { samples = 48, holes = [] } = {}) {
  const pts = []
  circles.forEach(([x, y, r]) => {
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
    }
  })
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  const hull = lower.concat(upper)
  const shape = new Shape(hull.map(([x, y]) => new Vector2(x, y)))
  holes.forEach(([x, y, r]) => shape.holes.push(holeCircle(x, y, r)))
  return shape
}

/**
 * Faceted (dauphine) hand: two polished facets meeting on a raised ridge,
 * so each flank catches a different softbox — the luxury "flash".
 */
export function facetedHand({ length = 1, width = 0.1, tail = 0.18, ridge = 0.02, waist = 0.18, hubR = 0.07 } = {}) {
  const T = [0, length, 0]
  const L = [-width / 2, length * waist, 0]
  const R = [width / 2, length * waist, 0]
  const BL = [-width * 0.32, -tail, 0]
  const BR = [width * 0.32, -tail, 0]
  const RM = [0, length * waist, ridge]
  const RB = [0, -tail, ridge * 0.7]
  const tris = [
    // front facets
    T, L, RM,
    T, RM, R,
    RM, L, BL,
    RM, BL, RB,
    RM, RB, BR,
    RM, BR, R,
    // tail cap
    BL, BR, RB,
    // back (flat)
    T, R, L,
    L, R, BR,
    L, BR, BL,
  ]
  const pos = new Float32Array(tris.flat())
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Flat Archimedean spiral → hairspring / mainspring. */
export function spiralTube({ turns = 10, r0 = 0.05, r1 = 0.25, wire = 0.006, z = 0, segmentsPerTurn = 48 } = {}) {
  const pts = []
  const n = Math.floor(turns * segmentsPerTurn)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = t * turns * Math.PI * 2
    const r = r0 + (r1 - r0) * t
    pts.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r, z))
  }
  const curve = new CatmullRomCurve3(pts)
  return new TubeGeometry(curve, n, wire, 5, false)
}

/**
 * Merge heterogeneous geometries (indexed/non-indexed, with or without uv)
 * into a single non-indexed geometry with position/normal/uv.
 */
export function mergeAll(list) {
  const prepared = list.map((g) => {
    let n = g.index ? g.toNonIndexed() : g.clone()
    if (!n.attributes.normal) n.computeVertexNormals()
    if (!n.attributes.uv) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2))
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(key)) n.deleteAttribute(key)
    n.clearGroups()
    return n
  })
  return mergeGeometries(prepared)
}

/** Reflect a geometry along an axis while keeping the winding valid. */
export function mirrorGeometry(g, axis = 'x') {
  const m = g.clone()
  const s = { x: [-1, 1, 1], y: [1, -1, 1], z: [1, 1, -1] }[axis]
  m.scale(...s)
  if (m.index) {
    const a = m.index.array
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1]
      a[i + 1] = a[i + 2]
      a[i + 2] = t
    }
    m.index.needsUpdate = true
  } else {
    for (const key of Object.keys(m.attributes)) {
      const attr = m.attributes[key]
      const sz = attr.itemSize
      const arr = attr.array
      for (let i = 0; i < attr.count; i += 3) {
        for (let c = 0; c < sz; c++) {
          const t = arr[(i + 1) * sz + c]
          arr[(i + 1) * sz + c] = arr[(i + 2) * sz + c]
          arr[(i + 2) * sz + c] = t
        }
      }
      attr.needsUpdate = true
    }
  }
  return m
}

/** Sweep a rounded rectangle along a curve (leather strap). */
export function sweepRibbon(curve, { samples = 220, width = 2, widthFn = null, thickness = 0.12, round = 0.05, side = new Vector3(1, 0, 0) } = {}) {
  // cross-section (u across width, v across thickness), closed loop
  const section = []
  const hw = 0.5
  const ht = 0.5
  const steps = 4
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2)
      section.push([cx + Math.cos(a) * round, cy + Math.sin(a) * round])
    }
  }
  // corners in normalised units (scaled per sample by width/thickness)
  corner(hw - round, ht - round, 0)
  corner(-hw + round, ht - round, Math.PI / 2)
  corner(-hw + round, -ht + round, Math.PI)
  corner(hw - round, -ht + round, Math.PI * 1.5)
  const S = section.length
  const pos = []
  const uv = []
  const tmpT = new Vector3()
  const tmpN = new Vector3()
  const tmpS = side.clone().normalize()
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = curve.getPointAt(t)
    curve.getTangentAt(t, tmpT)
    tmpN.crossVectors(tmpS, tmpT).normalize() // outward (away from wrist)
    const w = widthFn ? widthFn(t) : width
    for (let j = 0; j <= S; j++) {
      const [u, v] = section[j % S]
      pos.push(p.x + tmpS.x * u * w + tmpN.x * v * thickness, p.y + tmpS.y * u * w + tmpN.y * v * thickness, p.z + tmpS.z * u * w + tmpN.z * v * thickness)
      uv.push((u + 0.5) * w * 0.6, t * curve.getLength() * 0.6)
    }
  }
  const idx = []
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j
      const b = (i + 1) * (S + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
