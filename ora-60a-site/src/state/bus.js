/*
 * Minimal event bus shared by the WebGL engine and the Svelte UI.
 * Event names mirror the original engine (INIT/ATTACH/DETACH_PROJECT…).
 */
export const EVENTS = {
  INIT_PROJECT: 'INIT_PROJECT',
  ATTACH_PROJECT: 'ATTACH_PROJECT',
  DETACH_PROJECT: 'DETACH_PROJECT',
  RESIZE: 'RESIZE',
  POINTER: 'POINTER',
  LOAD_PROGRESS: 'LOAD_PROGRESS',
  LOADED: 'LOADED',
  INTRO: 'INTRO',
  PARTS_SCREEN: 'PARTS_SCREEN',
  PART_SELECT: 'PART_SELECT',
  PART_HOVER: 'PART_HOVER',
  CURSOR: 'CURSOR',
  LONGPRESS: 'LONGPRESS',
  DARK: 'DARK',
  SNAPSHOTS: 'SNAPSHOTS',
  TICK: 'TICK',
}

class Bus {
  constructor() {
    this.map = new Map()
  }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set())
    this.map.get(name).add(fn)
    return () => this.off(name, fn)
  }
  off(name, fn) {
    this.map.get(name)?.delete(fn)
  }
  emit(name, ...args) {
    this.map.get(name)?.forEach((fn) => fn(...args))
  }
}

const bus = new Bus()
export default bus
