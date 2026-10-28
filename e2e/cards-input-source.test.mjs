import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Native browser input against production assets; stored journals are read-only test evidence.
describe('Cards native input-source regression', { timeout: 120000 }, () => {
  const origin = 'http://127.0.0.1:4972'
  let server, browser, output = ''
  before(async () => {
    server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4972', '--strictPort'], { stdio: 'pipe' })
    server.stdout.on('data', data => { output += data }); server.stderr.on('data', data => { output += data })
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(`Cards production preview exited: ${output}`)
      try { ready = output.includes(origin) && (await fetch(`${origin}/practice/cards`)).ok } catch { /* server starting */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, `Cards production preview did not start: ${output}`)
    browser = await chromium.launch({ headless: true })
  })
  after(async () => {
    await browser?.close()
    if (server?.exitCode === null) {
      server.kill('SIGTERM')
      await new Promise(resolve => server.once('exit', resolve))
    }
  })
  async function readRun(page) {
    return page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('assessment-practice-cards-v11', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('installation', 'readonly')
        const get = transaction.objectStore('installation').get('root')
        get.onerror = () => reject(get.error)
        get.onsuccess = () => resolve(Object.values(get.result.runs)[0])
        transaction.oncomplete = () => db.close()
      }
    }))
  }
  const choices = run => run.events.filter(event => event.type === 'choice_committed')
  async function idle(page, count) {
    await page.waitForFunction(n => document.querySelector('.cards-board-top p')?.textContent === `${n} / 80` &&
      !document.querySelector('.cards-deck')?.disabled && document.activeElement === document.querySelector('.cards-deck'), count)
  }
  async function settled(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
  async function tabTo(page, deck) {
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(d => document.activeElement?.matches('.cards-deck') &&
        document.activeElement.querySelector('.cards-deck-label')?.textContent === `Deck ${d}`, deck)) return
    }
    assert.fail(`Tab did not reach Deck ${deck}`)
  }
  async function fixture(viewport, check) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width === 375 })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
      window.cardsInputEvents = []
      for (const type of ['pointerdown', 'pointercancel', 'keydown', 'keyup', 'click']) document.addEventListener(type, event => {
        if (event.target?.closest?.('.cards-deck')) window.cardsInputEvents.push({
          type, trusted: event.isTrusted, key: event.key ?? null, pointerType: event.pointerType ?? null,
          deck: event.target.closest('.cards-deck').querySelector('.cards-deck-label').textContent,
        })
      }, true)
    })
    const page = await context.newPage()
    try {
      await page.goto(`${origin}/practice/cards`)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('radio', { name: 'A draw can lose money; the game ends after 80 draws.', exact: true }).check()
      await page.getByRole('button', { name: 'Check answers', exact: true }).click()
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await idle(page, 0)
      await check(page, context)
    } finally { await context.close() }
  }
  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 667 }]) {
    const size = `${viewport.width}x${viewport.height}`
    test(`${size}: mouse focus transfer preserves pointer source`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      await page.getByRole('button', { name: 'Deck B', exact: true }).click()
      await idle(page, 1)
      const run = await readRun(page)
      assert.deepEqual(choices(run).map(e => [e.deck, e.source]), [['B', 'pointer']])
      assert.equal(run.events.filter(e => e.type === 'feedback_shown').length, 1)
      assert.ok((await page.evaluate(() => window.cardsInputEvents)).some(e => e.type === 'pointerdown' && e.pointerType === 'mouse' && e.trusted))
    }))
    test(`${size}: touch focus transfer preserves touch source`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      await page.getByRole('button', { name: 'Deck B', exact: true }).tap()
      await idle(page, 1)
      const run = await readRun(page)
      assert.deepEqual(choices(run).map(e => [e.deck, e.source]), [['B', 'touch']])
      assert.equal(run.events.filter(e => e.type === 'feedback_shown').length, 1)
      assert.ok((await page.evaluate(() => window.cardsInputEvents)).some(e => e.type === 'pointerdown' && e.pointerType === 'touch' && e.trusted))
    }))
    test(`${size}: Enter and Space on focused decks remain keyboard`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      await tabTo(page, 'C'); await page.keyboard.press('Enter'); await idle(page, 1)
      await tabTo(page, 'D'); await page.keyboard.press('Space'); await idle(page, 2)
      assert.deepEqual(choices(await readRun(page)).map(e => [e.deck, e.source]), [['C', 'keyboard'], ['D', 'keyboard']])
      const keys = await page.evaluate(() => window.cardsInputEvents.filter(e => e.type === 'keydown'))
      assert.ok(keys.some(e => e.key === 'Enter' && e.trusted)); assert.ok(keys.some(e => e.key === ' ' && e.trusted))
    }))
    test(`${size}: pointercancel records no choice and cannot forge keyboard`, { timeout: 15000 }, async () => fixture(viewport, async (page, context) => {
      const button = page.getByRole('button', { name: 'Deck B', exact: true }), box = await button.boundingBox()
      assert.ok(box)
      const cdp = await context.newCDPSession(page)
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      } finally { await cdp.detach() }
      await settled(page)
      assert.equal(choices(await readRun(page)).length, 0)
      const events = await page.evaluate(() => window.cardsInputEvents)
      assert.ok(events.some(e => e.type === 'pointerdown' && e.trusted)); assert.ok(events.some(e => e.type === 'pointercancel' && e.trusted))
      await page.getByRole('button', { name: 'Deck A', exact: true }).click(); await idle(page, 1)
      assert.deepEqual(choices(await readRun(page)).map(e => e.source), ['pointer'])
    }))
    test(`${size}: Space cancelled by focus transfer creates no false keyboard`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      await page.keyboard.down('Space'); await page.keyboard.press('Tab'); await page.keyboard.up('Space'); await settled(page)
      assert.equal(choices(await readRun(page)).length, 0)
      assert.equal(await page.getByRole('button', { name: 'Deck B', exact: true }).evaluate(e => e === document.activeElement), true)
      await page.getByRole('button', { name: 'Deck B', exact: true }).click(); await idle(page, 1)
      assert.deepEqual(choices(await readRun(page)).map(e => e.source), ['pointer'])
    }))
    test(`${size}: Enter before blur records one genuine keyboard choice only`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      await page.keyboard.down('Enter'); await page.keyboard.press('Tab'); await page.keyboard.up('Enter'); await idle(page, 1)
      assert.deepEqual(choices(await readRun(page)).map(e => [e.deck, e.source]), [['A', 'keyboard']])
    }))
    test(`${size}: an untrusted click is rejected without changing the run`, { timeout: 15000 }, async () => fixture(viewport, async page => {
      const before = await readRun(page)
      await page.getByRole('button', { name: 'Deck B', exact: true }).evaluate(button => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
      })
      await settled(page)
      assert.deepEqual(await readRun(page), before)
      assert.ok((await page.evaluate(() => window.cardsInputEvents)).some(e => e.type === 'click' && !e.trusted))
      await page.keyboard.press('Space'); await idle(page, 1)
      assert.deepEqual(choices(await readRun(page)).map(e => e.source), ['keyboard'])
    }))
  }
})
