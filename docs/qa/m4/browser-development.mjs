import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const output = fileURLToPath(new URL('./browser-development.json', import.meta.url))
const click = name => page.getByRole('button', { name, exact: true }).click({ timeout: 30000 })
async function prepare(fromLibrary = false) {
  if (fromLibrary) await click('Open Stop')
  await click('See the rule'); await click('Try examples')
  for (let index = 0; index < 4; index++) {
    if (index % 2 === 0) await page.keyboard.press('Space')
    await click('Check example')
    await click(index === 3 ? 'Check my understanding' : 'Next example')
  }
  for (const [name, answer] of [
    ['What should you do when GO appears?', 'Press Space once.'],
    ['What should you do when NO-GO appears?', 'Do nothing.'],
    ['Can you respond after the symbol disappears?', 'Yes, until the response window closes.'],
  ]) await page.getByRole('group', { name, exact: true }).getByLabel(answer, { exact: true }).check()
  await click('Check answers'); await click('Check your setup')
  await page.getByRole('checkbox', { name: 'I’m using a laptop or desktop with a physical keyboard.' }).check()
  await click('Run input check'); await page.keyboard.press('Space')
  await click('Continue to readiness'); await click('I’m ready')
  await page.getByRole('heading', { name: 'Warm-up complete', exact: true }).waitFor({ timeout: 30000 })
  await click('Start scored task')
  await page.getByRole('heading', { name: 'Stop complete', exact: true }).waitFor({ timeout: 225000 })
  await click('View my result')
  await page.getByRole('heading', { name: 'Your Stop practice result', exact: true }).waitFor()
  assert((await page.locator('body').innerText()).includes('These records cannot establish which sequences you started on earlier visits or in other tabs.'))
}
try {
  await page.goto(process.env.M4_URL || 'http://127.0.0.1:5173')
  await prepare(true)
  const baseline = await page.evaluate(async () => (await import('/src/stop/run.ts')).activeTabResults().at(-1))
  assert.equal(baseline.mode, 'baseline')
  assert.equal(baseline.validity, 'valid')
  await click('Start recommended training')
  await page.getByRole('heading', { name: 'Recommended Stop exercise' }).waitFor()
  assert((await page.locator('body').innerText()).includes('detection drill'))
  await click('Start assigned drill')
  await click('Start drill')
  for (let block = 1; block <= 2; block++) {
    await page.getByRole('heading', { name: `Drill block ${block} complete` }).waitFor({ timeout: 85000 })
    await click('Continue to next block')
  }
  await page.getByRole('heading', { name: 'Drill complete' }).waitFor({ timeout: 85000 })
  assert((await page.locator('body').innerText()).includes('GO miss rate by deadline block'))
  await click('Continue to retest')
  await click('Try a new Stop sequence')
  const explanation = await page.locator('body').innerText()
  assert(explanation.includes('We cannot check earlier visits or other tabs.'))
  await click('Start retest')
  await prepare(false)
  const retest = await page.evaluate(async () => (await import('/src/stop/run.ts')).activeTabResults().at(-1))
  assert.equal(retest.mode, 'retest')
  await click('View baseline comparison')
  await page.getByRole('heading', { name: 'Baseline and retest' }).waitFor()
  const comparison = await page.locator('body').innerText()
  assert(comparison.includes('Before this retest began, the records retained in this tab contained no earlier scored start of its sequence.'))
  assert(comparison.includes('Assessment Practice forms share the same design rules but have not yet been calibrated as equivalent.'))
  assert.notEqual(baseline.form.id, retest.form.id)
  assert.deepEqual(errors, [])
  await page.screenshot({ path: fileURLToPath(new URL('./comparison.png', import.meta.url)), fullPage: true })
  await writeFile(output, JSON.stringify({ status: 'passed', browser: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent), errors,
    baseline: { formId: baseline.form.id, counts: baseline.summarySnapshot.counts },
    drill: { id: 'detection', completedBlocks: 3 },
    retest: { formId: retest.form.id, counts: retest.summarySnapshot.counts },
    comparison }, null, 2))
  process.stdout.write(`M4 browser development chain passed in Chromium ${browser.version()}\n`)
} catch (error) {
  await writeFile(output, JSON.stringify({ status: 'failed', error: String(error), errors, text: await page.locator('body').innerText() }, null, 2))
  throw error
} finally { await browser.close() }
