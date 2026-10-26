import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4177/'
const results = []
async function run(name, test) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await page.goto(base); const detail = await test(page, context); if (errors.length) throw Error(`Page errors: ${errors.join('; ')}`); results.push({ name, status: 'PASS', detail }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error) }) }
  finally { await context.close() }
}
async function prepare(page, key = 'Space', holdInputCheck = false) {
  await page.getByRole('button', { name: /Open Keypresses/ }).click()
  await page.getByRole('button', { name: 'See an example' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Press example key' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Only after GO and before END').check()
  await page.getByRole('button', { name: 'Check answer' }).click()
  if (key !== 'Space') {
    await page.getByRole('button', { name: 'Change key' }).click()
    await page.getByRole('group', { name: 'Key capture' }).press(key)
  }
  await page.getByRole('button', { name: 'Run input check' }).click()
  if (holdInputCheck) await page.keyboard.down(key)
  else await page.getByRole('group', { name: 'Key capture' }).press(key)
  await page.getByRole('button', { name: 'Continue to readiness' }).click()
}
function assert(condition, message) { if (!condition) throw Error(message) }
async function savedRecord(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-keypresses-v1')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('installation', 'readonly')
      const read = transaction.objectStore('installation').get('root')
      transaction.oncomplete = () => { db.close(); resolve(Object.values(read.result.records)[0] ?? null) }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
    }
  }))
}
try {
  await run('40 Space presses, saved report, reload, deletion', async page => {
    await prepare(page)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 8000 })
    const before = await page.locator('.journey').innerText()
    assert(before.includes('saved in this browser') && before.includes('Valid practice attempt') && before.includes('40 of 40'), 'completed report mismatch')
    assert(before.includes('No interruption was recorded.') && before.includes('Advanced Training is not available for Keypresses'), 'valid report context missing')
    assert(before.includes('intervals over') && before.includes('After the scored window ended, before END appeared') && before.includes('Task version: keypresses_spec_v1_0_1'), 'report context missing')
    assert(await page.evaluate(() => document.activeElement?.textContent === 'Keypresses attempt ended'), 'focus did not move to completed report')
    await page.waitForFunction(async () => {
      const request = indexedDB.open('assessment-practice-keypresses-v1')
      return new Promise(resolve => {
        request.onsuccess = () => {
          const db = request.result, transaction = db.transaction('installation', 'readonly')
          const read = transaction.objectStore('installation').get('root')
          transaction.oncomplete = () => { db.close(); resolve(Object.values(read.result.records)[0]?.journal?.at(-1)?.type === 'report_viewed') }
        }
      })
    }, { timeout: 4000 })
    const firstRecord = await savedRecord(page)
    const firstState = JSON.stringify(firstRecord.state)
    assert(firstRecord.journal.length === firstRecord.state.events.length + 1, 'live report view missing from journal')
    assert(firstRecord.journal.at(-1).type === 'report_viewed' && JSON.parse(firstRecord.journal.at(-1).detail).context === 'live', 'live report-view context mismatch')
    await page.screenshot({ path: fileURLToPath(new URL('./browser-report.png', import.meta.url)), fullPage: true })
    await page.reload()
    await page.getByRole('button', { name: /Open Keypresses/ }).click()
    await page.getByRole('button', { name: 'Keypresses history' }).click()
    await page.evaluate(() => {
      window.firstMetricsWall = null
      new MutationObserver(() => {
        if (window.firstMetricsWall === null && document.querySelector('.keypresses-metrics')) window.firstMetricsWall = Date.now()
      }).observe(document.body, { childList: true, subtree: true })
      const original = IDBDatabase.prototype.transaction
      const oncomplete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')
      window.heldKeypressReads = []
      window.holdKeypressReads = true
      IDBDatabase.prototype.transaction = function(name, mode, ...rest) {
        const transaction = original.call(this, name, mode, ...rest)
        if (mode === 'readonly') Object.defineProperty(transaction, 'oncomplete', {
          set(callback) { oncomplete.set.call(transaction, function(event) {
            if (window.holdKeypressReads) window.heldKeypressReads.push(() => callback.call(transaction, event))
            else callback.call(transaction, event)
          }) },
        })
        return transaction
      }
      window.restoreKeypressReads = () => { IDBDatabase.prototype.transaction = original }
    })
    await page.getByRole('button', { name: 'Review result' }).click()
    await page.waitForTimeout(600)
    assert(await page.locator('.keypresses-metrics').count() === 0, 'history numbers appeared before authority read')
    await page.evaluate(() => {
      window.holdKeypressReads = false
      window.heldKeypressReads.splice(0).forEach(release => release())
      window.restoreKeypressReads()
    })
    await page.getByRole('heading', { name: 'Saved Keypresses result' }).waitFor({ timeout: 4000 })
    const after = await page.locator('.journey').innerText()
    assert(after.includes('40 of 40') && after.includes('Valid practice attempt'), 'reopened report mismatch')
    let reopened = await savedRecord(page)
    for (let attempt = 0; attempt < 80 && reopened.journal.length < reopened.state.events.length + 2; attempt++) {
      await page.waitForTimeout(50)
      reopened = await savedRecord(page)
    }
    const firstMetricsWall = await page.evaluate(() => window.firstMetricsWall)
    assert(JSON.stringify(reopened.state) === firstState, 'report view changed timed state')
    assert(reopened.journal.length === reopened.state.events.length + 2 && JSON.parse(reopened.journal.at(-1).detail).context === 'history',
      `history report-view event missing: ${JSON.stringify({ timed: reopened.state.events.length, journal: reopened.journal.length, tail: reopened.journal.at(-1) })}`)
    assert(reopened.journal.at(-1).timestampMs >= firstMetricsWall, 'history view was timestamped before verified report display')
    assert(reopened.journal.every((event, index) => event.sequenceNumber === index + 1), 'report journal order mismatch')
    await page.getByRole('button', { name: 'Delete this attempt' }).click()
    await page.getByText('No saved Keypresses attempts in this browser.').waitFor({ timeout: 4000 })
    return { accepted: 40, savedAndReopened: true, liveAndHistoryViews: 2, journalEvents: reopened.journal.length, delayedHistoryReadMs: 600, viewAfterVisibleMs: reopened.journal.at(-1).timestampMs - firstMetricsWall, individuallyDeleted: true }
  })
  await run('modified key, two presses and deadline', async page => {
    await prepare(page, 'f')
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    await page.keyboard.press('f'); await page.keyboard.press('f')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 21_000 })
    const text = await page.locator('.journey').innerText()
    assert(text.includes('2 of 40') && text.includes('modified key') && text.includes('Target not reached'), 'modified sparse report mismatch')
    await page.getByText('This attempt was saved in this browser.').waitFor()
    await page.getByRole('button', { name: 'Back to library' }).click()
    await page.getByRole('button', { name: /Open Keypresses/ }).click()
    await page.getByRole('button', { name: 'Keypresses history' }).click()
    await page.getByRole('heading', { name: 'Keypresses history' }).waitFor()
    assert((await page.locator('.journey').innerText()).includes('Modified key: KeyF'), 'history omitted modified-key label')
    return { accepted: 2, targetReached: false, modifiedKeyLabeled: true, historyLabeled: true }
  })
  await run('early timer delivery still waits for actual deadline and late close', async page => {
    await prepare(page, 'f')
    await page.evaluate(() => {
      const original = window.setTimeout.bind(window)
      window.setTimeout = (callback, delay, ...args) => original(callback, Math.max(0, delay - 2), ...args)
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    await page.keyboard.press('f'); await page.keyboard.press('f')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 21_000 })
    const text = await page.locator('.journey').innerText()
    assert(text.includes('Valid practice attempt') && text.includes('2 of 40'), 'early callback invalidated normal deadline or late close')
    return { accepted: 2, valid: true, injection: 'relative timers delivered up to 2 ms early; monotonic clock unchanged' }
  })
  await run('input capture keeps Tab navigation and Escape cancellation', async page => {
    await page.getByRole('button', { name: /Open Keypresses/ }).click()
    await page.getByRole('button', { name: 'See an example' }).click()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Press example key' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Only after GO and before END').check()
    await page.getByRole('button', { name: 'Check answer' }).click()
    await page.getByRole('button', { name: 'Run input check' }).click()
    await page.getByRole('group', { name: 'Key capture' }).press('Tab')
    assert(await page.evaluate(() => document.activeElement?.getAttribute('role') !== 'group'), 'Tab remained trapped')
    await page.getByRole('button', { name: 'Run input check' }).click()
    await page.getByRole('group', { name: 'Key capture' }).press('Escape')
    assert(await page.getByRole('group', { name: 'Key capture' }).count() === 0, 'Escape did not cancel capture')
    assert(await page.getByRole('button', { name: 'Run input check' }).evaluate(button => document.activeElement === button), 'Escape focus did not return')
    return { tabNavigates: true, escapeCancels: true, focusReturns: true }
  })
  await run('held selected key blocks scored start until release', async page => {
    await prepare(page, 'f', true)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.getByText('Release the selected key before starting.').waitFor()
    assert(await page.locator('.keypresses-signal').count() === 0, 'held key still armed run')
    await page.keyboard.up('f')
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    return { heldBlocked: true, releaseAllowed: true }
  })
  await run('injected blur invalidates and saves review-only attempt', async page => {
    await prepare(page)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    await page.keyboard.press('Space')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 8000 })
    await page.getByText('This attempt was saved in this browser.').waitFor({ timeout: 4000 })
    const text = await page.locator('.journey').innerText()
    assert(text.includes('Invalid practice attempt') && text.includes('for review only') &&
      text.includes('saved in this browser') && text.includes('The game window lost focus.') &&
      text.includes('Advanced Training is not available for Keypresses'), 'invalidation report context mismatch')
    return { invalid: true, retained: true, injection: 'untrusted blur' }
  })
  await run('cross-tab browser owner lock blocks second run', async (page, context) => {
    const held = await page.evaluate(async () => {
      let release
      const hold = new Promise(resolve => { release = resolve })
      let acquired
      const ready = new Promise(resolve => { acquired = resolve })
      navigator.locks.request('assessment-practice-keypresses-live-v1', async lock => { acquired(!!lock); await hold })
      window.releaseKeypressLock = release
      return ready
    })
    assert(held, 'test lock not acquired')
    const other = await context.newPage(); await other.goto(base); await prepare(other)
    await other.getByRole('button', { name: 'Start Keypresses' }).click()
    await other.getByRole('alert').filter({ hasText: 'active in another tab' }).waitFor({ timeout: 7000 })
    await page.evaluate(() => window.releaseKeypressLock())
    return { competingStartBlocked: true }
  })
  await run('cancel preparation before delayed owner acquisition releases lock', async page => {
    await prepare(page)
    await page.evaluate(() => {
      const original = navigator.locks.request.bind(navigator.locks)
      navigator.locks.request = (...args) => new Promise(resolve => {
        setTimeout(() => resolve(original(...args)), 300)
      })
      window.restoreKeypressLockRequest = () => { navigator.locks.request = original }
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.getByRole('button', { name: 'Cancel preparation' }).click()
    await page.getByRole('heading', { name: 'Ready for Keypresses?' }).waitFor()
    await page.waitForTimeout(500)
    const available = await page.evaluate(async () => {
      window.restoreKeypressLockRequest()
      return navigator.locks.request('assessment-practice-keypresses-live-v1', { ifAvailable: true }, lock => !!lock)
    })
    assert(available, 'canceled owner acquisition held the browser lock')
    return { canceledBeforeAcquisition: true, subsequentLockAvailable: true }
  })
  await run('cross-tab Delete all withdraws open report', async (page, context) => {
    await prepare(page)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByText('This attempt was saved in this browser.').waitFor({ timeout: 8000 })
    const other = await context.newPage(); await other.goto(base)
    await other.getByRole('button', { name: /Open Keypresses/ }).click()
    await other.getByRole('button', { name: 'Keypresses history' }).click()
    await other.getByRole('button', { name: 'Delete all Keypresses data' }).click()
    await other.getByRole('button', { name: 'Confirm Delete all' }).click()
    await page.getByText('This result is not currently available for review.').waitFor({ timeout: 5000 })
    assert(!(await page.locator('.journey').innerText()).includes('40 of 40'), 'deleted report numbers remained visible')
    return { deletedReportWithdrawn: true }
  })
  await run('withheld GO frame invalidates without confirmed onset', async page => {
    await prepare(page)
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = callback => document.querySelector('.keypresses-signal')?.dataset.phase === 'go'
        ? original(() => {}) : original(callback)
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 7000 })
    const text = await page.locator('.journey').innerText()
    assert(text.includes('Invalid practice attempt') && !text.includes('Valid practice attempt') &&
      text.includes('GO was not confirmed within the timing limit.') && text.includes('Advanced Training is not available for Keypresses'), 'missing GO confirmation or report context')
    return { invalid: true, injection: 'withheld GO animation-frame confirmation' }
  })
  await run('delayed END frame invalidates after actual 40th press', async page => {
    await prepare(page)
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = callback => document.querySelector('.keypresses-signal')?.dataset.phase === 'end'
        ? original(() => setTimeout(() => callback(performance.now()), 350)) : original(callback)
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 8000 })
    const text = await page.locator('.journey').innerText()
    assert(text.includes('Invalid practice attempt') && text.includes('40 of 40') &&
      text.includes('END was not confirmed within the timing limit.'), 'delayed END confirmation changed factual target, validity or reason')
    return { invalid: true, targetReached: true, injection: '350 ms END confirmation delay' }
  })
  await run('early END watchdog does not preempt timely frame', async page => {
    await prepare(page)
    await page.evaluate(() => {
      const timer = window.setTimeout.bind(window)
      const frame = window.requestAnimationFrame.bind(window)
      window.setTimeout = (callback, delay, ...args) => timer(callback, Math.max(0, delay - 20), ...args)
      window.requestAnimationFrame = callback => document.querySelector('.keypresses-signal')?.dataset.phase === 'end'
        ? frame(() => timer(() => callback(performance.now()), 180)) : frame(callback)
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 5000 })
    assert((await page.locator('.journey').innerText()).includes('Valid practice attempt'), 'early watchdog invalidated timely END confirmation')
    return { valid: true, injection: 'watchdog timer 20 ms early; END frame delayed 180 ms with native timer' }
  })
  await run('withheld END frame times out and releases ownership', async page => {
    await prepare(page)
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = callback => document.querySelector('.keypresses-signal')?.dataset.phase === 'end'
        ? original(() => {}) : original(callback)
    })
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByRole('heading', { name: 'Keypresses attempt ended' }).waitFor({ timeout: 4000 })
    const text = await page.locator('.journey').innerText()
    const lockAvailable = await page.evaluate(() => navigator.locks.request('assessment-practice-keypresses-live-v1', { ifAvailable: true }, lock => !!lock))
    assert(text.includes('Invalid practice attempt') && text.includes('40 of 40') && lockAvailable, 'missing END did not retain invalid attempt and release lock')
    return { invalid: true, factualTargetRetained: true, lockReleased: true, injection: 'withheld END animation-frame callback' }
  })
  await run('lost completion callback reconciles committed result', async page => {
    await prepare(page)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction
      IDBDatabase.prototype.transaction = function(name, mode, ...rest) {
        const transaction = original.call(this, name, mode, ...rest)
        if (mode === 'readwrite') Object.defineProperty(transaction, 'oncomplete', {
          configurable: true, get() { return null }, set() { /* injected missing callback */ },
        })
        return transaction
      }
    })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByText('This attempt was saved in this browser.').waitFor({ timeout: 6000 })
    assert((await page.locator('.journey').innerText()).includes('40 of 40'), 'committed report not shown')
    return { recoveredSavedClaim: true, injection: 'withheld IndexedDB transaction completion callback' }
  })
  await run('failed completion write remains reviewable and one retry saves', async page => {
    await prepare(page)
    await page.getByRole('button', { name: 'Start Keypresses' }).click()
    await page.locator('.keypresses-signal[data-phase="go"]').waitFor({ timeout: 7000 })
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction
      window.restoreKeypressWrites = () => { IDBDatabase.prototype.transaction = original }
      IDBDatabase.prototype.transaction = function(name, mode, ...rest) {
        if (mode === 'readwrite') throw Error('Injected completion write failure')
        return original.call(this, name, mode, ...rest)
      }
    })
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space')
    await page.getByText('This attempt is retained only in this tab. Saving could not be confirmed.').waitFor({ timeout: 8000 })
    assert((await page.locator('.journey').innerText()).includes('40 of 40'), 'temporary report missing')
    await page.evaluate(() => window.restoreKeypressWrites())
    await page.getByRole('button', { name: 'Try saving once more' }).click()
    await page.getByText('This attempt was saved in this browser.').waitFor({ timeout: 5000 })
    return { truthfulUnsaved: true, retrySaved: true, injection: 'IndexedDB readwrite rejection' }
  })
} finally { await browser.close() }
const output = { browser: browser.version(), preview: base, results }
await writeFile(new URL('./browser-development.json', import.meta.url), JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify(output, null, 2))
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1
