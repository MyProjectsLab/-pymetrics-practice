import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const url = process.env.M5_URL || 'http://127.0.0.1:5195/'
const evidence = { browser: browser.version(), url, errors: [], checks: {} }
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const a = await context.newPage(), b = await context.newPage()
  for (const page of [a,b]) page.on('pageerror', error => evidence.errors.push(String(error)))
  await Promise.all([a.goto(url), b.goto(url)])
  await Promise.all([a.getByRole('button', { name: 'Open Stop' }).waitFor(), b.getByRole('button', { name: 'Open Stop' }).waitFor()])
  const reserve = async (page, session, family, chain = null) => page.evaluate(async ({session,family,chain}) => {
    const { StopLocalStore } = await import('/src/stop/storage.ts')
    const store = await StopLocalStore.open()
    try { return await store.reserve(session, family, 0, family === 'retest' ? Date.now() + 1_800_000 : null, chain) }
    finally { store.close() }
  }, { session, family, chain })
  const [first, second] = await Promise.all([reserve(a, 'tab-a', 'baseline'), reserve(b, 'tab-b', 'baseline')])
  assert(first && second && first.formId !== second.formId)
  await a.evaluate(async formId => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); await store.arm('tab-a',formId,'standard'); store.close() }, first.formId)
  await a.reload(); await a.getByRole('button', { name: 'Open Stop' }).waitFor()
  const uncertain = await a.evaluate(async formId => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(); store.close(); return state.exposures[formId] }, first.formId)
  assert.equal(uncertain.certainty, 'uncertain')
  await b.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); await store.release('tab-b',false); store.close() })
  const third = await reserve(b, 'tab-c', 'baseline')
  assert(third && third.formId !== first.formId)
  await b.reload(); await b.getByRole('button', { name: 'Open Stop' }).waitFor()
  const releasedUnarmed = await b.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(); store.close(); return state.reservations['tab-c'] === undefined })
  assert(releasedUnarmed)
  evidence.checks.crossTab = { first: first.formId, second: second.formId, third: third.formId, uncertainAfterReload: uncertain.certainty, ownUnarmedReleasedAfterReload: releasedUnarmed }
  const retest = await reserve(a, 'retest-a', 'retest', 'chain-a')
  assert(retest)
  const activity = await a.evaluate(async formId => {
    const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open()
    await store.arm('retest-a',formId,'standard'); await store.confirm('retest-a',formId,new Date().toISOString(),'chain-a')
    const entry = { key: 'report_viewed:retest-a', sessionId: 'retest-a', chainId: 'chain-a', type: 'report_viewed', payload: { reportVersion: 'stop_report_v1' } }
    await store.activity(entry); await store.activity(entry)
    const entries = (await store.activities()).filter(item => item.sessionId === 'retest-a'); store.close(); return entries
  }, retest.formId)
  assert.deepEqual(activity.map(item => item.type), ['retest_reserved','retest_exposed','report_viewed'])
  assert.deepEqual(activity.map(item => item.sequenceNumber), [1,2,3])
  evidence.checks.activity = activity.map(item => ({ type:item.type, sequenceNumber:item.sequenceNumber }))
  await a.getByRole('button', { name: 'Stop history' }).click()
  await a.getByRole('button', { name: 'Delete all Assessment Practice data' }).click()
  const warning = await a.locator('body').innerText()
  assert(warning.includes('This removes results, events, settings, training chains, and form-exposure history from this browser. It cannot be undone.'))
  await a.getByRole('button', { name: 'Delete all local data' }).click()
  const cleared = await a.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(), activity = await store.activities(); store.close(); return { exposures: Object.keys(state.exposures).length, activity: activity.length } })
  assert.deepEqual(cleared, { exposures: 0, activity: 0 })
  evidence.checks.deleteAll = cleared
  await context.close()

  const blockedContext = await browser.newContext()
  await blockedContext.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }) })
  const blocked = await blockedContext.newPage(); blocked.on('pageerror', error => evidence.errors.push(String(error)))
  await blocked.goto(url)
  await blocked.getByRole('heading', { name: 'Results cannot be saved in this browser' }).waitFor()
  assert((await blocked.locator('body').innerText()).includes('You can complete Stop in this tab, but closing or refreshing the page will erase the result. History will be unavailable. A baseline, drill, and retest can stay linked only while this tab remains open.'))
  await blocked.getByRole('button', { name: 'Continue without saving' }).click()
  await blocked.getByRole('button', { name: 'Open Stop' }).waitFor()
  evidence.checks.temporaryPreflight = true
  await blockedContext.close()

  const futureContext = await browser.newContext()
  const future = await futureContext.newPage(); future.on('pageerror', error => evidence.errors.push(String(error)))
  await future.goto(url); await future.getByRole('button', { name: 'Open Stop' }).waitFor()
  await future.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('assessment-practice-stop', 1)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise((resolve, reject) => { const tx = db.transaction('installation', 'readwrite')
      const store = tx.objectStore('installation'); const request = store.get('stop')
      request.onsuccess = () => store.put({ ...request.result, schemaVersion: 'stop_local_future' }, 'stop')
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
    db.close()
  })
  await future.reload(); await future.getByRole('heading', { name: 'Results cannot be saved in this browser' }).waitFor()
  const preserved = await future.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('assessment-practice-stop', 1)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const record = await new Promise((resolve, reject) => { const tx = db.transaction('installation', 'readonly')
      const request = tx.objectStore('installation').get('stop'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    db.close(); return record.schemaVersion
  })
  assert.equal(preserved, 'stop_local_future')
  evidence.checks.unknownSchemaPreserved = true
  await futureContext.close()
  assert.deepEqual(evidence.errors, [])
  evidence.pass = true
} catch (error) { evidence.pass = false; evidence.failure = String(error) }
finally { await writeFile(new URL('./storage-browser.json', import.meta.url), JSON.stringify(evidence,null,2)); await browser.close() }
if (!evidence.pass) throw new Error(evidence.failure)
