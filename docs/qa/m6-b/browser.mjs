import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const executablePath = '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const out = { clock: 'Playwright controlled browser clock; not physical timing certification', cases: [] }
const kind = process.env.CASE || 'decline'
const browser = await chromium.launch({ headless: true, executablePath })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const requests = [], errors = []
page.on('pageerror', error => errors.push(String(error)))
await page.route('**/api/stop-analytics', async route => {
  const req = route.request()
  requests.push({ payload: req.postDataJSON(), headers: await req.allHeaders(), timedVisible: await page.locator('[aria-label="Timed Stop task"]:visible, [aria-label="Timed Stop drill"]:visible').count() })
  if (kind === 'network-failure') await route.abort('failed')
  else await route.fulfill({ status: 503, body: '' }) // Deliberately disabled server, never collection.
})
async function advance(ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) { await page.clock.runFor(Math.min(100, ms - elapsed)); await new Promise(resolve => setTimeout(resolve, 1)) }
}
async function click(name) { await page.getByRole('button', { name, exact: true }).click(); await page.clock.runFor(50) }
async function prepare() {
  await click('See the rule'); await click('Try examples')
  for (let i = 0; i < 4; i++) {
    if (i % 2 === 0) await page.keyboard.press('Space')
    await click('Check example'); await click(i === 3 ? 'Check my understanding' : 'Next example')
  }
  for (const [q,a] of [['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']]) await page.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check()
  await click('Check answers'); await click('Check your setup')
  await page.getByLabel('I’m using a laptop or desktop with a physical keyboard.', { exact: true }).check()
  await click('Run input check'); await page.keyboard.press('Space'); await click('Continue to readiness')
}
async function runSession() {
  await prepare(); await click('I’m ready')
  await advance(20000)
  await click('Start scored task')
  await advance(185000)
  await page.getByRole('heading', {name:'Stop complete',exact:true}).waitFor({timeout:3000})
  await click('View my result')
  assert(await page.getByRole('heading',{name:'Your Stop practice result',exact:true}).isVisible())
  return page.locator('[data-report-version]').innerText()
}
try {
  await page.clock.install({ time: new Date('2026-10-01T12:00:00Z') })
  await page.goto(kind === 'default' ? 'http://127.0.0.1:5567' : 'http://127.0.0.1:5568')
  await page.clock.runFor(200)
  await page.getByRole('button', {name:'Open Stop',exact:true}).waitFor()
  if (kind === 'default') assert(await page.getByRole('button',{name:'Allow optional analytics',exact:true}).isDisabled())
  if (kind === 'consent' || kind === 'network-failure' || kind === 'withdraw') await click('Allow optional analytics')
  if (kind === 'withdraw') await click('Withdraw analytics consent')
  if (kind === 'decline' || kind === 'default') await click('Decline analytics')
  await click('Open Stop')
  const baseline = await runSession()
  out.cases.push({ name: 'baseline-report', report: baseline })
  await click('Start recommended training')
  await click('Start assigned drill')
  await click('Start drill')
  for(let block = 1; block <= 3; block++) {
    await advance(55000)
    if (block < 3) await click('Continue to next block')
  }
  await page.getByRole('heading', {name:'Drill complete',exact:true}).waitFor({timeout:3000})
  await click('Continue to retest'); await click('Try a new Stop sequence'); await click('Start retest')
  const retest = await runSession()
  await click('View baseline comparison')
  await page.clock.runFor(200)
  await page.getByRole('heading',{name:'Baseline and retest',exact:true}).waitFor({timeout:10000})
  out.cases.push({ name:'drill-retest-comparison', report: retest, comparison: await page.locator('main').innerText() })
  await click('Back to library')
  await click('Stop history')
  await page.getByRole('button', { name:'Open original report', exact:true }).first().waitFor({timeout:10000})
  assert.equal(await page.getByRole('button', { name:'Open original report', exact:true }).count(), 2)
  assert.equal(await page.getByRole('button', { name:'Review drill attempt', exact:true }).count(), 1)
  out.cases.push({ name:'history', text: await page.locator('main').innerText() })
  const local = await page.evaluate(async () => {
    const db = await new Promise((resolve,reject) => { const r=indexedDB.open('assessment-practice-stop'); r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error) })
    const records={}
    for(const name of db.objectStoreNames) records[name]=await new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    db.close(); return JSON.stringify({records,localStorage:{...localStorage},sessionStorage:{...sessionStorage},cookies:document.cookie})
  })
  for(const request of requests) assert(!local.includes(request.payload.session_id), 'analytics id must not enter browser storage')
  out.localStorageHasNoAnalyticsId=true
  const requestCount=requests.length
  await page.reload(); await advance(500)
  await page.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
  assert(await page.getByText('Analytics consent is off.',{exact:true}).isVisible())
  await click('Stop history')
  await page.getByRole('button',{name:'Open original report',exact:true}).first().waitFor({timeout:10000})
  assert.equal(await page.getByRole('button',{name:'Open original report',exact:true}).count(),2)
  assert.equal(requests.length,requestCount)
  out.cases.push({name:'reload-consent-off-and-history-restored',passed:true})
  assert(requests.every(r => r.timedVisible === 0), 'No analytics request during visible timed work')
  if (['default','decline','withdraw'].includes(kind)) assert.equal(requests.length,0)
  else {
    const names=requests.map(r=>r.payload.event)
    for(const event of ['stop_guide_opened','stop_device_check_completed','stop_session_started','stop_session_ended','stop_report_viewed','stop_training_recommendation_shown','stop_drill_started','stop_drill_completed','stop_retest_started','stop_retest_completed']) assert(names.includes(event),event)
    assert(requests.every(r=>!r.headers.cookie && !r.headers.referer))
    assert(requests.every(r=>r.payload.event!=='stop_session_started'||['baseline','retest'].includes(r.payload.mode)))
    assert.equal(new Set(requests.map(r=>r.payload.session_id)).size,1)
  }
  assert.deepEqual(errors,[])
  out.passed=true
} catch(error) {
  out.failure=String(error);out.page=await page.locator('main').innerText().catch(()=> 'unavailable'); process.exitCode=1
} finally {
  out.kind=kind;out.requests=requests;out.errors=errors;out.browser=browser.version()
  await writeFile(`docs/qa/m6-b/browser-${kind}.json`,JSON.stringify(out,null,2)+'\n')
  await browser.close()
}
