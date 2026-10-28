import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { exerciseDigitsReference } from './digits-reference.helper.mjs'
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
    try { await exerciseDigitsReference(await context.newPage(), { origin }) } finally { await context.close() }
  })
}

test('Digits final Next retries a failed native report write once, retaining all answers', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try { await exerciseDigitsReference(await context.newPage(), { origin, failReportOnce: true }) } finally { await context.close() }
})
