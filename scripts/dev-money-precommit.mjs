import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext({ viewport: { width: 320, height: 720 } })
const page = await context.newPage()
page.setDefaultTimeout(7000)
const base = 'http://127.0.0.1:4182/practice'
async function root() { return page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('assessment-practice-money-exchange-1-v1')
  request.onsuccess = () => { const db = request.result, tx = db.transaction('installation', 'readonly'), get = tx.objectStore('installation').get('root')
    tx.oncomplete = () => { db.close(); resolve(get.result) }; tx.onerror = () => reject(tx.error) }
  request.onerror = () => reject(request.error)
})) }
async function chooseTransfer() {
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('heading', { name: 'Partner connected' }).waitFor()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Amount to send in dollars').waitFor()
}
try {
  await page.goto(base)
  await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
  await page.getByRole('button', { name: 'See an example' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('If you send $2').selectOption('6')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  for (let i = 1; i <= 7; i++) {
    await chooseTransfer()
    const before = await root(), current = Object.values(before.runs).find(run => run.status === 'active')
    if (!current || current.ordinal !== i || current.formId !== `ME1-${(i - 1) % 6 + 1}`) throw Error(`form rotation ${i}`)
    const input = page.getByLabel('Amount to send in dollars')
    await input.focus()
    if (await input.evaluate(node => document.activeElement !== node)) throw Error('keyboard focus lost')
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw Error('horizontal overflow at 320px')
    await page.getByRole('button', { name: 'Restart' }).click()
    await page.getByRole('heading', { name: 'Ready?' }).waitFor()
    const after = await root(), settled = after.runs[current.id]
    if (settled?.status !== 'incomplete' || after.nextOrdinal !== i + 1) throw Error(`restart/ordinal ${i}`)
  }
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: /Open Money Exchange 1/ }).click()
  await page.getByRole('button', { name: 'Local history' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.money-history li').length === 7)
  const listed = await page.locator('.money-history li').count()
  if (listed !== 7) throw Error(`history count ${listed}, durable ${Object.keys((await root()).runs).length}`)
  await page.getByRole('button', { name: 'Open' }).first().click()
  await page.getByRole('heading', { name: 'Your Money Exchange 1 result' }).waitFor()
  if (!(await page.getByText('familiar form').count())) throw Error('repeat label')
  await page.getByRole('button', { name: 'How the amounts were calculated' }).click()
  await page.getByRole('heading', { name: 'How the amounts were calculated' }).waitFor()
  await page.getByRole('button', { name: 'Back to result' }).click()
  await page.getByRole('heading', { name: 'Your Money Exchange 1 result' }).waitFor()
  console.log('PASS seven-form rotation, 320px keyboard/reflow, familiarity, report help/back')
} finally { await context.close(); await browser.close() }
