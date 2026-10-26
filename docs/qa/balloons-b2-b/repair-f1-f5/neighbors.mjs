import {createRequire} from 'node:module'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const audit='/private/tmp/balloons-b2b-audit-0273e9a/audit/', out='/private/tmp/balloons-b2b-repair/'
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=[]
const dbfn=async({root,write=false}={})=>{const q=indexedDB.open('assessment-practice-balloons-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('installation');const db=await new Promise((r,j)=>{q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return await new Promise((r,j)=>{const tx=db.transaction('installation',write?'readwrite':'readonly');const req=write?tx.objectStore('installation').put(root,'root'):tx.objectStore('installation').get('root');tx.oncomplete=()=>{db.close();r(write?null:req.result)};tx.onabort=()=>j(tx.error)})}
const state=p=>p.evaluate(dbfn), attempt=r=>Object.values(r.training.attempts).at(-1)
const settled=async p=>p.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=status]')).some(e=>['Checking saved training…','Checking saved history…'].includes(e.textContent)))
const click=async(p,name)=>{await p.getByRole('button',{name,exact:true}).click();await settled(p)}
const open=async(p,report=0)=>{await click(p,'Open Balloons');await click(p,'Balloons history');await p.getByRole('button',{name:'Open saved report',exact:true}).nth(report).click();await click(p,'Open assigned exercise');await settled(p)}
const resume=async p=>{if(await p.getByRole('button',{name:'Resume saved exercise',exact:true}).count())await click(p,'Resume saved exercise')}
const init=async(file)=>{const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('http://127.0.0.1:4198');await p.evaluate(dbfn,{root:JSON.parse(await fs.readFile(audit+file)),write:true});await p.reload();await open(p);return {ctx,p}}
const save=async(name,p)=>{const r=await state(p);await fs.writeFile(out+name+'.json',JSON.stringify(r));await fs.writeFile(out+name+'.txt',await p.locator('main').innerText());return r}
const native=async(p,name,key='Enter')=>{const b=p.getByRole('button',{name,exact:true});await b.focus();await p.keyboard.press(key);await settled(p)}
const hold=async p=>p.evaluate(()=>{window.held=[];window.hit=0;const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(fn){d.set.call(this,function(e){if(this.mode==='readwrite'&&!window.hit){window.hit++;window.held.push(()=>fn.call(this,e));return}fn.call(this,e)})}})})
try {
 for(const phase of ['demo','ready','resolved','feedback','completed']) {
  const {ctx,p}=await init(phase==='demo'?'seed-BL1-outcome.json':phase==='completed'?'maintenance-completed.json':'seed-BL1-maintenance.json')
  if(['resolved','feedback'].includes(phase)) {await native(p,'Start assigned exercise');const count=phase==='feedback'?6:1;for(let n=0;n<count;n++){await native(p,'Collect');if(n<count-1)await native(p,'Next balloon','Space')}}
  const before=attempt(await state(p));assert.equal(before.snapshot.phase,phase)
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await settled(p)
  if(phase==='completed'){assert.deepEqual(attempt(await state(p)),before)}else{
   await p.getByRole('button',{name:'Resume saved exercise',exact:true}).waitFor();const paused=attempt(await state(p));assert.equal(paused.snapshot.phase,'paused');assert.equal(paused.snapshot.resumePhase,phase)
   await native(p,'Resume saved exercise','Space');assert.equal(attempt(await state(p)).snapshot.phase,phase);assert.deepEqual(attempt(await state(p)).snapshot.results,before.snapshot.results)
  }
  await save('phase-'+phase,p);results.push({case:'lifecycle-'+phase});await ctx.close()
 }
 // Standard versus verbose successful-pump announcements.
 for(const verbose of [false,true]) {
  const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('http://127.0.0.1:4198');const seed=JSON.parse(await fs.readFile(audit+'seed-BL1-maintenance.json'));seed.records.baseline.header.settings.verbose=verbose
  await p.evaluate(dbfn,{root:seed,write:true});await p.reload();await open(p);await native(p,'Start assigned exercise');const before=await p.locator('.balloons-training .sr-only').innerText();await native(p,'Pump','Space');const after=await p.locator('.balloons-training .sr-only').innerText()
  if(verbose)assert.match(after,/Current 5 cents/);else assert.equal(after,before)
  results.push({case:'announcements',verbose,before,after});await ctx.close()
 }
 // Held Space across blur, pointer Resume and key release must not pump.
 {const {ctx,p}=await init('active.json');await resume(p);await p.getByRole('button',{name:'Pump',exact:true}).focus();await p.keyboard.down('Space');await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.getByRole('button',{name:'Resume saved exercise',exact:true}).waitFor();await click(p,'Resume saved exercise');const before=attempt(await state(p));await p.keyboard.up('Space');await p.waitForTimeout(100);assert.deepEqual(attempt(await state(p)),before);await native(p,'Pump','Space');assert.equal(attempt(await state(p)).snapshot.successfulPumps,before.snapshot.successfulPumps+1);results.push({case:'held-space-blur-fresh-press'});await ctx.close()}
 // Interruption during committed-but-undelivered transitions in adjacent phases.
 for(const action of ['start','demo_next','collect','next','final']) {
  const {ctx,p}=await init(action==='demo_next'?'seed-BL1-outcome.json':action==='start'?'seed-BL1-maintenance.json':action==='final'?'before-final.json':'active.json');await resume(p)
  if(action==='next')await native(p,'Collect')
  await hold(p);await p.getByRole('button',{name:action==='start'?'Start assigned exercise':action==='demo_next'?'Next example':action==='next'?'Next balloon':'Collect',exact:true}).click();await p.waitForFunction(()=>window.hit===1)
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await settled(p)
  if(action!=='final')await p.getByRole('button',{name:'Resume saved exercise',exact:true}).waitFor()
  else await p.getByText('First valid completion saved; retest eligibility is locked to this chain.',{exact:false}).waitFor()
  const r=await state(p);assert.equal(attempt(r).snapshot.phase,action==='final'?'completed':'paused');await p.evaluate(()=>window.held.forEach(f=>f()));await p.waitForTimeout(100);assert.deepEqual(await state(p),r);results.push({case:'interrupted-pending-transition',action,phase:attempt(r).snapshot.phase,round:attempt(r).snapshot.round});await ctx.close()
 }
 // Owner loss with a fresh snapshot must reject, including late callbacks.
 {const {ctx,p}=await init('active.json');await resume(p);await hold(p);await p.getByRole('button',{name:'Pump',exact:true}).click();await p.waitForFunction(()=>window.hit===1)
 const r=await state(p);r.generation++;r.owner={id:'injected-new-owner',generation:r.generation,sessionId:r.owner.sessionId};await p.evaluate(dbfn,{root:r,write:true});await p.evaluate(()=>window.held.forEach(f=>f()));await p.waitForTimeout(2200)
 assert.equal(await p.getByRole('button',{name:'Pump',exact:true}).count(),0);assert.deepEqual(await state(p),r);await save('owner-loss',p);results.push({case:'injected-owner-loss-pending-callback'});await ctx.close()}
 // Abort the actual action transaction: no action saved; recovery durably pauses.
 {const {ctx,p}=await init('active.json');await resume(p);const before=attempt(await state(p));await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;let once=true;IDBObjectStore.prototype.put=function(v,k){if(once&&v?.training){once=false;this.transaction.abort();throw Error('injected abort')}return put.call(this,v,k)}})
 await p.getByRole('button',{name:'Pump',exact:true}).click();await p.getByRole('button',{name:'Resume saved exercise',exact:true}).waitFor();const a=attempt(await state(p));assert.equal(a.snapshot.successfulPumps,before.snapshot.successfulPumps);assert.equal(a.snapshot.phase,'paused');await resume(p);await native(p,'Pump','Space');assert.equal(attempt(await state(p)).snapshot.successfulPumps,before.snapshot.successfulPumps+1);results.push({case:'action-abort-pauses'});await ctx.close()}
 for(const boundary of ['assignment','final','post-verify'])for(const operation of ['delete','replace']){
  const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('http://127.0.0.1:4198');await p.evaluate(dbfn,{root:JSON.parse(await fs.readFile(audit+(boundary==='assignment'?'seed-BL1-maintenance.json':'before-final.json'))),write:true});await p.reload()
  if(boundary==='assignment'){await click(p,'Open Balloons');await click(p,'Balloons history');await click(p,'Open saved report');await p.getByRole('button',{name:'Open assigned exercise',exact:true}).waitFor();await hold(p);await p.getByRole('button',{name:'Open assigned exercise',exact:true}).click()}
  else {await open(p);await resume(p);if(boundary==='final')await hold(p);else await p.evaluate(()=>{window.hit=0;window.held=[];let armed=false,reads=0;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(v?.training)armed=true;return put.call(this,v,k)};const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(fn){d.set.call(this,function(e){if(armed&&this.mode==='readonly'&&++reads===2){window.hit++;window.held.push(()=>fn.call(this,e));return}fn.call(this,e)})}})});await p.getByRole('button',{name:'Collect',exact:true}).click()}
  await p.waitForFunction(()=>window.hit===1);const q=await ctx.newPage();await q.goto('http://127.0.0.1:4198');await click(q,'Open Balloons');await click(q,'Balloons history');await click(q,operation==='delete'?'Delete this result':'Delete all Balloons data');const deleted=await state(q)
  await p.waitForTimeout(2200);await p.evaluate(()=>window.held.forEach(f=>f()));await p.waitForTimeout(100);assert.deepEqual(await state(p),deleted);assert(!(await p.locator('main').innerText()).includes('First valid completion saved'));if(operation==='replace')assert.equal(deleted.training,undefined)
  await save(`race-${boundary}-${operation}`,p);results.push({case:'deletion-race',boundary,operation});await ctx.close();console.log('PASS',boundary,operation)
 }
 // A genuinely committed final action with missing delivery still grants exactly one lock.
 {const {ctx,p}=await init('before-final.json');await resume(p);await hold(p);await p.getByRole('button',{name:'Collect',exact:true}).click();await p.getByText('Saved drill state verified after an interrupted save.').waitFor();const r=await state(p);assert.equal(attempt(r).snapshot.results.length,18);assert.equal(r.training.chains.chain.firstCompletedDrillId,attempt(r).header.attemptId);assert.match(await p.locator('main').innerText(),/First valid completion saved/);await p.evaluate(()=>window.held.forEach(f=>f()));await p.waitForTimeout(100);assert.deepEqual(await state(p),r);results.push({case:'lost-final-callback-lock'});await ctx.close()}
} finally {await fs.writeFile(out+'neighbor-results.json',JSON.stringify({version:browser.version(),results},null,2));await browser.close()}
