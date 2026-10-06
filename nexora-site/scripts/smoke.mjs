// Teste de fumaça das interações principais (CTA, scroll real, debug, leitura, idioma, capítulos, replay)
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:5173/';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#splash.is-ready', { timeout: 90000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

await wait(2200); // animação de construção do CTA
await page.click('.cta');
await wait(1800);
check('CTA inicia (body.started)', await page.$eval('body', (b) => b.classList.contains('started')));
check('Áudio iniciado', await page.evaluate(() => !!window.__exp.audio.ctx && window.__exp.audio.started));

// intro gate: 1200px de roda só trazem o satélite
await page.mouse.move(640, 400);
for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 200 }); await wait(30); } // = introGatePx
await wait(600);
let st = await page.evaluate(() => ({ p: window.__exp.scroll.progress, gate: window.__exp.scroll.gateDone }));
check('Intro gate segura o progresso (p≈0, gate aberto)', st.gate && st.p < 0.002);
for (let i = 0; i < 30; i++) { await page.mouse.wheel({ deltaY: 200 }); await wait(16); }
await wait(1500);
st = await page.evaluate(() => window.__exp.scroll.progress);
check(`Roda avança o progresso (p=${st.toFixed(4)})`, st > 0.1 / 24 && st < 0.5);

await page.keyboard.press('ArrowDown');
await wait(800);
const p2 = await page.evaluate(() => window.__exp.scroll.progress);
check('Seta ↓ avança', p2 > st);

await page.keyboard.press('d');
check('Debug abre com D', await page.$eval('#debug', (d) => d.classList.contains('is-open')));
await page.keyboard.press('d');

const btns = await page.$$('.ui-top-right .ui-btn');
await btns[1].click();
await wait(700);
check('Modo leitura abre', await page.$eval('.reading', (d) => d.classList.contains('is-open')));
check('Scroll travado no modo leitura', await page.evaluate(() => window.__exp.scroll.locked));
await page.keyboard.press('Escape');
await wait(700);

await page.click('.ui-top-right .lang-toggle');
await wait(300);
check('Idioma muda para EN', await page.evaluate(() => document.documentElement.lang === 'en'));
await page.click('.ui-top-right .lang-toggle');

await page.evaluate(() => document.querySelectorAll('.chapter')[3].click());
await wait(2200);
const p3 = await page.evaluate(() => window.__exp.scroll.progress);
check(`Capítulo 4 pula para ~0.555 (p=${p3.toFixed(3)})`, Math.abs(p3 - 0.555) < 0.02);

await page.evaluate(() => window.__exp.scroll.jump(0.995));
await wait(2500);
check('Tela final visível', await page.$eval('.credit-final', (d) => d.classList.contains('on')));
await page.click('.replay');
await wait(2500);
const p4 = await page.evaluate(() => window.__exp.scroll.progress);
check(`Replay volta ao início (p=${p4.toFixed(3)})`, p4 < 0.01);

await page.click('.audio-btn');
await wait(200);
check('Mute alterna', await page.evaluate(() => window.__exp.audio.muted));

check(`Sem erros de página (${errors.length})`, errors.length === 0);
errors.forEach((e) => console.log('  ', e));
await browser.close();
