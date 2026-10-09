import { createKeyframes, SECTIONS } from './choreography.js'

/*
 * "the-watch" project package. The engine (webgl/, state/, app/) is
 * project-agnostic; a project brings its sections, choreography and
 * locales. Locales are code-split and loaded on demand.
 */
const LOCALES = {
  en: () => import('./locales/en_GB.js'),
  pt: () => import('./locales/pt_BR.js'),
}

export default {
  id: 'the-watch',
  sections: SECTIONS,
  createKeyframes,
  locales: Object.keys(LOCALES),
  async loadLocale(lang) {
    const key = LOCALES[lang] ? lang : 'en'
    const mod = await LOCALES[key]()
    return { lang: key, dict: mod.default }
  },
}
