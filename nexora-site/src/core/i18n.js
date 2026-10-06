import { DEFAULT_LANG } from '../config.js';
import { bus } from './EventBus.js';

// Idioma atual (persistido por visitante)
let lang = DEFAULT_LANG;
try {
  const saved = localStorage.getItem('nx-lang');
  if (saved === 'pt' || saved === 'en') lang = saved;
} catch {}

export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try {
    localStorage.setItem('nx-lang', l);
  } catch {}
  document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
  bus.emit('lang', l);
}
// t({pt, en}) → string/array no idioma atual
export const t = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj) ? obj[lang] ?? obj.en : obj);
