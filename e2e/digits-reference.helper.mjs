import assert from 'node:assert/strict'

export async function readDigitsRoot(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-digits-v11', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('installation', 'readonly')
      const get = tx.objectStore('installation').get('root')
      get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error)
      tx.oncomplete = () => db.close()
    }
  }))
}
export async function exerciseDigitsReference(page, { origin, method = 'keyboard', contrast = false, waitMs = 0, screenshots } = {}) {
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    window.digitsReferenceProbe = []
    let previous = ''
    new MutationObserver(() => {
      const el = document.querySelector('.digits-stimulus'), text = el?.textContent ?? ''
      if (text === previous) return
      previous = text
      window.digitsReferenceProbe.push({ text, at: performance.now(), entryHidden: document.querySelector('.digits-entry') ? getComputedStyle(document.querySelector('.digits-entry')).visibility === 'hidden' : null })
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.goto(`${origin}/practice/digits`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Same digits, any order', exact: true }).check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  assert.ok(await page.getByText('Keep the original order. Try again.', { exact: true }).isVisible())
  await page.getByRole('radio', { name: 'Same digits, same order', exact: true }).check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await page.getByRole('heading', { name: 'Ready?', exact: true }).waitFor()
  await page.getByText('Presentation and accessibility options', { exact: true }).click()
  assert.ok(await page.getByRole('checkbox', { name: 'Extended answer time (35 seconds)', exact: true }).isDisabled())
  if (method === 'keypad') await page.getByRole('radio', { name: 'On-screen numeric keypad', exact: true }).check()
  if (contrast) await page.getByRole('checkbox', { name: 'High contrast', exact: true }).check()
  await page.getByText('Presentation and accessibility options', { exact: true }).click()
  await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  let offset = 0, waited = 0
  const observations = []
  for (let trial = 0; trial < 4; trial++) {
    await page.waitForFunction(() => /^\d$/.test(document.querySelector('.digits-stimulus')?.textContent ?? ''))
    assert.equal(await page.locator('.digits-entry').evaluate(e => getComputedStyle(e).visibility), 'hidden')
    if (screenshots && trial === 0) await page.screenshot({ path: `${screenshots}-digit.png` })
    await page.waitForFunction(() => document.querySelector('.digits-play')?.dataset.phase === 'entry')
    await page.waitForFunction(keypad => document.activeElement === document.querySelector(keypad ? '.digits-keypad button' : '#digits-response'), method === 'keypad')
    const input = page.locator('#digits-response')
    assert.equal(await input.getAttribute('maxlength'), '64')
    assert.equal(await page.locator('.digits-answer-boxes,.digits-position-ticks,.digits-entry-progress,.digits-countdown').count(), 0)
    assert.equal(await page.getByRole('button', { name: /^(Skip|Submit)$/ }).count(), 0)
    assert.doesNotMatch(await page.locator('.digits-play').innerText(), /Trial\s+\d|\d+\s+digits|Next:|seconds remaining|s left/)
    const probe = await page.evaluate(() => window.digitsReferenceProbe)
    const digits = probe.slice(offset).filter(row => /^\d$/.test(row.text))
    assert.ok(digits.length >= 3 && digits.every(row => row.entryHidden))
    const target = digits.map(row => row.text).join('')
    await page.evaluate(() => { window.retainedDigitsInput = document.querySelector('#digits-response') })
    if (waitMs && trial === 0) {
      const start = await page.evaluate(() => performance.now())
      await page.waitForTimeout(waitMs)
      waited = await page.evaluate(start => performance.now() - start, start)
      assert.ok(waited > 35000)
      assert.equal(await page.locator('.digits-play').getAttribute('data-phase'), 'entry')
      assert.equal(await input.inputValue(), '')
      assert.deepEqual(errors, [])
    }
    const answer = trial === 0 ? target : target + '9'
    if (method === 'keypad') {
      for (const digit of answer) await page.locator('.digits-keypad').getByRole('button', { name: digit, exact: true }).tap()
    } else await input.pressSequentially(answer, { delay: 15 })
    assert.equal(await input.inputValue(), answer)
    if (screenshots && trial === 0) await page.screenshot({ path: `${screenshots}-answer.png` })
    // Untrusted Enter must not commit, even with a fully populated answer.
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
    assert.equal(await page.locator('.digits-play').getAttribute('data-phase'), 'entry')
    if (method === 'keypad') await page.locator('.digits-keypad').getByRole('button', { name: 'Enter', exact: true }).tap()
    else await input.press('Enter')
    await page.waitForFunction(() => document.querySelector('.digits-play')?.dataset.screen === 'feedback')
    assert.equal(await input.inputValue(), answer)
    assert.ok(await input.evaluate(e => e === window.retainedDigitsInput && e.readOnly))
    const expected = trial === 0 ? 'correct' : 'wrong'
    assert.equal(await page.locator('.digits-entry').getAttribute('data-result'), expected)
    assert.equal(await page.locator('.digits-result-mark > span[aria-hidden]').innerText(), trial === 0 ? '✓' : '✕')
    const color = await input.evaluate(e => getComputedStyle(e).color)
    assert.equal(color, contrast ? trial === 0 ? 'rgb(130, 240, 178)' : 'rgb(255, 101, 116)' : trial === 0 ? 'rgb(18, 147, 90)' : 'rgb(214, 40, 59)')
    if (trial === 0) assert.equal(await page.locator('.digits-error-count').count(), 0)
    else assert.equal(await page.locator('.digits-error-count').innerText(), `✕ ${trial}`)
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent === 'Next' && !e.disabled))
    if (screenshots && trial <= 1) await page.screenshot({ path: `${screenshots}-${expected}.png` })
    const fit = await page.locator('.digits-play').evaluate(e => ({ top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, viewport: innerHeight, scrollWidth: document.documentElement.scrollWidth, width: innerWidth }))
    assert.ok(fit.top >= 0 && fit.bottom <= fit.viewport && fit.scrollWidth <= fit.width, JSON.stringify(fit))
    observations.push({ target, answer, expected, color, fit })
    offset = (await page.evaluate(() => window.digitsReferenceProbe)).length
    if (trial === 3) {
      const root = await readDigitsRoot(page), attempt = Object.values(root.attempts)[0]
      assert.equal(attempt.snapshot.kind, 'terminal')
      assert.equal(attempt.snapshot.state.phase, 'completed')
      assert.equal((root.activity[attempt.sessionId] ?? []).length, 0, 'No report receipt before final Next')
      assert.equal(await page.locator('.digits-report').count(), 0)
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await page.getByRole('heading', { name: 'Longest sequence: 4 digits', exact: true }).waitFor()
  assert.deepEqual(await page.locator('.report-summary-metrics dd').allTextContents(), ['1', '3', '0', '0'])
  if (screenshots) await page.screenshot({ path: `${screenshots}-report.png`, fullPage: true })
  const root = await readDigitsRoot(page), attempt = Object.values(root.attempts)[0], state = attempt.snapshot.state
  assert.equal(attempt.arm.events[0].detail.referenceRules, 'digits_reference_2026_10_28')
  assert.equal(state.entryDeadlineMs, null)
  assert.equal(state.commands.filter(e => e.kind === 'timeout' || e.kind === 'skip').length, 0)
  assert.equal(state.closed.length, 4)
  assert.ok(state.closed.every(e => !e.skipped && !e.timedOut))
  assert.equal(root.activity[attempt.sessionId].length, 1)
  assert.deepEqual(errors, [])
  const gaps = []
  for (let index = 0; index < state.events.length; index++) {
    const event = state.events[index]
    if (!['digit_presented', 'digit_ended', 'entry_opened'].includes(event.type)) continue
    assert.ok(event.atMs >= event.detail.dueMs && event.detail.latenessMs <= 50, JSON.stringify(event))
    const prior = state.events.slice(0, index).reverse().find(e => ['trial_started', 'digit_presented', 'digit_ended'].includes(e.type))
    if (prior) { const gap = event.atMs - prior.atMs; assert.ok(gap >= 500 && gap <= 550, String(gap)); gaps.push(gap) }
  }
  return { method, contrast, waitedMs: waited, observations, gaps, review: attempt.snapshot.review, noEarlyTimeout: true, reportReceipts: root.activity[attempt.sessionId].length, errors }
}
