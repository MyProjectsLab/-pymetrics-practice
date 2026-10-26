import { createRequire } from 'node:module'
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const out = process.env.BALLOONS_QA_OUT || '/private/tmp/balloons-b1b-faults'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const cases = [], errors = []
const button = (p, name) => p.getByRole('button', { name, exact: true })
async function ready(p) {
  await p.goto('http://127.0.0.1:4173'); await p.getByRole('button', { name: 'Open Balloons' }).click()
  for (const n of ['Try the worked example', 'Pump example', 'Pump example', 'Collect example', 'Check my understanding']) await button(p, n).click()
  await p.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked', { exact: true }).check(); await p.getByLabel('no, earlier outcomes do not reveal the next exact burst pump', { exact: true }).check()
  for (const n of ['Submit answers', 'Check input and accessibility', 'Test Pump', 'Test Collect', 'Continue to readiness']) await button(p, n).click()
}
async function read(p) { return p.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const q = indexedDB.open('assessment-practice-balloons-v1'); q.onsuccess = () => resolve(q.result); q.onerror = reject })
  return await new Promise((resolve, reject) => { const t = db.transaction('installation'), q = t.objectStore('installation').get('root'); q.onsuccess = () => { resolve(q.result); db.close() }; q.onerror = reject })
}) }
async function pumpReady(p) { await p.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Pump' && !b.disabled)) }
async function hook(p) {
  await p.addInitScript(() => {
    const qa = window.qa = { fail: null, hold: null, release: [], records: [], mounts: [], frameHold: false, frames: [] }
    const txKinds = new WeakMap(), original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.transaction.db.name === 'assessment-practice-balloons-v1' && value?.records) {
        const r = Object.values(value.records).at(-1), kind = r?.journal.at(-1)?.command?.kind || 'assignment'
        txKinds.set(this.transaction, kind); qa.records.push({ kind, phase: r?.snapshot.phase, exposure: r?.snapshot.exposure })
        if (qa.fail === kind) { qa.fail = null; throw new DOMException('Injected write failure', 'QuotaExceededError') }
      }
      return original.call(this, value, key)
    }
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor, set(callback) {
      descriptor.set.call(this, event => {
        if (qa.hold === txKinds.get(this)) { qa.hold = null; qa.release.push(() => callback?.call(this, event)); return }
        callback?.call(this, event)
      })
    } })
    const raf = requestAnimationFrame.bind(window)
    window.requestAnimationFrame = cb => qa.frameHold ? (qa.frames.push(cb), 987654) : raf(cb)
    new MutationObserver(() => { const d = document.querySelector('[data-balloon-type]'); if (d && document.querySelector('.balloons-play')) qa.mounts.push({ label: d.textContent, at: performance.now() }) }).observe(document, { childList: true, subtree: true })
  })
}
async function scenario(name, work) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }), p = await context.newPage()
  p.on('pageerror', e => errors.push({ name, error: e.message }))
  try { await hook(p); await ready(p); const details = await work(p, context); cases.push({ name, pass: true, details }) }
  catch (e) { cases.push({ name, pass: false, error: e.stack }); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true }); await writeFile(`${out}/${name}.txt`, await p.locator('body').innerText()); throw e }
  finally { await context.close(); await writeFile(`${out}/cases.json`, JSON.stringify({ browser: browser.version(), cases, errors }, null, 2)) }
}
try {
  await scenario('pre-arm-cancel-late-assignment', async p => {
    await p.evaluate(() => { window.qa.hold = 'assignment' }); await button(p, 'Start Balloons practice').click(); await p.waitForFunction(() => window.qa.release.length === 1)
    assert.equal(await p.locator('.balloons-play').count(), 0)
    await p.getByRole('button', { name: 'Assessment Practice — game library' }).click()
    await p.evaluate(() => window.qa.release.splice(0).forEach(fn => fn()))
    await p.waitForFunction(async () => { const db = await new Promise(r => { const q = indexedDB.open('assessment-practice-balloons-v1'); q.onsuccess = () => r(q.result) }); const value = await new Promise(r => { const q = db.transaction('installation').objectStore('installation').get('root'); q.onsuccess = () => r(q.result) }); db.close(); return Object.values(value.records)[0]?.snapshot.exposure === 'released_unseen' })
    const r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.exposure, 'released_unseen'); assert.equal((await p.evaluate(() => window.qa.mounts)).length, 0)
    return { exposure: r.snapshot.exposure, mounts: 0 }
  })
  for (const interruption of ['cancel', 'hide', 'reload']) await scenario(`post-arm-${interruption}`, async p => {
    await p.evaluate(() => { window.qa.hold = 'arm' }); await button(p, 'Start Balloons practice').click(); await p.waitForFunction(() => window.qa.release.length === 1)
    let r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.exposure, 'exposure_uncertain'); const id = r.header.identity.sessionId
    if (interruption === 'cancel') await p.getByRole('button', { name: 'Assessment Practice — game library' }).click()
    if (interruption === 'hide') await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    if (interruption === 'reload') await p.reload(); else await p.evaluate(() => window.qa.release.splice(0).forEach(fn => fn()))
    r = (await read(p)).records[id]; assert.equal(r.snapshot.exposure, 'exposure_uncertain'); assert.equal(r.snapshot.core.events.length, 1)
    if (interruption !== 'reload') assert.equal(await p.locator('.balloons-play').count(), 0)
    if (interruption === 'reload') { await p.getByRole('button', { name: 'Open Balloons' }).click(); await button(p, 'Balloons history').click(); await button(p, 'Resume saved session').click(); await pumpReady(p); r = (await read(p)).records[id]; assert.equal(r.snapshot.comparisonEligible, false); assert.equal(r.header.formId, 'BL1') }
    return { sessionId: id, exposure: r.snapshot.exposure, eligible: r.snapshot.comparisonEligible, injection: interruption === 'hide' ? 'synthetic visibility delivery' : 'held transaction completion delivery' }
  })
  for (const kind of ['arm', 'confirm', 'action_pending', 'action']) await scenario(`failed-${kind}-write`, async p => {
    if (kind === 'arm' || kind === 'confirm') { await p.evaluate(k => { window.qa.fail = k }, kind); await button(p, 'Start Balloons practice').click() }
    else { await button(p, 'Start Balloons practice').click(); await pumpReady(p); await p.evaluate(k => { window.qa.fail = k }, kind); await button(p, 'Pump').click() }
    await p.getByRole('alert').filter({ hasText: 'Unsaved' }).waitFor()
    let r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.core.nextActionId, 1); assert.equal(r.snapshot.comparisonEligible, false)
    if (kind === 'confirm') assert.equal(r.snapshot.exposure, 'exposure_uncertain')
    await p.reload(); await p.getByRole('button', { name: 'Open Balloons' }).click(); await button(p, 'Balloons history').click(); await button(p, 'Resume saved session').click(); await pumpReady(p)
    r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.comparisonEligible, false); assert.equal(r.snapshot.core.nextActionId, 1)
    return { exposure: r.snapshot.exposure, eligible: r.snapshot.comparisonEligible, actionCounter: r.snapshot.core.nextActionId, injection: 'one IDB put throws; atomic transaction abort' }
  })
  await scenario('pending-action-rapid-clicks-and-late-delivery', async p => {
    await button(p, 'Start Balloons practice').click(); await pumpReady(p)
    await p.evaluate(() => { window.qa.hold = 'action' }); await button(p, 'Pump').click(); await p.waitForFunction(() => window.qa.release.length === 1)
    assert.equal(await button(p, 'Pump').isDisabled(), true)
    await p.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('[data-control="pump"]').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    assert.equal(Object.values((await read(p)).records)[0].snapshot.core.nextActionId, 2)
    await p.evaluate(() => window.qa.release.splice(0).forEach(fn => fn()))
    await button(p, 'Next balloon').click(); await pumpReady(p); await button(p, 'Pump').click(); await pumpReady(p); await button(p, 'Pump').click(); await pumpReady(p)
    const r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.core.current.successfulPumps, 2); assert.equal(r.snapshot.core.nextActionId, 5)
    return { actionCounter: 5, ignoredDuringWrite: 5, freshPumps: 2 }
  })
  await scenario('keyboard-exit-during-pending-write', async p => {
    await button(p, 'Start Balloons practice').click(); await pumpReady(p)
    await p.evaluate(() => { window.qa.hold = 'action' }); await button(p, 'Pump').click(); await p.waitForFunction(() => window.qa.release.length === 1)
    await button(p, 'Pause and open history').focus(); await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Balloons history', exact: true }).waitFor()
    await p.evaluate(() => window.qa.release.splice(0).forEach(fn => fn()))
    assert.equal(await p.locator('.balloons-play').count(), 0)
    return { nativeKeyboardExit: true, injection: 'held action transaction completion delivery' }
  })
  for (const held of ['assignment', 'arm', 'confirm', 'action']) for (const deletion of ['individual', 'installation']) await scenario(`deletion-${deletion}-during-delayed-${held}`, async (p, ctx) => {
    if (held !== 'action') { await p.evaluate(k => { window.qa.hold = k }, held); await button(p, 'Start Balloons practice').click() }
    else { await button(p, 'Start Balloons practice').click(); await pumpReady(p); await p.evaluate(() => { window.qa.hold = 'action' }); await button(p, 'Pump').click() }
    await p.waitForFunction(() => window.qa.release.length === 1)
    const other = await ctx.newPage(); await other.goto('http://127.0.0.1:4173'); await other.getByRole('button', { name: 'Open Balloons' }).click(); await button(other, 'Balloons history').click()
    await button(other, deletion === 'individual' ? 'Delete this result' : 'Delete all Balloons data').click()
    await other.waitForFunction(() => document.body.innerText.includes('0 retained attempts'))
    const before = await read(other)
    await p.evaluate(() => window.qa.release.splice(0).forEach(fn => fn()))
    await p.waitForFunction(() => !document.querySelector('.balloons-play'))
    assert.deepEqual(await read(other), before); assert.equal(Object.keys(before.records).length, 0)
    return { records: 0, tombstones: Object.keys(before.tombstones).length, lateDeliveryResurrected: false }
  })
  await scenario('two-tab-owner-and-truthful-replay-assignment', async (p, ctx) => {
    await button(p, 'Start Balloons practice').click(); await pumpReady(p)
    const other = await ctx.newPage(); await hook(other); await ready(other)
    await button(other, 'Start Balloons practice').click(); await other.getByRole('alert').filter({ hasText: 'another tab' }).waitFor()
    assert.equal(Object.keys((await read(other)).records).length, 1)
    await button(p, 'Pause and open history').click()
    await button(other, 'Pause and open history').click(); await button(other, 'Practise again').click()
    for (const n of ['Try the worked example', 'Pump example', 'Pump example', 'Collect example', 'Check my understanding']) await button(other, n).click()
    await other.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked', { exact: true }).check(); await other.getByLabel('no, earlier outcomes do not reveal the next exact burst pump', { exact: true }).check()
    for (const n of ['Submit answers', 'Check input and accessibility', 'Test Pump', 'Test Collect', 'Continue to readiness', 'Start Balloons practice']) await button(other, n).click()
    await pumpReady(other); const records = Object.values((await read(other)).records); assert.deepEqual(records.map(r => r.header.formId), ['BL1', 'RP1'])
    return { formIds: records.map(r => r.header.formId) }
  })
  await scenario('delayed-frame-cancel-and-late-callback', async p => {
    await p.evaluate(() => { window.qa.frameHold = true }); await button(p, 'Start Balloons practice').click(); await p.waitForFunction(() => window.qa.frames.length > 0, null, { polling: 10 })
    assert.equal(Object.values((await read(p)).records)[0].snapshot.exposure, 'exposure_uncertain')
    await p.getByRole('button', { name: 'Assessment Practice — game library' }).click()
    await p.evaluate(() => { window.qa.frameHold = false; window.qa.frames.splice(0).forEach(cb => cb(performance.now())) })
    assert.equal(await p.locator('.balloons-play').count(), 0)
    const r = Object.values((await read(p)).records)[0]; assert.equal(r.snapshot.exposure, 'exposure_uncertain'); assert.deepEqual(r.snapshot.confirmedRounds, [])
    return { exposure: r.snapshot.exposure, confirmedRounds: [] }
  })
  assert.deepEqual(errors, []); console.log(JSON.stringify({ cases: cases.length, allPassed: true, browser: browser.version(), out }))
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close() }
