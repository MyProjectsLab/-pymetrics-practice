// Independently authored developer regressions: real IndexedDB/two pages and UI navigation.
// Only initial journals and explicit write faults are synthetic.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-r1-r2-fixtures.json','utf8'))
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const out={browser:browser.version(),cases:[],errors:[]}, hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const click=(p,name)=>p.getByRole('button',{name,exact:true}).click(), ready=p=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
const api=(p,fn,arg)=>p.evaluate(async({code,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts');return new Function('S','T','s','x',`return (${code})(S,T,s,x)`)(S,T,S.stopLocalStore(),arg)},{code:fn.toString(),arg})
async function pages(state=F.state, notifications=true){
 const context=await browser.newContext({viewport:{width:1200,height:800}})
 if(!notifications)await context.addInitScript(()=>{window.BroadcastChannel=undefined})
 const a=await context.newPage(),b=await context.newPage()
 for(const p of[a,b])p.on('pageerror',e=>out.errors.push(String(e)))
 await a.goto('http://127.0.0.1:5227/');await ready(a)
 await api(a,async(S,T,s,x)=>{await s.deleteAll();await s.mutate(q=>Object.assign(q,x))},state)
 await a.reload();await ready(a);await b.goto('http://127.0.0.1:5227/');await ready(b)
 return {context,a,b}
}
async function remove(p,kind,id){
 await click(p,'Stop history')
 if(kind==='all'){await click(p,'Delete all Assessment Practice data');await click(p,'Delete all local data')}
 else{
  const row=kind==='drill'?p.locator('article').filter({has:p.getByRole('button',{name:'Review drill attempt',exact:true})}).first():
   kind==='draft'?p.locator('article').filter({has:p.getByRole('button',{name:'Review attempt',exact:true})}):p.locator('article').filter({hasText:id ?? F.baseline.form.id})
  await row.getByRole('button',{name:'Delete this result',exact:true}).click()
  await p.getByRole('alertdialog').getByRole('button',{name:'Delete this result',exact:true}).click()
 }
 await p.getByRole('alertdialog').waitFor({state:'detached'})
}
async function fault(p,kind){
 await api(p,(S,T,s,kind)=>{
  window.realActive=s.saveChain.bind(s);window.realRetired=s.saveRetiredChain.bind(s)
  window.failActive=kind==='failed';window.failRetired=true;window.finishWrite=null
  let first=true
  s.saveChain=async(...args)=>{
   if(first&&kind!=='failed'){first=false;await new Promise(resolve=>window.finishWrite=resolve);if(kind==='delayed-reject')throw Error('injected late rejection')}
   if(window.failActive)throw Error('injected active write rejection')
   return window.realActive(...args)
  }
  s.saveRetiredChain=async(...args)=>{if(window.failRetired)throw Error('injected retired-history rejection');return window.realRetired(...args)}
 },kind)
}
async function recover(p){await api(p,async(S,T,s)=>{window.failActive=false;window.failRetired=false;window.finishWrite?.();await T.retryTrainingSave()});await waitValue(p,async()=> (await import('/src/stop/training.ts')).trainingSaveStatus()==='saved')}
try{
 for(const kind of process.env.ONLY_ONSET?[]:['baseline','drill'])for(const condition of ['failed','delayed','delayed-reject']){
  const state=structuredClone(F.state)
  if(kind==='baseline'){state.chains[F.chain.id].drillAttempts=[];state.chains[F.chain.id].status='assigned'}
  const {context,a,b}=await pages(state)
  await fault(a,condition)
  if(kind==='baseline'){
   // Native application path creates the previously lost five-event invalid attempt.
   await click(a,'Resume Stop training');await click(a,'Start assigned drill');await a.evaluate(()=>history.pushState({},'',location.href));await click(a,'Start drill')
   await a.locator('[aria-label="Timed Stop drill"]:visible').waitFor();await a.goBack();await click(a,'Restart drill')
  }else{
   const attempt=structuredClone(F.drills.detection);attempt.id=crypto.randomUUID();attempt.events.forEach(e=>e.sessionId=attempt.id)
   await api(a,(S,T,s,x)=>T.retainDrillAttempt(T.currentTrainingChain().id,x),attempt)
  }
  const before=await api(a,(S,T)=>T.currentTrainingChain().drillAttempts.at(-1)), journal=hash(before)
  if(condition==='failed')await a.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
  await remove(b,kind)
  await waitValue(a,async()=>!(await import('/src/stop/training.ts')).currentTrainingChain())
  await api(a,(S,T)=>{window.finishWrite?.();return T.retryTrainingSave()})
  await a.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
  const buffered=await api(a,(S,T)=>({status:T.trainingSaveStatus(),attempts:T.retainedTrainingAttempts()}))
  assert.equal(buffered.status,'failed');assert.equal(hash(buffered.attempts.find(x=>x.id===before.id)),journal)
  await click(a,'Stop history');await a.getByText('Not yet saved. Keep this tab open to review this attempt.',{exact:true}).waitFor()
  await click(a,'Review drill attempt');await a.getByText('Review event journal',{exact:true}).click()
  assert.equal(await a.locator('ol li').count(),before.events.length)
  const durableBefore=await api(a,async(S,T,s)=>s.read());assert(!JSON.stringify(durableBefore.retiredChains).includes(before.id))
  // A third tab reloads only durable history while the original retains failed work.
  const c=await context.newPage();await c.goto('http://127.0.0.1:5227/');await ready(c)
  assert.equal(await c.getByRole('button',{name:'Resume Stop training',exact:true}).count(),0)
  await recover(a)
  const saved=await api(a,async(S,T,s)=>s.read()),retired=saved.retiredChains[F.chain.id]
  assert.equal(hash(retired.drillAttempts.find(x=>x.id===before.id)),journal)
  assert(!saved.chains[F.chain.id]);if(kind==='drill')assert(!retired.drillAttempts.some(x=>x.id===F.drills.detection.id))
  await a.reload();await ready(a);await click(a,'Stop history');await click(a,'Review drill attempt')
  await a.getByText('Review event journal',{exact:true}).click();assert.equal(await a.locator('ol li').count(),before.events.length)
  out.cases.push({finding:'F1',kind,condition,events:before.events.length,journalHash:journal,failedMemoryReview:true,reloadBeforeSaveAbsent:true,retryAndReloadPreserved:true})
  await context.close()
 }
 for(const kind of process.env.ONLY_ONSET?[]:['draft','all','unrelated'])for(const linked of kind==='draft'?[false,true]:[false]){
  const state=structuredClone(F.state),unrelated=F.profiles[1]
  if(kind==='unrelated'){state.results[unrelated.sessionId]=unrelated;state.exposures[unrelated.form.id]={formId:unrelated.form.id,sessionId:unrelated.sessionId,visualProfile:unrelated.setup.visualProfile,certainty:'confirmed',deleted:false,exposedAtWall:unrelated.completedAtWall}}
  const {context,a,b}=await pages(state);await fault(a,'failed')
  const draft=F.drafts.find(x=>x.mode==='retest'&&!x.realizedSequence.length)
  await api(a,async(S,T,s,{draft,kind,linked})=>{
   if(kind==='draft'){await s.saveDraft(draft,linked?T.currentTrainingChain().id:undefined);T.updateTrainingChain({retestAttempts:[{sessionId:draft.sessionId,formId:draft.form.id,valid:false}]})}
   else T.updateTrainingChain({status:'drill_complete'})
  },{draft,kind,linked})
  await a.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
  await remove(b,kind,unrelated.form.id)
  if(kind==='unrelated'){
   assert(await api(a,(S,T)=>!!T.currentTrainingChain()));await recover(a)
   assert((await api(a,async(S,T,s)=>s.read())).chains[F.chain.id])
  }else{
   await waitValue(a,async()=>!(await import('/src/stop/training.ts')).currentTrainingChain())
   assert.equal(await a.getByRole('button',{name:'Resume Stop training',exact:true}).count(),0)
   const reservation=await api(a,async(S,T,s,chain)=>{try{await s.reserve('forbidden','retest',0,Date.now()+1800000,chain.id,chain);return 'accepted'}catch(e){return e.constructor.name}}, {...state.chains[F.chain.id],...(kind==='draft'?{retestAttempts:[{sessionId:draft.sessionId,formId:draft.form.id,valid:false}]}:{})})
   assert.notEqual(reservation,'accepted')
   if(kind==='draft')await recover(a)
   else await api(a,async(S,T)=>{window.failActive=false;window.failRetired=false;await T.retryTrainingSave()})
   const after=await api(b,async(S,T,s)=>s.read());assert(!after.reservations.forbidden);assert(!after.exposures[draft.form.id]);assert(!SENTINEL(after.drafts,draft.sessionId))
   await b.reload();await ready(b);assert.equal(await b.getByRole('button',{name:'Resume Stop training',exact:true}).count(),0)
   const claim=await api(b,async(S,T,s)=>{const q=await s.reserve('availability','retest',0,Date.now()+1e5,'deleted-chain');return q}).catch(()=>null)
   assert.equal(claim,null)
  }
  out.cases.push({finding:'F2',kind,linked,staleRetestBlocked:kind!=='unrelated',unrelatedSaved:kind==='unrelated'})
  await context.close()
 }
 for(const kind of process.env.ONLY_ONSET?[]:['drill','all'])for(const boundary of ['reservation','arm']){
  const {context,a,b}=await pages(F.state,false)
  let claim=null
  if(boundary==='arm')claim=await api(a,(S,T,s)=>s.reserve('pre-arm','retest',0,Date.now()+1800000,T.currentTrainingChain().id,T.currentTrainingChain()))
  await remove(b,kind)
  const rejected=await api(a,async(S,T,s,{boundary,claim})=>{try{
   if(boundary==='reservation')await s.reserve('blocked','retest',0,Date.now()+1800000,T.currentTrainingChain().id,T.currentTrainingChain())
   else await s.arm(claim.sessionId,claim.formId,'standard')
   return false
  }catch{return true}},{boundary,claim})
  assert(rejected)
  // The stale visible Resume control also rechecks before opening any retest route.
  await click(a,'Resume Stop training');await waitValue(a,async()=>!(await import('/src/stop/training.ts')).currentTrainingChain())
  assert.equal(await a.getByRole('button',{name:'Start retest',exact:true}).count(),0)
  const state=await api(b,async(S,T,s)=>s.read());assert.equal(Object.keys(state.reservations).length,0)
  if(claim)assert(!state.exposures[claim.formId])
  out.cases.push({finding:'F2',kind,boundary,notificationsDisabled:true,rejected,knownUnexposed:true})
  await context.close()
 }
 for(const kind of ['drill','all']){
  const {context,a,b}=await pages()
  await click(a,'Resume Stop training');await click(a,'Try a new Stop sequence');await click(a,'Start retest')
  await click(a,'See the rule');await click(a,'Try examples')
  for(let i=0;i<4;i++){if(i%2===0)await a.keyboard.press('Space');await click(a,'Check example');await click(a,i===3?'Check my understanding':'Next example')}
  for(const[q,r]of[['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']])await a.getByRole('group',{name:q,exact:true}).getByLabel(r,{exact:true}).check()
  await click(a,'Check answers');await click(a,'Check your setup');await a.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check()
  await click(a,'Run input check');await a.keyboard.press('Space');await click(a,'Continue to readiness');await click(a,'I’m ready')
  await a.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000})
  await click(b,'Stop history')
  if(kind==='all')await click(b,'Delete all Assessment Practice data')
  else await b.locator('article').filter({has:b.getByRole('button',{name:'Review drill attempt',exact:true})}).getByRole('button',{name:'Delete this result',exact:true}).click()
  await click(a,'Start scored task')
  await waitValue(a,async()=>Object.values(await (await import('/src/stop/storage.ts')).stopLocalStore().read()).length>0)
  const claim=await api(a,async(S,T,s)=>Object.values((await s.read()).reservations).find(r=>r.family==='retest'))
  assert(claim?.armed)
  await b.getByRole('alertdialog').getByRole('button',{name:kind==='all'?'Delete all local data':'Delete this result',exact:true}).click()
  await waitValue(a,async()=>!(await import('/src/stop/training.ts')).currentTrainingChain())
  await waitValue(a,async id=> (await import('/src/stop/run.ts')).developmentDrafts().some(d=>d.sessionId===id),claim.sessionId)
  const drafts=await a.evaluate(async()=> (await import('/src/stop/run.ts')).developmentDrafts()),draft=drafts.find(d=>d.sessionId===claim.sessionId)
  if(!draft)out.diagnostic={claim,drafts:drafts.map(d=>({id:d.sessionId,mode:d.mode,events:d.events.length,form:d.form?.id})),state:await api(b,async(S,T,s)=>s.read())}
  assert(draft);assert.deepEqual(draft.realizedSequence,[])
  await b.getByRole('alertdialog').waitFor({state:'detached'})
  // Poll for the asynchronous invalid draft/release writes, not elapsed-time assumptions.
  if(kind==='drill')await waitValue(b,async id=>!!(await (await import('/src/stop/storage.ts')).stopLocalStore().read()).drafts[id],claim.sessionId)
  const saved=await api(b,async(S,T,s)=>s.read());assert(!saved.exposures[claim.formId]);assert(!saved.reservations[claim.sessionId]);assert(!saved.chains[F.chain.id])
  if(kind==='all')assert.deepEqual(saved.drafts,{})
  out.cases.push({finding:'F2',kind,boundary:'actual scored initial fixation',events:draft.events.length,scoredOnsets:0,markerAbsent:true})
  await context.close()
 }
 assert.deepEqual(out.errors,[])
}catch(e){out.error=String(e.stack);process.exitCode=1;console.error(e)}finally{await writeFile(new URL('cross-tab.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out));await browser.close()}
function SENTINEL(records,id){return Object.hasOwn(records,id)}

// Await the evaluated predicate itself; an async browser callback must not be used as a truthy polling handle.
async function waitValue(page, predicate, arg) {
 const deadline=Date.now()+15000
 do { if(await page.evaluate(predicate,arg)) return; await page.waitForTimeout(25) } while(Date.now()<deadline)
 throw new Error('State predicate did not become true')
}
