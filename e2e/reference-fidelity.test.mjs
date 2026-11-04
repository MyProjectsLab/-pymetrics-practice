import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { firstPlay, games } from './live-game-audit.helper.mjs'

const origin = 'http://127.0.0.1:4957'
let server, browser
before(async () => {
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4957', '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('Preview did not start')
    try { if ((await fetch(origin)).ok) break } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch()
})
after(async () => {
  await browser?.close()
  if (server?.exitCode === null) {
    server.kill('SIGTERM')
    await new Promise(resolve => server.once('exit', resolve))
  }
})

async function runGame(name, check) {
  const page = await browser.newPage({ viewport: { width: 1005, height: 805 } })
  // Observe the actual authored DOM without modifying the protected display.
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow
    const roots = []
    const arrows = []
    let sawFixation = false, firstFace = null, firstReward = null
    Element.prototype.attachShadow = function(init) {
      const root = attachShadow.call(this, init)
      roots.push(root)
      if (this.matches('[data-arrows-shell]')) {
        new MutationObserver(records => {
          for (const record of records) for (const child of record.addedNodes) {
            if (!(child instanceof HTMLImageElement) || !record.target.matches('figure')) continue
            const source = decodeURIComponent(child.getAttribute('src').split(',')[1])
            if (/stroke="#(?:b11f2f|184dab|171717)"/.test(source)) arrows.push(source)
          }
        }).observe(root, { subtree: true, childList: true })
      }
      return root
    }
    const sample = () => {
      for (const root of roots) {
        if (root.querySelector('[data-mouth-v12="fixation"]')) sawFixation = true
        const face = root.querySelector('[data-mouth-v12="face"]')
        if (sawFixation && face && !firstFace) {
          const circle = face.querySelector('circle')
          const line = face.querySelector('line')
          firstFace = { width: circle.getBoundingClientRect().width, length: Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')) }
        }
        const reward = root.querySelector('.mouth-reward-tick')
        if (reward && !firstReward) firstReward = { mark: reward.textContent, amount: reward.parentElement.textContent, width: reward.getBoundingClientRect().width }
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    window.referenceEvidence = () => ({ arrows, firstFace, firstReward })
  })
  try {
    const ui = await firstPlay(page, games.find(game => game[0] === name), origin)
    try { await check(page) }
    finally { await ui.close() }
  } finally { await page.close() }
}

test('Lengths renders the smaller standard face and a distinct earned-reward tick', { timeout: 15000 }, async () => {
  await runGame('Lengths', async page => {
    const firstFace = await page.waitForFunction(() => window.referenceEvidence().firstFace)
    const face = await firstFace.jsonValue()
    assert.ok(Math.abs(face.width - 115.2) < 1, JSON.stringify(face))
    assert.equal(face.length, 43, 'Fresh form first stimulus is Long')
    await page.keyboard.press('ArrowRight')
    const witness = await page.waitForFunction(() => window.referenceEvidence().firstReward)
    assert.deepEqual(await witness.jsonValue(), { mark: '✓', amount: '✓+50¢ simulated', width: 116 })
  })
})

test('Arrows resumes from a confirmed checkpoint and shows position marks without text', { timeout: 95000 }, async () => {
  await runGame('Arrows', async page => {
    await page.waitForFunction(() => window.referenceEvidence().arrows.length >= 27, undefined, { timeout: 80000 })
    await page.keyboard.down('ArrowLeft')
    await page.waitForTimeout(2200)
    assert.equal(await page.evaluate(() => window.referenceEvidence().arrows.length), 27, 'A held response delays the next block')
    await page.keyboard.up('ArrowLeft')
    await page.waitForFunction(() => window.referenceEvidence().arrows.length >= 28)
    const { arrows } = await page.evaluate(() => window.referenceEvidence())
    assert.equal(arrows.length, 28)
    for (const source of arrows) {
      assert.ok(source.includes('94H'), 'The non-color position cue is in the visible artwork')
      const expectedPaths = source.includes('stroke="#b11f2f"') ? 10 : 7
      assert.equal((source.match(/<path /g) ?? []).length, expectedPaths, 'There are no outlined letters in the trial image')
    }
  })
})
