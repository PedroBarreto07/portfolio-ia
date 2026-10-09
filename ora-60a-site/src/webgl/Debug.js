import GUI from 'lil-gui'
import { get } from 'svelte/store'
import { dial, finish, strap } from '../state/store.js'
import { STATE_DEFAULTS } from './Scene/WatchScene.js'
import { downloadBuffer } from './Scene/GLBExport.js'

/*
 * ?debug — live tweaking panel (lil-gui):
 *  - post-processing (exposure, contrast, gamma, grain…)
 *  - every material of default.json, bound to all materials using it
 *  - configurator (finish / dial / strap)
 *  - timeline override: freeze any choreography param
 *  - FPS meter, export of the edited config as JSON
 */
export default function Debug({ scene, webgl, config, timeline, engine }) {
  const gui = new GUI({ title: 'ORA 60A — debug', width: 300 })
  gui.domElement.style.zIndex = 2000
  gui.domElement.setAttribute('data-interactive', '')
  gui.domElement.setAttribute('data-lenis-prevent', '')

  // ---------------------------------------------------------------- fps
  const meter = document.createElement('div')
  Object.assign(meter.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: 2000,
    font: '11px/1.4 monospace',
    color: '#fff',
    background: '#000c',
    padding: '6px 8px',
    borderRadius: '4px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
  })
  document.body.appendChild(meter)
  let frames = 0
  let last = performance.now()
  const tick = () => {
    frames++
    const now = performance.now()
    if (now - last > 500) {
      const fps = (frames * 1000) / (now - last)
      const info = webgl.renderer.info
      const x = (engine.lenis.animatedScroll / window.innerHeight).toFixed(2)
      meter.textContent = `${fps.toFixed(0)} fps · dpr ${webgl.dpr.toFixed(2)} · ${info.render.calls} calls\nscroll ${x} vh · ${engine.portrait ? 'portrait' : 'landscape'}`
      frames = 0
      last = now
    }
    requestAnimationFrame(tick)
  }
  tick()

  // --------------------------------------------------------------- post
  const post = webgl.post.uniforms
  const fPost = gui.addFolder('Post-processing')
  const postMap = { exposure: 'uExposure', contrast: 'uContrast', gamma: 'uGamma', saturation: 'uSaturation', noise: 'uNoise', fisheye: 'uFisheye', vignette: 'uVignette' }
  const postRanges = { exposure: [0.2, 3], contrast: [0.5, 2], gamma: [1, 3], saturation: [0, 2], noise: [0, 0.3], fisheye: [0, 1], vignette: [0, 2] }
  for (const [k, u] of Object.entries(postMap)) {
    post[u].value = config.post[k] ?? post[u].value
    fPost
      .add(config.post, k, ...postRanges[k], 0.001)
      .onChange((v) => (post[u].value = v))
  }
  fPost.close()

  // ---------------------------------------------------------- materials
  const fMat = gui.addFolder('Materials (default.json)')
  const byKey = (key) => scene.matGroups.all.filter((m) => m.userData.configKey === key)
  for (const [key, params] of Object.entries(config.materials)) {
    const mats = byKey(key)
    if (!mats.length) continue
    const f = fMat.addFolder(key)
    const apply = () =>
      mats.forEach((m) => {
        if (params.color) m.color.set(params.color)
        for (const p of ['roughness', 'metalness', 'envMapIntensity', 'additiveEnvMapIntensity', 'opacity', 'anisotropy']) if (params[p] !== undefined) m[p] = params[p]
        if (params.normalScale !== undefined && m.normalScale) m.normalScale.set(params.normalScale, params.normalScale)
      })
    if (params.color) f.addColor(params, 'color').onChange(apply)
    for (const [p, range] of Object.entries({ roughness: [0, 1], metalness: [0, 1], envMapIntensity: [0, 6], additiveEnvMapIntensity: [0, 3], normalScale: [0, 2], anisotropy: [0, 1], opacity: [0, 1] })) {
      if (params[p] === undefined && !['envMapIntensity', 'additiveEnvMapIntensity'].includes(p)) continue
      if (params[p] === undefined) params[p] = p === 'envMapIntensity' ? 1 : 0.3
      f.add(params, p, ...range, 0.001).onChange(apply)
    }
    f.close()
  }
  fMat.close()

  // ----------------------------------------------------------- finishes
  const fFin = gui.addFolder('Configurator')
  const sel = {
    finish: get(finish),
    dial: get(dial),
    strap: get(strap),
  }
  fFin.add(sel, 'finish', Object.fromEntries(config.finishes.map((f, i) => [f.id, i]))).onChange((v) => finish.set(Number(v)))
  fFin.add(sel, 'dial', Object.fromEntries(config.dials.map((f, i) => [f.id, i]))).onChange((v) => dial.set(Number(v)))
  fFin.add(sel, 'strap', Object.fromEntries(config.straps.map((f, i) => [f.id, i]))).onChange((v) => strap.set(Number(v)))
  config.finishes.forEach((fin) => {
    const f = fFin.addFolder(`finish: ${fin.id}`)
    const refresh = () => scene.applyFinish(scene.finishIndex, { immediate: true })
    for (const part of ['glossy', 'brushed']) {
      f.addColor(fin[part], 'color').name(`${part} color`).onChange(refresh)
      f.add(fin[part], 'roughness', 0, 1, 0.001).name(`${part} roughness`).onChange(refresh)
      f.add(fin[part], 'metalness', 0, 1, 0.001).name(`${part} metalness`).onChange(refresh)
    }
    f.close()
  })
  fFin.close()

  // ------------------------------------------------- timeline override
  const fTl = gui.addFolder('Choreography override')
  const overrides = {}
  const values = { ...STATE_DEFAULTS }
  const RANGES = {
    camRadius: [1, 40], camPhi: [0, Math.PI], camTheta: [0, Math.PI * 2], camFov: [10, 80],
    rotX: [-Math.PI, Math.PI], rotY: [-Math.PI, Math.PI], rotZ: [-Math.PI, Math.PI],
    posX: [-10, 10], posY: [-10, 15], explode: [0, 1.5], disassembly: [0, 1], spin: [0, 2],
    caseDissolve: [0, 1], movementDissolve: [0, 1], darkness: [0, 1], bg: [0, 2], envRot: [-10, 10],
    particles: [0, 1], particlesOpacity: [0, 1], backdrop: [0, 1], overlay: [0, 2], laser: [0, 1], laserX: [0, 1],
  }
  for (const [k, range] of Object.entries(RANGES)) {
    overrides[k] = false
    const row = fTl.addFolder(k)
    row.add(overrides, k).name('override')
    row.add(values, k, ...range, 0.001).name('value').listen()
    row.close()
  }
  fTl.add({ log: () => console.table({ ...scene.state }) }, 'log').name('log current state')
  fTl.close()
  engine.debugOverride = (state) => {
    for (const k in overrides) {
      if (overrides[k]) state[k] = values[k]
      else values[k] = state[k]
    }
  }

  // ---------------------------------------------------------------- io
  gui
    .add(
      {
        export: () => {
          const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = 'default.json'
          a.click()
        },
      },
      'export',
    )
    .name('⬇ export default.json')
  gui.add({ glb: async () => downloadBuffer(await scene.exportGLB()) }, 'glb').name('⬇ export watch.glb (Blender)')

  return gui
}
