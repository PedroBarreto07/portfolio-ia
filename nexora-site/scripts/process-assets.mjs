// Converte os originais de /assets-src em versões otimizadas para a web em /public/assets.
// Usa o Chrome headless (decodificação/redimensionamento de imagens enormes, TIFF e EXR).
// Uso: node scripts/process-assets.mjs        (rode antes `node scripts/fetch-assets.mjs`)
import { createServer } from 'node:http';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const SRC = resolve(root, 'assets-src');
const OUT = resolve(root, 'public/assets');

// Região "herói" da Terra em alta resolução (o que a câmera vê da órbita): costa do Brasil / Atlântico Sul
export const EARTH_DETAIL = { lon0: -75, lon1: -5, lat0: 15, lat1: -40 };

const MIME = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.tif': 'image/tiff', '.exr': 'application/octet-stream', '.html': 'text/html' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>`);
    return;
  }
  if (url.startsWith('/src/')) file = resolve(SRC, url.slice(5));
  else if (url.startsWith('/three/')) file = resolve(root, 'node_modules/three', url.slice(7));
  if (!file || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  protocolTimeout: 600000,
  args: ['--use-angle=d3d11', '--enable-gpu', '--js-flags=--max-old-space-size=8192'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log('  [page]', m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.exposeFunction('saveFile', (rel, b64) => {
  const dest = resolve(OUT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(b64, 'base64'));
  console.log(`✓ ${rel} (${(statSync(dest).size / 1e6).toFixed(2)} MB)`);
});
await page.goto(`http://localhost:${PORT}/`);

// utilitários dentro da página
await page.evaluate(() => {
  window.toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  window.encode = async (canvas, out, quality = 0.85) => {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    await window.saveFile(out, await window.toB64(blob));
  };
  // redimensiona (e opcionalmente recorta) uma imagem do assets-src
  window.resize = async (src, out, w, h, quality = 0.85, crop = null) => {
    const blob = await (await fetch('/src/' + src)).blob();
    const opts = { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' };
    const bmp = crop ? await createImageBitmap(blob, crop[0], crop[1], crop[2], crop[3], opts) : await createImageBitmap(blob, opts);
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    await window.encode(c, out, quality);
  };
});

const job = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    process.exitCode = 1;
  }
  console.log(`  (${name}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
};

/* ----------------------------- Terra (NASA) ----------------------------- */
await job('earth day 4k', () => page.evaluate(() => window.resize('earth/bluemarble_21600.jpg', 'earth/day_4k.jpg', 4096, 2048, 0.9)));
await job('earth day detail', () =>
  page.evaluate((d) => {
    const ppd = 21600 / 360; // pixels por grau
    const x = (d.lon0 + 180) * ppd;
    const y = (90 - d.lat0) * ppd;
    const w = (d.lon1 - d.lon0) * ppd;
    const h = (d.lat0 - d.lat1) * ppd;
    const ow = 4096;
    const oh = Math.round((ow * h) / w);
    return window.resize('earth/bluemarble_21600.jpg', 'earth/day_detail.jpg', ow, oh, 0.9, [x, y, w, h]);
  }, EARTH_DETAIL)
);
await job('earth night 4k', () => page.evaluate(() => window.resize('earth/blackmarble_3km.jpg', 'earth/night_4k.jpg', 4096, 2048, 0.88)));
await job('earth clouds (TIFF → JPG)', () =>
  page.evaluate(async (d) => {
    const { default: UTIF } = await import('/three/examples/jsm/libs/utif.module.js');
    const buf = await (await fetch('/src/earth/clouds_8192.tif')).arrayBuffer();
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const w = ifds[0].width;
    const h = ifds[0].height;
    console.log(`clouds tif ${w}x${h}`);
    const full = new OffscreenCanvas(w, h);
    full.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), w, h), 0, 0);
    // global 4k
    const c4 = new OffscreenCanvas(4096, 2048);
    const g4 = c4.getContext('2d');
    g4.imageSmoothingQuality = 'high';
    g4.drawImage(full, 0, 0, 4096, 2048);
    await window.encode(c4, 'earth/clouds_4k.jpg', 0.85);
    // recorte em resolução máxima da região "herói"
    const ppd = w / 360;
    const x = (d.lon0 + 180) * ppd;
    const y = (90 - d.lat0) * ppd;
    const cw = Math.round((d.lon1 - d.lon0) * ppd);
    const chh = Math.round((d.lat0 - d.lat1) * ppd);
    const cd = new OffscreenCanvas(cw, chh);
    cd.getContext('2d').drawImage(full, x, y, cw, chh, 0, 0, cw, chh);
    await window.encode(cd, 'earth/clouds_detail.jpg', 0.9);
  }, EARTH_DETAIL)
);

/* -------------------------- Estrelas (NASA SVS) -------------------------- */
await job('starmap (EXR → JPG)', () =>
  page.evaluate(async () => {
    const { EXRLoader } = await import('three/addons/loaders/EXRLoader.js');
    const THREE = await import('three');
    const loader = new EXRLoader().setDataType(THREE.FloatType);
    const tex = await loader.loadAsync('/src/space/starmap_2020_4k.exr');
    const { data, width, height } = tex.image;
    console.log(`starmap exr ${width}x${height}`);
    const ch = data.length / (width * height);
    const out = new Uint8ClampedArray(width * height * 4);
    const exposure = 2.2;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const si = ((height - 1 - y) * width + x) * ch; // EXR vem invertido em y
        const di = (y * width + x) * 4;
        for (let k = 0; k < 3; k++) {
          const v = 1 - Math.exp(-data[si + k] * exposure);
          out[di + k] = Math.pow(Math.max(0, v), 1 / 2.2) * 255;
        }
        out[di + 3] = 255;
      }
    const c = new OffscreenCanvas(width, height);
    c.getContext('2d').putImageData(new ImageData(out, width, height), 0, 0);
    await window.encode(c, 'space/starmap_4k.jpg', 0.9);
  })
);

/* ------------------------ Ambiente (Poly Haven) ------------------------ */
await job('hdri backplate 8k', () => page.evaluate(() => window.resize('hdri/lago_disola_tonemapped.jpg', 'hdri/lago_disola_8k.jpg', 8192, 4096, 0.86)));
await job('hdri backplate 4k (mobile)', () => page.evaluate(() => window.resize('hdri/lago_disola_tonemapped.jpg', 'hdri/lago_disola_4k.jpg', 4096, 2048, 0.86)));
await job('pbr textures', () =>
  page.evaluate(async () => {
    for (const t of ['asphalt_02', 'snow_02', 'rocks_ground_02']) {
      await window.resize(`textures/${t}_diff.jpg`, `textures/${t}_diff.jpg`, 2048, 2048, 0.82);
      await window.resize(`textures/${t}_nor.jpg`, `textures/${t}_nor.jpg`, 1024, 1024, 0.92);
      await window.resize(`textures/${t}_arm.jpg`, `textures/${t}_arm.jpg`, 1024, 1024, 0.88);
    }
  })
);

await browser.close();
server.close();

/* ------------------------- cópias diretas ------------------------- */
for (const [from, to] of [
  ['models/ssl1300.glb', 'models/satellite_ssl1300.glb'],
  ['models/carconcept.glb', 'models/car_concept.glb'],
  ['hdri/lago_disola_2k.hdr', 'hdri/lago_disola_2k.hdr'],
]) {
  const dest = resolve(OUT, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolve(SRC, from), dest);
  console.log(`✓ ${to} (cópia, ${(statSync(dest).size / 1e6).toFixed(2)} MB)`);
}
