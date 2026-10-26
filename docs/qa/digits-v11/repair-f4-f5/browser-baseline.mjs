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
  if (process.env.CASE_REGEX && !new RegExp(process.env.CASE_REGEX).test(name)) return
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (init) await context.addInitScript(init)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await page.goto(base); const detail = await test(page, context); check(!errors.length, `Page errors: ${errors.join('; ')}`); results.push({ name, status: 'PASS', detail }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-3500) }) }
  finally { await context.close(); console.log(name, results.at(-1).status); await writeFile(new URL(process.env.CASE_FILTER ? `./browser-${process.env.CASE_FILTER.replaceAll(' ', '-')}.json` : './browser-development.json', import.meta.url), JSON.stringify(results, null, 2) + '\n') }
}
await run('normal adaptive C W C W C W, native Enter, saved report and byte-identical reload/history', async page => {
  await prepare(page); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).focus()
  await page.keyboard.press('Space')
  await page.waitForFunction(() => /^[0-9]$/.test(document.querySelector('.digits-stimulus')?.textContent ?? ''))
  await page.screenshot({ path: new URL('./visual-play.png', import.meta.url).pathname })
  const targets = []
  for (let trial = 0; trial < 6; trial++) {
    targets.push(await answer(page, trial % 2 === 0, { enter: trial === 0 }))
    if (trial < 5) { await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Next')?.disabled)
      const savedRoot = await root(page), attempt = Object.values(savedRoot.attempts)[0]
      check(attempt.snapshot.state.closed.length === trial + 1, 'Next offered without exact prefix')
      await observe(page); await page.getByRole('button', { name: 'Next', exact: true }).click() }
  }
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  check((await page.locator('body').innerText()).includes('Maximum correctly recalled length: 4'), 'wrong maximum report')
  const before = await root(page), attempt = Object.values(before.attempts)[0]
  check(attempt.snapshot.state.completionReason === 'three_mistakes', 'wrong ending')
  check(attempt.snapshot.state.closed.length === 6, 'wrong trial count')
  const bytes = JSON.stringify(attempt.snapshot)
  await writeFile(new URL('./visual-terminal-root.json', import.meta.url), JSON.stringify(before, null, 2) + '\n')
  check(targets.map(t => t.length).join(',') === '4,5,4,5,4,5', 'wrong adaptive playback path')
  await page.screenshot({ path: new URL('./visual-report.png', import.meta.url).pathname, fullPage: true })
  await page.reload(); await page.getByRole('button', { name: 'Open Digits', exact: true }).click()
  await page.getByRole('button', { name: 'Local history', exact: true }).click()
  await page.getByRole('button', { name: 'Open review' }).click()
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  const after = await root(page)
  check(JSON.stringify(after.attempts[attempt.sessionId].snapshot) === bytes, 'reload changed snapshot')
  await writeFile(new URL('./visual-reloaded-root.json', import.meta.url), JSON.stringify(after, null, 2) + '\n')
  check(after.activity[attempt.sessionId].length === 2, 'missing report activity')
  return { lengths: targets.map(t => t.length), review: attempt.snapshot.review, events: attempt.snapshot.state.events.length, unchangedSnapshot: true }
})
await run('keypad trusted input and protected feedback blur', async page => {
  await prepare(page, { keypad: true }); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await entry(page)
  await page.locator('.digits-keypad button').first().focus()
  await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter')
  check(await page.locator('#digits-response').inputValue() === '0', 'held keypad Enter entered twice')
  await page.getByRole('button', { name: 'Delete last digit', exact: true }).click()
  const target = await answer(page, true, { keypad: true })
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  const attempt = Object.values((await root(page)).attempts)[0]
  check(attempt.snapshot.state.phase === 'invalid', 'feedback blur did not invalidate')
  check(attempt.snapshot.state.closed[0].answer === target, 'keypad answer not retained')
  check(attempt.snapshot.review.status === 'invalid', 'invalid aggregate status')
  return { closed: attempt.snapshot.state.closed.length, reason: attempt.snapshot.review.reason, presented: attempt.snapshot.state.presentedTrials }
})
await run('untrusted input rejected; held physical key repeat suppressed', async page => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click(); await entry(page)
  await page.locator('#digits-response').focus()
  await page.evaluate(() => { const field = document.querySelector('#digits-response')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(field, '1234'); field.dispatchEvent(new InputEvent('input', { bubbles: true, data: '1234', inputType: 'insertText' }))
    field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '1234' }))
    document.querySelector('.digits-entry button').click()
  })
  check(await page.locator('#digits-response').inputValue() === '', 'untrusted value entered')
  await page.keyboard.down('7'); await page.keyboard.down('7'); await page.keyboard.up('7')
  check(await page.locator('#digits-response').inputValue() === '7', 'repeat key entered twice')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  return { untrustedIgnored: true, heldKeySingleDigit: true }
})
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
await run('committed arm held delivery, same-request retry, and late callback cannot double rotate', async page => {
  await prepare(page); await observe(page); await page.evaluate(() => { window.__digitsFault = 'hold_arm' })
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.getByText('Start could not be confirmed.', { exact: false }).waitFor()
  check((await root(page)).counters.visual === 1, 'held arm not committed')
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await entry(page)
  check((await root(page)).counters.visual === 1, 'retry consumed second arm')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(release => release()))
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor()
  check((await root(page)).counters.visual === 1, 'late arm callback rotated')
  return { armCounter: 1, sameRequestRecovered: true }
}, storageFaults)
await run('genuine checkpoint failure disables Next; one same-byte retry recovers', async page => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await entry(page); await page.evaluate(() => { window.__digitsFault = 'reject_checkpoint' })
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Retry saving', exact: true }).waitFor()
  check(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), 'failed write enabled Next')
  check(!Object.values((await root(page)).attempts)[0].snapshot, 'rejected checkpoint saved')
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Next')?.disabled)
  const snapshot = Object.values((await root(page)).attempts)[0].snapshot
  check(snapshot.state.closed.length === 1 && snapshot.kind === 'checkpoint', 'retry wrong prefix')
  return { samePrefixVerified: true, closed: 1 }
}, storageFaults)
await run('committed held checkpoint then feedback End reconciles before terminal; late callback fenced', async page => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await entry(page); await page.evaluate(() => { window.__digitsFault = 'hold_checkpoint' })
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'End and review', exact: true }).click()
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  const before = Object.values((await root(page)).attempts)[0].snapshot
  check(before.kind === 'terminal' && before.state.invalidReason === 'candidate_ended', 'End failed terminal')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(release => release()))
  await page.waitForTimeout(80)
  const after = Object.values((await root(page)).attempts)[0].snapshot
  check(JSON.stringify(before) === JSON.stringify(after), 'late checkpoint changed terminal')
  return { reason: before.review.reason, closed: before.state.closed.length, lateCheckpointIgnored: true }
}, storageFaults)
await run('terminal held delivery shows unsaved draft; retry confirms same bytes', async page => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await entry(page); await page.evaluate(() => { window.__digitsFault = 'hold_terminal'; window.dispatchEvent(new Event('blur')) })
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  await page.getByRole('button', { name: 'Retry saving or verifying this result' }).waitFor()
  check((await page.locator('body').innerText()).includes('has not been confirmed saved'), 'held terminal false saved')
  const before = Object.values((await root(page)).attempts)[0].snapshot
  await page.getByRole('button', { name: 'Retry saving or verifying this result' }).click()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  const after = Object.values((await root(page)).attempts)[0].snapshot
  check(JSON.stringify(before) === JSON.stringify(after), 'terminal retry changed bytes')
  return { sameBytes: true, review: after.review }
}, storageFaults)
for (const type of ['individual', 'all']) for (const order of ['deletion_first', 'next_first']) {
  await run(`${type} ${order}: shared Next/deletion boundary without notifications`, async (page, context) => {
    const peer = await context.newPage(); await peer.goto(base); await page.bringToFront()
    await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click()
    await answer(page, false)
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Next')?.disabled)
    await observe(page)
    let deletionObservation
    if (order === 'deletion_first') {
      deletionObservation = await deleteFromPeer(peer, type)
      await page.getByRole('button', { name: 'Next', exact: true }).click()
    } else {
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      deletionObservation = await deleteFromPeer(peer, type)
    }
    await page.getByRole('heading', { name: 'Digits attempt removed' }).waitFor()
    const observed = await page.evaluate(() => window.__digitsObserved.join(''))
    check(order === 'deletion_first' ? observed.length === 0 : observed.length >= 1, 'wrong display/deletion order')
    const durable = await root(page)
    check(Object.keys(durable.attempts).length === 0, 'deleted attempt resurrected')
    return { successorDigitsObserved: observed.length, attempts: 0, visualCounter: durable.counters.visual,
      orderTrace: await page.evaluate(() => window.__digitsOrder), deletionObservation }
  }, () => { Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true })
    const request = navigator.locks.request.bind(navigator.locks)
    navigator.locks.request = (name, options, work) => request(name, options, async lock => {
      if (name === 'assessment-practice-digits-data-v1') window.__digitsOrder?.push({ type: 'data_lock_acquired', wallMs: Date.now(), atMs: performance.now() })
      try { return await work(lock) } finally { if (name === 'assessment-practice-digits-data-v1')
        window.__digitsOrder?.push({ type: 'data_lock_released', wallMs: Date.now(), atMs: performance.now() }) }
    })
  })
}
function fakeVoice() {
  const voice = { voiceURI: 'qa-local-en', lang: 'en-US', localService: true }
  const names = ['zero','one','two','three','four','five','six','seven','eight','nine']
  const listeners = new Map(); let epoch = 0
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true,
    value: class { constructor(text) { this.text = text; this.voice = null; this.onstart = null; this.onend = null; this.onerror = null } } })
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [voice], addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name), cancel: () => epoch++, speak: utterance => {
      const owned = epoch
      checkVoice(utterance)
      if (window.__digitsObserved) window.__digitsObserved.push(String(names.indexOf(utterance.text)))
      setTimeout(() => { if (epoch === owned) utterance.onstart?.() }, 10)
      setTimeout(() => { if (epoch === owned) utterance.onend?.() }, 100)
    },
  } })
  function checkVoice(utterance) { if (utterance.voice !== voice) throw Error('fake voice assignment mismatch') }
}
await run('eligible local-auditory full callback-injected journey, save and exact reload', async page => {
  await prepare(page, { auditory: true }); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  for (let i = 0; i < 3; i++) { await answer(page, false)
    if (i < 2) { await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Next')?.disabled)
      await observe(page); await page.getByRole('button', { name: 'Next', exact: true }).click() } }
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  const attempt = Object.values((await root(page)).attempts)[0], bytes = JSON.stringify(attempt.snapshot)
  await writeFile(new URL('./auditory-terminal-root.json', import.meta.url), JSON.stringify(await root(page), null, 2) + '\n')
  check(attempt.snapshot.review.status === 'valid' && attempt.mode === 'auditory', 'auditory not valid')
  check(attempt.snapshot.state.events.filter(e => e.type === 'speech_started').length === 9, 'wrong audio observation count')
  await page.reload(); await page.getByRole('button', { name: 'Open Digits', exact: true }).click()
  await page.getByRole('button', { name: 'Local history', exact: true }).click(); await page.getByRole('button', { name: 'Open review' }).click()
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  check(JSON.stringify(Object.values((await root(page)).attempts)[0].snapshot) === bytes, 'auditory reload changed bytes')
  await writeFile(new URL('./auditory-reloaded-root.json', import.meta.url), JSON.stringify(await root(page), null, 2) + '\n')
  return { callbackInjection: true, physicalAudibility: 'not established', speechStarts: 9, unchangedSnapshot: true }
}, fakeVoice)
await run('auditory unavailable disclosure with no voices, visual remains usable', async page => {
  await page.getByRole('button', { name: 'Open Digits', exact: true }).click()
  await page.getByRole('button', { name: 'See example', exact: true }).click()
  await page.getByRole('button', { name: 'Check understanding', exact: true }).click()
  await page.getByLabel('What counts as correct?').selectOption('yes'); await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await page.locator('summary').click()
  check(await page.getByLabel('Auditory digits with a verified local English browser voice').isDisabled(), 'unavailable auditory selectable')
  check(await page.getByLabel('Visual digits', { exact: true }).isChecked(), 'visual fallback absent')
  return { unavailableDeclared: true }
}, () => { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [] } }) })
await run('200 percent CSS zoom keyboard entry, normal button Enter, and report focus', async page => {
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await prepare(page); await observe(page)
  await page.getByRole('button', { name: 'Start scored Digits' }).focus(); await page.keyboard.press('Enter')
  await entry(page)
  const layout = await page.locator('.digits-entry').evaluate(element => {
    const r = element.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollY,
      stimulus: document.querySelector('.digits-stimulus')?.getBoundingClientRect().toJSON() }
  })
  check(layout.bottom <= layout.height && layout.right <= layout.width && layout.scrollWidth <= layout.clientWidth + 1, 'zoom entry overflow')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'End and review', exact: true }).click()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  check(await page.getByRole('heading', { name: 'Digits report' }).evaluate(element => element === document.activeElement), 'report focus absent')
  return { method: 'CSS zoom 2 at 1280x800, bounded reflow evidence', layout }
})
await run('required first frame missing, late callback fenced, saved Invalid with zero exposure', async page => {
  await prepare(page)
  await page.evaluate(() => {
    window.__lateFrames = []
    window.requestAnimationFrame = callback => { window.__lateFrames.push(callback); return window.__lateFrames.length }
  })
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  const before = Object.values((await root(page)).attempts)[0].snapshot
  check(before.review.reason === 'visual_frame_watchdog' && before.state.presentedTrials === 0, 'frame failure exposure wrong')
  await page.evaluate(() => window.__lateFrames.splice(0).forEach(callback => callback(performance.now())))
  const after = Object.values((await root(page)).attempts)[0].snapshot
  check(JSON.stringify(before) === JSON.stringify(after), 'late frame changed terminal')
  return { presented: 0, reason: before.review.reason, lateFrameIgnored: true }
})
await run('saved report held authority read hides numbers until current root is verified', async page => {
  await prepare(page); await observe(page); await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await answer(page, false); await page.getByRole('button', { name: 'End and review', exact: true }).click()
  await page.getByText('Review-only record saved in this browser', { exact: true }).waitFor()
  await page.evaluate(() => { window.__digitsFault = 'hold_read' })
  await page.getByText('Numbers are hidden until the check finishes.', { exact: false }).waitFor()
  check(!(await page.locator('body').innerText()).includes('1 trials began presentation'), 'held read retained numbers')
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(release => release()))
  await page.getByText('1 trials began presentation', { exact: false }).waitFor()
  return { withheldDuringRead: true, restoredAfterCurrentAuthority: true }
}, storageFaults)
await run('held terminal delivery plus other-tab deletion retires retry and late saved copy', async (page, context) => {
  const peer = await context.newPage(); await peer.goto(base); await page.bringToFront()
  await prepare(page); await page.evaluate(() => { window.__digitsFault = 'hold_terminal' })
  await page.getByRole('button', { name: 'Start scored Digits' }).click()
  await page.locator('.digits-stimulus').waitFor()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.getByRole('heading', { name: 'Digits report' }).waitFor()
  const prefix = Object.values((await root(page)).attempts)[0].snapshot
  check(prefix?.kind === 'terminal', 'held terminal did not commit')
  await deleteFromPeer(peer, 'individual')
  await page.getByRole('heading', { name: 'Digits attempt removed' }).waitFor()
  await page.evaluate(() => window.__digitsHeld.splice(0).forEach(release => release()))
  await page.waitForTimeout(80)
  check(Object.keys((await root(page)).attempts).length === 0, 'late terminal resurrected')
  check(!(await page.locator('body').innerText()).includes('Saved in this browser'), 'late saved claim restored')
  check(await page.getByRole('button', { name: /Retry saving/ }).count() === 0, 'deleted retry remained')
  return { lateSavedCopySuppressed: true, attempts: 0, deletedRetryAbsent: true }
}, storageFaults)
await browser.close()
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1
