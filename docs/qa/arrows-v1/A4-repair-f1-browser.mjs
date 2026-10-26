import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const origin = process.env.ARROWS_QA_ORIGIN ?? 'http://127.0.0.1:4173'
const results = []
try {
  for (const container of ['Map', 'Set', 'Date', 'tombstone-map']) {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto(origin)
      const result = await page.evaluate(async kind => {
        const { ArrowsStore, inspectArrowsRoot } = await import('/src/arrows/storage.ts')
        const store = await ArrowsStore.open()
        await store.backend.change(root => {
          if (kind === 'tombstone-map') root.tombstones = new Map([['session-1', 10]])
          else root.attempts = kind === 'Map' ? new Map() : kind === 'Set' ? new Set() : new Date(0)
        })
        let admissionRejected = false
        try { await inspectArrowsRoot(await store.backend.read()) } catch { admissionRejected = true }
        const request = { requestId: 'request-1', sessionId: 'session-1', clockDomainId: 'clock-1',
          profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
            alternative: false, accommodation: 'default', reducedMotion: false },
          atMs: 100, wallMs: 1_000 }
        const rejected = []
        for (let retry = 0; retry < 2; retry++) {
          try { await store.start(request); rejected.push(false) } catch { rejected.push(true) }
        }
        const root = await store.backend.read()
        return { container: kind, admissionRejected, rejected,
          count: root.scoredStartCount, revision: root.revision,
          attemptsKind: Object.prototype.toString.call(root.attempts),
          tombstonesKind: Object.prototype.toString.call(root.tombstones),
          tombstoneRetained: kind === 'tombstone-map' ? root.tombstones.get('session-1') === 10 : null }
      }, container)
      results.push(result)
    } finally { await context.close() }
  }
  const outcome = { browser: await browser.version(), cases: results,
    passed: results.every(result => result.admissionRejected && result.rejected.every(Boolean) &&
      result.count === 0 && result.revision === 0 && result.tombstoneRetained !== false) }
  writeFileSync(new URL('./A4-repair-f1-browser.json', import.meta.url), JSON.stringify(outcome, null, 2) + '\n')
  if (!outcome.passed) process.exitCode = 1
} finally { await browser.close() }
