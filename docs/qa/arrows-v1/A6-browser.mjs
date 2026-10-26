import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage()
const origin = process.env.ARROWS_QA_ORIGIN ?? 'http://127.0.0.1:4173'
const results = []
try {
  await page.goto(origin)
  await page.bringToFront()
  const started = await page.evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    const host = document.createElement('div')
    host.id = 'arrows-qa-host'
    Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
      zIndex: '999999', background: 'white', color: 'black', border: '1px solid black' })
    document.body.append(host)
    const store = await ArrowsStore.open()
    const entry = new ArrowsEntry(store)
    const run = new ArrowsBrowserRun(entry, host, () => {})
    window.arrowsA6 = { store, entry, run, host }
    const request = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
        alternative: false, accommodation: 'default', reducedMotion: false } }
    const state = await run.begin(request)
    return { phase: state.phase, form: state.form.id, ordinal: run.armedAttempt()?.ordinal }
  })
  await page.waitForFunction(() => window.arrowsA6.run.snapshot()?.phase === 'stimulus', { timeout: 5000 })
  const visible = await page.evaluate(() => ({ stage: document.querySelector('[data-arrows-stage]')?.getAttribute('data-arrows-stage'),
    symbols: document.querySelectorAll('[data-arrows-symbol]').length,
    onset: window.arrowsA6.run.snapshot().events.filter(e => e.type === 'stimulus_presented').length,
    correct: window.arrowsA6.run.snapshot().form.trials[0].direction }))
  await page.keyboard.press(visible.correct === 'left' ? 'ArrowLeft' : 'ArrowRight')
  await page.waitForFunction(() => window.arrowsA6.run.snapshot()?.events.some(e => e.type === 'trial_closed'), { timeout: 5000 })
  const afterFirst = await page.evaluate(() => {
    const state = window.arrowsA6.run.snapshot()
    return { phase: state.phase, trial: state.trialIndex,
      closed: state.events.filter(e => e.type === 'trial_closed').length,
      responses: state.events.filter(e => e.type === 'response').length,
      actualOnset: state.events.find(e => e.type === 'stimulus_presented')?.atMs,
      actualOffset: state.events.find(e => e.type === 'stimulus_offset')?.atMs }
  })
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const ended = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    const state = window.arrowsA6.run.snapshot()
    return { phase: state.phase, reason: state.invalidReason,
      retainedOnsets: state.events.filter(e => e.type === 'stimulus_presented').length,
      retainedClosed: state.events.filter(e => e.type === 'trial_closed').length,
      ownerHeld: (await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1') }
  })
  results.push({ started, visible, afterFirst, ended, pass: started.phase === 'fixation_pending' &&
    started.ordinal === 1 && visible.stage === 'stimulus' && visible.symbols === 5 && visible.onset === 1 &&
    afterFirst.closed === 1 && afterFirst.responses === 1 && afterFirst.actualOffset >= afterFirst.actualOnset &&
    ended.phase === 'invalid' && ended.reason === 'blur' && ended.retainedOnsets >= 1 &&
    ended.retainedClosed === 1 && !ended.ownerHeld })
  const heldStarted = await page.evaluate(async () => {
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    window.arrowsA6.run.dispose()
    const entry = new ArrowsEntry(window.arrowsA6.store)
    const run = new ArrowsBrowserRun(entry, window.arrowsA6.host, () => {})
    window.arrowsA6.entry = entry
    window.arrowsA6.run = run
    const request = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
        alternative: false, accommodation: 'default', reducedMotion: false } }
    await run.begin(request)
    return run.armedAttempt()?.ordinal
  })
  await page.waitForFunction(() => window.arrowsA6.run.snapshot()?.phase === 'fixation')
  await page.keyboard.down('ArrowLeft')
  await page.waitForFunction(() => window.arrowsA6.run.snapshot()?.phase === 'stimulus')
  const whileHeld = await page.evaluate(() => ({ response: window.arrowsA6.run.snapshot().firstResponse,
    held: window.arrowsA6.run.snapshot().heldCodes.includes('ArrowLeft') }))
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  const afterFresh = await page.evaluate(() => ({ response: window.arrowsA6.run.snapshot().firstResponse,
    responses: window.arrowsA6.run.snapshot().events.filter(e => e.type === 'response').length }))
  await page.evaluate(() => window.arrowsA6.run.cancel())
  results.push({ heldStarted, whileHeld, afterFresh, pass: heldStarted === 2 && whileHeld.response === null &&
    whileHeld.held && afterFresh.response?.direction === 'left' && afterFresh.responses === 1 })
  const withheld = await page.evaluate(async () => {
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    window.arrowsA6.run.dispose()
    const callbacks = []
    const original = window.requestAnimationFrame
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length }
    const run = new ArrowsBrowserRun(new ArrowsEntry(window.arrowsA6.store), window.arrowsA6.host, () => {})
    window.arrowsA6.run = run
    const request = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
        alternative: false, accommodation: 'default', reducedMotion: false } }
    await run.begin(request)
    await new Promise((resolve, reject) => {
      const limit = setTimeout(() => reject(Error('watchdog did not fire')), 4000)
      const check = () => run.snapshot()?.phase === 'invalid' ? (clearTimeout(limit), resolve()) : setTimeout(check, 10)
      check()
    })
    const before = { phase: run.snapshot().phase, reason: run.snapshot().invalidReason,
      onsets: run.snapshot().events.filter(e => e.type === 'stimulus_presented').length }
    window.requestAnimationFrame = original
    callbacks.forEach(callback => callback(performance.now()))
    await new Promise(resolve => setTimeout(resolve, 30))
    return { before, afterOnsets: run.snapshot().events.filter(e => e.type === 'stimulus_presented').length,
      invalidations: run.snapshot().events.filter(e => e.type === 'invalidated').length,
      ownerHeld: (await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1') }
  })
  results.push({ withheld, pass: withheld.before.phase === 'invalid' && withheld.before.reason === 'watchdog' &&
    withheld.before.onsets === 0 && withheld.afterOnsets === 0 && withheld.invalidations === 1 && !withheld.ownerHeld })
  const pointerPage = await browser.newPage()
  await pointerPage.goto(origin)
  await pointerPage.bringToFront()
  await pointerPage.evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
      zIndex: '999999', background: 'white', color: 'black', border: '1px solid black' })
    document.body.append(host)
    const run = new ArrowsBrowserRun(new ArrowsEntry(await ArrowsStore.open()), host, () => {})
    window.arrowsPointer = run
    await run.begin({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'pointer', pointerSource: 'mouse', alternative: false,
        accommodation: 'default', reducedMotion: false } })
  })
  await pointerPage.waitForFunction(() => window.arrowsPointer.snapshot()?.phase === 'stimulus')
  await pointerPage.locator('[data-direction="left"]').click()
  await pointerPage.locator('[data-direction="right"]').click()
  const pointer = await pointerPage.evaluate(() => {
    const state = window.arrowsPointer.snapshot()
    window.arrowsPointer.cancel()
    return { response: state.firstResponse,
      responseEvents: state.events.filter(e => e.type === 'response').length,
      extraEvents: state.events.filter(e => e.type === 'response_extra').length,
      profile: state.profile.kind }
  })
  results.push({ pointer, pass: pointer.profile === 'pointer' && pointer.response?.direction === 'left' &&
    pointer.response?.source === 'mouse' && pointer.responseEvents === 1 && pointer.extraEvents === 1 })
  const latePage = await browser.newPage()
  await latePage.goto(origin)
  await latePage.bringToFront()
  const late = await latePage.evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
      zIndex: '999999', background: 'white', color: 'black', border: '1px solid black' })
    document.body.append(host)
    const callbacks = []
    const original = window.requestAnimationFrame
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length }
    const run = new ArrowsBrowserRun(new ArrowsEntry(await ArrowsStore.open()), host, () => {})
    await run.begin({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
        alternative: false, accommodation: 'default', reducedMotion: false } })
    for (const callback of callbacks.splice(0)) callback(performance.now())
    if (run.snapshot()?.phase !== 'fixation') throw Error('Initial fixation did not confirm')
    await new Promise((resolve, reject) => {
      const limit = setTimeout(() => reject(Error('stimulus was not painted')), 3000)
      const check = () => host.querySelector('[data-arrows-stage="stimulus"]') ?
        (clearTimeout(limit), resolve()) : setTimeout(check, 5)
      check()
    })
    await new Promise(resolve => setTimeout(resolve, 320))
    for (const callback of callbacks.splice(0)) callback(performance.now())
    window.requestAnimationFrame = original
    const state = run.snapshot()
    for (let index = 0; index < 20; index++) {
      if (!(await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1')) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    return { phase: state.phase, reason: state.invalidReason,
      onsets: state.events.filter(e => e.type === 'stimulus_presented').length,
      invalidations: state.events.filter(e => e.type === 'invalidated').length,
      onsetAt: state.events.find(e => e.type === 'stimulus_presented')?.atMs,
      ownerHeld: (await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1') }
  })
  results.push({ late, pass: late.phase === 'invalid' && late.reason === 'timing' && late.onsets === 1 &&
    late.invalidations === 1 && Number.isFinite(late.onsetAt) && !late.ownerHeld })
  const faultPage = await browser.newPage()
  await faultPage.goto(origin)
  await faultPage.bringToFront()
  const technical = await faultPage.evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
      zIndex: '999999', background: 'white', color: 'black', border: '1px solid black' })
    document.body.append(host)
    const run = new ArrowsBrowserRun(new ArrowsEntry(await ArrowsStore.open()), host, state => {
      if (state.events.some(event => event.type === 'stimulus_presented')) throw Error('Injected render callback failure')
    })
    await run.begin({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
      profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
        alternative: false, accommodation: 'default', reducedMotion: false } })
    await new Promise((resolve, reject) => {
      const limit = setTimeout(() => reject(Error('technical failure did not settle')), 3000)
      const check = () => run.snapshot()?.phase === 'invalid' ? (clearTimeout(limit), resolve()) : setTimeout(check, 5)
      check()
    })
    for (let index = 0; index < 20; index++) {
      if (!(await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1')) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    const state = run.snapshot()
    return { phase: state.phase, reason: state.invalidReason,
      onsets: state.events.filter(e => e.type === 'stimulus_presented').length,
      invalidations: state.events.filter(e => e.type === 'invalidated').length,
      ownerHeld: (await navigator.locks.query()).held.some(lock => lock.name === 'assessment-practice-arrows-live-v1') }
  })
  results.push({ technical, pass: technical.phase === 'invalid' && technical.reason === 'technical' &&
    technical.onsets === 1 && technical.invalidations === 1 && !technical.ownerHeld })
  const result = { browser: await browser.version(), results }
  writeFileSync(new URL('./A6-browser.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  if (results.some(item => !item.pass)) process.exitCode = 1
} finally { await browser.close() }
