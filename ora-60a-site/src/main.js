import '@fontsource/unbounded/300.css'
import '@fontsource/unbounded/400.css'
import '@fontsource-variable/inter'
import '@fontsource/eb-garamond/400-italic.css'
import './styles/global.css'

import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { mount } from 'svelte'
import { get } from 'svelte/store'

import config from './assets/jsons/configs/default.json'
import Ratchet from './audio/Ratchet.js'
import App from './app/App.svelte'
import project from './packages/the-watch/index.js'
import bus, { EVENTS } from './state/bus.js'
import * as store from './state/store.js'
import Interactions from './webgl/Interactions.js'
import { detectQuality } from './webgl/quality.js'
import WatchScene, { STATE_DEFAULTS } from './webgl/Scene/WatchScene.js'
import ScrollTimeline from './webgl/ScrollTimeline.js'
import Snapshotter from './webgl/Snapshotter.js'
import Webgl from './webgl/Webgl.js'

// ------------------------------------------------------------------ GSAP
gsap.registerPlugin(ScrollTrigger, CustomEase)
gsap.config({ force3D: true })
gsap.defaults({ ease: 'none', duration: 0.5 })
CustomEase.create('brand.zoomIn', '0.9, 0.0, 0.4, 1.0')
CustomEase.create('brand.zoomOut', '0.4, 0.0, 0.1, 1.0')
CustomEase.create('brand.posIn', '0.4, 0.0, 0.1, 1.0')
CustomEase.create('brand.posOut', '0.9, 0.0, 0.4, 1.0')
CustomEase.create('brand.expoOut', '0.14, 1.0, 0.34, 1.0')
CustomEase.create('brand.expoIn', '0.66, 0.0, 0.86, 0.0')
CustomEase.create('brand.expoInOut', '0.225, 0.415, 0.3, 1')

const params = new URLSearchParams(location.search)
const T = (window.__oraTimes = [['main', Math.round(performance.now())]])
const mark = (l) => T.push([l, Math.round(performance.now())])
const quality = detectQuality()
const { engine } = store
engine.quality = quality
engine.config = config
document.documentElement.classList.toggle('is-mobile', quality.mobile)
document.documentElement.classList.toggle('is-reduced', quality.reduced)

// ----------------------------------------------------------- viewport --vh
let lastWidth = 0
function setVh(force = false) {
  // only on width change: mobile URL bars must not make the layout jump
  if (!force && window.innerWidth === lastWidth) return
  lastWidth = window.innerWidth
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}
setVh(true)

// ------------------------------------------------------------------ Lenis
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
const lenis = new Lenis({
  duration: quality.reduced ? 1.1 : quality.mobile ? 1.6 : quality.prefersReduced ? 3.2 : 4,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  syncTouch: false,
  autoRaf: false,
})
lenis.stop()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)
engine.lenis = lenis

// ------------------------------------------------- i18n + configurator URL
const urlLang = params.get('lang')
const lang = urlLang || ((navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en')
const { lang: loadedLang, dict } = await project.loadLocale(lang)
store.locale.set(loadedLang)
store.dict.set(dict)
document.documentElement.lang = loadedLang === 'pt' ? 'pt-BR' : 'en-GB'

const indexOf = (list, id) => Math.max(0, list.findIndex((x) => x.id === id))
store.finish.set(indexOf(config.finishes, params.get('finish')))
store.dial.set(indexOf(config.dials, params.get('dial')))
store.strap.set(indexOf(config.straps, params.get('strap')))

// --------------------------------------------------------------- the app
const audio = new Ratchet()
engine.audio = audio
mark('pre-mount')
mount(App, { target: document.getElementById('root') })
mark('mounted')

// ----------------------------------------------------------------- WebGL
const webgl = new Webgl({ container: document.getElementById('canvas-wrapper'), quality })
const scene = new WatchScene({ webgl, config, quality })
// display transform from default.json
const postUniforms = webgl.post.uniforms
const POST_KEYS = { exposure: 'uExposure', contrast: 'uContrast', gamma: 'uGamma', saturation: 'uSaturation', noise: 'uNoise', fisheye: 'uFisheye', vignette: 'uVignette' }
for (const [k, u] of Object.entries(POST_KEYS)) if (config.post[k] !== undefined) postUniforms[u].value = config.post[k]
engine.webgl = webgl
engine.scene = scene

const timeline = new ScrollTimeline(STATE_DEFAULTS)
function measure() {
  const vh = window.innerHeight
  const map = {}
  document.querySelectorAll('[data-section]').forEach((el) => {
    const r = el.getBoundingClientRect()
    map[el.dataset.section] = { top: (r.top + window.scrollY) / vh, height: el.offsetHeight / vh }
  })
  const S = (id, p, offset = 0) => {
    const s = map[id]
    if (!s) return 0
    return s.top + p * Math.max(0.001, s.height - 1) + offset
  }
  engine.sectionMap = map
  engine.S = S
  engine.portrait = window.innerWidth / window.innerHeight < 0.8
  timeline.build(project.createKeyframes(S, { portrait: engine.portrait }))
}
ScrollTrigger.addEventListener('refresh', measure)
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    setVh()
    ScrollTrigger.refresh()
  }, 100)
})
engine.refresh = () => ScrollTrigger.refresh()

// ---------------------------------------------------------------- loader
const loaderEl = document.getElementById('loader')
const arc = loaderEl.querySelector('.progress-arc')
const valueEl = loaderEl.querySelector('.loader-value')
const CIRC = 2073.45
let shown = 0
function setLoader(p) {
  shown = Math.max(shown, p)
  arc.style.strokeDashoffset = `${CIRC * (1 - shown)}`
  valueEl.textContent = String(Math.round(shown * 100)).padStart(3, '0')
  bus.emit(EVENTS.LOAD_PROGRESS, shown)
}

mark('pre-load')
try {
  await scene.load((p) => setLoader(p * 0.96))
} catch (err) {
  console.error(err)
  loaderEl.querySelector('.loader-label').textContent = 'WebGL is unavailable on this device.'
  throw err
}

mark('loaded')
// first render with the URL configuration
scene.applyFinish(get(store.finish), { immediate: true })
scene.applyDial(get(store.dial), { immediate: true })
scene.applyStrap(get(store.strap))
let prevFinish = get(store.finish)
let prevDial = get(store.dial)
store.finish.subscribe((i) => i !== prevFinish && (scene.applyFinish(i), (prevFinish = i), syncURL()))
store.dial.subscribe((i) => i !== prevDial && (scene.applyDial(i), (prevDial = i), syncURL()))
store.strap.subscribe((i) => (scene.applyStrap(i), syncURL()))
store.locale.subscribe(() => syncURL())
store.sound.subscribe((on) => audio.setEnabled(on))

function syncURL() {
  const u = new URL(location.href)
  u.searchParams.set('finish', config.finishes[get(store.finish)].id)
  u.searchParams.set('dial', config.dials[get(store.dial)].id)
  u.searchParams.set('strap', config.straps[get(store.strap)].id)
  u.searchParams.set('lang', get(store.locale))
  history.replaceState(null, '', u)
}

const interactions = new Interactions({ scene, webgl, audio, quality })
engine.interactions = interactions

// ------------------------------------------------------------ frame loop
let isDarkNow = false
const autoscroll = params.has('autoscroll') ? Number(params.get('autoscrollspeed') || 1) : 0
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 1 / 20)
  if (autoscroll && get(store.introDone)) lenis.scrollTo(lenis.targetScroll + autoscroll * dt * 120, { immediate: true })
  const x = (lenis.animatedScroll ?? window.scrollY) / window.innerHeight
  timeline.evaluate(x, scene.state)
  engine.debugOverride?.(scene.state)
  interactions.update()
  scene.update(dt, time, lenis.velocity || 0)
  webgl.render(dt, time)
  const dark = scene.state.darkness > 0.5
  if (dark !== isDarkNow) {
    isDarkNow = dark
    document.documentElement.classList.toggle('is-dark', dark)
    store.isDark.set(dark)
  }
})

// ----------------------------------------------------------------- start
ScrollTrigger.refresh()
measure()
setLoader(1)
await new Promise((r) => setTimeout(r, 350))
loaderEl.classList.add('is-done')
mark('done')
store.loaded.set(true)
scene.playIntro()
bus.emit(EVENTS.INTRO)
setTimeout(() => {
  lenis.start()
  store.introDone.set(true)
}, quality.reduced ? 200 : 1400)

// studio renders for the gallery / parts list, generated when idle
const snapshotter = new Snapshotter({ webgl, scene, config, quality })
engine.snapshotter = snapshotter
snapshotter.start()

// -------------------------------------------- optional analytics beacon
// set VITE_CF_BEACON=<token> in .env to enable Cloudflare Web Analytics
if (import.meta.env.VITE_CF_BEACON) {
  const sc = document.createElement('script')
  sc.defer = true
  sc.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  sc.dataset.cfBeacon = JSON.stringify({ token: import.meta.env.VITE_CF_BEACON })
  document.head.appendChild(sc)
}

// ------------------------------------------------------------ dev hooks
if (params.has('debug')) import('./webgl/Debug.js').then((m) => m.default({ scene, webgl, config, timeline, engine }))
if (import.meta.env.DEV || params.has('shots')) {
  window.__ora = {
    lenis,
    scene,
    webgl,
    timeline,
    engine,
    async exportGLB() {
      const buffer = await scene.exportGLB()
      return btoa(Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(''))
    },
    goto(id, p = 0, offset = 0) {
      const y = engine.S(id, p, offset) * window.innerHeight
      lenis.scrollTo(y, { immediate: true, force: true })
    },
  }
}
