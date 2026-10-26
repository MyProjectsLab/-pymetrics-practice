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

const setup = async (page, publishFailure = false) => page.evaluate(async failure => {
  const { ArrowsStore } = await import('/src/arrows/storage.ts')
  const { ArrowsEntry, ARROWS_LIVE_LOCK } = await import('/src/arrows/entry.ts')
  const { ArrowsBrowserRun } = await import('/src/arrows/browser.ts')
  const host = document.createElement('div')
  Object.assign(host.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '280px',
    zIndex: '1000', background: 'white', color: 'black' })
  document.body.append(host)
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
}, publishFailure)

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

await scenario('obscured rule cue', async page => {
  const start = await setup(page)
  await page.waitForFunction(() => window.arrowsRepair.run.snapshot()?.phase === 'stimulus')
  const result = await page.evaluate(async () => {
    const { run, host, lock } = window.arrowsRepair
    const cue = host.querySelector('[data-arrows-cue]')
    const box = cue.getBoundingClientRect()
    const overlay = document.createElement('div')
    Object.assign(overlay.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`, background: 'black', zIndex: '2000' })
    document.body.append(overlay)
    const covered = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === overlay
    const ready = run.layoutReady()
    await new Promise(resolve => setTimeout(resolve, 120))
    const competingOwner = await navigator.locks.request(lock, { ifAvailable: true }, owner => Boolean(owner))
    return { covered, ready, phase: run.snapshot()?.phase, reason: run.snapshot()?.invalidReason, competingOwner }
  })
  return { start, result, pass: start.started && result.covered && !result.ready &&
    result.phase === 'invalid' && result.reason === 'viewport' && result.competingOwner }
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
writeFileSync(new URL('./A6-repair-browser.json', import.meta.url), JSON.stringify({ browser: browser.version(), results }, null, 2) + '\n')
if (results.some(result => !result.pass)) process.exitCode = 1
