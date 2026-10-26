import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { fixtures } from './fixtures.mjs'
const fixture = await fixtures()
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || '/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const out = { browser: browser.version(), errors: [], checks: {} }
page.on('pageerror', e => out.errors.push(String(e)))
const click = name => page.getByRole('button', { name, exact: true }).click()
async function db(fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const module = await import('/src/stop/storage.ts'), store = await module.StopLocalStore.open()
    try { return await new Function('store', 'module', 'arg', `return (${code})(store,module,arg)`)(store, module, arg) } finally { store.close() }
  }, { code: fn.toString(), arg })
}
const reload = async () => { await page.reload(); await page.getByRole('button', { name: 'Open Stop', exact: true }).waitFor() }
const seed = state => db((s,m,state) => s.mutate(current => Object.assign(current,state)), state)
try {
  await page.goto(process.env.M5_URL || 'http://127.0.0.1:5198/'); await page.getByRole('button', { name: 'Open Stop', exact: true }).waitFor()
  // B1: all allocators; ordinary invalid release, reload, deletion, and deletion after reuse.
  out.checks.inventory = []
  for (const draft of fixture.drafts) {
    const exposed = draft.realizedSequence.length > 0
    await db(async (s,m,d) => {
      await s.deleteAll()
      const claim = await s.reserve(d.sessionId,d.mode,0,d.mode === 'retest' ? Date.now()+1800000 : null)
      if (claim.formId !== d.form.id) throw Error('Unexpected form')
      await s.arm(d.sessionId,d.form.id,d.setup.visualProfile)
      await s.saveDraft(d)
    }, draft)
    await reload()
    const evidence = await db(async (s,m,d) => {
      const before = await s.read(), checked = m.inspectLocalState(before)
      const claims = []
      for (let i=0;i<(d.mode === 'replay' ? 6 : 4);i++) { const c = await s.reserve(`next-${i}`,d.mode,0); if(c) claims.push(c) }
      const reused = claims.find(c=>c.formId===d.form.id)
      if(reused) await s.arm(reused.sessionId,reused.formId,d.setup.visualProfile)
      const marker = (await s.read()).exposures[d.form.id]
      await s.deleteResult(d.sessionId)
      const after = await s.read()
      return { family:d.mode, exposed:d.realizedSequence.length>0, reviewable:checked.invalid.length,
        retainedSame:JSON.stringify(before.drafts[d.sessionId])===JSON.stringify(d), available:claims.length,
        released:!before.reservations[d.sessionId], markerBefore:before.exposures[d.form.id]?.certainty ?? null,
        deleted:!after.drafts[d.sessionId], reused:!!reused, reusedMarkerPreserved:!reused || JSON.stringify(marker)===JSON.stringify(after.exposures[d.form.id]) }
    },draft)
    assert.equal(evidence.available,(draft.mode==='replay'?6:4)-(exposed?1:0)); assert.equal(evidence.reused,!exposed)
    assert(evidence.reviewable===1 && evidence.retainedSame && evidence.released && evidence.deleted && evidence.reusedMarkerPreserved)
    out.checks.inventory.push(evidence)
  }
  // Deleting an unexposed draft with no new claim must not create a marker.
  await db(async(s,m,d)=>{await s.deleteAll();await s.saveDraft(d);await s.deleteResult(d.sessionId);if(Object.keys((await s.read()).exposures).length)throw Error('Deletion invented exposure')},fixture.drafts[0])
  out.checks.unexposedDeletion = true
  // B2/B3: mutations are seeded into real IndexedDB; reload must reject without changing stored evidence.
  out.checks.reloadMutations=[]
  for (const mutation of ['intact','visual','binding','keyboard','exposure identity','exposure profile','drill validity','severe tail','final fixation']) {
    const state=structuredClone(fixture.state), r=state.results[fixture.baseline.sessionId], a=state.chains[fixture.chain.id].drillAttempts[0]
    if(mutation==='visual')r.setup.visualProfile='shape_accommodation_v1'
    if(mutation==='binding')r.setup.binding={code:'KeyA',label:'A'}
    if(mutation==='keyboard')r.setup.physicalKeyboard=false
    if(mutation==='exposure identity')state.exposures[r.form.id].formId='stop-baseline-04'
    if(mutation==='exposure profile')state.exposures[r.form.id].visualProfile='shape_accommodation_v1'
    if(mutation==='drill validity')a.events.find(e=>e.type==='session_completed').payload.validity='invalid'
    if(mutation==='severe tail') {
      const i=a.events.length-2
      a.events.splice(i,0,{...a.events[i],type:'timing_anomaly',payload:{trialIndex:null,issues:['onset'],severity:'severe',expectedMs:0,observedMs:1000}})
      a.events.forEach((e,i)=>{e.sequenceNumber=i+1;if(e.type==='session_completed')e.payload.eventCount=i+1})
    }
    if(mutation==='final fixation'){const i=a.events.findLastIndex(e=>e.type==='trial_resolved');for(let j=i+1;j<a.events.length;j++)a.events[j].timestampMs=a.events[i].timestampMs}
    state.chains[fixture.chain.id].baseline=structuredClone(r)
    await seed(state); await reload()
    const check=await db(async(s,m,original)=>{const state=await s.read(),checked=m.inspectLocalState(state);return{valid:checked.valid.length,chain:!!checked.activeChain,unchanged:JSON.stringify(state)===JSON.stringify(original)}},state)
    assert(check.unchanged);assert.equal(check.chain,mutation==='intact')
    assert.equal(await page.getByRole('button',{name:'Resume Stop training',exact:true}).count(),mutation==='intact'?1:0)
    out.checks.reloadMutations.push({mutation,...check})
  }
  // A known-unexposed retest draft does not destroy the completed-drill chain on reload.
  const retestState=structuredClone(fixture.state), retestDraft=fixture.drafts.find(d=>d.mode==='retest'&&!d.realizedSequence.length)
  retestState.drafts[retestDraft.sessionId]=retestDraft
  retestState.chains[fixture.chain.id].retestAttempts=[{sessionId:retestDraft.sessionId,formId:retestDraft.form.id,valid:false}]
  await seed(retestState);await reload();await click('Resume Stop training');await click('Try a new Stop sequence');await page.getByRole('button',{name:'Start retest',exact:true}).waitFor()
  out.checks.preOnsetRetestChainReload=true
  // B4: same display label, different physical codes: two isolated series.
  const profileState=structuredClone(fixture.state);profileState.results={};profileState.exposures={};profileState.chains={};profileState.activeChainId=null
  for(const r of fixture.profiles){profileState.results[r.sessionId]=r;profileState.exposures[r.form.id]={formId:r.form.id,sessionId:r.sessionId,certainty:'confirmed',deleted:false,visualProfile:r.setup.visualProfile,exposedAtWall:r.completedAtWall}}
  await seed(profileState);await reload();await click('Stop history')
  const labels=await page.getByRole('img').evaluateAll(items=>items.map(e=>e.getAttribute('aria-label')))
  assert.deepEqual(labels,Array(2).fill('Overall accuracy across 1 compatible Stop session in this profile'))
  out.checks.bindingSeries=labels
  // N1: navigation is not a timed start. Retry creates a new actual attempt identity.
  const assigned=structuredClone(fixture.state);assigned.chains[fixture.chain.id].drillAttempts=[];assigned.chains[fixture.chain.id].status='assigned'
  await db(s=>s.deleteAll());await seed(assigned);await reload();await click('Resume Stop training');await click('Start assigned drill')
  assert.equal((await db(s=>s.activities())).filter(e=>e.type==='drill_started').length,0)
  await page.evaluate(()=>history.pushState({},'',location.href))
  await click('Start drill');await page.waitForTimeout(100);await page.goBack()
  await click('Restart drill');await click('Start assigned drill')
  await page.evaluate(()=>history.pushState({},'',location.href))
  await click('Start drill');await page.waitForTimeout(100);await page.goBack();await click('Restart drill')
  const starts=(await db(s=>s.activities())).filter(e=>e.type==='drill_started')
  assert.equal(starts.length,2);assert.notEqual(starts[0].sessionId,starts[1].sessionId)
  out.checks.actualDrillStarts={count:starts.length,distinct:true,introCount:0}
  // B5: injected chain-write rejection, visible failure, reload, and explicit retry recovery.
  for(const retry of [false,true]) {
    await seed(assigned);await reload();await click('Resume Stop training')
    const failure=await page.evaluate(async attempt=>{
      const st=await import('/src/stop/storage.ts'),tr=await import('/src/stop/training.ts'),store=st.stopLocalStore()
      const original=store.saveChain.bind(store);window.restoreChainWrite=()=>{store.saveChain=original}
      store.saveChain=async()=>{throw Error('Injected chain write failure')}
      tr.retainDrillAttempt(tr.currentTrainingChain().id,attempt)
      for(let i=0;i<50&&tr.trainingSaveStatus()!=='failed';i++)await new Promise(r=>setTimeout(r,10))
      return {status:tr.trainingSaveStatus(),memory:tr.currentTrainingChain().drillAttempts.length,disclosure:tr.storageDisclosure(),saved:(await store.read()).chains[tr.currentTrainingChain().id].drillAttempts.length}
    },fixture.chain.drillAttempts[0])
    assert.equal(failure.status,'failed');assert.equal(failure.memory,1);assert.equal(failure.saved,0);assert(failure.disclosure.includes('could not be saved'))
    await page.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
    assert((await page.locator('body').innerText()).includes('current training changes are temporary'))
    assert(!(await page.locator('body').innerText()).includes('Results and sequence-use records are saved'))
    if(retry){await page.evaluate(()=>window.restoreChainWrite());await click('Try saving training again');await page.waitForFunction(async()=>(await import('/src/stop/training.ts')).trainingSaveStatus()==='saved')}
    await reload()
    const restored=await db(async(s,m)=>m.inspectLocalState(await s.read()).activeChain)
    assert.equal(restored.drillAttempts.length,retry?1:0)
    assert.equal(restored.status,retry?'drill_complete':'assigned')
    out.checks[retry?'chainRetryReload':'chainFailureReload']={...failure,restoredStatus:restored.status,restoredAttempts:restored.drillAttempts.length}
  }
  assert.deepEqual(out.errors,[]);out.pass=true
} catch(e) {out.pass=false;out.failure=String(e);out.failurePage=await page.locator('body').innerText();throw e}
finally {await writeFile(new URL('./browser.json',import.meta.url),JSON.stringify(out,null,2));await browser.close()}
