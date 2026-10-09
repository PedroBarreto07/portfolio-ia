/*
 * THE WATCH — scroll choreography.
 *
 * Sections are sticky "stages" whose heights are expressed in viewport
 * heights (vh). S(id, p) converts a section progress p (0 → 1 over the
 * sticky range) into an absolute scroll position in vh, so every pose
 * below is anchored to the DOM layout and survives any resize.
 *
 * Each keyframe only lists what changes. Everything is continuous: no
 * curtain cuts — the movement is pulled out of the case part by part
 * (staggered inside WatchScene), the case fades away, and after the
 * particle cloud the dust flows back onto the parts, which slide home.
 */

const PI = Math.PI
const H = PI / 2

export const SECTIONS = [
  { id: 'hero', vh: 4.4 },
  { id: 'timeless', vh: 3.2 },
  { id: 'vertical', vh: 2.8 },
  { id: 'disassembly', vh: 5.2 },
  { id: 'mechanism', vh: 6.4 },
  { id: 'curves', vh: 8 },
  { id: 'profile', vh: 4.2 },
  { id: 'editions', vh: 1.8 },
  { id: 'colors', vh: 4.4 },
  { id: 'parts', vh: null },
  { id: 'outro', vh: 2.8 },
]

export function createKeyframes(S, { portrait = false } = {}) {
  const kf = []
  // portrait screens get their own framing (P(desktop, portrait))
  const P = (d, m) => (portrait ? m : d)
  const K = (at, values, ease, easeFor) => kf.push({ at, values, ease, easeFor })

  // ------------------------------------------------------------ 1. HERO
  K(S('hero', 0), {
    camRadius: P(14.5, 16.5),
    camPhi: H,
    camTheta: H,
    camFov: 30,
    camRoll: 0,
    parallax: 1,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
    lookLocal: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
    scale: 1,
    explode: 0,
    disassembly: 0,
    spin: 0,
    caseDissolve: 0,
    movementDissolve: 0,
    darkness: 0,
    bg: 1,
    envRot: 0,
    addRot: 0,
    particles: 0,
    particlesOpacity: 0,
    particlesCloud: 1,
    backdrop: 1,
    backdropScale: 1,
    backdropX: 0,
    vText: 0,
    vTextOpacity: 0,
    overlay: 0,
    overlayDark: 0,
    laser: 0,
    laserX: 0,
    shadow: 1,
    labels: 0,
    interactive: 0,
    drag: 1,
    rowPan: 0,
    autoRotate: 0,
    lineup: 0,
    lineupText: 0,
  })
  K(S('hero', 0.55), { backdrop: 1, shadow: 1 })
  K(S('hero', 0.85), { rotY: -0.42, rotX: 0.14, camRadius: P(14, 16), envRot: 0.9 })
  K(S('hero', 1), { backdrop: 0, shadow: 0, backdropScale: 1.35 })

  // -------------------------------------------------------- 2. TIMELESS
  K(S('timeless', 0), { vText: 0, vTextOpacity: 0 })
  K(S('timeless', 0.08), { vTextOpacity: 1 })
  K(S('timeless', 0.45), { rotY: -0.98, rotX: -0.3, rotZ: 0.14, posX: P(1.9, 0), posY: P(0, 1.3), camRadius: P(17, 19), envRot: 1.9 })
  K(S('timeless', 1), { vText: 1, rotY: -1.18, rotX: -0.36, posX: P(1.75, 0), posY: P(0, 1.3), envRot: 2.3 }, 'sine.inOut', { vText: 'none' })

  // -------------------------------------------------------- 3. VERTICAL
  K(S('vertical', 0.06), { vTextOpacity: 0 })
  K(S('vertical', 0.42), { rotY: -H, rotX: 0.06, rotZ: 0, posX: P(-1.3, -2.5), posY: 0, camRadius: 16.5, envRot: 3.0 })
  K(S('vertical', 0.85), { rotY: -H - 0.14, rotX: 0.1, camRadius: 16, envRot: 3.5 })

  // ----------------------------------------------------- 4. DISASSEMBLY
  // turn to a three-quarter row view with the case still closed…
  K(S('disassembly', 0.16), {
    rotY: P(-1.12, 0.2),
    rotX: P(0.16, 1.12),
    rotZ: 0,
    posX: P(0, 0.35),
    posY: P(-0.35, 0),
    camRadius: 17.5,
    envRot: 4.0,
    explode: 0,
    disassembly: 0,
    caseDissolve: 0,
  })
  // …then pull the movement out, part after part, while the case fades
  K(S('disassembly', 0.24), { caseDissolve: 0 })
  K(S('disassembly', 0.44), { caseDissolve: 1 })
  K(S('disassembly', 0.48), { explode: 1, disassembly: 1 }, 'none')
  K(S('disassembly', 0.5), { laser: 0, laserX: -0.05 })
  K(S('disassembly', 0.54), { laser: 1 })
  K(S('disassembly', 0.68), { laserX: 1.05 }, 'power1.inOut')
  K(S('disassembly', 0.72), { laser: 0 })
  K(S('disassembly', 0.5), { labels: 0 })
  K(S('disassembly', 0.58), { labels: 1 })
  K(S('disassembly', 0.9), { labels: 1 })
  K(S('disassembly', 0.97), { labels: 0 })
  K(S('disassembly', 0.54), { interactive: 0 })
  K(S('disassembly', 0.55), { interactive: 1 }, 'hold')
  K(S('disassembly', 0.9), { interactive: 1 })
  K(S('disassembly', 0.91), { interactive: 0 }, 'hold')
  K(S('disassembly', 0.95), { rotY: P(-1.05, 0.26), camRadius: 17, envRot: 4.6 })

  // ------------------------------------------------- 5. MECHANICAL HEART
  K(S('mechanism', 0), { darkness: 0, explode: 1, spin: 0 })
  K(S('mechanism', 0.12), { darkness: 1 })
  K(S('mechanism', 0.4), { particles: 0, particlesOpacity: 0, movementDissolve: 0 })
  K(S('mechanism', 0.46), { particlesOpacity: 1 })
  K(S('mechanism', 0.48), { spin: 1, explode: 1.12, posY: 0, posX: 0, rotY: -0.42, rotX: 0.55, rotZ: 0.2, camRadius: 15.5, camPhi: H - 0.12, envRot: 6.0 })
  K(S('mechanism', 0.74), { particles: 0.72, movementDissolve: 1, particlesOpacity: 1 })
  K(S('mechanism', 1), { particles: 1, particlesOpacity: 0.55, camRadius: 17.5, rotY: 0.4, camTheta: H + 0.35, envRot: 7.0 })

  // ---------------------------------------------------------- 6. CURVES
  // the dust flows back onto the parts while the studio lights come on…
  K(S('curves', 0.02), { particles: 1, darkness: 1, spin: 1, explode: 1.12, movementDissolve: 1, particlesOpacity: 1 })
  K(S('curves', 0.15), { darkness: 0 })
  K(
    S('curves', 0.16),
    { particles: 0, spin: 0, explode: 1, rotY: 0.1, rotX: 0.3, rotZ: 0.08, camRadius: 17, camTheta: H, camPhi: H - 0.05, envRot: 7.2, lookLocal: 0, lookX: 0, lookY: 0, lookZ: 0 },
    'power2.inOut',
  )
  K(S('curves', 0.08), { movementDissolve: 1 })
  K(S('curves', 0.17), { movementDissolve: 0 })
  K(S('curves', 0.13), { particlesOpacity: 1 })
  K(S('curves', 0.2), { particlesOpacity: 0 })
  // …then every part slides home and the case closes around them
  K(S('curves', 0.32), { explode: 0, disassembly: 0 }, 'none')
  K(S('curves', 0.22), { caseDissolve: 1 })
  K(S('curves', 0.33), { caseDissolve: 0 })
  K(S('curves', 0.34), { rotX: 0, rotY: 0, rotZ: 0, lookLocal: 1, lookX: 0, lookY: 0, lookZ: 0.2, camRadius: 9.6, camPhi: H, envRot: 7.6 }, 'power2.inOut')
  K(S('curves', 0.58), { camRadius: 8.8, rotZ: -0.05, rotX: 0.04, envRot: 8.3 })
  K(S('curves', 0.66), { rotY: -0.9, rotX: 0.08, rotZ: 0, lookX: 1.2, lookY: 0.1, lookZ: 0.15, camRadius: 8.2, camTheta: H - 0.08, envRot: 9.2 })
  K(S('curves', 0.95), { rotY: -1.05, camRadius: 7.8, envRot: 9.8 })

  // --------------------------------------------------------- 7. PROFILE
  K(S('profile', 0.16), { rotX: -H, rotY: 0, rotZ: -H, lookX: 0, lookY: 0, lookZ: -1.45, camRadius: P(14.5, 15), camPhi: H - 0.07, camTheta: H, envRot: 10.8 })
  K(S('profile', 0.45), { camRadius: P(13.8, 14.5), envRot: 11.4 })
  K(S('profile', 0.66), { lookX: 0, lookY: -1.6, lookZ: -4.3, camRadius: 6.8, camPhi: H + 0.32, envRot: 12.2 })
  K(S('profile', 0.95), { lookY: -0.8, camRadius: 6.4, envRot: 12.8 })

  // -------------------------------------------------------- 8. EDITIONS
  K(S('editions', 0), { posY: 0, lookLocal: 1, camPhi: H + 0.32 })
  K(S('editions', 0.55), { lookLocal: 0, lookX: 0, lookY: 0, lookZ: 0, posY: 12, camRadius: 15, camPhi: H, rotX: -0.3, rotY: 0.5, rotZ: 0 }, 'power2.in')

  // ---------------------------------------------- 9. COLORS / 10. PARTS
  K(S('colors', 0.98), { posY: 12, posX: 0, rotX: 0.12, rotY: 0.35, rotZ: 0, camRadius: 15, backdrop: 0, autoRotate: 0 })
  K(S('colors', 1), { posX: P(-3.5, 0), scale: P(0.92, 0.7), backdropScale: 0.95 }, 'hold')
  K(S('parts', 0, -0.6), { posY: 12 })
  K(S('parts', 0, 0.05), { posY: P(1.1, 2.7), backdrop: 1, autoRotate: 1 }, 'power3.out')

  // ---------------------------------------------------------- 11. OUTRO
  // the configured watch leaves upward while the four finishes rise in
  K(S('outro', 0, -0.45), { posY: P(1.1, 2.7), backdrop: 1, camRadius: 15 })
  K(S('outro', 0, -0.05), { lineup: 0 })
  K(S('outro', 0, 0.08), { posY: 12, backdrop: 0, scale: 1 }, 'power2.in')
  K(S('outro', 0.3), { camRadius: P(18, 19), posX: 0, rotX: 0, rotY: 0 })
  K(S('outro', 0.34), { lineup: 1 }, 'none')
  K(S('outro', 0.08), { lineupText: 0 })
  K(S('outro', 0.4), { lineupText: 1 }, 'power2.out')

  return kf
}
