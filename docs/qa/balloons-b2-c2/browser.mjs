import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4230'
const out = process.env.EVIDENCE_DIR ?? '/private/tmp/balloons-b2-c2'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext()
const page = await context.newPage()
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
const button = (p, name) => p.getByRole('button', { name, exact: true })
async function activate(p, name, key = null) {
  const target = button(p, name)
  await target.waitFor()
  for (let n = 0; !(await target.isEnabled()); n++) { if (n > 1000) throw Error(`Button stayed disabled: ${name}`); await p.waitForTimeout(10) }
  if (key) { await target.focus(); await p.keyboard.press(key) }
  else await target.click()
}
async function root(p) {
  return p.evaluate(async () => {
    const request = indexedDB.open('assessment-practice-balloons-v1', 1)
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    return new Promise((resolve, reject) => { const tx = db.transaction('installation', 'readonly'), get = tx.objectStore('installation').get('root'); tx.oncomplete = () => { db.close(); resolve(get.result) }; tx.onabort = () => reject(tx.error) })
  })
}
async function capture(name, p = page) {
  await fs.writeFile(`${out}/${name}.json`, JSON.stringify(await root(p)))
  await fs.writeFile(`${out}/${name}.txt`, await p.locator('main').innerText())
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true })
}
try {
  await page.goto(url)
  await activate(page, 'Open Balloons')
  for (const name of ['Try the worked example', 'Pump example', 'Pump example', 'Collect example', 'Check my understanding']) await activate(page, name)
  await page.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked', { exact: true }).check()
  await page.getByLabel('no, earlier outcomes do not reveal the next exact burst pump', { exact: true }).check()
  for (const name of ['Submit answers', 'Check input and accessibility', 'Test Pump', 'Test Collect', 'Continue to readiness', 'Start Balloons practice']) await activate(page, name)
  for (let round = 1; round <= 39; round++) { await activate(page, 'Collect', 'Space'); if (round < 39) await activate(page, 'Next balloon', 'Enter') }
  await activate(page, 'View report')
  await activate(page, 'Open assigned exercise')
  await activate(page, 'Start assigned exercise')
  for (let round = 1; round <= 18; round++) { await activate(page, 'Collect', 'Space'); if (round < 18) await activate(page, round % 6 === 0 ? 'Continue exercise' : 'Next balloon', 'Enter') }
  await activate(page, 'Open retest explanation')
  await activate(page, 'Start 39-round retest')
  for (let round = 1; round <= 39; round++) {
    if (round % 3 === 0) for (let pump = 0; pump < 2; pump++) {
      await activate(page, 'Pump', 'Space')
      await page.waitForFunction(() => document.querySelector('[data-control=collect]')?.disabled === false || document.querySelector('[data-next]')?.disabled === false)
      if (await page.locator('[data-next]').count()) break
    }
    if (!(await page.locator('[data-next]').count())) await activate(page, 'Collect', 'Space')
    if (round < 39) {
      await activate(page, 'Next balloon', 'Enter')
      await page.waitForFunction(n => document.querySelector('.balloons-play')?.textContent?.includes(`Round ${n} of 39`) && document.querySelector('[data-control=collect]')?.disabled === false, round + 1)
    }
  }
  await activate(page, 'View report')
  const complete = await root(page), rt = Object.values(complete.records).find(record => record.header.retest)
  assert.equal(rt.snapshot.phase, 'completed'); assert.equal(rt.snapshot.comparisonEligible, true)
  assert.equal(complete.training.chains[rt.header.identity.chainId].completedRetestSessionId, rt.header.identity.sessionId)
  await capture('completed')
  await activate(page, 'Open saved comparison', 'Enter')
  await page.locator('.balloons-comparison').waitFor()
  assert.match(await page.locator('.balloons-comparison').innerText(), /Saved BL BL1 and RT RT1/)
  await capture('comparison-open')
  const beforeReload = await root(page)
  await page.reload(); await activate(page, 'Open Balloons'); await activate(page, 'Balloons history')
  await page.locator('.balloons-history-item').filter({ hasText: /^RT1/ }).getByRole('button', { name: 'Open saved comparison' }).click()
  await page.locator('.balloons-comparison').waitFor()
  assert.deepEqual((await root(page)).records[rt.header.identity.sessionId].journal, beforeReload.records[rt.header.identity.sessionId].journal)
  await capture('comparison-reload')
  const other = await context.newPage(); await other.goto(url); await activate(other, 'Open Balloons'); await activate(other, 'Balloons history')
  await other.locator('.balloons-history-item').filter({ hasText: /^BL1/ }).getByRole('button', { name: 'Delete this result' }).click()
  await page.getByText('The saved baseline was deleted.').waitFor()
  assert.equal(await page.locator('.balloons-comparison').count(), 0)
  await capture('baseline-deleted')
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ status: 'PASS', browser: browser.version(), completeRounds: 39, drillRounds: 18, retestRounds: 39, comparisonAfterCompletion: true, historyAfterReload: true, crossTabDeletionWithdrawal: true, pageErrors: errors }, null, 2))
  console.log('PASS Balloons B2-C2 production-browser journey')
} catch (error) {
  await capture('failure').catch(() => {})
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ status: 'FAIL', error: String(error?.stack ?? error), pageErrors: errors }, null, 2))
  throw error
} finally { await context.close(); await browser.close() }
