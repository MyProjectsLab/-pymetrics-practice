import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.BALLOONS_REPAIR_OUT || '/private/tmp/balloons-b1b-repair/post';
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const results=[];
const url='http://127.0.0.1:4191';
const btn=(p,n)=>p.getByRole('button',{name:n,exact:true});
async function enabled(p,n){await p.waitForFunction(n=>[...document.querySelectorAll('button')].some(b=>b.textContent===n&&!b.disabled),n,{polling:10});}
async function click(p,n){await btn(p,n).click();}
async function read(p){return p.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('assessment-practice-balloons-v1');q.onsuccess=()=>r(q.result);q.onerror=j});return new Promise((r,j)=>{const q=db.transaction('installation').objectStore('installation').get('root');q.onsuccess=()=>{db.close();r(q.result)};q.onerror=j;});});}
async function cur(p){return Object.values((await read(p)).records).at(-1);}
async function prep(p,open=true){if(open){await p.goto(url);await click(p,'Open Balloons');}for(const n of ['Try the worked example','Pump example','Pump example','Collect example','Check my understanding'])await click(p,n);await p.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked',{exact:true}).check();await p.getByLabel('no, earlier outcomes do not reveal the next exact burst pump',{exact:true}).check();for(const n of ['Submit answers','Check input and accessibility','Test Pump','Test Collect','Continue to readiness'])await click(p,n);}
async function hook(ctx,noBC=false){await ctx.addInitScript(({noBC})=>{
 if(noBC)Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true});
 const a=window.audit={hold:null,held:[],fail:[],readDelay:0,writes:[],dom:[],keys:[],holdReads:0,readHeld:[]};
 const kinds=new WeakMap(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,k){if(this.transaction.db.name==='assessment-practice-balloons-v1'&&v?.records){const r=Object.values(v.records).at(-1),kind=r?.journal.at(-1)?.command?.kind??'assignment';kinds.set(this.transaction,kind);a.writes.push({kind,record:r,at:performance.now(),mounted:!!document.querySelector('.balloons-play')});if(a.fail.includes(kind))throw new DOMException('Independent injected put failure','QuotaExceededError');}return put.call(this,v,k);};
 const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(f){d.set.call(this,e=>{if(this.db.name==='assessment-practice-balloons-v1'){const deliver=()=>f?.call(this,e);if(a.hold&&a.hold===kinds.get(this)){a.hold=null;a.held.push(deliver);return;}if(this.mode==='readonly'&&a.holdReads>0){a.holdReads--;a.readHeld.push(deliver);return;}if(this.mode==='readonly'&&a.readDelay){setTimeout(deliver,a.readDelay);return;}}f?.call(this,e);});}});
 for(const t of ['keydown','keyup','click'])document.addEventListener(t,e=>a.keys.push({type:e.type,key:e.key,code:e.code,repeat:e.repeat,detail:e.detail,target:e.target?.textContent?.slice(0,50),at:performance.now()}),true);
 new MutationObserver(()=>{const play=document.querySelector('.balloons-play'),report=document.querySelector('.balloons-report');a.dom.push({at:performance.now(),play:!!play,report:!!report,heading:document.querySelector('h1')?.textContent,status:[...document.querySelectorAll('[role="status"],[role="alert"]')].map(x=>x.textContent),phase:a.writes.at(-1)?.record?.snapshot.phase});}).observe(document,{subtree:true,childList:true});
},{noBC});}
async function scenario(name,work,noBC=false){const ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});await hook(ctx,noBC);const p=await ctx.newPage();try{const evidence=await work(p,ctx);results.push({name,...evidence});await fs.writeFile(`${out}/${name}.json`,JSON.stringify({evidence,root:await read(p),trace:await p.evaluate(()=>({writes:window.audit.writes.map(w=>({kind:w.kind,at:w.at,mounted:w.mounted,phase:w.record?.snapshot.phase,exposure:w.record?.snapshot.exposure})),dom:window.audit.dom,keys:window.audit.keys}))},null,2));await p.screenshot({path:`${out}/${name}.png`,fullPage:true});console.log(name,JSON.stringify(evidence));}catch(e){results.push({name,harnessError:e.stack});console.error(name,e);await p.screenshot({path:`${out}/${name}-error.png`,fullPage:true});}finally{await ctx.close();await fs.writeFile(out+'/repair-control-results.json',JSON.stringify(results,null,2));}}
try {
for(const fault of ['action_pending','action','clean-pause'])await scenario(`repair-committed-recovery-${fault}`,async p=>{
 await prep(p);await click(p,'Start Balloons practice');await enabled(p,'Pump');await click(p,'Collect');await enabled(p,'Next balloon');await click(p,'Next balloon');await enabled(p,'Pump');await click(p,'Pump');await enabled(p,'Pump');const committed=await cur(p),bytes=await read(p);
 assert.equal(committed.snapshot.core.current.successfulPumps,1);
 if(fault==='clean-pause'){await click(p,'Pause and open history');await p.waitForTimeout(100);assert.equal((await cur(p)).snapshot.phase,'paused');}
 else {await p.evaluate(fault=>window.audit.fail=[fault,'pause'],fault);await click(p,'Pump');await p.getByRole('alert').filter({hasText:'Unsaved'}).waitFor();const failed=await cur(p);assert.deepEqual(failed.snapshot.core,committed.snapshot.core);if(fault==='action_pending')assert.deepEqual(await read(p),bytes);else assert(failed.snapshot.pendingAction);}
 const visibleBefore=await p.locator('main').innerText();await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');await click(p,'Resume saved session');await enabled(p,'Pump');const recovered=await cur(p);
 assert.deepEqual(recovered.header,committed.header);assert.deepEqual(recovered.snapshot.core,committed.snapshot.core);assert.deepEqual(recovered.snapshot.confirmedRounds,[1,2]);assert.equal(recovered.snapshot.exposure,'form_exposed');assert.equal(recovered.snapshot.comparisonEligible,fault==='clean-pause');
 return {pass:true,visibleBefore,visibleAfter:await p.locator('main').innerText(),committedCoreUnchanged:true,confirmedRounds:recovered.snapshot.confirmedRounds,eligible:recovered.snapshot.comparisonEligible};
});
await scenario('repair-slow-report-restored-and-fast-stable',async p=>{
 await p.goto(url);await click(p,'Open Balloons');const seed=JSON.parse(await fs.readFile(out+'/independent-full-root.json'));
 await p.evaluate(async root=>{const db=await new Promise(r=>{const q=indexedDB.open('assessment-practice-balloons-v1');q.onsuccess=()=>r(q.result)});await new Promise(r=>{const tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(root,'root');tx.oncomplete=r});db.close()},seed);
 await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');await btn(p,'Open saved report').first().click();await p.locator('.balloons-report').waitFor();const before=await read(p),text=await p.locator('.balloons-report').innerText();
 await p.evaluate(()=>{window.audit.dom=[];window.audit.readDelay=150});await p.waitForTimeout(3500);await p.evaluate(()=>window.audit.readDelay=0);await p.locator('.balloons-report').waitFor();
 const trace=await p.evaluate(()=>window.audit.dom);assert(trace.some(x=>!x.report));assert(trace.some(x=>x.report));assert.equal(await p.locator('.balloons-report').innerText(),text);assert.deepEqual(await read(p),before);
 await p.evaluate(()=>window.audit.dom=[]);await p.waitForTimeout(3500);assert.equal((await p.evaluate(()=>window.audit.dom)).filter(x=>!x.report).length,0);assert.deepEqual(await read(p),before);
 return{pass:true,selectedReportRestored:true,healthySlowSuppressionObserved:true,fastReadRemovals:0,durableBytesUnchanged:true,selectedText:text};
});
}finally{await browser.close();}
if(results.some(r=>!r.pass||r.harnessError))process.exitCode=1;
