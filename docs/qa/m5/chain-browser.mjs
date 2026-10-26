import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const evidence = { browser: browser.version(), errors: [] }
const fixture = JSON.parse(await readFile(new URL('../m3/repair/browser-recovery.json', import.meta.url), 'utf8')).result
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
page.on('pageerror', error => evidence.errors.push(String(error)))
try {
  await page.goto(process.env.M5_URL || 'http://127.0.0.1:5195/')
  await page.getByRole('button', { name: 'Open Stop' }).waitFor()
  const seed = await page.evaluate(async raw => {
    const { StopLocalStore } = await import('/src/stop/storage.ts')
    const { routeStop } = await import('/src/stop/training.ts')
    const { drillById } = await import('/src/stop/drills.ts')
    const { createDrillRun } = await import('/src/stop/drill-run.ts')
    const { verifyCompletedResult } = await import('/src/stop/run.ts')
    const store = await StopLocalStore.open()
    const result = { ...raw, storageMode: 'persistent_local' }
    if (!verifyCompletedResult(result)) throw new Error('Parent browser fixture did not verify')
    const reserved = await store.reserve(result.sessionId, 'baseline', 0)
    if (reserved?.formId !== result.form.id) throw new Error('Parent fixture form differed from first baseline form')
    await store.arm(result.sessionId, result.form.id, result.setup.visualProfile)
    await store.confirm(result.sessionId, result.form.id, result.completedAtWall, null)
    await store.saveResult(result)
    const recommendation = routeStop(result)
    const drillId = recommendation.drillId
    let now = 0, serial = 0
    const jobs = []
    const schedule = (at, callback) => { const job = { at, callback, canceled: false, serial: serial++ }; jobs.push(job); return () => { job.canceled = true } }
    const run = createDrillRun({ id: crypto.randomUUID(), manifest: drillById(drillId), setup: result.setup,
      clock: () => now, scheduler: { at: schedule, after: (at, callback) => schedule(at + .001, callback) },
      frames: { request: (request, confirm) => schedule(request.notBeforeMs, confirm) },
      initialFrame: ready => ready(), clear() {}, changed() {} })
    const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
    const advance = async target => { for (;;) {
      const job = jobs.filter(item => !item.canceled && item.at <= target).sort((a,b) => a.at - b.at || a.serial - b.serial)[0]
      if (!job) break
      job.canceled = true; now = Math.max(now, job.at); job.callback(); await settle()
    } now = Math.max(now, target); await new Promise(resolve => setTimeout(resolve, 0)); await settle() }
    await run.begin(false)
    for (let block = 0; block < drillById(drillId).blocks.length; block++) {
      await advance(now + 80_000)
      if (block < drillById(drillId).blocks.length - 1 && !run.continue()) throw new Error('Synthetic drill did not reach its next block')
    }
    const attempt = run.snapshot().attempt
    if (!attempt?.valid) throw new Error('Synthetic drill did not complete')
    const chain = { schemaVersion: 'stop_training_chain_v1', id: crypto.randomUUID(), baseline: result,
      recommendation, drillAttempts: [attempt],
      retestAttempts: [], retest: null, status: 'drill_complete' }
    await store.saveChain(chain)
    const retest = await store.reserve('retest-restore-fixture', 'retest', 0, Date.now()+1_800_000, chain.id)
    store.close()
    return { baseline: result.sessionId, baselineForm: result.form.id, chainId: chain.id, retestForm: retest?.formId }
  }, fixture)
  assert(seed.retestForm)
  const integrity = await page.evaluate(async chainId => {
    const { StopLocalStore, inspectLocalState } = await import('/src/stop/storage.ts')
    const store = await StopLocalStore.open(), intact = await store.read(); store.close()
    const original = inspectLocalState(intact).activeChain?.id === chainId
    const altered = structuredClone(intact)
    altered.chains[chainId].drillAttempts[0].events = []
    const rejectsMissingDrill = inspectLocalState(altered).activeChain === null
    altered.chains[chainId].drillAttempts[0].events = intact.chains[chainId].drillAttempts[0].events
    altered.chains[chainId].recommendation.drillId = altered.chains[chainId].recommendation.drillId === 'maintenance' ? 'detection' : 'maintenance'
    const rejectsChangedRecommendation = inspectLocalState(altered).activeChain === null
    return { original, rejectsMissingDrill, rejectsChangedRecommendation }
  }, seed.chainId)
  assert.deepEqual(integrity, { original: true, rejectsMissingDrill: true, rejectsChangedRecommendation: true })
  await page.reload()
  await page.getByRole('heading', { name: 'Try a new Stop sequence' }).waitFor()
  await page.getByRole('button', { name: 'Start retest' }).waitFor()
  const before = await page.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(); store.close(); return state.reservations['retest-restore-fixture'] })
  assert.equal(before.formId, seed.retestForm)
  assert.equal(before.armed, false)
  await page.getByRole('button', { name: 'Back to library' }).click()
  await page.getByRole('button', { name: 'Stop history' }).waitFor()
  const afterExit = await page.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(); store.close(); return state.reservations['retest-restore-fixture'] })
  assert.equal(afterExit, undefined)
  await page.getByRole('button', { name: 'Stop history' }).click()
  await page.getByRole('button', { name: 'Delete this result' }).first().click()
  await page.getByRole('heading', { name: 'Delete this Stop result?' }).waitFor()
  await page.getByRole('button', { name: 'Delete this result' }).click()
  await page.getByText(/Retired chain/).waitFor()
  const afterDelete = await page.evaluate(async () => { const { StopLocalStore } = await import('/src/stop/storage.ts'); const store = await StopLocalStore.open(); const state = await store.read(); store.close(); return { results: Object.keys(state.results), chains: Object.keys(state.chains), retiredChains: state.retiredChains, exposures: state.exposures } })
  assert.deepEqual(afterDelete.results, [])
  assert.deepEqual(afterDelete.chains, [])
  assert.equal(afterDelete.retiredChains[seed.chainId].drillAttempts.length, 1)
  assert.equal(afterDelete.exposures[seed.baselineForm].deleted, true)
  assert.deepEqual(evidence.errors, [])
  Object.assign(evidence, { pass: true, seed, integrity, restoredExplanation: true, releasedOnExit: true, dependentChainRetired: true, otherAttemptRetained: true, markerRetained: true })
} catch (error) { evidence.pass = false; evidence.failure = String(error) }
finally { await writeFile(new URL('./chain-browser.json', import.meta.url), JSON.stringify(evidence,null,2)); await browser.close() }
if (!evidence.pass) throw new Error(evidence.failure)
