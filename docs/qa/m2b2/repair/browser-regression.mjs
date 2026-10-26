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
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:5187')
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


const evidence = []
const technicalBody = 'A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.'
async function state() {
  return page.evaluate(async () => ({
    draft: (await import('/src/stop/run.ts')).developmentDrafts().at(-1),
    exposure: (await import('/src/stop/exposure.ts')).stopExposure.snapshot(),
    text: document.body.innerText,
    domWrites: window.repairDOMWrites ?? [],
  }))
}
function checkInvalid(data) {
  const d = data.draft, events = d.events
  assert.equal(d.status, 'invalid')
  assert.equal(d.scoringVersion, null); assert.equal(d.summarySnapshot, null)
  assert.equal(events.some(e => ['session_completed', 'protection_ended'].includes(e.type)), false)
  assert(events.every((e, i) => e.sessionId === d.sessionId && e.sequenceNumber === i + 1 &&
    (!i || e.timestampMs >= events[i - 1].timestampMs)))
}
function scoredEvents(data) {
  const start = data.draft.events.findIndex(e => e.type === 'trial_scheduled' && e.payload.trial.phase === 'scored')
  return start < 0 ? [] : data.draft.events.slice(start)
}
async function warmup() {
  await prepare(); await click('I’m ready')
  await page.getByRole('heading', {name: 'Warm-up complete', exact:true}).waitFor({timeout:25000})
}
try {
  await warmup()
  // Audit reproduction: stall *inside* the eligible scored-onset rAF so the
  // watchdog cannot run first. Instrument DOM writes separately from the journal.
  await page.evaluate(() => {
    const original = requestAnimationFrame.bind(window), from = performance.now()
    let stalled = false
    window.requestAnimationFrame = cb => original(t => {
      if (!stalled && performance.now() - from > 900) {
        stalled = true
        const until = performance.now() + 600
        while (performance.now() < until) { /* deliberate fault */ }
      }
      cb(t)
    })
    window.repairDOMWrites = []
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true, get: descriptor.get, set(value) {
        descriptor.set.call(this, value)
        if (this.classList.contains('stop-presentation')) window.repairDOMWrites.push({time:performance.now(), svg:value})
      },
    })
  })
  await click('Start scored task')
  await page.getByRole('heading', {name:'This run cannot continue as a valid session'}).waitFor({timeout:6000})
  const delayed = await state(); checkInvalid(delayed)
  const scored = scoredEvents(delayed), presented = scored.filter(e => e.type === 'stimulus_presented')
  assert.equal(delayed.draft.invalidRule, 'stop_validity_v1.severe_timing')
  assert.equal(presented.length, 1)
  assert.equal(presented[0].payload.stimulus, delayed.draft.form.sequence[0])
  assert.deepEqual(delayed.draft.realizedSequence, [delayed.draft.form.sequence[0]])
  assert.equal(delayed.exposure.length, 1)
  assert.equal(delayed.exposure[0].exposedAtMs, presented[0].payload.confirmedOnsetMs)
  assert.equal(delayed.domWrites.length, 2)
  assert(delayed.domWrites[1].svg.includes(delayed.draft.form.sequence[0] === 'GO' ? '#B42334' : '#147D4F'))
  assert(delayed.domWrites[1].time <= presented[0].timestampMs)
  const anomaly = scored.find(e => e.type === 'timing_anomaly')
  assert(anomaly.payload.observedMs - anomaly.payload.expectedMs >= 600)
  assert(presented[0].sequenceNumber < anomaly.sequenceNumber)
  assert(anomaly.sequenceNumber < scored.find(e => e.type === 'session_invalidated').sequenceNumber)
  assert.equal(scored.some(e => ['trial_resolved', 'response_accepted', 'trial_timed_out', 'batch_finished'].includes(e.type)), false)
  const next = await page.evaluate(async () => (await import('/src/stop/exposure.ts')).stopExposure.reserve('next-probe', () => 0))
  assert.notEqual(next.id, delayed.draft.form.id)
  evidence.push({name:'confirmed onset rejected after 600 ms stall', delivery:'Injected main-thread stall inside production rAF; real clock and DOM', ...delayed})
  console.log('confirmed delayed onset retained: passed')

  await warmup(); await click('Start scored task')
  await page.waitForFunction(() => document.querySelector('.stop-presentation')?.dataset.presentation === 'fixation')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await page.getByRole('heading', {name:'This run cannot continue as a valid session'}).waitFor()
  const before = await state(); checkInvalid(before)
  assert(before.draft.form)
  assert.deepEqual(before.exposure, []); assert.deepEqual(before.draft.realizedSequence, [])
  assert.equal(scoredEvents(before).some(e => e.type === 'stimulus_presented'), false)
  // No delayed callback may consume the form after cancellation. Prove it is eligible.
  await page.waitForTimeout(1600)
  assert.deepEqual((await state()).exposure, [])
  const reusable = await page.evaluate(async () => {
    const repo = (await import('/src/stop/exposure.ts')).stopExposure
    return Array.from({length:4}, (_,i) => repo.reserve(`reuse-${i}`, () => 0)?.id)
  })
  assert(reusable.includes(before.draft.form.id))
  evidence.push({name:'interruption before confirmed scored onset', delivery:'Injected pagehide during actual scored initial fixation; real clock', ...before, reusable})
  console.log('pre-onset interruption remains unconsumed: passed')

  for (const kind of ['canvas', 'browser']) {
    await prepare(); await click('I’m ready')
    await page.waitForFunction(() => document.querySelector('.stop-presentation')?.dataset.presentation === 'fixation')
    if (kind === 'canvas') await page.evaluate(() => document.querySelector('.stop-presentation').remove())
    else await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {message:'Deliberate QA browser error'})))
    await page.getByRole('heading', {name:'Stop could not finish this session', exact:true}).waitFor()
    assert(await page.getByText(technicalBody, {exact:true}).isVisible())
    assert(await page.getByRole('button', {name:'Restart with a new form',exact:true}).isVisible())
    assert(await page.getByRole('button', {name:'Return to library',exact:true}).isVisible())
    assert.equal(await page.getByText('The recorded trials did not match the assigned form.',{exact:true}).count(),0)
    const data = await state(); checkInvalid(data)
    assert.equal(data.draft.invalidRule,'stop_validity_v1.integrity')
    assert(data.draft.events.some(e => e.type === 'integrity_checked' && !e.payload.valid &&
      e.payload.detail === (kind === 'canvas' ? 'DOM presentation confirmation failed' : 'Unhandled browser error during protected interval')))
    evidence.push({name:`non-manifest ${kind} failure`,delivery:kind === 'canvas' ? 'Injected DOM removal; production canvas failure handling' : 'Injected browser ErrorEvent; production listener',...data})
    if (kind === 'browser') await page.screenshot({path:fileURLToPath(new URL('technical-recovery.png',out))})
    console.log(`${kind} technical recovery: passed`)
  }
  assert.deepEqual(errors, [])
  await writeFile(new URL('browser-regression.json',out),JSON.stringify({browserVersion:browser.version(),errors,evidence},null,2))
  console.log(JSON.stringify({status:'passed',scenarios:evidence.length,browser:browser.version()}))
} finally { await browser.close() }
