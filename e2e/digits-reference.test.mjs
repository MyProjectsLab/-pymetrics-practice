import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { exerciseDigitsReference, readDigitsRoot } from './digits-reference.helper.mjs'
const origin = 'http://127.0.0.1:4973'
let server, browser
before(async () => {
  let output = ''
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4973', '--strictPort'], { stdio: 'pipe' })
  server.stdout.on('data', d => { output += d }); server.stderr.on('data', d => { output += d })
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(output)
    try { ready = output.includes(origin) && (await fetch(`${origin}/practice/digits`)).ok } catch { /* starting */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, output)
  browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close()
  if (server?.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)) }
})
for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 667 }]) {
  test(`Digits ${viewport.width}: plain Enter answer, inline results and final Next report`, { timeout: 45000 }, async () => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width === 375 })
    try { await exerciseDigitsReference(await context.newPage(), { origin, screenshots: process.env.DIGITS_SCREENSHOTS_DIR ? resolve(process.env.DIGITS_SCREENSHOTS_DIR, viewport.width === 375 ? 'phone' : 'desktop') : undefined }) } finally { await context.close() }
  })
}

test('Digits final Next retries a failed native report write once, retaining all answers', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try { await exerciseDigitsReference(await context.newPage(), { origin, failReportOnce: true, contrast: true }) } finally { await context.close() }
})

test('Digits Exit remains usable with the menu hidden and saves the interrupted run', { timeout: 20000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  try {
    const page = await context.newPage()
    await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true }))
    await page.goto(`${origin}/practice/digits`)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'Same digits, same order', exact: true }).check()
    await page.getByRole('button', { name: 'Check answer', exact: true }).click()
    await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.digits-play')?.dataset.phase === 'entry')
    assert.equal(await page.locator('header nav[aria-label="Main navigation"]').isVisible(), false)
    await page.getByRole('button', { name: 'Exit', exact: true }).click()
    await page.getByRole('heading', { name: 'Choose an assessment', exact: true }).waitFor()
    assert.ok(await page.locator('header nav[aria-label="Main navigation"]').isVisible())
    let attempt
    for (let i = 0; i < 50; i++) {
      attempt = Object.values((await readDigitsRoot(page)).attempts)[0]
      if (attempt.snapshot?.state.invalidReason === 'page_exit') break
      await page.waitForTimeout(100)
    }
    assert.equal(attempt.snapshot.state.invalidReason, 'page_exit')
    assert.equal(attempt.snapshot.state.closed.length, 0)
  } finally { await context.close() }
})
