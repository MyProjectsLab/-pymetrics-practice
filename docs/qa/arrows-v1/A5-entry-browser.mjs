import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext()
const pages = [await context.newPage(), await context.newPage()]
const origin = process.env.ARROWS_QA_ORIGIN ?? 'http://127.0.0.1:4173'
const request = number => ({ requestId: `request-${number}`, sessionId: `session-${number}`,
  clockDomainId: `clock-${number}`, profile: { kind: 'keyboard', leftCode: 'ArrowLeft',
    rightCode: 'ArrowRight', alternative: false, accommodation: 'default', reducedMotion: false },
  atMs: 100 + number, wallMs: 1_000 + number })
try {
  await Promise.all(pages.map(page => page.goto(origin)))
  await pages[0].bringToFront()
  const first = await pages[0].evaluate(async input => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const { advance, verifyHeadless } = await import('/src/arrows/engine.ts')
    const store = await ArrowsStore.open()
    const entry = new ArrowsEntry(store)
    window.arrowsA5 = { store, entry }
    const arm = await entry.begin(input)
    return { ordinal: arm.ordinal, form: arm.state.form.id,
      replayed: verifyHeadless(arm.state),
      canAdvance: advance(arm.state, { kind: 'start', atMs: 200, responseHeld: false }).phase === 'fixation_pending' }
  }, request(1))
  await pages[1].bringToFront()
  const blocked = await pages[1].evaluate(async input => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const store = await ArrowsStore.open()
    const entry = new ArrowsEntry(store)
    window.arrowsA5 = { store, entry }
    try { await entry.begin(input); return false } catch { return true }
  }, request(2))
  await pages[0].evaluate(() => window.arrowsA5.entry.release())
  await pages[1].waitForFunction(async () => (await navigator.locks.query()).held.every(lock => lock.name !== 'assessment-practice-arrows-live-v1'))
  const second = await pages[1].evaluate(async input => {
    const arm = await window.arrowsA5.entry.begin(input)
    return { ordinal: arm.ordinal, form: arm.state.form.id }
  }, request(2))
  await pages[1].evaluate(() => window.arrowsA5.entry.release())
  await pages[0].bringToFront()
  const canceled = await pages[0].evaluate(async input => {
    const { ArrowsEntry } = await import('/src/arrows/entry.ts')
    const store = window.arrowsA5.store
    const original = store.start.bind(store)
    let started
    const entered = new Promise(resolve => { started = resolve })
    store.start = (_request, signal) => {
      started()
      return new Promise((_resolve, reject) => signal.addEventListener('abort',
        () => reject(Error('canceled held delivery')), { once: true }))
    }
    const entry = new ArrowsEntry(store)
    const pending = entry.begin(input).then(() => false, () => true)
    await entered
    entry.release()
    const rejected = await pending
    store.start = original
    return rejected
  }, request(3))
  await pages[1].bringToFront()
  await pages[1].waitForFunction(async () => (await navigator.locks.query()).held.every(lock => lock.name !== 'assessment-practice-arrows-live-v1'))
  const afterCancel = await pages[1].evaluate(async input => {
    const arm = await window.arrowsA5.entry.begin(input)
    window.arrowsA5.entry.release()
    return { ordinal: arm.ordinal, form: arm.state.form.id }
  }, request(4))
  const count = await pages[1].evaluate(async () => (await window.arrowsA5.store.read()).scoredStartCount)
  await pages[0].reload()
  const rehydrated = await pages[0].evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const { verifyHeadless, advance } = await import('/src/arrows/engine.ts')
    const arm = await (await ArrowsStore.open()).loadArmed('session-1')
    return !!arm && verifyHeadless(arm.state) && Object.isFrozen(arm.state) &&
      advance(arm.state, { kind: 'start', atMs: 200, responseHeld: false }).phase === 'fixation_pending'
  })
  const result = { browser: await browser.version(), first, blocked, second, canceled, afterCancel, count, rehydrated,
    passed: first.ordinal === 1 && first.form === 'AR1' && first.replayed && first.canAdvance &&
      blocked && second.ordinal === 2 && second.form === 'AR2' && canceled &&
      afterCancel.ordinal === 3 && afterCancel.form === 'AR3' && count === 3 && rehydrated }
  writeFileSync(new URL('./A5-entry-browser.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  if (!result.passed) process.exitCode = 1
} finally { await browser.close() }
