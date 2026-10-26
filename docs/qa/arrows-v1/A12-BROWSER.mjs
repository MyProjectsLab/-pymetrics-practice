import { createRequire } from 'node:module'
import { appendFileSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext({ viewport: { width: 1512, height: 827 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(12000)
const evidencePath = '/private/tmp/arrows-complete-production.jsonl'
writeFileSync(evidencePath, '')
const log = (label, value) => {
  const line = JSON.stringify({ label, ...value }) + '\n'
  appendFileSync(evidencePath, line)
  process.stdout.write(line)
}
async function root() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('assessment-practice-arrows-v1')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return new Promise((resolve, reject) => {
      const tx = db.transaction('installation', 'readonly')
      const request = tx.objectStore('installation').get('root')
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
    })
  })
}
try {
  await page.goto('http://127.0.0.1:4403/')
  await page.getByRole('button', { name: 'Open Arrows' }).click()
  await page.getByRole('button', { name: 'See examples' }).click()
  await page.getByRole('button', { name: 'Next example' }).click()
  await page.getByRole('button', { name: 'Check understanding' }).click()
  await page.getByLabel('The matching arrows at both ends').check()
  await page.getByLabel('The first eligible Left or Right response before the deadline').check()
  await page.getByRole('button', { name: 'Check answers' }).click()
  await page.getByRole('button', { name: 'Set up input' }).click()
  await page.getByRole('button', { name: 'Check Left key' }).click()
  await page.keyboard.down('ArrowLeft'); await page.keyboard.up('ArrowLeft')
  await page.getByRole('button', { name: 'Check Right key' }).click()
  await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight')
  await page.getByRole('button', { name: 'Continue to readiness' }).click()
  await page.getByRole('button', { name: 'Start Arrows' }).click()
  for (let block = 1; block <= 4; block++) {
    await page.getByRole('heading', { name: 'Block complete' }).waitFor({ timeout: 85000 })
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Continue next block' && !button.disabled))
    const saved = await root()
    const arm = Object.values(saved.attempts)[0]
    if (arm.snapshot?.kind !== 'checkpoint' || arm.snapshot.closedTrials !== block * 24)
      throw Error(`Block ${block} checkpoint did not match ${block * 24} closed trials`)
    log('break', { block, closed: arm.snapshot.closedTrials })
    await page.getByRole('button', { name: 'Continue next block' }).press('Enter')
    await page.getByRole('heading', { name: 'Arrows scored block' }).waitFor({ timeout: 20000 })
  }
  await page.getByRole('heading', { name: 'Arrows report' }).waitFor({ timeout: 85000 })
  await page.getByRole('button', { name: 'View history' }).waitFor({ timeout: 12000 })
  const completed = await root()
  const session = Object.keys(completed.attempts)[0]
  const snapshot = completed.attempts[session].snapshot
  if (completed.scoredStartCount !== 1 || snapshot?.kind !== 'terminal' ||
    snapshot.closedTrials !== 120 || snapshot.review.status !== 'complete_headless')
    throw Error('Verified 120-trial terminal snapshot missing')
  log('complete', { form: completed.attempts[session].state.form.id, closed: snapshot.closedTrials,
    correct: snapshot.review.metrics?.overall.correct, activity: completed.activity?.[session]?.events.length ?? 0 })
  await page.reload()
  await page.getByRole('button', { name: 'Open Arrows' }).click()
  await page.getByRole('button', { name: 'Arrows history' }).click()
  await page.getByRole('button', { name: 'Open report' }).click()
  await page.getByRole('heading', { name: 'Arrows report' }).waitFor()
  const recovered = await root()
  if (JSON.stringify(recovered.attempts[session].snapshot) !== JSON.stringify(snapshot))
    throw Error('Reload changed saved snapshot bytes')
  log('recovered', { activity: recovered.activity?.[session]?.events.length ?? 0 })
  await page.getByRole('button', { name: 'View history' }).click()
  await page.getByRole('button', { name: 'Delete all Arrows data' }).click()
  await page.getByRole('group', { name: 'Confirm Arrows deletion' }).getByRole('button', { name: 'Delete all Arrows data' }).click()
  const replaced = await root()
  if (replaced.installationId === completed.installationId ||
    replaced.scoredStartCount !== 0 || Object.keys(replaced.attempts).length ||
    Object.keys(replaced.activity ?? {}).length || Object.keys(replaced.tombstones).length)
    throw Error('Delete all failed to create an empty installation')
  if (errors.length) throw Error(errors.join(' | '))
  log('delete-all', { clean: true, errors })
} catch (error) {
  log('failure', { error: String(error), body: (await page.locator('main').innerText().catch(() => 'unavailable')).slice(-1300), errors })
  process.exitCode = 1
} finally { await browser.close() }
