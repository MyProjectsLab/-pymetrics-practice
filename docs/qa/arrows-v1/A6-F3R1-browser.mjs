import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const origin = process.env.ARROWS_QA_ORIGIN ?? 'http://127.0.0.1:4188'
const results = []

async function scenario(name, run) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
  try {
    await page.goto(origin)
    await page.bringToFront()
    const result = await run(page)
    results.push({ name, ...result })
  } catch (error) {
    results.push({ name, pass: false, error: String(error) })
  } finally { await page.close() }
}

const setup = async (page, publishFailure = false, underlying = false) => page.evaluate(async ({ failure, underlying }) => {
  const { ArrowsStore } = await import('/src/arrows/storage.ts')
  const { ArrowsEntry, ARROWS_LIVE_LOCK } = await import('/src/arrows/entry.ts')
  const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
  const host = document.createElement('div')
  Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
    zIndex: '1000', background: 'white', color: 'black' })
  document.body.append(host)
  if (underlying) {
    const underlay = document.createElement('div')
    Object.assign(underlay.style, { position: 'fixed', left: '100px', top: '100px', width: '600px',
      height: '280px', zIndex: '0', background: 'black', pointerEvents: 'none' })
    document.body.append(underlay)
    window.arrowsUnderlay = underlay
  }
  const run = new ArrowsBrowserRun(new ArrowsEntry(await ArrowsStore.open()), host, state => {
    if (failure && state.events.at(-1)?.type === 'block_started') throw Error('Injected publication failure')
  })
  window.arrowsRepair = { run, host, lock: ARROWS_LIVE_LOCK }
  const request = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    clockDomainId: crypto.randomUUID(), atMs: performance.now(), wallMs: Date.now(),
    profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
      alternative: false, accommodation: 'default', reducedMotion: false } }
  try { await run.begin(request); return { started: true } }
  catch (error) { return { started: false, error: String(error) } }
}, { failure: publishFailure, underlying })

await scenario('publication failure before first fixation', async page => {
  const start = await setup(page, true)
  const result = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    const { run, host, lock } = window.arrowsRepair
    const competingOwner = await navigator.locks.request(lock, { ifAvailable: true }, owner => Boolean(owner))
    run.cancel()
    return { phase: run.snapshot()?.phase, reason: run.snapshot()?.invalidReason,
      onsets: run.snapshot()?.events.filter(event => event.type === 'stimulus_presented').length,
      protected: run.protectedNow(), hostChildren: host.childElementCount, competingOwner }
  })
  return { start, result, pass: !start.started && result.phase === 'invalid' && result.reason === 'technical' &&
    result.onsets === 0 && !result.protected && result.hostChildren === 0 && result.competingOwner }
})

for (const overlayCase of [
  { name: 'obscured rule cue', pointerEvents: 'auto', width: 'full' },
  { name: 'painted cue overlay without pointer hit testing', pointerEvents: 'none', width: 'full' },
  { name: 'partially obscured cue word', pointerEvents: 'auto', width: 'partial' },
  { name: 'stage child painted overlay', pointerEvents: 'none', width: 'partial', insideStage: true },
]) {
  await scenario(overlayCase.name, async page => {
    const start = await setup(page)
    await page.waitForFunction(() => window.arrowsRepair.run.snapshot()?.phase === 'stimulus')
    const result = await page.evaluate(async ({ pointerEvents, width, insideStage }) => {
      const { run, host, lock } = window.arrowsRepair
      const cue = host.querySelector('[data-arrows-cue]')
      const box = cue.getBoundingClientRect()
      const overlay = document.createElement('div')
      Object.assign(overlay.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
        width: `${width === 'full' ? box.width : 50}px`, height: `${box.height}px`,
        background: 'black', zIndex: '2000', pointerEvents })
      if (insideStage) host.querySelector('[data-arrows-stage]').append(overlay)
      else document.body.append(overlay)
      const hit = document.elementFromPoint(box.left + 10, box.top + box.height / 2) === overlay
      const ready = run.layoutReady()
      await new Promise(resolve => setTimeout(resolve, 120))
      const competingOwner = await navigator.locks.request(lock, { ifAvailable: true }, owner => Boolean(owner))
      return { hit, ready, phase: run.snapshot()?.phase, reason: run.snapshot()?.invalidReason, competingOwner }
    }, overlayCase)
    return { start, result, pass: start.started && result.hit === (overlayCase.pointerEvents === 'auto') &&
      !result.ready && result.phase === 'invalid' && result.reason === 'viewport' && result.competingOwner }
  })
}

await scenario('non-interactive content behind visible stimulus', async page => {
  const start = await setup(page)
  await page.waitForFunction(() => window.arrowsRepair.run.snapshot()?.phase === 'stimulus')
  const result = await page.evaluate(async () => {
    const { run, host } = window.arrowsRepair
    const cue = host.querySelector('[data-arrows-cue]')
    const box = cue.getBoundingClientRect()
    const underlay = document.createElement('div')
    Object.assign(underlay.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`, background: 'black',
      zIndex: '0', pointerEvents: 'none' })
    document.body.append(underlay)
    const priorStyle = underlay.getAttribute('style')
    const cueVisible = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === cue
    const ready = run.layoutReady()
    await new Promise(resolve => setTimeout(resolve, 120))
    const result = { cueVisible, ready, styleUnchanged: underlay.getAttribute('style') === priorStyle,
      phase: run.snapshot()?.phase, reason: run.snapshot()?.invalidReason, protected: run.protectedNow() }
    run.cancel()
    return result
  })
  return { start, result, pass: start.started && result.cueVisible && result.ready && result.styleUnchanged &&
    result.phase === 'stimulus' && result.reason === null && result.protected }
})

await scenario('underlying content does not block Start', async page => {
  const start = await setup(page, false, true)
  const result = await page.evaluate(() => {
    const { run } = window.arrowsRepair
    const underlay = window.arrowsUnderlay
    const ready = run.layoutReady()
    const state = { ready, phase: run.snapshot()?.phase, style: underlay.style.pointerEvents }
    run.cancel()
    return state
  })
  return { start, result, pass: start.started && result.ready &&
    ['fixation_pending', 'fixation', 'stimulus'].includes(result.phase) && result.style === 'none' }
})

await scenario('transparent host ancestor', async page => {
  const start = await setup(page)
  await page.waitForFunction(() => window.arrowsRepair.run.snapshot()?.phase === 'stimulus')
  const result = await page.evaluate(async () => {
    const { run, host, lock } = window.arrowsRepair
    const wrapper = document.createElement('div')
    wrapper.style.opacity = '0'
    document.body.append(wrapper)
    wrapper.append(host)
    const ready = run.layoutReady()
    await new Promise(resolve => setTimeout(resolve, 120))
    const competingOwner = await navigator.locks.request(lock, { ifAvailable: true }, owner => Boolean(owner))
    return { ready, phase: run.snapshot()?.phase, reason: run.snapshot()?.invalidReason, competingOwner }
  })
  return { start, result, pass: start.started && !result.ready && result.phase === 'invalid' &&
    result.reason === 'viewport' && result.competingOwner }
})

await browser.close()
writeFileSync(new URL('./A6-F3R1-browser.json', import.meta.url), JSON.stringify({ browser: browser.version(), results }, null, 2) + '\n')
if (results.some(result => !result.pass)) process.exitCode = 1
