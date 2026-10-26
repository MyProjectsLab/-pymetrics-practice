import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const context = await browser.newContext()
const pages = [await context.newPage(), await context.newPage()]
const origin = process.env.ARROWS_QA_ORIGIN ?? 'http://127.0.0.1:4173'
try {
  await Promise.all(pages.map(page => page.goto(origin)))
  const arms = await Promise.all(pages.map(page => page.evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const store = await ArrowsStore.open()
    const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
      alternative: false, accommodation: 'default', reducedMotion: false }
    const request = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
      clockDomainId: crypto.randomUUID(), profile, atMs: performance.now(), wallMs: Date.now() }
    const arm = await store.start(request)
    const retry = await store.start(request)
    return { ordinal: arm.ordinal, formId: arm.state.form.id, sessionId: arm.sessionId,
      retryIdentical: JSON.stringify(arm) === JSON.stringify(retry),
      eventTypes: arm.state.events.map(event => event.type) }
  })))
  await pages[0].reload()
  const recovered = await pages[0].evaluate(async () => {
    const { ArrowsStore } = await import('/src/arrows/storage.ts')
    const store = await ArrowsStore.open()
    const root = await store.read()
    return { count: root.scoredStartCount, revision: root.revision,
      ordinals: Object.values(root.attempts).map(attempt => attempt.ordinal).sort(),
      eventCounts: Object.values(root.attempts).map(attempt => attempt.state.events.length) }
  })
  const result = { browser: await browser.version(), arms, recovered,
    passed: arms.length === 2 && arms.every(arm => arm.retryIdentical &&
      arm.eventTypes.join(',') === 'prepared,form_assigned,armed') &&
      arms.map(arm => arm.ordinal).sort().join(',') === '1,2' &&
      arms.map(arm => arm.formId).sort().join(',') === 'AR1,AR2' &&
      recovered.count === 2 && recovered.revision === 2 &&
      recovered.ordinals.join(',') === '1,2' && recovered.eventCounts.every(count => count === 3) }
  writeFileSync(new URL('./A4-browser-arm.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  if (!result.passed) process.exitCode = 1
} finally {
  await browser.close()
}
