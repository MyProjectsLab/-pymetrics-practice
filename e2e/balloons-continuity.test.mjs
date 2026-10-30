import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:4974'
let server, browser
before(async () => {
  let output = ''
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4974', '--strictPort'], { stdio: 'pipe' })
  server.stdout.on('data', d => { output += d }); server.stderr.on('data', d => { output += d })
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(output)
    try { ready = output.includes(origin) && (await fetch(`${origin}/practice/balloons`)).ok } catch { /* starting */ }
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

async function readRun(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-balloons-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('installation', 'readonly'), get = tx.objectStore('installation').get('root')
      get.onerror = () => reject(get.error)
      get.onsuccess = () => resolve(Object.values(get.result.records)[0])
      tx.oncomplete = () => db.close()
    }
  }))
}
async function settled(page) {
  await page.waitForFunction(() => document.querySelector('.balloons-play')?.getAttribute('aria-busy') === 'false')
}

// Observe *between* settled screens as well. A post-click screenshot alone misses
// awaiting-presentation and background-authority-check collapses.
function installContinuityMonitor() {
  const m = window.balloonsContinuity = { active: false, ended: false, frames: 0, missingPump: 0, removedPump: 0, changedHeight: 0, maxHeightDelta: 0, cls: 0, rawShift: 0, firstHeight: null, firstTop: null, firstFooter: null, maxTopDelta: 0, maxFooterDelta: 0, checkingSamples: 0, gaps: [] }
  const sample = () => {
    if (document.querySelector('.balloons-report')) { m.ended = true; return }
    const play = document.querySelector('.balloons-play'), pump = play?.querySelector('[data-control="pump"]')
    if (!m.active && play && pump) { m.active = true; m.firstHeight = play.getBoundingClientRect().height; m.firstTop = play.getBoundingClientRect().top + scrollY; m.firstFooter = document.querySelector('.site-footer').getBoundingClientRect().top + scrollY }
    if (!m.active || m.ended) return
    m.frames++
    if (document.querySelector('.balloons-journey .panel > [role="status"]')?.textContent.startsWith('Checking saved session authority')) m.checkingSamples++
    if (!play || !pump) { m.missingPump++; if (m.gaps.length < 8) m.gaps.push({ time: performance.now(), status: document.querySelector('.balloons-journey [role="status"]')?.textContent }); return }
    const delta = Math.abs(play.getBoundingClientRect().height - m.firstHeight)
    m.maxTopDelta = Math.max(m.maxTopDelta, Math.abs(play.getBoundingClientRect().top + scrollY - m.firstTop))
    m.maxFooterDelta = Math.max(m.maxFooterDelta, Math.abs(document.querySelector('.site-footer').getBoundingClientRect().top + scrollY - m.firstFooter))
    m.maxHeightDelta = Math.max(delta, m.maxHeightDelta)
    if (delta > 1) m.changedHeight++
  }
  const observer = new MutationObserver(records => {
    if (m.active && !m.ended && !document.querySelector('.balloons-report')) for (const record of records) for (const node of record.removedNodes) {
      if (node.nodeType === 1 && (node.matches('[data-control="pump"]') || node.querySelector('[data-control="pump"]'))) m.removedPump++
    }
    sample()
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  const shifts = new PerformanceObserver(list => {
    if (!m.active || m.ended) return
    for (const entry of list.getEntries()) { m.rawShift += entry.value; if (!entry.hadRecentInput) m.cls += entry.value }
  })
  shifts.observe({ type: 'layout-shift' })
  const frame = () => { sample(); if (!m.ended) requestAnimationFrame(frame) }
  requestAnimationFrame(frame)
}

for (const viewport of [{ width: 1005, height: 805 }, { width: 375, height: 667 }]) {
  test(`Balloons ${viewport.width}: all 39 rounds keep Pump mounted, fixed height and CLS <= 0.01`, { timeout: 180000 }, async () => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width === 375 })
    const page = await context.newPage(), errors = [], problems = [], rounds = []
    const press = async selector => { const button = page.locator(selector); if (viewport.width === 375) await button.tap(); else await button.click() }
    page.on('pageerror', e => errors.push(String(e)))
    const out = process.env.BALLOONS_SCREENSHOTS_DIR ? resolve(process.env.BALLOONS_SCREENSHOTS_DIR, `${viewport.width}x${viewport.height}`) : null
    const shot = async name => { if (out) { await mkdir(out, { recursive: true }); await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }) } }
    try {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
        // Delay one real, completed read's application callback at round 36.
        // Data/transactions/clocks stay native; this deterministically exercises
        // the background-check display path even on a fast test machine.
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor, set(handler) {
          if (typeof handler !== 'function') { descriptor.set.call(this, handler); return }
          descriptor.set.call(this, function(event) {
            if (window.holdBalloonsRead && this.mode === 'readonly' && this.db.name === 'assessment-practice-balloons-v1') {
              window.holdBalloonsRead = false; window.delayedBalloonsReads = (window.delayedBalloonsReads || 0) + 1
              setTimeout(() => handler.call(this, event), 180)
            } else handler.call(this, event)
          })
        } })
      })
      await page.goto(`${origin}/practice/balloons`)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('radio', { name: /Only this balloon’s \$0\.10/ }).check()
      await page.getByRole('button', { name: 'Check answer', exact: true }).click()
      await page.evaluate(() => document.fonts.ready)
      const buttons = page.getByRole('button', { name: /^(Pump|Collect)$/ })
      const colours = await buttons.evaluateAll(elements => elements.map(e => getComputedStyle(e).backgroundColor))
      if (colours.length !== 2 || colours.some(c => c !== 'rgb(14, 116, 144)')) problems.push(`Ready buttons are not matching filled cyan: ${colours}`)
      if ((await page.locator('body').innerText()).includes('Wait for each choice to save.')) problems.push('Obsolete save-wait copy is present')
      await page.getByRole('button', { name: 'Pump', exact: true }).click()
      await page.getByRole('button', { name: 'Collect', exact: true }).click()
      await page.evaluate(() => scrollTo(0, 0))
      const startBox = await page.getByRole('button', { name: 'Start', exact: true }).boundingBox()
      if (viewport.width === 1005 && startBox.y + startBox.height > viewport.height) problems.push(`Ready Start ends below viewport: ${startBox.y + startBox.height}`)
      await shot('ready')
      await page.evaluate(installContinuityMonitor)
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await settled(page)
      await shot('play')
      let growth = null, maxGrowth = null, firstBurst = null, fast = null
      for (let round = 1; round <= 39; round++) {
        let run = await readRun(page), c = run.snapshot.core
        assert.equal(c.round, round)
        if (round === 36) {
          await page.evaluate(() => { window.holdBalloonsRead = true })
          await page.waitForFunction(() => document.querySelector('.balloons-journey .panel > [role="status"]')?.textContent.startsWith('Checking saved session authority'))
          assert.ok(await page.locator('[data-control="pump"]').isDisabled())
          assert.ok(await page.locator('[data-control="collect"]').isDisabled())
          await settled(page)
        } else if (round > 36) { await page.waitForTimeout(1100); await settled(page) } // exercise background checks with the largest real journals
        let intendedPumps = 0
        if (!growth && c.manifest.rounds[round - 1].threshold > 20) {
          intendedPumps = 20
          const body = page.locator('[data-balloon-body] > path').first()
          await page.waitForTimeout(180)
          const initial = (await body.boundingBox()).height
          const begin = performance.now()
          for (let n = 0; n < 10; n++) await press('[data-control="pump"]')
          const elapsed = performance.now() - begin
          await settled(page); c = (await readRun(page)).snapshot.core
          assert.equal(c.current.successfulPumps, 10); assert.ok(elapsed < 1000)
          fast = { clicks: 10, recorded: c.current.successfulPumps, elapsed }
          for (let n = 10; n < 20; n++) await press('[data-control="pump"]')
          await settled(page); await page.waitForTimeout(180)
          growth = { initial, after20: (await body.boundingBox()).height }
          const expected = viewport.width >= 768 ? { initial: 120, after20: 220 } : { initial: 90, after20: 165 }
          if (Math.abs(growth.initial - expected.initial) > 3 || Math.abs(growth.after20 - expected.after20) > 3) problems.push(`Growth ${JSON.stringify(growth)}, expected ${JSON.stringify(expected)}`)
          await shot('pump20')
        } else {
          const threshold = c.manifest.rounds[round - 1].threshold
          const pumps = threshold > 32 ? 32 : round % 3 === 0 ? Math.min(threshold - 1, 24) : Math.min(threshold, 32)
          intendedPumps = pumps
          for (let n = 0; n < pumps; n++) await press('[data-control="pump"]')
          await settled(page)
        }
        c = (await readRun(page)).snapshot.core
        if (c.status === 'active') { await press('[data-control="collect"]'); await settled(page) }
        c = (await readRun(page)).snapshot.core
        const savedPumps = c.results.at(-1).attemptedPumps
        rounds.push({ round, intendedPumps, savedPumps })
        if (savedPumps !== intendedPumps) problems.push(`Round ${round}: ${intendedPumps} native Pumps but ${savedPumps} recorded`)
        if (!maxGrowth && c.results.at(-1)?.outcome === 'cap_collect') {
          await page.waitForTimeout(180)
          maxGrowth = (await page.locator('[data-balloon-body] > path').first().boundingBox()).height
          if (Math.abs(maxGrowth - (viewport.width >= 768 ? 280 : 210)) > 3) problems.push(`Maximum growth ${maxGrowth}`)
        }
        if (round === 1) { firstBurst = { form: run.header.formId, outcome: c.results[0].outcome, attempted: c.results[0].attemptedPumps }; await shot('burst') }
        if (round < 39) { await page.getByRole('button', { name: 'Next balloon', exact: true }).click(); await settled(page) }
        else await page.getByRole('button', { name: 'View report', exact: true }).click()
      }
      await page.locator('.balloons-report').waitFor()
      await page.waitForTimeout(100)
      await shot('report')
      const monitor = await page.evaluate(() => window.balloonsContinuity), c = (await readRun(page)).snapshot.core
      const result = { viewport, monitor, growth, maxGrowth, fast, firstBurst, ready: { colours, startBottom: startBox.y + startBox.height }, rounds, errors, problems }
      console.log(JSON.stringify(result))
      if (out) await writeFile(`${out}/RESULT.json`, JSON.stringify(result, null, 2) + '\n')
      assert.equal(c.results.length, 39); assert.equal(c.bankedCents + c.lostCents, c.results.reduce((n, r) => n + r.successfulPumps * 5, 0))
      assert.deepEqual(firstBurst, { form: 'BL1', outcome: 'burst', attempted: 1 })
      assert.ok(growth && maxGrowth && fast, 'Growth and rapid-input witnesses must execute')
      assert.ok(monitor.checkingSamples > 0, 'Held background authority check must be observed')
      assert.equal(await page.evaluate(() => window.delayedBalloonsReads), 1)
      assert.ok(monitor.active && monitor.ended && monitor.frames > 39)
      assert.equal(monitor.missingPump, 0, 'Pump disappeared during play')
      assert.equal(monitor.removedPump, 0, 'Pump DOM node was removed between rounds')
      assert.equal(monitor.changedHeight, 0, 'Play area changed height during play')
      assert.ok(monitor.maxTopDelta < 1 && monitor.maxFooterDelta < 1, 'Play area or footer moved between rounds')
      assert.ok(monitor.cls <= 0.01, `Layout shift score ${monitor.cls} exceeds 0.01`)
      assert.deepEqual(errors, []); assert.deepEqual(problems, [])
    } finally { await context.close() }
  })
}
