// Gera public/og-image.png (1200×630) a partir do splash real
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:5173/';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#splash.is-ready', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
await page.addStyleTag({ content: '#cursor,.splash-lang,.headphones{display:none!important} body.bands-intro{--band:0px}' });
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('public/og-image.png gerado');
