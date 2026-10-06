// Captura screenshots em vários pontos do progresso (teste visual).
// Uso: node scripts/shots.mjs [url] [p1,p2,...] [outDir]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5173/';
const points = (process.argv[3] || '0,0.03,0.07,0.1,0.13').split(',').map(Number);
const out = process.argv[4] || 'shots';
const W = +(process.env.W || 1440);
const H = +(process.env.H || 900);
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#splash.is-ready', { timeout: 90000 }).catch(() => logs.push('splash not ready'));
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${out}/splash.png` });
await page.click('.cta').catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
const wait = +(process.env.WAIT || 2200);
for (const p of points) {
  if (p >= 0.7) await page.waitForFunction(() => window.__exp.deferredReady, { timeout: 120000 }).catch(() => console.log('deferred not ready'));
  await page.evaluate((p) => window.__exp.scroll.jump(p), p);
  await new Promise((r) => setTimeout(r, wait));
  const fps = await page.evaluate(() => window.__exp.debug.fps);
  await page.screenshot({ path: `${out}/p${p.toFixed(3)}.png` });
  console.log('shot', p, 'fps', fps);
}
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
