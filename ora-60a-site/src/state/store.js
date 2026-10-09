import { writable } from 'svelte/store'

export const loaded = writable(false)
export const introDone = writable(false)
export const finish = writable(0)
export const dial = writable(0)
export const strap = writable(0)
export const locale = writable('en')
export const dict = writable(null)
export const cursor = writable({ text: '', icon: 'none', hover: false, pick: null })
export const longpress = writable(0)
export const selectedPart = writable(null)
export const activeSection = writable('hero')
export const sound = writable(false)
export const isDark = writable(false)
export const snapshots = writable({}) // { 'finish-0': [url…], 'parts-0': {id: url} }

/** Non-reactive handles to the engine (set once in main.js). */
export const engine = {
  scene: null,
  webgl: null,
  lenis: null,
  quality: null,
  config: null,
  snapshotter: null,
  audio: null,
  refresh: () => {},
}
