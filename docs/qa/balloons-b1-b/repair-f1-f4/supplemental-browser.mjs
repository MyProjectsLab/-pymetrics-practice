import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.BALLOONS_REPAIR_OUT || '/private/tmp/balloons-b1b-repair/pre';
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
async function scenario(name,work,noBC=false){const ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});await hook(ctx,noBC);const p=await ctx.newPage();try{const evidence=await work(p,ctx);results.push({name,...evidence});await fs.writeFile(`${out}/${name}.json`,JSON.stringify({evidence,root:await read(p),trace:await p.evaluate(()=>({writes:window.audit.writes.map(w=>({kind:w.kind,at:w.at,mounted:w.mounted,phase:w.record?.snapshot.phase,exposure:w.record?.snapshot.exposure})),dom:window.audit.dom,keys:window.audit.keys}))},null,2));await p.screenshot({path:`${out}/${name}.png`,fullPage:true});console.log(name,JSON.stringify(evidence));}catch(e){results.push({name,harnessError:e.stack});console.error(name,e);await p.screenshot({path:`${out}/${name}-error.png`,fullPage:true});}finally{await ctx.close();await fs.writeFile(out+'/supplemental-results.json',JSON.stringify(results,null,2));}}
try{
await scenario('failed-intent-and-cleanup-completes-as-baseline',async p=>{
 await prep(p);await click(p,'Start Balloons practice');await enabled(p,'Pump');await p.evaluate(()=>window.audit.fail=['action_pending','pause']);await click(p,'Pump');await p.getByRole('alert').filter({hasText:'Unsaved'}).waitFor();const unsavedText=await p.locator('main').innerText();await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');await click(p,'Resume saved session');await enabled(p,'Pump');let r;
 while((r=await cur(p)).snapshot.core.status!=='completed'){if(r.snapshot.core.status==='resolved'){await click(p,'Next balloon');await enabled(p,'Pump');}else{await click(p,'Collect');await enabled(p,r.snapshot.core.round===39?'View report':'Next balloon');}}
 await click(p,'View report');await p.locator('.balloons-report').waitFor();const text=await p.locator('main').innerText();return{pass:!text.includes('Saved standalone baseline'),unsavedText,reportText:text,eligible:(await cur(p)).snapshot.comparisonEligible};
});
await scenario('native-space-source-and-repeat',async p=>{
 await prep(p);await click(p,'Start Balloons practice');await enabled(p,'Pump');const sources=[];
 await btn(p,'Collect').focus();await p.keyboard.press('Space');await enabled(p,'Next balloon');sources.push({input:'Space Collect',source:(await cur(p)).snapshot.core.events.find(e=>e.actionId===1).source});await click(p,'Next balloon');await enabled(p,'Pump');
 for(const key of ['Space','Enter','Space']){await btn(p,'Pump').focus();const id=(await cur(p)).snapshot.core.nextActionId;await p.keyboard.press(key);await enabled(p,'Pump');sources.push({input:key+' Pump',source:(await cur(p)).snapshot.core.events.find(e=>e.actionId===id).source});}
 const id=(await cur(p)).snapshot.core.nextActionId;await btn(p,'Pump').focus();await p.keyboard.down('Space');await p.keyboard.down('Space');await btn(p,'Collect').focus();await p.keyboard.up('Space');assert.equal((await cur(p)).snapshot.core.nextActionId,id);return{pass:sources.every(x=>x.source==='keyboard'),sources,heldFocusReleaseAddsNoAction:true};
});
await scenario('healthy-normal-report-polling',async p=>{
 await p.goto(url);await click(p,'Open Balloons');const saved=JSON.parse(await fs.readFile(out+'/independent-full-root.json'));await p.evaluate(async saved=>{const db=await new Promise(r=>{const q=indexedDB.open('assessment-practice-balloons-v1');q.onsuccess=()=>r(q.result)});await new Promise(r=>{const tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(saved,'root');tx.oncomplete=r;});db.close();},saved);await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');await btn(p,'Open saved report').first().click();await p.locator('.balloons-report').waitFor();const before=await read(p);await p.evaluate(()=>window.audit.dom=[]);await p.waitForTimeout(6500);const lost=(await p.evaluate(()=>window.audit.dom)).filter(x=>!x.report);assert.deepEqual(await read(p),before);return{pass:lost.length===0,normalPollReportRemovals:lost.length,reportVisible:!!await p.locator('.balloons-report').count()};
});
}finally{await browser.close();}
