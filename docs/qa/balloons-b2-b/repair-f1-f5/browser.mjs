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
const open=async(p,report=0)=>{await click(p,'Open Balloons');await click(p,'Balloons history');if(typeof report==='string')await p.locator('.balloons-history-item').filter({hasText:report}).getByRole('button',{name:'Open saved report',exact:true}).click();else await p.getByRole('button',{name:'Open saved report',exact:true}).nth(report).click();await click(p,'Open assigned exercise');await settled(p)}
const resume=async p=>{if(await p.getByRole('button',{name:'Resume saved exercise',exact:true}).count())await click(p,'Resume saved exercise')}
const init=async(file)=>{const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('http://127.0.0.1:4198');await p.evaluate(dbfn,{root:JSON.parse(await fs.readFile(audit+file)),write:true});await p.reload();await open(p);return {ctx,p}}
const save=async(name,p)=>{const r=await state(p);await fs.writeFile(out+name+'.json',JSON.stringify(r));await fs.writeFile(out+name+'.txt',await p.locator('main').innerText());return r}
const native=async(p,name,key='Enter')=>{const b=p.getByRole('button',{name,exact:true});await b.focus();await p.keyboard.press(key);await settled(p)}
const focused=p=>p.evaluate(()=>document.activeElement?.textContent)
const hold=async p=>p.evaluate(()=>{window.held=[];window.hit=0;const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(fn){d.set.call(this,function(e){if(this.mode==='readwrite'&&!window.hit){window.hit++;window.held.push(()=>fn.call(this,e));return}fn.call(this,e)})}})})
try{
 // Complete all seven fixed inventories with native Space/Enter, including all feedback boundaries.
 for(const kind of ['maintenance','outcome','information','updating','consistencyA','consistencyB','consistencyC']){
  const {ctx,p}=await init(`seed-BL1-${kind}.json`)
  while(await p.getByRole('button',{name:'Next example',exact:true}).count())await native(p,'Next example','Space')
  await native(p,'Start assigned exercise','Enter');assert.equal(await focused(p),'Pump')
  const announcements=[];let actions=0
  for(let round=1;round<=18;round++){
   assert.equal(await p.locator('.balloons-training .balloon').count(),1)
   assert.match(await p.locator('[data-balloon-type]').innerText(),/^Type [123]$/)
   const plan=[0,1,4,32,2,6][(round-1)%6]
   for(let pump=0;pump<plan&&await p.getByRole('button',{name:'Pump',exact:true}).count();pump++){await native(p,'Pump',pump%2?'Enter':'Space');actions++}
   if(await p.getByRole('button',{name:'Collect',exact:true}).count()){await native(p,'Collect',round%2?'Enter':'Space');actions++}
   assert.equal(await focused(p),round===18?'Balloons history':round%6===0?'Continue exercise':'Next balloon')
   announcements.push(await p.locator('.balloons-training .sr-only').innerText())
   assert.match(announcements.at(-1),/Type [123].*Current.*Banked total/)
   if(round<18){await native(p,round%6===0?'Continue exercise':'Next balloon',round%2?'Space':'Enter');assert.equal(await focused(p),'Pump')}
  }
  const r=await save(`inventory-${kind}`,p),a=attempt(r);assert.equal(a.snapshot.results.length,18);assert.equal(r.training.chains.chain.firstCompletedDrillId,a.header.attemptId)
  assert(a.journal.filter(e=>['pump','collect','next','start','demo_next'].includes(e.command?.kind)).every(e=>e.command.source==='keyboard'))
  const journal=a.journal;await p.reload();await open(p);assert.deepEqual(attempt(await state(p)).journal,journal)
  results.push({case:`inventory-${kind}`,rounds:18,actions,announcements});await ctx.close();console.log('PASS',kind)
 }
 // Delete every optional field too, using the actual candidate control.
 {const {ctx,p}=await init('maintenance-completed.json');await click(p,'Balloons history');await click(p,'Delete all Balloons data');const r=await save('delete-all',p)
 assert.deepEqual(Object.keys(r).sort(),['version','installationId','revision','generation','owner','records','tombstones'].sort());assert.deepEqual(r.records,{});assert.equal(r.owner,null);results.push({case:'delete-all',root:r});await ctx.close()}
 // A poll supplies no capability. Pause releases; stale observer cannot act; reload recovers paused.
 {const {ctx,p}=await init('active.json');await resume(p);const q=await ctx.newPage();await q.goto('http://127.0.0.1:4198');await open(q)
 assert.match(await q.locator('main').innerText(),/active in another tab/);assert.equal(await q.getByRole('button',{name:'Pump',exact:true}).count(),0)
 await p.waitForTimeout(1800);await native(p,'Pump','Space');const before=attempt(await state(p));await click(p,'Pause exercise')
 await click(q,'Reopen saved exercise');await resume(q);await native(q,'Pump','Enter');await p.waitForTimeout(1800)
 assert.equal(await p.getByRole('button',{name:'Pump',exact:true}).count(),0);assert.equal(attempt(await state(q)).snapshot.successfulPumps,before.snapshot.successfulPumps+1)
 const a=attempt(await state(q));await q.reload();await open(q);assert.equal(attempt(await state(q)).snapshot.phase,'paused');await resume(q);assert.equal(attempt(await state(q)).snapshot.currentCents,a.snapshot.currentCents)
 await save('ownership',q);results.push({case:'ownership',generation:(await state(q)).generation});await ctx.close()}
 // Lifecycle interruption before/after writes, then delivery of the old callback.
 for(const mode of ['blur','hidden','pending-blur','pending-hidden']){
  const {ctx,p}=await init('active.json');await resume(p)
  if(mode.startsWith('pending')){await hold(p);await p.getByRole('button',{name:'Pump',exact:true}).click();await p.waitForFunction(()=>window.hit===1)}
  await p.evaluate(hidden=>{if(hidden){Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))}else window.dispatchEvent(new Event('blur'))},mode.includes('hidden'))
  await p.getByRole('button',{name:'Resume saved exercise',exact:true}).waitFor();await settled(p)
  const paused=await state(p);assert.equal(attempt(paused).snapshot.phase,'paused');assert.equal(await p.getByRole('button',{name:'Pump',exact:true}).count(),0)
  if(mode.startsWith('pending')){await p.evaluate(()=>window.held.forEach(f=>f()));await p.waitForTimeout(100);assert.deepEqual(await state(p),paused)}
  await p.evaluate(()=>{delete document.visibilityState;window.dispatchEvent(new Event('focus'))});await native(p,'Resume saved exercise','Space');assert.equal(await focused(p),'Pump')
  assert.equal(attempt(await state(p)).snapshot.currentCents,attempt(paused).snapshot.currentCents);await native(p,'Collect','Enter');await save(mode,p);results.push({case:mode,pausedPumps:attempt(paused).snapshot.successfulPumps});await ctx.close()
 }
 // A held Enter must not activate the newly focused Next on repeat/release.
 {const {ctx,p}=await init('active.json');await resume(p);await p.getByRole('button',{name:'Collect',exact:true}).focus();await p.keyboard.down('Enter');await settled(p);assert.equal(await focused(p),'Next balloon');const r=await state(p);await p.keyboard.down('Enter');await p.keyboard.up('Enter');await p.waitForTimeout(100);assert.deepEqual(await state(p),r);await p.keyboard.press('Space');await settled(p);assert.equal(await focused(p),'Pump');results.push({case:'held-enter-focus-transfer'});await ctx.close()}
 // Familiar across baselines; current chain gets its own new attempt and empty completion slot.
 {const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('http://127.0.0.1:4198');await p.evaluate(dbfn,{root:JSON.parse(await fs.readFile(audit+'two-chain-seed.json')),write:true});await p.reload();await open(p,'BL2')
 assert.match(await p.locator('main').innerText(),/Familiar exercise/);const r=await save('familiar',p),a=attempt(r);assert.equal(a.header.recommendation.chainId,'chain2');assert.equal(a.header.familiar,true);assert.equal(r.training.chains.chain2.firstCompletedDrillId,null);results.push({case:'familiar',prior:a.header.priorAttemptIds});await ctx.close()}
}finally{await fs.writeFile(out+'browser-results.json',JSON.stringify({version:browser.version(),results},null,2));await browser.close()}
