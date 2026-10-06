import './styles/main.css';
import { setLang, getLang } from './core/i18n.js';
import { ReadingMode } from './ui/ReadingMode.js';

setLang(getLang());

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function boot() {
  if (!hasWebGL()) {
    // Fallback estático: todo o conteúdo em uma página rolável
    document.getElementById('splash').remove();
    document.getElementById('webgl').remove();
    const r = new ReadingMode({ fallback: true });
    r.el.classList.add('is-open');
    return;
  }
  document.body.classList.add('bands-intro');
  const { Experience } = await import('./core/Experience.js');
  const exp = new Experience(document.getElementById('webgl'));
  await exp.load();
}

boot();
