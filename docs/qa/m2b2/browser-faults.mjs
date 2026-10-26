import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE })
const evidence = []
const errors = []
let page
const click = text => page.getByRole('button', { name: text, exact: true }).click()
async function prepare() {
  if (page) await page.close()
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:5173')
  await click('Open Stop'); await click('See the rule'); await click('Try examples')
  for (let i = 0; i < 4; i++) {
    if (i % 2 === 0) await page.keyboard.press('Space')
    await click('Check example'); await click(i === 3 ? 'Check my understanding' : 'Next example')
  }
  for (const [name, answer] of [
    ['What should you do when GO appears?', 'Press Space once.'],
    ['What should you do when NO-GO appears?', 'Do nothing.'],
    ['Can you respond after the symbol disappears?', 'Yes, until the response window closes.'],
  ]) await page.getByRole('group', { name, exact: true }).getByLabel(answer, { exact: true }).check()
  await click('Check answers'); await click('Check your setup'); await page.getByRole('checkbox').check()
  await click('Run input check'); await page.keyboard.press('Space'); await click('Continue to readiness')
}
async function invalid(name, trigger, expected, delivery) {
  await prepare(); await click('I’m ready'); await trigger()
  await page.getByRole('heading', { name: 'This run cannot continue as a valid session' }).waitFor()
  const draft = await page.evaluate(async () => (await import('/src/stop/run.ts')).developmentDrafts().at(-1))
  assert.equal(draft.invalidRule, `stop_validity_v1.${expected}`)
  assert.equal(draft.events.some(e => e.type === 'warmup_restart_required'), false)
  evidence.push({ name, delivery, draft }); console.log(name + ": passed")
}
try {
  await invalid('hidden page', () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  }), 'hidden', 'Injected visibility state and visibilitychange in real browser')
  await invalid('visible long blur', () => page.evaluate(() => window.dispatchEvent(new Event('blur'))), 'blur_over_1000ms', 'Injected window blur; unaccelerated browser watchdog')
  await invalid('pagehide', () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide'))), 'lifecycle', 'Injected DOM lifecycle event')
  await invalid('pageshow', () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow'))), 'lifecycle', 'Injected DOM lifecycle restoration event')
  await invalid('resume', () => page.evaluate(() => document.dispatchEvent(new Event('resume'))), 'lifecycle', 'Injected DOM lifecycle restoration event')
  await invalid('freeze', () => page.evaluate(() => document.dispatchEvent(new Event('freeze'))), 'lifecycle', 'Injected DOM freeze event; native CDP freeze did not deliver a lifecycle event in this headless environment')
  await invalid('unsupported resize', () => page.setViewportSize({ width: 767, height: 600 }), 'viewport_below_768x600', 'Native browser viewport change')
  await invalid('accessibility preference change', () => page.emulateMedia({ reducedMotion: 'reduce' }), 'settings_changed', 'Native browser media preference change')
  await invalid('browser back', async () => {
    await page.evaluate(() => history.pushState({}, '', '#qa-route'))
    await page.goBack()
  }, 'lifecycle', 'Native browser history navigation')

  await prepare(); await click('I’m ready')
  // Wait until the initial fixation has begun before holding across onset.
  await page.waitForFunction(() => document.querySelector('.stop-presentation')?.dataset.presentation === 'fixation')
  await page.keyboard.down('Space')
  await page.waitForFunction(() => document.querySelector('.stop-presentation')?.dataset.presentation === 'GO')
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  await page.evaluate(async () => {
    for (let i = 0; i < 2; i++) {
      window.dispatchEvent(new Event('blur'))
      await new Promise(resolve => setTimeout(resolve, 300))
      window.dispatchEvent(new Event('focus'))
    }
  })
  assert.equal(await page.getByRole('heading', { name: 'This run cannot continue as a valid session' }).count(), 0)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await page.getByRole('heading', { name: 'This run cannot continue as a valid session' }).waitFor()
  const held = await page.evaluate(async () => (await import('/src/stop/run.ts')).developmentDrafts().at(-1))
  assert.equal(held.events.some(e => e.type === 'response_accepted'), false)
  assert(held.events.some(e => e.type === 'response_ignored' && e.payload.reason === 'repeat'))
  assert(held.events.some(e => e.type === 'response_ignored' && e.payload.reason === 'fixation'))
  const focusEvents = held.events.filter(e => e.type === 'focus_changed')
  assert.equal(focusEvents.filter(e => e.payload.focused).length, 2)
  evidence.push({ name: 'held/repeated/premature input and repeated brief blur', delivery: 'Playwright keyboard down/up via browser; injected focus events with real 300 ms waits', draft: held })

  await prepare()
  // Delay the production rAF callback for offset once in each warm-up. This
  // deliberately tests browser fault recovery, not normal measured performance.
  await page.evaluate(() => {
    const original = window.requestAnimationFrame.bind(window)
    let delayed = false
    window.qaDelayOffset = () => { delayed = false }
    window.requestAnimationFrame = callback => original(timestamp => {
      const symbol = document.querySelector('.stop-presentation')?.dataset.presentation
      if (!delayed && symbol && symbol !== 'fixation') {
        // The adapter waits until 200 ms; blocking immediately after onset delays
        // offset to ~300 ms, which must trigger the warm-up retry rule.
        delayed = true
        const until = performance.now() + 300
        while (performance.now() < until) { /* deliberate QA main-thread stall */ }
      }
      callback(timestamp)
    })
  })
  await click('I’m ready')
  await page.getByRole('heading', { name: 'Warm-up needs to restart' }).waitFor({ timeout: 6000 })
  await page.screenshot({ path: fileURLToPath(new URL('warmup-restart.png', import.meta.url)) })
  await page.evaluate(() => window.qaDelayOffset())
  await click('Restart warm-up')
  await page.getByRole('heading', { name: 'This run cannot continue as a valid session' }).waitFor({ timeout: 6000 })
  const retry = await page.evaluate(async () => ({ draft: (await import('/src/stop/run.ts')).developmentDrafts().at(-1), exposure: (await import('/src/stop/exposure.ts')).stopExposure.snapshot() }))
  assert.equal(retry.draft.invalidRule, 'stop_validity_v1.second_warmup_anomaly')
  assert.equal(retry.draft.events.filter(e => e.type === 'warmup_restart_required').length, 1)
  assert.equal(retry.exposure.length, 0)
  evidence.push({ name: 'first warm-up anomaly restart and second anomaly invalidation', delivery: 'Deliberate 300 ms main-thread stalls in production frame callback; real clock', ...retry })

  for (const afterOnset of [false, true]) {
    await prepare(); await click('I’m ready')
    await page.getByRole('heading', { name: 'Warm-up complete', exact: true }).waitFor({ timeout: 25000 })
    const pre = await page.evaluate(async () => (await import('/src/stop/exposure.ts')).stopExposure.snapshot())
    assert.equal(pre.length, 0)
    await click('Start scored task')
    if (afterOnset) await page.waitForFunction(() => ['GO', 'NO_GO'].includes(document.querySelector('.stop-presentation')?.dataset.presentation))
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
    await page.getByRole('heading', { name: 'This run cannot continue as a valid session' }).waitFor()
    const state = await page.evaluate(async () => ({ draft: (await import('/src/stop/run.ts')).developmentDrafts().at(-1), exposure: (await import('/src/stop/exposure.ts')).stopExposure.snapshot() }))
    assert.equal(state.exposure.length, afterOnset ? 1 : 0)
    assert.equal(state.draft.form.family, 'baseline')
    const oldForm = state.draft.form.id
    const eligible = await page.evaluate(async () => (await import('/src/stop/exposure.ts')).stopExposure.reserve('qa-next', () => 0))
    if (afterOnset) assert.notEqual(eligible.id, oldForm)
    evidence.push({ name: afterOnset ? 'exit after first scored onset' : 'exit before first scored onset', delivery: 'Actual production warm-up and scored handoff; injected pagehide', ...state })
  }
  assert.deepEqual(errors, [])
  await writeFile(new URL('browser-faults.json', import.meta.url), JSON.stringify({ browserVersion: browser.version(), errors, evidence }, null, 2))
  console.log(JSON.stringify({ status: 'passed', scenarios: evidence.length, browser: browser.version() }))
} finally {
  await writeFile(new URL('browser-faults.json', import.meta.url), JSON.stringify({ browserVersion: browser.version(), errors, evidence }, null, 2))
  await browser.close()
}
