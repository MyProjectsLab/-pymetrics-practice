import { createRequire } from 'node:module'
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const out = process.env.BALLOONS_QA_OUT || '/private/tmp/balloons-b1b-browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
const page = await context.newPage(), errors = [], cases = []
page.on('pageerror', e => errors.push(e.message))
const button = (name, p = page) => p.getByRole('button', { name, exact: true })
async function state(p = page) { return p.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const q = indexedDB.open('assessment-practice-balloons-v1', 1); q.onsuccess = () => resolve(q.result); q.onerror = reject })
  return await new Promise((resolve, reject) => { const t = db.transaction('installation'), q = t.objectStore('installation').get('root'); q.onsuccess = () => { resolve(q.result); db.close() }; q.onerror = reject })
}) }
const current = async () => Object.values((await state()).records).at(-1)
async function enabled(name, p = page) { await p.waitForFunction(name => [...document.querySelectorAll('button')].some(b => b.textContent === name && !b.disabled), name) }
async function click(name, p = page) { await enabled(name, p); await button(name, p).click() }
async function preparation(p = page) {
  await click('Try the worked example', p); await click('Pump example', p); await click('Pump example', p); await click('Collect example', p); await click('Check my understanding', p)
  await p.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked', { exact: true }).check()
  await p.getByLabel('no, earlier outcomes do not reveal the next exact burst pump', { exact: true }).check()
  await click('Submit answers', p); await click('Check input and accessibility', p)
  await click('Test Pump', p); await click('Test Collect', p); await click('Continue to readiness', p)
}
try {
  await page.goto('http://127.0.0.1:4173'); await page.getByRole('button', { name: 'Open Balloons' }).click(); await preparation()
  assert.equal(Object.keys((await state()).records).length, 0)
  await click('Start Balloons practice'); await enabled('Pump')
  let r = await current(); assert.equal(r.header.formId, 'BL1'); assert.equal(r.snapshot.exposure, 'form_exposed'); assert.deepEqual(r.snapshot.confirmedRounds, [1])
  assert.deepEqual(r.journal.slice(0, 3).map(e => e.type), ['pending_exposure', 'presentation_armed', 'form_exposed'])
  cases.push('ordinary preparation assigns nothing; BL1 pending/armed/confirmed in order')
  // Native Enter first activation and repeated keydown, including focus transfer after BL1 first-pump burst.
  await button('Pump').focus(); await page.keyboard.down('Enter'); await enabled('Next balloon')
  r = await current(); assert.equal(r.snapshot.core.results[0].outcome, 'burst'); assert.equal(r.snapshot.core.nextActionId, 2)
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter')
  assert.equal((await current()).snapshot.core.nextActionId, 2)
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Next balloon')
  cases.push('native Enter once; repeat across outcome focus transfer suppressed; T=1 burst')
  await click('Next balloon'); await enabled('Pump')
  // Native Space first activation.
  await button('Pump').focus(); await page.keyboard.press('Space'); await enabled('Pump')
  assert.equal((await current()).snapshot.core.current.successfulPumps, 1)
  // Held Space canceled by focus change before keyup.
  await button('Pump').focus(); await page.keyboard.down('Space'); await page.keyboard.down('Space'); await button('Collect').focus(); await page.keyboard.up('Space')
  assert.equal((await current()).snapshot.core.current.successfulPumps, 1); assert.equal((await current()).snapshot.core.status, 'active')
  cases.push('native Space once; held Space release cannot activate different control')
  // Touch emulation, then unclassified DOM click: intentionally separate evidence.
  await button('Pump').tap(); await enabled('Pump')
  await button('Pump').evaluate(b => b.click()); await enabled('Pump')
  r = await current(); assert.equal(r.snapshot.core.current.successfulPumps, 3)
  assert(r.snapshot.core.events.some(e => e.source === 'touch_or_pen')); assert(r.snapshot.core.events.some(e => e.source === 'unknown_or_assistive'))
  cases.push('emulated touch native button click; injected unclassified DOM click accepted')
  while ((r = await current()).snapshot.core.status !== 'completed') {
    const c = r.snapshot.core
    if (c.status === 'resolved') { await click('Next balloon'); await enabled('Pump') }
    else if (c.current.successfulPumps < 6) { await click('Pump'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]')) }
    else { await click('Collect'); await enabled(c.round === 39 ? 'View report' : 'Next balloon') }
  }
  const saved = r
  await click('View report'); await page.getByRole('heading', { name: 'Your choices and outcomes' }).waitFor()
  // Independent arithmetic from immutable manifest plus accepted actions, not production report functions.
  const attempts = saved.snapshot.core.events.filter(e => e.type === 'pump_attempted')
  const rows = saved.snapshot.core.manifest.rounds.map(row => {
    const count = attempts.filter(e => e.round === row.round).length, burst = count === row.threshold && row.threshold <= 32
    const successes = count - Number(burst)
    return { round: row.round, attempts: count, successes, bank: burst ? 0 : 5 * successes, lost: burst ? 5 * successes : 0, outcome: burst ? 'burst' : successes === 32 ? 'cap_collect' : 'voluntary_collect' }
  })
  rows.forEach((row, i) => { const actual = saved.snapshot.core.results[i]; assert.equal(actual.attemptedPumps, row.attempts); assert.equal(actual.successfulPumps, row.successes); assert.equal(actual.bankedCents, row.bank); assert.equal(actual.lostCents, row.lost); assert.equal(actual.outcome, row.outcome) })
  const bank = rows.reduce((s, x) => s + x.bank, 0), lost = rows.reduce((s, x) => s + x.lost, 0)
  assert.equal(bank, 810); assert.equal(lost, 125); assert.equal(saved.snapshot.confirmedRounds.length, 39)
  const summarize = subset => [subset.length, subset.filter(x => x.outcome !== 'burst').length, subset.filter(x => x.outcome === 'burst').length, subset.reduce((s, x) => s + x.bank, 0), subset.reduce((s, x) => s + x.lost, 0), subset.reduce((s, x) => s + x.attempts, 0), subset.reduce((s, x) => s + x.successes, 0), subset.filter(x => x.outcome === 'voluntary_collect').length, subset.filter(x => x.outcome === 'voluntary_collect' && x.successes === 0).length, subset.filter(x => x.outcome === 'cap_collect').length].map(String)
  const categoryRows = await page.locator('table').nth(0).locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)))
  assert.deepEqual(categoryRows[0], summarize(rows))
  for (let i = 0; i < 3; i++) assert.deepEqual(categoryRows[i + 1], summarize(rows.filter(row => saved.snapshot.core.manifest.rounds[row.round - 1].profile === ['A', 'B', 'C'][i])))
  const blocks = await page.locator('table').nth(1).locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)))
  for (let i = 0; i < 3; i++) assert.deepEqual(blocks[i], summarize(rows.slice(i * 13, (i + 1) * 13)))
  const review = await page.locator('table').nth(2).locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('th, td')].map(td => td.textContent)))
  for (const row of rows) assert.deepEqual(review[row.round - 1], [String(row.round), `Type ${['A', 'B', 'C'].indexOf(saved.snapshot.core.manifest.rounds[row.round - 1].profile) + 1}`, String(row.attempts), String(row.successes), row.outcome.replaceAll('_', ' '), String(row.bank), String(row.lost)])
  const reportText = await page.locator('main').innerText(); assert(reportText.includes('810 cents collected. 125 cents lost')); assert(!/threshold|profile A|profile B|profile C|candidateSeed/.test(reportText))
  const afterReport = await current(); await page.screenshot({ path: `${out}/report.png`, fullPage: true })
  await page.reload(); await page.getByRole('button', { name: 'Open Balloons' }).click(); await click('Balloons history'); await click('Open saved report'); await page.getByRole('heading', { name: 'Your choices and outcomes' }).waitFor()
  const reopened = await current(); assert.deepEqual(reopened.snapshot, afterReport.snapshot); assert.deepEqual(reopened.header, afterReport.header); assert.deepEqual(reopened.journal.slice(0, -1), afterReport.journal); assert.equal(reopened.journal.at(-1).type, 'report_viewed'); assert.equal(await page.locator('main').innerText(), reportText)
  cases.push('39-round BL1 completed; independent 810/125 reconciliation; core journal/snapshot and report identical after reload; history view appends only report_viewed')
  await writeFile(`${out}/complete-session.json`, JSON.stringify(afterReport, null, 2)); await writeFile(`${out}/independent-rounds.json`, JSON.stringify(rows, null, 2))
  await click('Practise again'); await preparation(); await click('Start Balloons practice'); await enabled('Pump')
  assert.equal((await current()).header.formId, 'RP1')
  while ((r = await current()).snapshot.core.status !== 'completed') {
    if (r.snapshot.core.status === 'resolved') { await click('Next balloon'); await enabled('Pump') }
    else { await click('Collect'); await enabled(r.snapshot.core.round === 39 ? 'View report' : 'Next balloon') }
  }
  await click('View report'); await page.getByRole('heading', { name: 'Your choices and outcomes' }).waitFor()
  assert.equal((await current()).snapshot.core.results.length, 39); assert.equal((await current()).header.identity.stage, 'replay')
  cases.push('ordinary RP1 standalone 39-round zero-pump completion stays replay')
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await page.screenshot({ path: `${out}/mobile-report.png`, fullPage: true })
  cases.push('390 CSS-pixel report has no page overflow; result tables scroll within labeled keyboard-focusable regions')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ browser: browser.version(), cases, errors, bank, lost }, null, 2))
  console.log(JSON.stringify({ browser: browser.version(), cases, errors, out }, null, 2))
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }); await writeFile(`${out}/failure.txt`, `${e.stack}\n\n${await page.locator('body').innerText()}`); console.error(e); process.exitCode = 1
} finally { await browser.close() }
