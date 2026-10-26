import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const output = { browser: browser.version(), cases: [] }
try {
 for (const family of ['baseline', 'replay']) {
  const context = await browser.newContext(), a = await context.newPage(), b = await context.newPage()
  for (const p of [a,b]) { await p.goto('http://127.0.0.1:5566'); await p.getByRole('button', {name:'Open Stop', exact:true}).waitFor() }
  const start = 2000000000000
  const reserve = (p, id, now) => p.evaluate(async ({id,now,family}) => {
   const S = await import('/src/stop/storage.ts'); const s = await S.StopLocalStore.open(); const original = Date.now; Date.now = () => now
   try { return await s.reserve(id, family, 0) } finally { Date.now = original; s.close() }
  }, {id,now,family})
  const first = await reserve(a,'abandoned',start)
  const second = await reserve(b,'replacement',start+1800000)
  output.cases.push({family,first,second,reclaimed: first.formId===second.formId})
  await context.close()
 }
} finally { await browser.close(); await writeFile(new URL(process.env.BEFORE ? 'before-claims.json' : 'claims-browser.json',import.meta.url), JSON.stringify(output,null,2)) }
if (!process.env.BEFORE) for (const row of output.cases) assert(row.reclaimed)
