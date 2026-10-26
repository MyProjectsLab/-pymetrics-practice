// Run against `npm run dev -- --host 127.0.0.1` using an externally supplied Playwright.
// No accelerated clock. Scripted keyboard input is identified in the evidence.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE })
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const out = new URL('./', import.meta.url)
await mkdir(out, { recursive: true })
const click = text => page.getByRole('button', { name: text, exact: true }).click()
async function prepare() {
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
  await click('Check answers'); await click('Check your setup')
  await page.getByRole('checkbox').check(); await click('Run input check'); await page.keyboard.press('Space')
  await click('Continue to readiness')
}
async function installResponses() {
  await page.evaluate(() => {
    window.qa = { phase: 'warmup', onsets: [], offsets: [], inputs: [], scroll: [], last: null, scoredCount: 0 }
    const input = (type, code = 'Space', repeat = false) => {
      const event = new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : 'x', repeat, bubbles: true, cancelable: true })
      document.dispatchEvent(event)
      window.qa.inputs.push({ type, code, repeat, prevented: event.defaultPrevented, time: performance.now() })
    }
    window.qa.input = input
    new MutationObserver(() => {
      const node = document.querySelector('.stop-presentation')
      const kind = node?.dataset.presentation
      if (!kind || kind === window.qa.last) return
      window.qa.last = kind
      if (kind === 'fixation') { window.qa.offsets.push(performance.now()); return }
      const scored = window.qa.phase === 'scored'
      const index = scored ? window.qa.scoredCount++ : window.qa.onsets.filter(x => x.phase === 'warmup').length
      window.qa.onsets.push({ phase: window.qa.phase, kind, index, time: performance.now() })
      window.qa.scroll.push({ x: scrollX, y: scrollY })
      if (kind === 'GO' && !(scored && index === 2)) {
        setTimeout(() => { input('keydown'); input('keyup') }, scored && index === 0 ? 150 : 350)
      }
      if (scored && index === 0) {
        setTimeout(() => input('keydown', 'KeyX'), 80)
        setTimeout(() => { input('keydown', 'Space', true); input('keyup') }, 100)
        setTimeout(() => { input('keydown'); input('keyup') }, 450)
      }
      if (scored && index === 2) setTimeout(() => { input('keydown'); input('keyup') }, 1050)
    }).observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['data-presentation'] })
  })
}
try {
  await prepare(); await installResponses(); await click('I’m ready')
  await page.getByRole('heading', { name: 'Warm-up complete', exact: true }).waitFor({ timeout: 25000 })
  const before = await page.evaluate(async () => (await import('/src/stop/exposure.ts')).stopExposure.snapshot())
  assert.equal(before.length, 0)
  await page.evaluate(() => { window.qa.phase = 'scored' })
  await click('Start scored task')
  await page.waitForFunction(() => document.querySelector('.stop-presentation')?.dataset.presentation === 'GO', { timeout: 5000 })
  await page.screenshot({ path: fileURLToPath(new URL('live-canvas.png', out)) })
  await page.getByRole('heading', { name: 'Timed run finished', exact: true }).waitFor({ timeout: 190000 })
  const data = await page.evaluate(async () => ({
    draft: (await import('/src/stop/run.ts')).developmentDrafts().at(-1),
    exposure: (await import('/src/stop/exposure.ts')).stopExposure.snapshot(),
    observations: JSON.parse(JSON.stringify(window.qa)), userAgent: navigator.userAgent,
  }))
  assert.equal(data.draft.status, 'timed_run_finished_awaiting_m3')
  assert.equal(data.draft.realizedSequence.length, 80)
  assert.equal(data.exposure.length, 1)
  assert.equal(data.draft.events.filter(e => e.type === 'trial_resolved').length, 88)
  assert.equal(data.draft.events.some(e => e.type === 'session_completed'), false)
  assert.equal(data.observations.inputs.filter(e => e.code === 'Space' && !e.prevented).length, 0)
  await page.screenshot({ path: fileURLToPath(new URL('development-checkpoint.png', out)) })
  const ordinary = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
    document.dispatchEvent(e); return e.defaultPrevented
  })
  assert.equal(ordinary, false)
  assert.deepEqual(errors, [])
  await writeFile(new URL('full-run.json', out), JSON.stringify({ browserVersion: browser.version(), errors, ordinarySpacePrevented: ordinary, ...data }, null, 2))
  console.log(JSON.stringify({ status: 'passed', browser: browser.version(), events: data.draft.events.length, onsets: data.observations.onsets.length }))
} finally { await browser.close() }
