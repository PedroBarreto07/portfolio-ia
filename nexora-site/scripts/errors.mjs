// Carrega a página e lista erros de console/página
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/X4122|X3577/.test(m.text()) && console.log(`[${m.type()}]`, m.text().slice(0, 600)));
await page.goto(process.argv[2] || 'http://localhost:5173/', { waitUntil: 'domcontentloaded' });
const ok = await page.waitForSelector('#splash.is-ready', { timeout: 60000 }).then(() => true).catch(() => false);
console.log('ready:', ok);
await browser.close();
