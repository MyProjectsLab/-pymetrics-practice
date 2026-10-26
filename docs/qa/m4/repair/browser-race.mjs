import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', error => errors.push(String(error)))
const evidence = { browser: browser.version(), viewport: '1200x800', errors,
  injection: 'Wall-clock expiry crosses after the successful production canvas guard and before confirmed paint.' }
try {
  await page.goto('http://127.0.0.1:5194')
  evidence.run = await page.evaluate(async () => {
    const { createStopRun } = await import('/src/stop/run.ts')
    const { createMemoryExposureRepository } = await import('/src/stop/exposure.ts')
    const { createPreparationRecorder } = await import('/src/stop/preparation.ts')
    const { createBrowserCanvas, createBrowserScheduler } = await import('/src/stop/browser.ts')
    const host = document.createElement('div')
    host.style = 'width:200px;height:200px;position:fixed;top:150px;left:100px'
    document.body.append(host)
    const clock = () => performance.now()
    const preparation = createPreparationRecorder(clock)
    const exposure = createMemoryExposureRepository()
    const form = exposure.reserve(preparation.sessionId, () => 0, 'retest', 1_800_000)
    let wall = 1_799_999
    let run
    const guards = []
    const canvas = createBrowserCanvas(clock, 'standard', () => run.engine.technicalFailure('Paint failed'), () => {
      const ok = run.canPresentScored()
      guards.push({ wall, ok })
      wall = 1_800_001
      return ok
    })
    canvas.attach(host)
    run = createStopRun({ preparation, setup: { binding: { code: 'Space', label: 'Space' }, visualProfile: 'standard', physicalKeyboard: true },
      clock, wallClock: () => wall, exposure, reservedFormId: form.id, mode: 'retest',
      scheduler: createBrowserScheduler(clock), frames: canvas.frames, clear: canvas.clear, changed() {},
      initialFrame: ready => requestAnimationFrame(() => { canvas.fixation(); ready() }),
      environment: { userAgent: navigator.userAgent, width: 1200, height: 800 } })
    run.begin(false)
    run.startWarmup()
    while (run.snapshot().screen === 'live') await new Promise(resolve => setTimeout(resolve, 50))
    await run.startScored()
    await new Promise(resolve => setTimeout(resolve, 1300))
    const snapshot = run.snapshot()
    const presented = snapshot.engine.events.filter(event => event.type === 'stimulus_presented' && event.payload.trialIndex === 0).at(-1)
    return { guards, wall, screen: snapshot.screen, state: snapshot.engine.state,
      invalidRule: snapshot.engine.invalidRule, formId: form.id, draftFormId: snapshot.draft?.form?.id,
      realized: snapshot.draft?.realizedSequence, result: snapshot.result,
      exposure: exposure.snapshot(), presented: presented && { sequenceNumber: presented.sequenceNumber,
        timestampMs: presented.timestampMs, stimulus: presented.payload.stimulus,
        confirmedOnsetMs: presented.payload.confirmedOnsetMs },
      invalidations: snapshot.engine.events.filter(event => event.type === 'session_invalidated').length,
      completions: snapshot.engine.events.filter(event => event.type === 'session_completed').length }
  })
  assert.deepEqual(evidence.run.guards, [{ wall: 1_799_999, ok: true }])
  assert.equal(evidence.run.state, 'invalid')
  assert.equal(evidence.run.invalidRule, 'stop_validity_v1.integrity')
  assert.equal(evidence.run.draftFormId, evidence.run.formId)
  assert.equal(evidence.run.realized.length, 1)
  assert.equal(evidence.run.exposure.length, 1)
  assert.equal(evidence.run.exposure[0].formId, evidence.run.formId)
  assert.equal(evidence.run.exposure[0].exposedAtMs, evidence.run.presented.confirmedOnsetMs)
  assert.equal(evidence.run.invalidations, 1)
  assert.equal(evidence.run.completions, 0)
  assert.equal(evidence.run.result, null)
  assert.deepEqual(errors, [])
  evidence.pass = true
} catch (error) {
  evidence.pass = false
  evidence.failure = String(error)
} finally {
  await writeFile(new URL('./browser-race.json', import.meta.url), JSON.stringify(evidence, null, 2))
  await browser.close()
}
if (!evidence.pass) throw new Error(evidence.failure)
