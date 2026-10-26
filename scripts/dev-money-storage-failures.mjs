import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const base = 'http://127.0.0.1:4182/practice'
async function seed(page, value) {
  await page.evaluate(value => new Promise((resolve, reject) => {
    const open = indexedDB.open('assessment-practice-money-exchange-1-v1', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('installation')
    open.onsuccess = () => { const db = open.result, tx = db.transaction('installation', 'readwrite')
      tx.objectStore('installation').put(value, 'root')
      tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error) }
    open.onerror = () => reject(open.error)
  }), value)
}
async function read(page) { return page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('assessment-practice-money-exchange-1-v1')
  open.onsuccess = () => { const db = open.result, tx = db.transaction('installation', 'readonly'), get = tx.objectStore('installation').get('root')
    tx.oncomplete = () => { db.close(); resolve(get.result) }; tx.onerror = () => reject(tx.error) }
  open.onerror = () => reject(open.error)
})) }
try {
  {
    const context = await browser.newContext(), page = await context.newPage()
    page.setDefaultTimeout(7000)
    await page.goto(base)
    await seed(page, false)
    await page.reload()
    await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
    await page.getByRole('alert').waitFor()
    const current = await read(page)
    if (current !== false) throw Error('falsey corrupt root was silently reset')
    if (await page.getByRole('button', { name: 'Start' }).count()) throw Error('corrupt storage admitted scored Start')
    console.log('PASS falsey present root blocks play without reset')
    await context.close()
  }
  {
    const context = await browser.newContext(), page = await context.newPage()
    page.setDefaultTimeout(7000)
    await page.addInitScript(() => {
      const actual = indexedDB.open.bind(indexedDB)
      let held = true
      indexedDB.open = function (...args) {
        if (held && args[0] === 'assessment-practice-money-exchange-1-v1') {
          held = false
          return { set onupgradeneeded(_) {}, set onerror(_) {}, set onsuccess(_) {} }
        }
        return actual(...args)
      }
    })
    await page.goto(base)
    await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
    await page.getByRole('alert').waitFor({ timeout: 6000 })
    if (!(await page.getByRole('alert').textContent())?.includes('Local database opening was not confirmed'))
      throw Error('failed open not reported')
    console.log('PASS held database opening fails visibly within watchdog')
    await context.close()
  }
} finally { await browser.close() }
