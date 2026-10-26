import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const base = 'http://127.0.0.1:4183/practice'

async function readRoot(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-money-exchange-1-v1')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('installation', 'readonly')
      const get = tx.objectStore('installation').get('root')
      tx.oncomplete = () => { db.close(); resolve(get.result ?? null) }
      tx.onerror = () => reject(tx.error)
    }
  }))
}
async function toResponse(page) {
  await page.goto(base)
  await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
  await page.getByRole('button', { name: 'See an example' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('If you send $2').selectOption('6')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('heading', { name: 'Partner connected' }).waitFor()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Amount to send in dollars').fill('5')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('heading', { name: 'Your partner has received the money' }).waitFor()
}
async function check(name, work) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  try { await work(page); console.log('PASS', name) }
  catch (error) { console.error('FAIL', name, error); process.exitCode = 1 }
  finally { await context.close() }
}
async function inspectResult(page, css, expected) {
  await toResponse(page)
  if (css) await page.addStyleTag({ content: css })
  if(css) await page.evaluate(() => { const next = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Next'); next?.click() })
  else await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
  const root = await readRoot(page), run = Object.values(root.runs)[0]
  if (run.exposure !== expected || run.events.some(event => event.kind === 'return_presented') !== (expected === 'captured_visible'))
    throw Error(`Visible/durable mismatch: ${JSON.stringify({ exposure: run.exposure, events: run.events.map(e => e.kind) })}`)
}
await check('healthy result records visible return', page => inspectResult(page, '', 'captured_visible'))
await check('healthy result remains visible at 320px', async page => { await page.setViewportSize({ width: 320, height: 700 }); await inspectResult(page, '', 'captured_visible') })
await check('ancestor opacity zero withdraws result', page => inspectResult(page, '.money-journey { opacity: 0 !important }', 'possibly_revealed'))
await check('ancestor visibility hidden withdraws result', page => inspectResult(page, '.money-journey { visibility: hidden !important }', 'possibly_revealed'))
await check('ancestor clipping withdraws result', page => inspectResult(page, '.money-journey { clip-path: inset(100%) !important }', 'possibly_revealed'))
await check('overlay occlusion withdraws result', async page => {
  await toResponse(page)
  await page.evaluate(() => { const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:999999'; document.body.append(overlay) })
  await page.evaluate(() => { const next = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Next'); next?.click() })
  await page.waitForTimeout(600)
  const run = Object.values((await readRoot(page)).runs)[0]
  if (run.exposure !== 'possibly_revealed' || run.events.some(event => event.kind === 'return_presented')) throw Error('Occluded return was accepted')
})
await check('fresh database initializes once', async page => {
  await page.goto(base); await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
  const root = await readRoot(page)
  if (!root || root.nextOrdinal !== 1 || Object.keys(root.runs).length) throw Error('Fresh root was not initialized')
})
await check('missing root in existing database stays blocked', async page => {
  await toResponse(page)
  const before = await readRoot(page)
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-money-exchange-1-v1')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => { const db = request.result, tx = db.transaction('installation', 'readwrite'); tx.objectStore('installation').delete('root'); tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error) }
  }))
  await page.reload()
  await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
  await page.getByRole('alert').filter({ hasText: /no root|root missing/i }).waitFor()
  const after = await readRoot(page)
  if (after !== null || !before || before.nextOrdinal !== 2) throw Error('Damaged database was reset or initial arm was not durable')
})
await browser.close()
