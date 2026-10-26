import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.BALLOONS_REPAIR_OUT || '/private/tmp/balloons-b1b-repair/post';
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const results=[];
const url='http://127.0.0.1:4197';
const btn=(p,n)=>p.getByRole('button',{name:n,exact:true});
async function enabled(p,n){await p.waitForFunction(n=>[...document.querySelectorAll('button')].some(b=>b.textContent===n&&!b.disabled),n,{polling:10});}
async function click(p,n){await btn(p,n).click();}
async function read(p){return p.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('assessment-practice-balloons-v1');q.onsuccess=()=>r(q.result);q.onerror=j});return new Promise((r,j)=>{const q=db.transaction('installation').objectStore('installation').get('root');q.onsuccess=()=>{db.close();r(q.result)};q.onerror=j;});});}
async function cur(p){return Object.values((await read(p)).records).at(-1);}
async function prep(p,open=true){if(open){await p.goto(url);await click(p,'Open Balloons');}for(const n of ['Try the worked example','Pump example','Pump example','Collect example','Check my understanding'])await click(p,n);await p.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked',{exact:true}).check();await p.getByLabel('no, earlier outcomes do not reveal the next exact burst pump',{exact:true}).check();for(const n of ['Submit answers','Check input and accessibility','Test Pump','Test Collect','Continue to readiness'])await click(p,n);}
async function hook(ctx,noBC=false){await ctx.addInitScript(({noBC})=>{
 if(noBC==='absent')Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true});
 const a=window.audit={hold:null,held:[],fail:[],failRead:false,readDelay:0,writes:[],dom:[],keys:[],holdReads:0,readHeld:[]};
 a.bcHeld=[]; if(noBC==='delayed'){const b=Object.getOwnPropertyDescriptor(BroadcastChannel.prototype,'onmessage');Object.defineProperty(BroadcastChannel.prototype,'onmessage',{...b,set(f){b.set.call(this,e=>a.bcHeld.push(()=>f?.call(this,e)));}});}
 const kinds=new WeakMap(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,k){if(this.transaction.db.name==='assessment-practice-balloons-v1'&&v?.records){const r=Object.values(v.records).at(-1),kind=r?.journal.at(-1)?.command?.kind??'assignment';kinds.set(this.transaction,kind);a.writes.push({kind,record:r,at:performance.now(),mounted:!!document.querySelector('.balloons-play')});if(a.fail.includes(kind))throw new DOMException('Independent injected put failure','QuotaExceededError');}return put.call(this,v,k);};
 const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(f){d.set.call(this,e=>{if(this.db.name==='assessment-practice-balloons-v1'){const deliver=()=>f?.call(this,e);if(a.hold&&a.hold===kinds.get(this)){a.hold=null;a.held.push(deliver);return;}if(this.mode==='readonly'&&a.failRead){this.onabort?.call(this,e);return;}if(this.mode==='readonly'&&a.holdReads>0){a.holdReads--;a.readHeld.push(deliver);return;}if(this.mode==='readonly'&&a.readDelay){setTimeout(deliver,a.readDelay);return;}}f?.call(this,e);});}});
 for(const t of ['keydown','keyup','click'])document.addEventListener(t,e=>a.keys.push({type:e.type,key:e.key,code:e.code,repeat:e.repeat,detail:e.detail,target:e.target?.textContent?.slice(0,50),at:performance.now()}),true);
 new MutationObserver(()=>{const play=document.querySelector('.balloons-play'),report=document.querySelector('.balloons-report');a.dom.push({at:performance.now(),play:!!play,report:!!report,heading:document.querySelector('h1')?.textContent,status:[...document.querySelectorAll('[role="status"],[role="alert"]')].map(x=>x.textContent),phase:a.writes.at(-1)?.record?.snapshot.phase});}).observe(document,{subtree:true,childList:true});
},{noBC});}
async function scenario(name,work,noBC=false){const ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});await hook(ctx,noBC);const p=await ctx.newPage();try{const evidence=await work(p,ctx);results.push({name,...evidence});await fs.writeFile(`${out}/${name}.json`,JSON.stringify({evidence,root:await read(p),trace:await p.evaluate(()=>({writes:window.audit.writes.map(w=>({kind:w.kind,at:w.at,mounted:w.mounted,phase:w.record?.snapshot.phase,exposure:w.record?.snapshot.exposure})),dom:window.audit.dom,keys:window.audit.keys}))},null,2));await p.screenshot({path:`${out}/${name}.png`,fullPage:true});console.log(name,JSON.stringify(evidence));}catch(e){results.push({name,harnessError:e.stack});console.error(name,e);await p.screenshot({path:`${out}/${name}-error.png`,fullPage:true});}finally{await ctx.close();await fs.writeFile(out+'/r1-results.json',JSON.stringify(results,null,2));}}


try {
for(const fault of ['action-zero','action','action_pending','action-unavailable','action-held-read','failed-intent-cleanup','failed-action-cleanup']) await scenario('r1-'+fault, async p=>{
 await prep(p);await click(p,'Start Balloons practice');await enabled(p,'Pump');
 for(let round=1;round<39;round++){await click(p,'Collect');await enabled(p,'Next balloon');await click(p,'Next balloon');await enabled(p,'Pump')}
 const cents=fault==='action-zero'?0:5;
 if(cents){await click(p,'Pump');await enabled(p,'Pump');}const before=await read(p),id=Object.keys(before.records)[0],prefix=before.records[id];
 assert.equal(prefix.snapshot.core.results.length,38);assert.equal(prefix.snapshot.core.current.currentCents,cents);
 await p.evaluate(fault=>{
  window.audit.dom=[];
  if(fault.startsWith('failed'))window.audit.fail=[fault==='failed-intent-cleanup'?'action_pending':'action','pause'];
  else window.audit.hold=fault==='action_pending'?'action_pending':'action';
 },fault);
 await click(p,'Collect');
 if(!fault.startsWith('failed'))await p.waitForFunction(()=>window.audit.held.length===1);
 const committed=await read(p);
 if(fault==='action-unavailable')await p.evaluate(()=>window.audit.failRead=true);
 if(fault==='action-held-read')await p.evaluate(()=>window.audit.holdReads=1);
 const complete=fault.startsWith('action')&&fault!=='action_pending';
 const uncertain=fault.includes('unavailable')||fault.includes('held-read')||fault.startsWith('failed');
 if(uncertain){
  await p.getByRole('alert').filter({hasText:'Save status needs checking'}).waitFor();
  await p.waitForTimeout(fault==='action-held-read'?2200:200);
 }else if(complete)await p.getByRole('status').filter({hasText:'Saved completion verified'}).waitFor();
 else await p.getByRole('alert').filter({hasText:'not eligible as a durable baseline'}).waitFor();
 const boundaryText=await p.locator('main').innerText(), boundary=await read(p);
 assert.deepEqual(boundary.records[id].header,prefix.header);
 assert.deepEqual(boundary.records[id].journal.slice(0,prefix.journal.length),prefix.journal);
 if(uncertain){assert(!boundaryText.includes('not eligible'));assert(!boundaryText.includes('Saved completion'));assert(boundaryText.includes('Save status needs checking'));}
 if(complete){assert.deepEqual(boundary,committed);assert.equal(committed.records[id].snapshot.core.bankedCents,cents);assert.equal(committed.records[id].snapshot.phase,'completed');}
 else {assert.deepEqual(boundary.records[id].snapshot.core,prefix.snapshot.core);if(fault==='failed-intent-cleanup')assert.deepEqual(boundary,before);if(fault==='action_pending')assert.equal(boundary.records[id].snapshot.comparisonEligible,false);}
 assert.equal(await p.locator('.balloons-play').count(),0);
 const locks=await p.evaluate(()=>navigator.locks.query());assert(!locks.held.some(l=>l.name.startsWith('assessment-practice-balloons-v1')));
 if(complete&&uncertain){await p.evaluate(()=>window.audit.failRead=false);await click(p,'Check save status');await p.getByRole('status').filter({hasText:'Saved completion verified'}).waitFor();assert.deepEqual(await read(p),committed);}
 if(complete){await p.waitForTimeout(2400);await p.getByRole('status').filter({hasText:'Saved completion verified'}).waitFor();assert.deepEqual(await read(p),committed);}
 const preLate=await read(p),preLateText=await p.locator('main').innerText();
 await p.evaluate(()=>{for(const f of window.audit.held.splice(0))f();for(const f of window.audit.readHeld.splice(0))f()});await p.waitForTimeout(150);
 assert.deepEqual(await read(p),preLate);assert.equal(await p.locator('main').innerText(),preLateText);
 const trace=await p.evaluate(()=>window.audit.dom);
 if(complete)assert(!trace.some(t=>t.status.some(s=>s.includes('not eligible'))));
 await fs.writeFile(out+'/r1-'+fault+'-boundaries.json',JSON.stringify({before,committed,boundary,boundaryText,locks,preLate,preLateText,trace},null,2));
 await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');
 await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>['Resume saved session','Open saved report'].includes(b.textContent)));
 if(complete){await click(p,'Open saved report');}
 else {
  await click(p,'Resume saved session');await enabled(p,'Pump');const recovered=await cur(p);
  assert.deepEqual(recovered.snapshot.core,prefix.snapshot.core);assert.equal(recovered.snapshot.comparisonEligible,false);
  await click(p,'Collect');await enabled(p,'View report');await click(p,'View report');
 }
 await p.locator('.balloons-report').waitFor();const report=await p.locator('.balloons-report').innerText(),result=await cur(p);
 assert.equal(result.header.identity.sessionId,id);assert.equal(result.snapshot.core.bankedCents,cents);assert.equal(result.snapshot.core.results.length,39);
 assert.equal(report.includes('Saved standalone baseline'),complete);assert.equal(report.includes('Review only; not eligible as a baseline'),!complete);
 if(complete){assert.deepEqual(result.snapshot,committed.records[id].snapshot);assert.deepEqual(result.journal.slice(0,committed.records[id].journal.length),committed.records[id].journal);assert.equal(result.journal.length,committed.records[id].journal.length+1);}
 return {pass:true,boundaryText,report,committedRounds:committed.records[id].snapshot.core.results.length,eligible:result.snapshot.comparisonEligible,banked:result.snapshot.core.bankedCents,lateCallbacksUnchanged:true,locksReleased:true};
},'absent');
} finally {await browser.close()}
if(results.some(r=>r.harnessError||!r.pass))process.exitCode=1;
