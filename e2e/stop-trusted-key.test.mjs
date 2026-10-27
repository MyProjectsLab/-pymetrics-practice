import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Real production assets, native browser events; no mocked receipts or clocks.
test('Stop requires a trusted press AND release before keyboard readiness', { timeout: 45000 }, async () => {
  const port = 4971, origin = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' })
  let output = '', browser
  server.stdout.on('data', chunk => { output += chunk }); server.stderr.on('data', chunk => { output += chunk })
  try {
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Production preview exited: ${output}`)
      try { ready = output.includes(origin) && (await fetch(`${origin}/practice`)).ok } catch { /* starting */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, `Production preview did not start: ${output}`)
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    await page.goto(`${origin}/practice/stop`)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'Press Space once.', exact: true }).check()
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.getByRole('heading', { name: 'A NO-GO symbol appears. What do you do?', exact: true }).waitFor()
    await page.getByRole('radio', { name: 'Do nothing.', exact: true }).check()
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.getByRole('heading', { name: 'Test your keyboard', exact: true }).waitFor()
    const readiness = page.getByRole('heading', { name: 'Ready to begin?', exact: true })
    assert.equal(await readiness.isVisible(), false)
    await page.getByRole('button', { name: 'Test my keyboard', exact: true }).click()
    const target = page.getByRole('group', { name: 'Keyboard test', exact: true })
    await target.focus()
    await page.evaluate(() => {
      window.traitgameObservedKeys = []
      for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => {
        if (event.code === 'Space') window.traitgameObservedKeys.push({ type, trusted: event.isTrusted, repeat: event.repeat })
      }, true)
    })
    await page.keyboard.down('Space')
    assert.equal(await readiness.isVisible(), false, 'Key-down alone must not pass the input check')
    await page.keyboard.up('Space')
    await readiness.waitFor()
    assert.equal(await page.getByRole('button', { name: 'Start', exact: true }).isEnabled(), true)
    assert.deepEqual(await page.evaluate(() => window.traitgameObservedKeys), [
      { type: 'keydown', trusted: true, repeat: false }, { type: 'keyup', trusted: true, repeat: false },
    ])
    const receipt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('traitgame.input-check.v1')))
    assert.equal(receipt.originGame, 'stop')
    assert.deepEqual(receipt.entries.find(entry => entry.code === 'Space'), {
      code: 'Space', trustedDown: true, trustedUp: true, sameCode: true,
      unmodifiedDownAndUp: true, downWasNotRepeat: true, upWasNotRepeat: true,
    })
    assert.equal(receipt.controlProfile.physicalKeyboardDeclared, true)
    assert.equal(receipt.controlProfile.latencyAffectedInput, false)
  } finally {
    await browser?.close()
    if (server.exitCode === null) {
      server.kill('SIGTERM')
      await new Promise(resolve => server.once('exit', resolve))
    }
  }
})
