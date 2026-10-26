import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4191/'
const results = []
function check(value, reason) { if (!value) throw Error(reason) }
async function root(page) { return page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('assessment-practice-digits-v11', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const value = await new Promise((resolve, reject) => { const r = db.transaction('installation').objectStore('installation').get('root'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }); db.close(); return value
}) }
async function prepare(page, { keypad = false, auditory = false } = {}) {
  await page.getByRole('button', { name: 'Open Digits', exact: true }).click()
  await page.getByRole('button', { name: 'See example', exact: true }).click()
  await page.getByRole('button', { name: 'Check understanding', exact: true }).click()
  await page.getByLabel('What counts as correct?').selectOption('yes')
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  if (keypad || auditory) await page.locator('summary').click()
  if (keypad) await page.getByLabel('On-screen numeric keypad').check()
  if (auditory) { await page.getByLabel('Auditory digits with a verified local English browser voice').check()
    await page.getByRole('button', { name: 'Play two sample digits' }).click()
    await page.getByLabel('I heard both sample digits clearly').check() }
  await page.getByRole('button', { name: 'Continue to readiness' }).click()
}
async function observe(page) {
  await page.evaluate(() => {
    window.__digitsObserved = []
    window.__digitsOrder = []
    window.__digitsObserver?.disconnect()
    window.__digitsObserver = new MutationObserver(records => {
      for (const record of records) {
        if (!(record.target instanceof Element) || !record.target.matches('.digits-stimulus')) continue
        for (const added of record.addedNodes) if (/^[0-9]$/.test(added.textContent ?? ''))
          { window.__digitsObserved.push(added.textContent); window.__digitsOrder?.push({ type: 'digit_dom_write', value: added.textContent, wallMs: Date.now(), atMs: performance.now() }) }
      }
    })
    window.__digitsObserver.observe(document.body, { childList: true, subtree: true })
  })
}
async function entry(page) { await page.getByRole('button', { name: 'Submit', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.digits-entry button')?.disabled, null, { timeout: 25000 }) }
async function answer(page, correct, { keypad = false, enter = false } = {}) {
  await entry(page)
  const target = await page.evaluate(() => window.__digitsObserved.join(''))
  if (correct) {
    if (keypad) for (const digit of target) await page.locator('.digits-keypad').getByRole('button', { name: digit, exact: true }).click()
    else await page.locator('#digits-response').pressSequentially(target)
  }
  if (enter) await page.locator('#digits-response').press('Enter')
  else await page.getByRole('button', { name: correct ? 'Submit' : 'Skip', exact: true }).click()
  return target
}
async function run(name, test, init = null) {
  if (process.env.CASE_FILTER && !name.includes(process.env.CASE_FILTER)) return
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (init) await context.addInitScript(init)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await page.goto(base); const detail = await test(page, context); check(!errors.length, `Page errors: ${errors.join('; ')}`); results.push({ name, status: 'PASS', detail }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-3500) }) }
  finally { await context.close(); console.log(name, results.at(-1).status); await writeFile(new URL(process.env.CASE_FILTER ? `./browser-${process.env.CASE_FILTER.replaceAll(' ', '-')}.json` : './browser-repair.json', import.meta.url), JSON.stringify(results, null, 2) + '\n') }
}
function storageFaults() {
  const meta = new WeakMap()
  window.__digitsFault = null; window.__digitsHeld = []
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function(value, ...args) {
    if (value?.version === 'digits_storage_v1_1') {
      const snapshot = Object.values(value.attempts).map(a => a.snapshot).find(s => s?.revision === value.revision)
      const type = snapshot?.kind ?? (Object.keys(value.attempts).length ? 'arm' : 'other')
      const prior = meta.get(this.transaction) ?? {}; meta.set(this.transaction, { ...prior, type })
      if (window.__digitsFault === `reject_${type}`) {
        window.__digitsFault = null; throw new DOMException('Injected write failure', 'UnknownError')
      }
    }
    return put.call(this, value, ...args)
  }
  const get = IDBObjectStore.prototype.get
  IDBObjectStore.prototype.get = function(...args) {
    const request = get.apply(this, args)
    meta.set(this.transaction, { ...(meta.get(this.transaction) ?? {}), request })
    return request
  }
  const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true,
    get() { return complete.get.call(this) },
    set(handler) { complete.set.call(this, handler && function(event) {
      const observation = meta.get(this)
      if (observation?.request?.result?.version === 'digits_storage_v1_1') {
        const type = observation.type ?? 'read'
        if (window.__digitsFault === `hold_${type}`) {
          window.__digitsFault = null; window.__digitsHeld.push(() => handler.call(this, event)); return
        }
        if (window.__digitsFault === `lose_${type}`) {
          window.__digitsFault = null; this.onerror?.(new Event('error')); return
        }
      }
      return handler.call(this, event)
    }) },
  })
}
async function deleteFromPeer(peer, type) {
  return peer.evaluate(async type => navigator.locks.request('assessment-practice-digits-data-v1',
    { mode: 'exclusive' }, async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('assessment-practice-digits-v11', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      await new Promise((resolve, reject) => {
        const tx = db.transaction('installation', 'readwrite'), objectStore = tx.objectStore('installation')
        const r = objectStore.get('root')
        r.onsuccess = () => {
          const root = r.result
          if (type === 'all') { root.installationId = crypto.randomUUID(); root.revision = 0;
            root.counters = { visual: 0, auditory: 0 }; root.attempts = {}; root.tombstones = {}; root.activity = {} }
          else { const attempt = Object.values(root.attempts)[0]; delete root.attempts[attempt.sessionId]; delete root.activity[attempt.sessionId]
            root.tombstones[attempt.sessionId] = { requestId: attempt.requestId, mode: attempt.mode,
              ordinal: attempt.ordinal, deletedAtWallMs: Date.now() }; root.revision++ }
          objectStore.put(root, 'root')
        }; tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
      }); db.close(); return { type: 'deletion_committed', wallMs: Date.now() }
    }), type)
}
async function settledReport(page) {
  await page.getByRole('heading', { name: 'Digits report', exact: true }).waitFor()
  await page.waitForFunction(() => /Review-only record saved in this browser|Saved in this browser/.test(document.body.innerText))
}
for (const reason of ['blur', 'freeze', 'page_exit', 'hidden', 'viewport_changed']) await run(`F1 committed-undelivered arm ${reason} invalidation and fresh rotation`, async page => {
  await prepare(page); await observe(page); await page.evaluate(() => window.__digitsFault = 'hold_arm')
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.waitForFunction(() => window.__digitsHeld.length > 0)
  const committed = await root(page), arm = Object.values(committed.attempts)[0]
  if (reason === 'viewport_changed') await page.setViewportSize({ width: 1270, height: 800 })
  await page.evaluate(reason => {
    if (reason === 'viewport_changed') window.dispatchEvent(new Event('resize'))
    else if (reason === 'hidden') { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) }
    else if (reason === 'freeze') document.dispatchEvent(new Event('freeze'))
    else window.dispatchEvent(new Event(reason === 'page_exit' ? 'pagehide' : 'blur'))
  }, reason)
  await settledReport(page)
  const invalidRoot = await root(page), invalid = invalidRoot.attempts[arm.sessionId]
  check(invalid.snapshot.state.phase === 'invalid' && invalid.snapshot.state.invalidReason === reason, 'canceled arm did not save observation')
  check(invalid.snapshot.state.presentedTrials === 0 && invalid.snapshot.state.closed.length === 0, 'canceled arm invented trial exposure')
  check(JSON.stringify(invalid.snapshot.state.events.slice(0, arm.arm.events.length)) === JSON.stringify(arm.arm.events), 'original arm journal changed')
  const bytes = JSON.stringify(invalid.snapshot)
  const body = await page.locator('body').innerText()
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); scrollTo(0, 0); window.__digitsHeld.splice(0).forEach(f => f()) })
  await page.waitForTimeout(100)
  check(JSON.stringify((await root(page)).attempts[arm.sessionId].snapshot) === bytes, 'late arm delivery rewrote terminal')
  if (reason === 'viewport_changed') await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Replay Digits' }).click(); await page.getByRole('button', { name: 'See example' }).click()
  await page.getByRole('button', { name: 'Check understanding' }).click(); await page.getByLabel('What counts as correct?').selectOption('yes')
  await page.getByRole('button', { name: 'Check answer', exact: true }).click(); await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  await page.getByRole('button', { name: 'Continue to readiness' }).click(); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await entry(page)
  const freshRoot = await root(page), fresh = Object.values(freshRoot.attempts).find(a => a.sessionId !== arm.sessionId)
  check(freshRoot.counters.visual === 2 && fresh.ordinal === 2 && fresh.arm.form.id === 'DV2', 'fresh Start reused canceled rotation')
  await page.getByRole('button', { name: 'Skip', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  await page.getByRole('button', { name: 'End and review' }).click(); await settledReport(page)
  await writeFile(new URL(`./F1-${reason}-root.json`, import.meta.url), JSON.stringify(await root(page), null, 2) + '\n')
  return { invalid: invalid.snapshot.review, invalidJournal: invalid.snapshot.state.events, freshForm: fresh.arm.form.id, freshOrdinal: fresh.ordinal, body }
}, storageFaults)
await run('F1 timeout-only same request then blur after timeout preserves observation', async page => {
  await prepare(page); await observe(page); await page.evaluate(() => window.__digitsFault = 'hold_arm')
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await page.waitForFunction(() => window.__digitsHeld.length > 0)
  await page.getByText('Start could not be confirmed. Retry Start to verify the same request.', { exact: true }).waitFor()
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await settledReport(page)
  const before = await root(page), canceled = Object.values(before.attempts)[0], bytes = JSON.stringify(canceled.snapshot)
  check(canceled.snapshot.state.invalidReason === 'blur', 'timeout dropped later blur')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(f => f())); await page.waitForTimeout(100)
  check(JSON.stringify(Object.values((await root(page)).attempts)[0].snapshot) === bytes, 'late timeout callback changed invalid state')
  return { counter: before.counters.visual, phase: canceled.snapshot.state.phase, body: await page.locator('body').innerText() }
}, storageFaults)
await run('F1 uncommitted owner admission blur leaves no scored journal', async (page, context) => {
  await prepare(page)
  const peer = await context.newPage(); await peer.goto(base)
  await peer.evaluate(() => { window.__releaseOwner = null; navigator.locks.request('assessment-practice-digits-live-v1', async () => new Promise(resolve => { window.__releaseOwner = resolve })) })
  await peer.waitForFunction(() => !!window.__releaseOwner)
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(100)
  const durable = await root(page)
  check(durable.counters.visual === 0 && Object.keys(durable.attempts).length === 0, 'pre-arm cancellation invented record')
  await peer.evaluate(() => window.__releaseOwner())
  return { root: durable, body: await page.locator('body').innerText() }
})
for (const type of ['one', 'all']) await run(`F1 ${type} deletion before held-arm cancellation has no resurrection`, async (page, context) => {
  await prepare(page); await page.evaluate(() => window.__digitsFault = 'hold_arm')
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await page.waitForFunction(() => window.__digitsHeld.length > 0)
  const peer = await context.newPage(); await peer.goto(base); await deleteFromPeer(peer, type)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(200)
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(f => f())); await page.waitForTimeout(200)
  const durable = await root(page), body = await page.locator('body').innerText()
  check(Object.keys(durable.attempts).length === 0, 'deleted canceled arm resurrected')
  check(!/Review-only record saved|Saved in this browser/.test(body), 'deleted arm claimed saved')
  check((await page.getByRole('button', { name: /Retry saving/ }).count()) === 0, 'deleted cancellation offered save retry')
  return { durable, body }
}, storageFaults)
await run('F2 undeclared trusted paste labels live and reopened report without changing journal', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await prepare(page); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await entry(page)
  const target = await page.evaluate(() => window.__digitsObserved.join(''))
  await page.evaluate(t => navigator.clipboard.writeText(t), target); await page.locator('#digits-response').focus(); await page.keyboard.press('Meta+V')
  check(await page.locator('#digits-response').inputValue() === target, 'trusted paste not accepted')
  await page.locator('#digits-response').press('Enter'); await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next', exact: true }).click(); await answer(page, false) }
  await settledReport(page)
  const durable = await root(page), attempt = Object.values(durable.attempts)[0], bytes = JSON.stringify(attempt.snapshot), body = await page.locator('body').innerText()
  check(attempt.snapshot.review.assistedEntry && !attempt.arm.profile.assistedEntryDeclared, 'actual/declaration facts conflated')
  check(body.includes('assisted entry used') && !body.includes('assisted entry declared'), 'live report omitted actual assistance')
  await page.reload(); await page.getByRole('button', { name: 'Open Digits' }).click(); await page.getByRole('button', { name: 'Local history' }).click()
  await page.getByRole('heading', { name: 'Digits local history' }).waitFor()
  check((await page.locator('body').innerText()).includes('assisted entry'), 'history lost actual assistance')
  await page.getByRole('button', { name: 'Open review' }).click(); await settledReport(page)
  const reopened = await page.locator('body').innerText()
  check(reopened.includes('assisted entry used') && !reopened.includes('assisted entry declared'), 'reopened report omitted actual assistance')
  check(JSON.stringify((await root(page)).attempts[attempt.sessionId].snapshot) === bytes, 'reopening changed original journal')
  await writeFile(new URL('./F2-paste-root.json', import.meta.url), JSON.stringify(await root(page), null, 2) + '\n')
  return { target, assisted: attempt.snapshot.review.assistedEntry, declared: false, body, reopened, unchangedSnapshot: true }
})
await run('F2 undeclared trusted paste then entry blur labels unresolved Invalid', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await prepare(page); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await entry(page)
  await page.evaluate(() => navigator.clipboard.writeText('0')); await page.locator('#digits-response').focus(); await page.keyboard.press('Meta+V')
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await settledReport(page)
  const body = await page.locator('body').innerText(), durable = await root(page), state = Object.values(durable.attempts)[0].snapshot.state
  check(state.draftAssisted && state.closed.length === 0 && body.includes('assisted entry used'), 'unresolved assistance omitted')
  return { body, state }
})
for (const type of ['one', 'all']) for (const order of ['next_first', 'delete_first']) await run(`F3 ${type} ${order} factual review without durable authority`, async (page, context) => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click(); await answer(page, false)
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Next')?.disabled)
  const checkpoint = Object.values((await root(page)).attempts)[0].snapshot
  const peer = await context.newPage(); await peer.goto(base); await observe(page)
  if (order === 'next_first') {
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForFunction(() => window.__digitsObserved.length >= 1)
    await page.waitForTimeout(70); await deleteFromPeer(peer, type)
  } else { await deleteFromPeer(peer, type); await page.getByRole('button', { name: 'Next', exact: true }).click() }
  await page.getByRole('heading', { name: 'Digits attempt removed', exact: true }).waitFor()
  const body = await page.locator('body').innerText(), durable = await root(page), observed = await page.evaluate(() => window.__digitsObserved)
  check(body.includes('Observed presentation in this tab') && body.includes('Known closed trials: 1'), 'retirement erased factual review')
  check(body.includes('Trial 1: 4 digits began presentation.'), 'prior confirmed onsets lost')
  if (order === 'next_first') check(/Trial 2: [1-3] digits began presentation\./.test(body), 'confirmed successor onset lost')
  else check(!body.includes('Trial 2:') && observed.length === 0, 'deletion-first invented onset')
  check(Object.keys(durable.attempts).length === 0 && !/Review-only record saved|Saved in this browser/.test(body), 'retirement retained saved authority')
  check(!body.includes('Maximum correctly recalled length') && (await page.getByRole('button', { name: /Retry saving/ }).count()) === 0, 'retired result offered performance/Retry')
  await page.waitForTimeout(1100)
  check(JSON.stringify(await root(page)) === JSON.stringify(durable), 'late callbacks resurrected/changed deletion root')
  await writeFile(new URL(`./F3-${type}-${order}.json`, import.meta.url), JSON.stringify({ body, durable, observed, checkpoint }, null, 2) + '\n')
  await page.getByRole('button', { name: 'Replay Digits' }).click(); await page.getByRole('button', { name: 'See example' }).click()
  await page.getByRole('button', { name: 'Check understanding' }).click(); await page.getByLabel('What counts as correct?').selectOption('yes')
  await page.getByRole('button', { name: 'Check answer', exact: true }).click(); await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  await page.getByRole('button', { name: 'Continue to readiness' }).click(); await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.waitForFunction(() => /^[0-9]$/.test(document.querySelector('.digits-stimulus')?.textContent ?? ''))
  const fresh = Object.values((await root(page)).attempts)[0]
  check(fresh.ordinal === (type === 'all' ? 1 : 2) && fresh.arm.form.id === (type === 'all' ? 'DV1' : 'DV2'), 'retired Replay retained stale store/rotation')
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await settledReport(page)
  return { body, observed, counter: durable.counters.visual, attempts: 0, lateRootUnchanged: true, freshForm: fresh.arm.form.id, freshOrdinal: fresh.ordinal }
})
await run('F1 canceled arm authority read failure cannot turn Retry Start into presentation', async page => {
  await prepare(page); await observe(page); await page.evaluate(() => window.__digitsFault = 'hold_arm')
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await page.waitForFunction(() => window.__digitsHeld.length > 0)
  await page.evaluate(() => { window.__digitsFault = 'lose_read'; window.dispatchEvent(new Event('blur')) })
  await page.getByText('Canceled Start could not be reconciled. Retry Start to verify its cancellation; this request cannot begin presentation.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await settledReport(page)
  const durable = await root(page), attempt = Object.values(durable.attempts)[0]
  check(attempt.snapshot.state.invalidReason === 'blur' && attempt.snapshot.state.presentedTrials === 0 && durable.counters.visual === 1, 'read retry resumed canceled arm')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(f => f())); await page.waitForTimeout(100)
  check((await page.evaluate(() => window.__digitsObserved)).length === 0, 'late canceled onset')
  return { body: await page.locator('body').innerText(), durable }
}, storageFaults)
await run('F1 canceled terminal genuine save failure retains exact retry bytes', async page => {
  await prepare(page); await page.evaluate(() => window.__digitsFault = 'hold_arm')
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await page.waitForFunction(() => window.__digitsHeld.length > 0)
  await page.evaluate(() => { window.__digitsFault = 'reject_terminal'; window.dispatchEvent(new Event('blur')) })
  await page.getByRole('button', { name: 'Retry saving or verifying this result' }).waitFor()
  const failed = await root(page)
  check(!Object.values(failed.attempts)[0].snapshot, 'rejected terminal saved')
  await page.getByRole('button', { name: 'Retry saving or verifying this result' }).click(); await settledReport(page)
  const durable = await root(page), state = Object.values(durable.attempts)[0].snapshot.state
  check(state.invalidReason === 'blur' && state.events.filter(e => e.type === 'invalidated').length === 1 && state.presentedTrials === 0, 'same-byte terminal retry changed observation')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(f => f())); await page.waitForTimeout(100)
  check(JSON.stringify(await root(page)) === JSON.stringify(durable), 'late arm changed recovered result/activity')
  return { body: await page.locator('body').innerText(), state }
}, storageFaults)
await run('F2 declared assistance remains distinct from actual use', async page => {
  await page.getByRole('button', { name: 'Open Digits' }).click(); await page.getByRole('button', { name: 'See example' }).click()
  await page.getByRole('button', { name: 'Check understanding' }).click(); await page.getByLabel('What counts as correct?').selectOption('yes')
  await page.getByRole('button', { name: 'Check answer', exact: true }).click(); await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  await page.locator('summary').click(); await page.getByLabel('I plan to use assisted text entry; label this result separately').check()
  await page.getByRole('button', { name: 'Continue to readiness' }).click(); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  for (let i = 0; i < 3; i++) { await answer(page, false); if (i < 2) await page.getByRole('button', { name: 'Next', exact: true }).click() }
  await settledReport(page)
  const body = await page.locator('body').innerText(), durable = await root(page), attempt = Object.values(durable.attempts)[0]
  check(body.includes('assisted entry declared') && !body.includes('assisted entry used'), 'declaration incorrectly asserted actual use')
  check(attempt.arm.profile.assistedEntryDeclared && attempt.snapshot.state.closed.every(trial => !trial.assistedEntry), 'journal changed assistance facts')
  return { body, declared: true, actual: false }
})
await run('F1 native active transaction canceled before put, absent read then old callback cannot commit', async page => {
  await prepare(page); await observe(page)
  await page.evaluate(() => {
    window.__armBeforePutHeld = false; window.__lateBeforePut = []
    const get = IDBObjectStore.prototype.get
    const success = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')
    let holdNext = true
    Object.defineProperty(IDBRequest.prototype, 'onsuccess', { configurable: true,
      get() { return success.get.call(this) },
      set(handler) { success.set.call(this, handler && function(event) {
        if (holdNext && this.source instanceof IDBObjectStore && this.source.name === 'installation' &&
          this.source.transaction.mode === 'readwrite' && this.result?.version === 'digits_storage_v1_1') {
          holdNext = false; window.__armBeforePutHeld = true
          const request = this, source = this.source
          let keep = true
          const pump = () => { if (!keep) return
            try { const next = get.call(source, 'root'); next.onsuccess = pump; next.onerror = () => { keep = false } } catch { keep = false }
          }
          window.__lateBeforePut.push(() => { keep = false; handler.call(request, event) })
          pump(); return
        }
        return handler.call(this, event)
      }) },
    })
  })
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await page.waitForFunction(() => window.__armBeforePutHeld)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.getByText('Start canceled before any retained result could be confirmed. Start a new attempt to continue.', { exact: true }).waitFor()
  const absent = await root(page)
  check(absent.counters.visual === 0 && Object.keys(absent.attempts).length === 0, 'before-put cancel committed arm')
  await page.evaluate(() => window.__lateBeforePut.splice(0).forEach(callback => callback())); await page.waitForTimeout(100)
  const late = await root(page)
  check(JSON.stringify(absent) === JSON.stringify(late), 'old aborted transaction committed after absent read')
  check((await page.evaluate(() => window.__digitsObserved)).length === 0, 'aborted precommit request displayed digit')
  await page.getByRole('button', { name: 'Start scored Digits' }).click(); await entry(page)
  const fresh = Object.values((await root(page)).attempts)[0]
  check(fresh.ordinal === 1 && fresh.arm.form.id === 'DV1', 'uncommitted cancellation consumed rotation')
  await page.getByRole('button', { name: 'Skip', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  await page.getByRole('button', { name: 'End and review' }).click(); await settledReport(page)
  return { absent, late, identical: true, freshOrdinal: fresh.ordinal, freshForm: fresh.arm.form.id }
}, storageFaults)
await browser.close()
if (results.some(row => row.status !== 'PASS')) process.exitCode = 1
