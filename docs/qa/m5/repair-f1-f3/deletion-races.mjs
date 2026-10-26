// Real UI deletion, real IndexedDB transactions; only save scheduling/failure is injected.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const F = JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-r1-r2-fixtures.json', 'utf8'))
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const out = { browser: browser.version(), cases: [], errors: [] }
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const p = await browser.newPage({ viewport: { width: 1200, height: 800 } })
p.on('pageerror', e => out.errors.push(String(e)))
const click = name => p.getByRole('button', { name, exact: true }).click()
const ready = () => p.getByRole('button', { name: 'Open Stop', exact: true }).waitFor()
const api = (fn, arg) => p.evaluate(async ({ code, arg }) => {
  const S = await import('/src/stop/storage.ts'), T = await import('/src/stop/training.ts')
  return new Function('S', 'T', '_s', 'arg', `return (${code})(S,T,_s,arg)`)(S, T, S.stopLocalStore(), arg)
}, { code: fn.toString(), arg })
const read = () => api((S,T,_s) => _s.read())
const saved = () => waitValue(p,async () => (await import('/src/stop/training.ts')).trainingSaveStatus() === 'saved')
const seed = async state => { await api(async (S,T,_s,state) => { await _s.deleteAll(); await _s.mutate(x => Object.assign(x,state)) }, state); await p.reload(); await ready() }
try {
  await p.goto('http://127.0.0.1:5227/'); await ready()
  for (const failure of ['failed', 'pending', 'pending-reject']) for (const action of ['drill', 'retest', 'completed-retest', 'baseline', 'all', 'unrelated']) for (const order of ['retry-before-delete', 'retry-after-delete']) {
    const state = structuredClone(F.state), unrelated = F.profiles[1]
    state.results[unrelated.sessionId] = unrelated
    state.exposures[unrelated.form.id] = { formId: unrelated.form.id, sessionId: unrelated.sessionId, visualProfile: unrelated.setup.visualProfile, certainty: 'confirmed', deleted: false, exposedAtWall: unrelated.completedAtWall }
    const draft = F.drafts.find(d => d.mode === 'retest' && d.realizedSequence.length)
    state.drafts[draft.sessionId] = draft
    state.exposures[draft.form.id] = { formId: draft.form.id, sessionId: draft.sessionId, visualProfile: 'standard', certainty: 'confirmed', deleted: false, exposedAtWall: draft.retainedAtWall }
    state.chains[F.chain.id].retestAttempts = [{ sessionId: draft.sessionId, formId: draft.form.id, valid: false }]
    if (action === 'completed-retest') {
      delete state.drafts[draft.sessionId]
      state.results[F.retest.sessionId] = F.retest
      state.exposures[F.retest.form.id] = { formId: F.retest.form.id, sessionId: F.retest.sessionId, visualProfile: 'standard', certainty: 'confirmed', deleted: false, exposedAtWall: F.retest.completedAtWall }
      Object.assign(state.chains[F.chain.id], { retest: F.retest, status: 'complete', retestAttempts: [{sessionId:F.retest.sessionId,formId:F.retest.form.id,valid:true}] })
    }
    await seed(state)
    // A second, unsaved journal must remain reviewable when deletion retires the chain.
    const extra = structuredClone(F.drills.detection)
    extra.id = 'unsaved-other-attempt'; for (const e of extra.events) e.sessionId = extra.id
    await api((S,T,_s,{failure,extra}) => {
      window.writes = []; window.releaseSave = null; window.rejectWrites = failure === 'failed'; window.realSave = _s.saveChain.bind(_s)
      let first = true
      _s.saveChain = async (chain,event) => {
        writes.push({ chainId: chain.id, status: chain.status, attempts: chain.drillAttempts.map(a => a.id) })
        if (first && failure !== 'failed') { first = false; await new Promise(resolve => window.releaseSave = resolve); if (failure === 'pending-reject') throw Error('delayed transient rejection') }
        if (rejectWrites) throw Error('transient rejection')
        return realSave(chain,event)
      }
      if (T.currentTrainingChain().retest) T.updateTrainingChain({drillAttempts:[...T.currentTrainingChain().drillAttempts,extra]})
      else T.retainDrillAttempt(T.currentTrainingChain().id,extra)
    }, { failure, extra })
    if (failure === 'failed') await p.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
    else await p.getByText('Saving training changes. Keep this tab open until saving finishes.',{exact:true}).waitFor()
    const before = await api((S,T,_s) => ({ status: T.trainingSaveStatus(), memory: T.currentTrainingChain().drillAttempts.map(a=>a.id), calls: writes.length }))
    await api((S,T,_s) => T.retryTrainingSave()) // explicit retry during pending/failed state
    if (order === 'retry-before-delete') {
      await p.evaluate(() => { rejectWrites = false; releaseSave?.() })
      await api((S,T,_s) => T.retryTrainingSave()); await saved()
    }
    await click('Stop history')
    if (action === 'all') { await click('Delete all Assessment Practice data'); await click('Delete all local data') }
    else {
      const target = action === 'drill' ? p.locator('article').filter({has:p.getByRole('button',{name:'Review drill attempt',exact:true})}).first() :
        action === 'retest' ? p.locator('article').filter({has:p.getByRole('button',{name:'Review attempt',exact:true})}) :
        p.locator('article').filter({hasText: action === 'baseline' ? F.baseline.form.id : action === 'completed-retest' ? F.retest.form.id : unrelated.form.id})
      await target.getByRole('button',{name:'Delete this result',exact:true}).click()
      await p.getByRole('alertdialog').getByRole('button',{name:'Delete this result',exact:true}).click()
    }
    await p.getByRole('alertdialog').waitFor({state:'detached'})
    const afterDelete = await read()
    const memoryAfterDelete = await api((S,T,_s) => ({ id: T.currentTrainingChain()?.id ?? null, attempts: T.currentTrainingChain()?.drillAttempts.map(a=>a.id) ?? [], status: T.trainingSaveStatus(), calls: writes.length }))
    if (action !== 'unrelated') assert.equal(memoryAfterDelete.id,null)
    else assert(memoryAfterDelete.attempts.includes(extra.id))
    await p.evaluate(() => { rejectWrites = false; releaseSave?.() })
    await api((S,T,_s) => T.retryTrainingSave()); await saved()
    const settled = await read(), calls = await p.evaluate(() => writes)
    // Direct stale storage replay is independent of the canceled queue and UI.
    const stale = await api(async (S,T,_s,chain) => { try { await realSave(chain); return 'accepted' } catch(e) { return e.constructor.name } }, { ...state.chains[F.chain.id], drillAttempts: [...state.chains[F.chain.id].drillAttempts,extra] })
    assert.equal(stale,action === 'unrelated' ? 'accepted' : action === 'all' ? 'Error' : 'DeletedChainError')
    if (action === 'all') {
      assert.deepEqual(settled.results,{}); assert.deepEqual(settled.chains,{}); assert.deepEqual(settled.retiredChains,{}); assert.deepEqual(settled.exposures,{})
    } else if (action !== 'unrelated') {
      assert.deepEqual(settled.chains,{})
      assert.equal(settled.activeChainId,null)
      assert(settled.retiredChains[F.chain.id].drillAttempts.some(a=>a.id === extra.id))
      if (action === 'drill') assert(!settled.retiredChains[F.chain.id].drillAttempts.some(a=>a.id === F.drills.detection.id))
      if (action === 'retest') { assert(!settled.drafts[draft.sessionId]); assert.equal(settled.retiredChains[F.chain.id].retestAttempts.length,0) }
      if (action === 'baseline') assert(!settled.results[F.baseline.sessionId])
      if (action === 'completed-retest') { assert(!settled.results[F.retest.sessionId]); assert.equal(settled.retiredChains[F.chain.id].retestSessionId,null) }
      assert.equal(hash(settled.results[unrelated.sessionId]),hash(unrelated))
      assert.equal(hash(settled.exposures[unrelated.form.id]),hash(state.exposures[unrelated.form.id]))
      assert.deepEqual(settled,afterDelete)
    } else {
      assert(!settled.results[unrelated.sessionId]); assert(settled.chains[F.chain.id].drillAttempts.some(a=>a.id === extra.id))
    }
    await p.reload(); await ready()
    const resumed = await p.getByRole('button',{name:'Resume Stop training',exact:true}).count()
    assert.equal(resumed,action === 'unrelated' ? 1 : 0)
    await click('Stop history')
    const drillRows = await p.getByRole('button',{name:'Review drill attempt',exact:true}).count()
    assert.equal(drillRows,action === 'all' ? 0 : action === 'drill' ? 1 : 2)
    const afterReload = await read(); assert.deepEqual({...afterReload,installationId:null},{...settled,installationId:null})
    out.cases.push({ failure, action, order, before, memoryAfterDelete, writes:calls, staleStorageReplay:stale, activeAfterReload:resumed, drillRows,
      retainedAttemptIds: Object.values(settled.retiredChains).flatMap(c=>c.drillAttempts.map(a=>a.id)),
      deletedDraftAbsent:!settled.drafts[draft.sessionId], durableHash:hash(settled), reloadHash:hash(afterReload), unrelatedPreserved:action !== 'all' && action !== 'unrelated', pass:true })
  }
  assert.equal(out.errors.length,0)
  console.log(JSON.stringify({cases:out.cases.length,pass:true,errors:out.errors}))
} catch(e) { out.error=String(e.stack); console.error(e); process.exitCode=1 }
finally { await writeFile(new URL('deletion-races.json',import.meta.url),JSON.stringify(out,null,2)); await browser.close() }

// Await the evaluated predicate itself; an async browser callback must not be used as a truthy polling handle.
async function waitValue(page, predicate, arg) {
 const deadline=Date.now()+15000
 do { if(await page.evaluate(predicate,arg)) return; await page.waitForTimeout(25) } while(Date.now()<deadline)
 throw new Error('State predicate did not become true')
}
