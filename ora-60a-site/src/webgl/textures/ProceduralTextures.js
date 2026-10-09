import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { mulberry32 } from '../utils/math.js'

/*
 * Every texture of the site is generated here, at load time, from code.
 * This replaces the baked maps of a GLB pipeline (metal-brushed-normal,
 * geneva-normal, numbersAO, moonphase-bg...) and keeps the repo free of
 * third-party assets. Sizes scale down on low-end devices.
 */

// ---------------------------------------------------------------- helpers

function makeData(width, height, data, { wrap = true, srgb = false } = {}) {
  const tex = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = wrap ? RepeatWrapping : ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function makeCanvas(width, height = width) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, ctx: canvas.getContext('2d') }
}

function canvasTexture(canvas, { srgb = true, wrap = false, flipY = true } = {}) {
  const tex = new CanvasTexture(canvas)
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = wrap ? RepeatWrapping : ClampToEdgeWrapping
  tex.anisotropy = 8
  tex.flipY = flipY
  tex.needsUpdate = true
  return tex
}

/** 1D value noise over a periodic lattice (cosine interpolated). */
function periodic1D(period, rng) {
  const values = new Float32Array(period)
  for (let i = 0; i < period; i++) values[i] = rng()
  return (x) => {
    const xi = Math.floor(x)
    const f = x - xi
    const a = values[((xi % period) + period) % period]
    const b = values[(((xi + 1) % period) + period) % period]
    const t = (1 - Math.cos(f * Math.PI)) * 0.5
    return a + (b - a) * t
  }
}

/** 2D periodic value noise, returns fn(x, y) in lattice units. */
function periodic2D(period, rng) {
  const g = new Float32Array(period * period)
  for (let i = 0; i < g.length; i++) g[i] = rng()
  const at = (x, y) => g[(((y % period) + period) % period) * period + (((x % period) + period) % period)]
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

/** Sobel-free central-difference normal map from a height field. */
export function heightToNormal(heights, width, height, strength = 2, wrap = true) {
  const out = new Uint8Array(width * height * 4)
  const H = (x, y) => {
    if (wrap) {
      x = (x + width) % width
      y = (y + height) % height
    } else {
      x = Math.min(width - 1, Math.max(0, x))
      y = Math.min(height - 1, Math.max(0, y))
    }
    return heights[y * width + x]
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      let nx = -dx
      let ny = -dy
      let nz = 1
      const l = 1 / Math.hypot(nx, ny, nz)
      nx *= l
      ny *= l
      nz *= l
      const i = (y * width + x) * 4
      out[i] = (nx * 0.5 + 0.5) * 255
      out[i + 1] = (ny * 0.5 + 0.5) * 255
      out[i + 2] = (nz * 0.5 + 0.5) * 255
      out[i + 3] = 255
    }
  }
  return out
}

function grayToRGBA(values, width, height, min = 0, max = 1) {
  const out = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = Math.min(255, Math.max(0, (min + (max - min) * values[i]) * 255))
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v
    out[i * 4 + 3] = 255
  }
  return out
}

// ------------------------------------------------------------ metal maps

/** Linear brushed steel (metal-brushed-normal + metal-brushed-roughness). */
export function createBrushed(size = 1024, seed = 11) {
  const rng = mulberry32(seed)
  const fine = periodic1D(size, rng)
  const mid = periodic1D(size / 4, rng)
  const patches = periodic2D(8, rng)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const a = fine(y * 1.0)
    const b = mid(y * 0.25)
    for (let x = 0; x < size; x++) {
      const p = patches((x / size) * 8, (y / size) * 8)
      // streaks drift slightly along x so the brushing never looks ruled
      const c = fine(y + p * 3.0)
      h[y * size + x] = a * 0.45 + c * 0.35 + b * 0.2 * (0.6 + p * 0.4)
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 1.6))
  const roughnessMap = makeData(size, size, grayToRGBA(h, size, size, 0.55, 1.0))
  return { normalMap, roughnessMap }
}

/** Côtes de Genève — rounded stripes with the arcs left by the brushing wheel. */
export function createGeneva(size = 1024, seed = 23) {
  const rng = mulberry32(seed)
  const micro = periodic1D(4096, rng)
  const stripes = 4
  const sw = size / stripes
  const radius = sw * 1.35
  const stamp = sw * 0.9
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = Math.floor(x / sw)
      const cx = (s + 0.5) * sw
      const u = (x - cx) / (sw * 0.5)
      const ridge = Math.sqrt(Math.max(0, 1 - u * u * 0.85))
      // nearest wheel stamp below this pixel (stripe-dependent phase)
      const phase = (s * 0.37 * stamp) % stamp
      const k = Math.floor((y - phase) / stamp)
      const cy = k * stamp + phase - radius * 0.55
      const d = Math.hypot(x - cx, y - cy)
      const arcs = micro(d * 0.9 + s * 500)
      h[y * size + x] = ridge * 0.55 + arcs * 0.06
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 6))
  return { normalMap }
}

/** Perlage (circular graining) — overlapping swirled dots, tileable. */
export function createPerlage(size = 1024, seed = 31) {
  const rng = mulberry32(seed)
  const swirl = periodic1D(512, rng)
  const per = 9
  const s = size / per
  const R = s * 0.72
  const h = new Float32Array(size * size).fill(0.5)
  for (let row = 0; row < per; row++) {
    for (let col = 0; col < per; col++) {
      const cx = col * s + (row % 2 ? s * 0.5 : 0) + rng() * s * 0.08
      const cy = row * s + rng() * s * 0.08
      const off = rng() * 512
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const r = Math.hypot(dx, dy)
          if (r > R) continue
          const px = (((Math.round(cx + dx)) % size) + size) % size
          const py = (((Math.round(cy + dy)) % size) + size) % size
          const ang = Math.atan2(dy, dx)
          const dome = 1 - (r / R) ** 2
          h[py * size + px] = dome * 0.35 + swirl(r * 0.8 + ang * 6 + off) * 0.12
        }
      }
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 5))
  return { normalMap }
}

/** Concentric circular brushing (metal-circles), centred in the texture. */
export function createCircular(size = 1024, seed = 41) {
  const rng = mulberry32(seed)
  const n = periodic1D(8192, rng)
  const h = new Float32Array(size * size)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c)
      h[y * size + x] = n(r * 1.4) * 0.7 + n(r * 0.35 + 4000) * 0.3
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 2.2, false), { wrap: false })
  return { normalMap }
}

/** Sunburst dial: radial brushing + radial anisotropy direction map. */
export function createSunburst(size = 1024, seed = 53) {
  const rng = mulberry32(seed)
  const n = periodic1D(2400, rng)
  const h = new Float32Array(size * size)
  const aniso = new Uint8Array(size * size * 4)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx)
      const t = (a / (Math.PI * 2) + 0.5) * 2400
      h[y * size + x] = n(t + r * 0.004) * 0.8 + n(t * 0.31 + 900) * 0.2
      const i = (y * size + x) * 4
      const ir = r > 0 ? 1 / r : 0
      aniso[i] = ((dx * ir) * 0.5 + 0.5) * 255
      aniso[i + 1] = ((dy * ir) * 0.5 + 0.5) * 255
      aniso[i + 2] = 255
      aniso[i + 3] = 255
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 1.2, false), { wrap: false })
  const anisotropyMap = makeData(size, size, aniso, { wrap: false })
  return { normalMap, anisotropyMap }
}

/** Leather grain for the strap option. */
export function createLeather(size = 512, seed = 61) {
  const rng = mulberry32(seed)
  const pts = []
  const cells = 22
  for (let i = 0; i < cells * cells; i++) pts.push([(i % cells + rng()) / cells, (Math.floor(i / cells) + rng()) / cells])
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const cu = Math.floor(u * cells)
      const cv = Math.floor(v * cells)
      let d1 = 9
      let d2 = 9
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = (cu + i + cells) % cells
          const gy = (cv + j + cells) % cells
          const p = pts[gy * cells + gx]
          let px = p[0] + (cu + i - gx) / cells
          let py = p[1] + (cv + j - gy) / cells
          const d = Math.hypot(px - u, py - v)
          if (d < d1) {
            d2 = d1
            d1 = d
          } else if (d < d2) d2 = d
        }
      }
      h[y * size + x] = Math.min(1, (d2 - d1) * cells * 1.6)
    }
  }
  const normalMap = makeData(size, size, heightToNormal(h, size, size, 1.4))
  return { normalMap }
}

/** Tileable RGB fbm used by the particles (curl lookups) — noise-solid. */
export function createSmoothNoise(size = 256, seed = 71) {
  const rng = mulberry32(seed)
  const data = new Uint8Array(size * size * 4)
  const layers = [0, 1, 2].map(() => [periodic2D(4, rng), periodic2D(8, rng), periodic2D(16, rng), periodic2D(32, rng)])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const i = (y * size + x) * 4
      for (let ch = 0; ch < 3; ch++) {
        const L = layers[ch]
        const val = L[0](u * 4, v * 4) * 0.5 + L[1](u * 8, v * 8) * 0.25 + L[2](u * 16, v * 16) * 0.15 + L[3](u * 32, v * 32) * 0.1
        data[i + ch] = val * 255
      }
      data[i + 3] = 255
    }
  }
  return makeData(size, size, data)
}

/** White noise for film grain. */
export function createGrain(size = 256, seed = 83) {
  const rng = mulberry32(seed)
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = rng() * 255
    data[i * 4 + 1] = rng() * 255
    data[i * 4 + 2] = rng() * 255
    data[i * 4 + 3] = 255
  }
  const tex = makeData(size, size, data)
  tex.generateMipmaps = false
  tex.minFilter = LinearFilter
  return tex
}

// ------------------------------------------------------- canvas textures

/**
 * Detail "additive" environment (metal.exr equivalent): an equirect strip
 * map of thin softboxes and pin lights summed over the main IBL to give
 * the jewellery sparkle on polished edges.
 */
export function createAdditiveEnv(width = 1024) {
  const height = width / 2
  const { canvas, ctx } = makeCanvas(width, height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  const rng = mulberry32(97)
  const strip = (x, y, w, h, alpha) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
  }
  // tall vertical strip lights all around
  for (let i = 0; i < 9; i++) strip(rng() * width, height * 0.18, width * (0.006 + rng() * 0.01), height * 0.6, 0.6 + rng() * 0.4)
  // two horizon bands
  const band = (y, h, a) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, width, h)
  }
  band(height * 0.47, height * 0.03, 0.55)
  band(height * 0.3, height * 0.012, 0.8)
  // pin lights
  for (let i = 0; i < 90; i++) {
    const x = rng() * width
    const y = height * (0.15 + rng() * 0.7)
    const r = 1 + rng() * 3
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = canvasTexture(canvas, { srgb: true, wrap: true })
  tex.wrapT = ClampToEdgeWrapping
  return tex
}

/** Soft baked contact shadow (ShadowPlanes). */
export function createShadow(size = 256) {
  const { canvas, ctx } = makeCanvas(size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.75, 'rgba(0,0,0,0.12)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}

/** Shadow under a hand: blurred silhouette. */
export function createBlurredShape(drawPath, size = 256, blur = 10) {
  const { canvas, ctx } = makeCanvas(size)
  ctx.filter = `blur(${blur}px)`
  ctx.fillStyle = '#000'
  drawPath(ctx, size)
  ctx.fill()
  return canvasTexture(canvas)
}

/**
 * Moon-phase disc (moonphase-bg + moon): midnight lacquer, star field and
 * two golden moons opposite each other, centred texture.
 */
export function createMoonDisc(size = 1024) {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  const bg = ctx.createRadialGradient(c, c, 0, c, c, c)
  bg.addColorStop(0, '#1c2b52')
  bg.addColorStop(1, '#0a1230')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.fill()
  const rng = mulberry32(7)
  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * c * 0.98
    const x = c + Math.cos(a) * r
    const y = c + Math.sin(a) * r
    const s = rng() < 0.08 ? 2.2 : 0.6 + rng() * 1.1
    ctx.fillStyle = `rgba(255,255,255,${0.35 + rng() * 0.65})`
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.fill()
  }
  const moon = (x, y, r) => {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
    g.addColorStop(0, '#fff3cf')
    g.addColorStop(0.6, '#e6c27a')
    g.addColorStop(1, '#b8893d')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(150,105,40,0.25)'
    for (let i = 0; i < 7; i++) {
      ctx.beginPath()
      ctx.arc(x + (rng() - 0.5) * r * 1.2, y + (rng() - 0.5) * r * 1.2, r * (0.08 + rng() * 0.12), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  moon(c, c - c * 0.6, c * 0.22)
  moon(c, c + c * 0.6, c * 0.22)
  return canvasTexture(canvas)
}

/**
 * Printed dial layer (transfer printing): minute track, brand, complication
 * captions. Transparent RGBA, colour depends on the dial lacquer.
 */
export function createDialPrint({ brand = 'ORA', model = '60A', caption = 'AUTOMATIC', subCaption = 'TOURBILLON', color = '#ffffff', size = 2048, displayFont = 'Unbounded', textFont = 'Inter Variable' } = {}) {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  const R = c * 0.985
  ctx.translate(c, c)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'butt'
  // minute track (railway)
  ctx.lineWidth = size * 0.0012
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.955, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.915, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 240; i++) {
    const major = i % 20 === 0
    const minute = i % 4 === 0
    const a = (i / 240) * Math.PI * 2
    const r0 = R * (major ? 0.9 : minute ? 0.915 : 0.935)
    const r1 = R * 0.955
    ctx.lineWidth = size * (major ? 0.0032 : minute ? 0.0016 : 0.0007)
    ctx.beginPath()
    ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0)
    ctx.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1)
    ctx.stroke()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // brand
  ctx.font = `400 ${size * 0.052}px "${displayFont}", sans-serif`
  ctx.letterSpacing = `${size * 0.012}px`
  ctx.fillText(brand, size * 0.006, -R * 0.245)
  ctx.font = `500 ${size * 0.0125}px "${textFont}", sans-serif`
  ctx.letterSpacing = `${size * 0.006}px`
  ctx.fillText(`${caption}  ·  ${model}`, size * 0.003, -R * 0.15)
  // tourbillon caption above the aperture at 6
  ctx.font = `500 ${size * 0.0105}px "${textFont}", sans-serif`
  ctx.fillText(subCaption, size * 0.003, R * 0.145)
  // power-reserve sub-dial at 9 o'clock (pivot at x = -0.95 world units)
  const toPx = c / 1.8
  const pcx = -0.95 * toPx
  const pr = 0.3 * toPx
  ctx.lineWidth = size * 0.0011
  ctx.beginPath()
  ctx.arc(pcx, 0, pr, -Math.PI * 0.5 - 1.1, -Math.PI * 0.5 + 1.1)
  ctx.stroke()
  for (let i = 0; i <= 12; i++) {
    const a = -1.1 + (i / 12) * 2.2
    const major = i % 6 === 0
    const r0 = pr * (major ? 0.8 : 0.88)
    ctx.lineWidth = size * (major ? 0.0024 : 0.0011)
    ctx.beginPath()
    ctx.moveTo(pcx + Math.sin(a) * r0, -Math.cos(a) * r0)
    ctx.lineTo(pcx + Math.sin(a) * pr, -Math.cos(a) * pr)
    ctx.stroke()
  }
  ctx.font = `500 ${size * 0.0095}px "${textFont}", sans-serif`
  ctx.letterSpacing = `${size * 0.002}px`
  ctx.fillText('0', pcx + Math.sin(-1.1) * pr * 1.22, -Math.cos(-1.1) * pr * 1.22)
  ctx.fillText('60', pcx + Math.sin(1.1) * pr * 1.25, -Math.cos(1.1) * pr * 1.25)
  ctx.fillText('RÉSERVE', pcx, pr * 0.42)
  ctx.font = `500 ${size * 0.0095}px "${textFont}", sans-serif`
  ctx.fillText('SAPPHIRE · 42 JEWELS', 0, R * 0.855)
  return canvasTexture(canvas)
}

/**
 * Rehaut (inner flange) print: minute numerals on a strip, wrapped by the
 * conical ring UVs (u = clockwise angle from 12 o'clock).
 */
export function createRehaut({ color = '#2b2b2b', background = '#e9e9e9', width = 4096, height = 160, font = 'Inter Variable' } = {}) {
  const { canvas, ctx } = makeCanvas(width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${height * 0.36}px "${font}", sans-serif`
  for (let i = 0; i < 60; i++) {
    const x = (i / 60) * width
    if (i % 5 === 0) {
      const label = String(i === 0 ? 60 : i).padStart(2, '0')
      ctx.save()
      ctx.translate(x, height * 0.5)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    } else {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, height * 0.35)
      ctx.lineTo(x, height * 0.65)
      ctx.stroke()
    }
  }
  return canvasTexture(canvas, { wrap: true, flipY: false })
}

/** Engraving for the clasp / caseback (light text on transparent). */
export function createEngraving(lines, { size = 1024, font = 'Unbounded' } = {}) {
  const { canvas, ctx } = makeCanvas(size, size / 2)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => {
    ctx.font = `${l.weight || 400} ${size * (l.size || 0.08)}px "${l.font || font}", sans-serif`
    ctx.letterSpacing = `${size * (l.tracking || 0.01)}px`
    ctx.fillText(l.text, size / 2, size / 4 + (i - (lines.length - 1) / 2) * size * 0.11)
  })
  return canvasTexture(canvas)
}

/**
 * Big display word rendered to a texture, used for the vertical typography
 * that slides *behind/through* the watch inside the WebGL scene.
 */
export function createWordTexture(text, { font = 'Unbounded', weight = 400, color = '#1e1e1e', height = 512, tracking = -0.02 } = {}) {
  const probe = makeCanvas(8, 8).ctx
  probe.font = `${weight} ${height * 0.82}px "${font}", sans-serif`
  probe.letterSpacing = `${height * tracking}px`
  const w = Math.ceil(probe.measureText(text).width + height * 0.2)
  const { canvas, ctx } = makeCanvas(w, height)
  ctx.font = probe.font
  ctx.letterSpacing = probe.letterSpacing
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, height * 0.1, height * 0.54)
  const tex = canvasTexture(canvas)
  tex.userData = { aspect: w / height }
  return tex
}
