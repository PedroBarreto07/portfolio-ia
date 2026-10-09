/*
 * Visual QA: opens the site in headless Chrome (GPU), waits for the loader,
 * jumps to choreography positions and saves screenshots.
 *
 *   npm run dev            (in another terminal)
 *   npm run shots -- --out shots --size 1440x900 hero:0 disassembly:0.7
 *
 * Positions are "section:progress[:offsetVh]". Without positions, a default
 * tour of every section is captured.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return def
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const out = opt('out', 'shots')
const size = opt('size', '1440x900').split('x').map(Number)
const base = opt('url', 'http://localhost:5173/')
const query = opt('query', '')
const wait = Number(opt('wait', '900'))
const evalCode = opt('eval', '') // JS run in the page after each jump (e.g. select a part)
const chrome = opt('chrome', [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p)))

const DEFAULT = [
  'hero:0', 'hero:0.8', 'timeless:0.5', 'vertical:0.6', 'disassembly:0.12', 'disassembly:0.6',
  'mechanism:0.3', 'mechanism:0.6', 'mechanism:0.9', 'curves:0.35', 'curves:0.75',
  'profile:0.3', 'profile:0.8', 'editions:0.5', 'colors:0.5', 'parts:0.2', 'parts:0.8', 'outro:0.8',
]
const positions = args.length ? args : DEFAULT

fs.mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: size[0], height: size[1], deviceScaleFactor: 1 },
})
const page = await browser.newPage()
page.on('console', (m) => {
  if (['error', 'warn'].includes(m.type())) console.log(`[${m.type()}]`, m.text().slice(0, 400))
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
const url = `${base}?shots${query ? `&${query}` : ''}`
const t0 = Date.now()
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__ora && document.getElementById('loader').classList.contains('is-done'), { timeout: 120000 })
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
await new Promise((r) => setTimeout(r, 3600))
const info = await page.evaluate(() => {
  const gl = window.__ora.webgl.renderer.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a', calls: window.__ora.webgl.renderer.info.render.calls }
})
console.log('GPU:', info.renderer, '| draw calls:', info.calls)

for (const pos of positions) {
  const [id, p = '0', off = '0'] = pos.split(':')
  await page.evaluate((id, p, off) => window.__ora.goto(id, Number(p), Number(off)), id, p, off)
  if (evalCode) {
    await new Promise((r) => setTimeout(r, 300))
    await page.evaluate(evalCode)
  }
  await new Promise((r) => setTimeout(r, wait))
  const file = path.join(out, `${pos.replace(/[:.]/g, '_')}.png`)
  await page.screenshot({ path: file })
  console.log('saved', file)
}
await browser.close()
