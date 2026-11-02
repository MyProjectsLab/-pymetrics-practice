import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

test('Cards reveal and cumulative bars preserve all 80 native draws and stable deck positions', { timeout: 180000 }, async () => {
  const origin = 'http://127.0.0.1:4992'
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4992', '--strictPort'], { stdio: 'pipe' })
  let browser
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break } catch {} await new Promise(r => setTimeout(r, 100)) }
    browser = await chromium.launch()
    for (const viewport of [{ width: 1005, height: 805 }, { width: 1920, height: 1080 }, { width: 375, height: 667 }]) {
      const context = await browser.newContext({ viewport, hasTouch: true })
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(String(error)))
      const capture = async name => {
        if (!process.env.TRAITGAME_CARDS_OUTPUT) return
        await mkdir(process.env.TRAITGAME_CARDS_OUTPUT, { recursive: true })
        await page.screenshot({ path: resolve(process.env.TRAITGAME_CARDS_OUTPUT, `cards-${name}-${viewport.width}.png`), fullPage: false })
      }
      try {
        await page.goto(`${origin}/practice/cards`)
        await page.getByRole('button', { name: 'Continue', exact: true }).click()
        await page.getByRole('radio', { name: 'A draw can lose money; the game ends after 80 draws.', exact: true }).check()
        await page.getByRole('button', { name: 'Check answers', exact: true }).click()
        await page.getByRole('button', { name: 'Start', exact: true }).click()
        const waitReady = async count => page.waitForFunction(n => document.querySelector('.cards-board-top p')?.textContent === `${n} / 80` && !document.querySelector('.cards-deck')?.disabled, count)
        await waitReady(0)
        const geometry = () => page.locator('.cards-decks').evaluate(e => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height } })
        const before = await geometry()
        assert.equal(await page.locator('.cards-drawn-card').count(), 0)
        assert.equal(await page.getByRole('progressbar', { name: 'Cumulative gains' }).getAttribute('value'), '0')
        assert.equal(await page.getByRole('progressbar', { name: 'Cumulative losses' }).getAttribute('value'), '0')
        // Full run uses a fixed mixed policy, never reads unchosen form values.
        let gains = 0, losses = 0, lossCaptured = false
        const expectedDecks = [], expectedSources = []
        for (let turn = 1; turn <= 80; turn++) {
          const deck = ['B', 'B', 'B', 'B', 'B', 'B', 'A', 'C', 'D', 'B'][(turn - 1) % 10]
          const button = page.getByRole('button', { name: `Deck ${deck}`, exact: true })
          const source = turn % 3 === 0 ? 'keyboard' : turn % 3 === 1 ? 'pointer' : 'touch'
          if (source === 'keyboard') { await button.focus(); await page.keyboard.press(turn % 2 ? 'Enter' : 'Space') }
          else if (source === 'touch') await button.tap()
          else await button.click()
          expectedDecks.push(deck); expectedSources.push(source)
          if (turn === 80) break
          await waitReady(turn)
          const shown = await page.evaluate(() => {
            const amount = document.querySelector('.cards-outcome').textContent
            const bars = [...document.querySelectorAll('.cards-money-bar progress')]
            return { amount, values: bars.map(e => e.value), maxima: bars.map(e => e.max),
              balance: document.querySelector('.cards-balance strong').textContent,
              announcement: document.querySelector('.cards-feedback .cards-sr-only').textContent,
              artHidden: document.querySelector('.cards-drawn-card').getAttribute('aria-hidden'),
              deckRects: [...document.querySelectorAll('.cards-deck')].map(e => { const r = e.getBoundingClientRect(); return { width: r.width, bottom: r.bottom, opacity: getComputedStyle(e).opacity } }) }
          })
          const value = Number(shown.amount.replace(/[^0-9.-]/g, ''))
          gains += Math.max(value, 0); losses += Math.max(-value, 0)
          assert.deepEqual(shown.values, [gains, losses])
          assert.equal(shown.maxima[0], shown.maxima[1])
          assert.equal(Number(shown.balance.replace(/[^0-9.-]/g, '')), 2000 + gains - losses)
          assert.ok(shown.announcement.includes(`Deck ${deck}:`) && shown.announcement.includes('Balance'))
          assert.equal(shown.artHidden, 'true')
          assert.equal(await page.locator('.cards-drawn-card').count(), 1)
          const after = await geometry()
          assert.ok(Math.abs(after.top - before.top) < 1, 'Reveal must not move the decks')
          assert.ok(Math.abs(after.height - before.height) < 1, 'Deck row must retain its height')
          assert.ok(shown.deckRects.every(r => r.width >= 44 && r.opacity === '1'))
          assert.ok(shown.deckRects.every(r => r.bottom <= viewport.height), 'Four deck controls fit the viewport')
          if (turn === 1) await capture('gain')
          if (value < 0 && !lossCaptured) { await capture('loss'); lossCaptured = true }
        }
        await page.getByRole('heading', { name: /^Ended with / }).waitFor()
        assert.ok(lossCaptured, 'Mixed run must exercise a loss')
        const run = await page.evaluate(() => new Promise((resolve, reject) => {
          const req = indexedDB.open('assessment-practice-cards-v11', 1)
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result, tx = db.transaction('installation', 'readonly'), get = tx.objectStore('installation').get('root')
            get.onsuccess = () => resolve(Object.values(get.result.runs)[0])
            get.onerror = () => reject(get.error); tx.oncomplete = () => db.close()
          }
        }))
        const choices = run.events.filter(e => e.type === 'choice_committed')
        assert.equal(choices.length, 80)
        assert.equal(run.events.filter(e => e.type === 'feedback_shown').length, 80)
        assert.equal(run.events.filter(e => e.type === 'run_completed').length, 1)
        assert.deepEqual(choices.map(e => e.deck), expectedDecks)
        assert.deepEqual(choices.map(e => e.source), expectedSources)
        const ending = choices[79].balance
        await page.getByRole('heading', { name: `Ended with ${ending < 0 ? '-' : ''}$${Math.abs(ending).toLocaleString('en-US')}` }).waitFor()
        assert.equal(run.status, 'complete')
        assert.deepEqual(errors, [])
        await capture('report')
        console.log(JSON.stringify({ viewport, draws: choices.length, feedback: 80, ending, sources: Object.fromEntries(['pointer', 'touch', 'keyboard'].map(s => [s, choices.filter(e => e.source === s).length])) }))
      } finally { await context.close() }
    }
  } finally { await browser?.close(); server.kill('SIGTERM') }
})
