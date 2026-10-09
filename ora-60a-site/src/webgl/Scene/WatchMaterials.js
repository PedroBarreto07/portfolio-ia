import { Color, MeshBasicMaterial, Vector2 } from 'three'
import { SixtyMaterial } from '../Materials/PBR/SixtyMaterial.js'

/*
 * Builds every material of the watch from the JSON config
 * (src/assets/jsons/configs/default.json) + the procedural textures.
 * Materials are grouped so the scene can:
 *  - tween the 4 finishes (glossy/brushed sets) without swapping materials,
 *  - dissolve the case/bracelet or the movement independently.
 */

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

export function createMaterials({ config, tex }) {
  const C = config.materials
  const add = tex.additiveEnv

  const make = (key, extra = {}) => {
    const c = C[key] || {}
    const m = new SixtyMaterial(
      clean({
        color: c.color,
        roughness: c.roughness,
        metalness: c.metalness,
        envMapIntensity: c.envMapIntensity ?? 1,
        additiveEnvMap: add,
        additiveEnvMapIntensity: c.additiveEnvMapIntensity ?? 0.3,
        roughnessMapIntensity: c.roughnessMapIntensity ?? 1,
        ior: c.ior,
        opacity: c.opacity,
        ...extra,
      }),
    )
    if (c.normalScale !== undefined && m.normalMap) m.normalScale = new Vector2(c.normalScale, c.normalScale)
    if (c.anisotropy) m.anisotropy = c.anisotropy
    m.name = key
    m.userData.configKey = key
    return m
  }

  const withRepeat = (t, rx, ry = rx, rot = 0) => {
    const c = t.clone()
    c.repeat.set(rx, ry)
    c.rotation = rot
    c.center.set(0.5, 0.5)
    c.needsUpdate = true
    return c
  }

  const m = {}
  // finish-driven metals
  m.glossy = make('metal-glossy')
  m.glossyDial = make('metal-glossy')
  m.brushed = make('metal-brushed', {
    normalMap: withRepeat(tex.brushed.normalMap, 4, 1),
    roughnessMap: withRepeat(tex.brushed.roughnessMap, 4, 1),
  })
  m.brushedLinks = make('metal-brushed', {
    normalMap: withRepeat(tex.brushed.normalMap, 1, 1, Math.PI / 2),
    roughnessMap: withRepeat(tex.brushed.roughnessMap, 1, 1, Math.PI / 2),
  })

  // movement
  m.steel = make('steel')
  m.gilt = make('gilt')
  m.logo = make('logo')
  m.crownLogo = make('logo')
  m.ruby = make('ruby', { additiveEnvMapIntensity: 1.2 })
  m.blued = make('blued')
  m.perlage = make('metal-perlage', { normalMap: withRepeat(tex.perlage.normalMap, 0.42, 0.42) })
  m.geneva = make('metal-geneva', { normalMap: withRepeat(tex.geneva.normalMap, 0.62, 0.62, 0.42) })
  m.circles = make('metal-circles', { normalMap: tex.circular.normalMap })
  m.glass = make('glass', { glass: true, additiveEnvMapIntensity: 0.25 })
  m.dial = make('dial', { normalMap: tex.sunburst.normalMap, anisotropyMap: tex.sunburst.anisotropyMap })
  m.dialPrint = new SixtyMaterial({
    map: tex.dialPrint,
    transparent: true,
    depthWrite: false,
    roughness: 0.45,
    metalness: 0,
    envMapIntensity: 1.2,
    ambientIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  m.rehaut = new SixtyMaterial({ map: tex.rehaut, roughness: 0.55, metalness: 0, envMapIntensity: 1.3, ambientIntensity: 0.25 })
  m.moon = new SixtyMaterial({ map: tex.moon, roughness: 0.32, metalness: 0.15, envMapIntensity: 1.1, ambientIntensity: 0.45 })
  m.engraving = new SixtyMaterial({ map: tex.engraving, color: '#6f6f6f', transparent: true, depthWrite: false, roughness: 0.55, metalness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
  m.engravingPlate = new SixtyMaterial({ map: tex.engravingPlate, color: '#f0c98a', transparent: true, depthWrite: false, roughness: 0.25, metalness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
  m.engravingRotor = new SixtyMaterial({ map: tex.engravingRotor, color: '#f0c98a', transparent: true, depthWrite: false, roughness: 0.25, metalness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
  m.leather = make('leather', { normalMap: withRepeat(tex.leather.normalMap, 2.2, 2.2), additiveEnvMapIntensity: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color('#8a6a55') })
  m.stitch = new SixtyMaterial({ color: '#e9dfcf', roughness: 0.85, metalness: 0, ambientIntensity: 0.2 })
  m.handShadow = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
  m.shadow = new MeshBasicMaterial({ map: tex.shadow, transparent: true, opacity: 0.4, depthWrite: false })

  // every material knows its dictionary key (used by the GLB pipeline)
  for (const [k, mat] of Object.entries(m)) {
    mat.userData.matKey = k
    if (!mat.name) mat.name = k
  }

  const groups = {
    finishGlossy: [m.glossy, m.glossyDial],
    finishBrushed: [m.brushed, m.brushedLinks],
    case: [m.glossy, m.brushed, m.brushedLinks, m.glass, m.rehaut, m.crownLogo, m.engraving, m.leather, m.stitch],
    movement: [m.steel, m.gilt, m.logo, m.ruby, m.blued, m.perlage, m.geneva, m.circles, m.dial, m.dialPrint, m.moon, m.glossyDial, m.engravingPlate, m.engravingRotor],
    all: Object.values(m).filter((x) => x.isSixtyMaterial),
  }
  // case / bracelet fade out (instead of a hard cut) when the movement is
  // taken out: render them in the transparent pass, depth-writing, so they
  // look exactly opaque at full opacity
  groups.case.forEach((mat) => {
    if (mat.defines.SIXTY_GLASS !== undefined) return
    mat.transparent = true
    if (mat !== m.engraving) mat.depthWrite = true
  })
  // the movement fades in/out of the particle cloud with alpha-to-coverage
  // (MSAA dithering): order independent, depth-correct, no sorting artefacts
  groups.movement.forEach((mat) => {
    if (!mat.transparent) mat.alphaToCoverage = true
  })
  return { materials: m, groups }
}

/** Apply a flat param object ({color, roughness…}) to a SixtyMaterial. */
export function applyParams(mat, p) {
  if (p.color !== undefined) mat.color.set(p.color)
  for (const k of ['roughness', 'metalness', 'envMapIntensity', 'additiveEnvMapIntensity', 'roughnessMapIntensity', 'opacity', 'anisotropy']) {
    if (p[k] !== undefined) mat[k] = p[k]
  }
  if (p.normalScale !== undefined && mat.normalScale) mat.normalScale.set(p.normalScale, p.normalScale)
}
