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
const urls = {}
page.on('response', response => {
  for (const name of ['training', 'exposure']) {
    if (new URL(response.url()).pathname === `/src/stop/${name}.ts`) urls[name] = response.url()
  }
})
const evidence = { browser: browser.version(), viewport: '1200x800', errors,
  baseline: 'Synthetic valid-summary fixture; UI, keyboard, engine, DOM canvas, and browser timers are production adapters.' }
const click = name => page.getByRole('button', { name, exact: true }).click()
const state = () => page.evaluate(async urls => {
  const chain = (await import(urls.training)).currentTrainingChain()
  return { status: chain?.status, attempts: chain?.drillAttempts.map(attempt => ({ id: attempt.id,
    valid: attempt.valid, completedBlocks: attempt.completedBlocks, frozen: Object.isFrozen(attempt) && Object.isFrozen(attempt.events),
    eventCount: attempt.events.length, presentations: attempt.events.filter(event => event.type === 'stimulus_presented').length,
    invalidations: attempt.events.filter(event => event.type === 'session_invalidated').length,
    completions: attempt.events.filter(event => event.type === 'session_completed').length })),
    retestAttempts: chain?.retestAttempts.length, exposure: (await import(urls.exposure)).stopExposure.snapshot() }
}, urls)

try {
  await page.addInitScript(() => {
    window.qaBaseline = {
      mode: 'baseline', validity: 'valid', sessionId: 'm4-repair-browser-fixture', events: [],
      setup: { binding: { code: 'Space', label: 'Space' }, visualProfile: 'standard', physicalKeyboard: true },
      summarySnapshot: { counts: { hits: 54, misses: 6, withholds: 20, falseAlarms: 0 },
        halves: [{ hits: 27, misses: 3, withholds: 10, falseAlarms: 0 }, { hits: 27, misses: 3, withholds: 10, falseAlarms: 0 }],
        timing: { count: 54, iqr: 80 }, rates: { hit: .9, miss: .1, falseAlarm: 0 } },
    }
  })
  await page.route('**/src/main.tsx*', async route => {
    evidence.seedRouteHit = true
    const response = await route.fetch()
    await route.fulfill({ response, body: 'import {beginTrainingChain} from "/src/stop/training.ts"; beginTrainingChain(window.qaBaseline);\n' + await response.text() })
  })
  await page.goto('http://127.0.0.1:5194')
  assert.equal(evidence.seedRouteHit, true)
  await click('Resume Stop training')
  await click('Start assigned drill')
  await click('Start drill')
  await page.waitForSelector('[data-presentation="GO"], [data-presentation="NO_GO"]')
  await page.keyboard.press('Shift+Tab')
  evidence.liveExitFocus = await page.evaluate(() => document.activeElement?.textContent?.trim())
  assert.equal(evidence.liveExitFocus, 'Back to library')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Resume Stop training' }).waitFor()
  evidence.afterLiveExit = await state()
  assert.equal(evidence.afterLiveExit.status, 'assigned')
  assert.equal(evidence.afterLiveExit.attempts.length, 1)
  assert.equal(evidence.afterLiveExit.attempts[0].valid, false)
  assert.equal(evidence.afterLiveExit.attempts[0].invalidations, 1)
  assert.equal(evidence.afterLiveExit.attempts[0].frozen, true)
  assert.equal(evidence.afterLiveExit.retestAttempts, 0)
  assert.equal(evidence.afterLiveExit.exposure.length, 0)
  await click('Resume Stop training')
  evidence.afterInvalidResume = await state()
  await click('Start assigned drill')
  await click('Start drill')
  for (let block = 1; block <= 3; block++) {
    await page.getByRole('heading', { name: block === 3 ? 'Drill complete' : `Drill block ${block} complete`, exact: true })
      .waitFor({ timeout: 120000 })
    if (block < 3) await click('Continue to next block')
  }
  evidence.beforeCompletedExit = await state()
  assert.equal(evidence.beforeCompletedExit.attempts.length, 1)
  await click('Back to library')
  await page.getByRole('button', { name: 'Resume Stop training' }).waitFor()
  evidence.afterCompletedExit = await state()
  assert.equal(evidence.afterCompletedExit.status, 'drill_complete')
  assert.equal(evidence.afterCompletedExit.attempts.length, 2)
  assert.equal(evidence.afterCompletedExit.attempts[1].valid, true)
  assert.equal(evidence.afterCompletedExit.attempts[1].completions, 1)
  assert.equal(evidence.afterCompletedExit.attempts[1].invalidations, 0)
  assert.equal(evidence.afterCompletedExit.attempts[1].frozen, true)
  await click('Resume Stop training')
  await page.getByRole('heading', { name: 'Your drill is complete', exact: true }).waitFor()
  evidence.afterValidResume = await state()
  evidence.retestAction = await page.getByRole('button', { name: 'Try a new Stop sequence' }).count()
  assert.equal(evidence.retestAction, 1)
  assert.equal(evidence.afterValidResume.attempts.length, 2)
  assert.equal(evidence.afterValidResume.retestAttempts, 0)
  assert.deepEqual(errors, [])
  evidence.pass = true
} catch (error) {
  evidence.pass = false
  evidence.failure = String(error)
  evidence.screenText = await page.locator('body').innerText().catch(() => '')
} finally {
  await writeFile(new URL('./browser-regression.json', import.meta.url), JSON.stringify(evidence, null, 2))
  await browser.close()
}
if (!evidence.pass) throw new Error(evidence.failure)
