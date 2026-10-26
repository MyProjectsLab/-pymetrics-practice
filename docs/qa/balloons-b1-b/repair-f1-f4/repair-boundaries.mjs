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
 if(noBC==='absent')Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true});
 const a=window.audit={hold:null,held:[],fail:[],readDelay:0,writes:[],dom:[],keys:[],holdReads:0,readHeld:[]};
 a.bcHeld=[]; if(noBC==='delayed'){const b=Object.getOwnPropertyDescriptor(BroadcastChannel.prototype,'onmessage');Object.defineProperty(BroadcastChannel.prototype,'onmessage',{...b,set(f){b.set.call(this,e=>a.bcHeld.push(()=>f?.call(this,e)));}});}
 const kinds=new WeakMap(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,k){if(this.transaction.db.name==='assessment-practice-balloons-v1'&&v?.records){const r=Object.values(v.records).at(-1),kind=r?.journal.at(-1)?.command?.kind??'assignment';kinds.set(this.transaction,kind);a.writes.push({kind,record:r,at:performance.now(),mounted:!!document.querySelector('.balloons-play')});if(a.fail.includes(kind))throw new DOMException('Independent injected put failure','QuotaExceededError');}return put.call(this,v,k);};
 const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...d,set(f){d.set.call(this,e=>{if(this.db.name==='assessment-practice-balloons-v1'){const deliver=()=>f?.call(this,e);if(a.hold&&a.hold===kinds.get(this)){a.hold=null;a.held.push(deliver);return;}if(this.mode==='readonly'&&a.holdReads>0){a.holdReads--;a.readHeld.push(deliver);return;}if(this.mode==='readonly'&&a.readDelay){setTimeout(deliver,a.readDelay);return;}}f?.call(this,e);});}});
 for(const t of ['keydown','keyup','click'])document.addEventListener(t,e=>a.keys.push({type:e.type,key:e.key,code:e.code,repeat:e.repeat,detail:e.detail,target:e.target?.textContent?.slice(0,50),at:performance.now()}),true);
 new MutationObserver(()=>{const play=document.querySelector('.balloons-play'),report=document.querySelector('.balloons-report');a.dom.push({at:performance.now(),play:!!play,report:!!report,heading:document.querySelector('h1')?.textContent,status:[...document.querySelectorAll('[role="status"],[role="alert"]')].map(x=>x.textContent),phase:a.writes.at(-1)?.record?.snapshot.phase});}).observe(document,{subtree:true,childList:true});
},{noBC});}
async function scenario(name,work,noBC=false){const ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});await hook(ctx,noBC);const p=await ctx.newPage();try{const evidence=await work(p,ctx);results.push({name,...evidence});await fs.writeFile(`${out}/${name}.json`,JSON.stringify({evidence,root:await read(p),trace:await p.evaluate(()=>({writes:window.audit.writes.map(w=>({kind:w.kind,at:w.at,mounted:w.mounted,phase:w.record?.snapshot.phase,exposure:w.record?.snapshot.exposure})),dom:window.audit.dom,keys:window.audit.keys}))},null,2));await p.screenshot({path:`${out}/${name}.png`,fullPage:true});console.log(name,JSON.stringify(evidence));}catch(e){results.push({name,harnessError:e.stack});console.error(name,e);await p.screenshot({path:`${out}/${name}-error.png`,fullPage:true});}finally{await ctx.close();await fs.writeFile(out+'/repair-boundary-results.json',JSON.stringify(results,null,2));}}
try {
for(const notifications of (process.env.PROBE_ONE?['absent']:['absent','delayed']))for(const held of (process.env.PROBE_ONE?['assignment']:['assignment','arm','confirm','action']))for(const deletion of (process.env.PROBE_ONE?['individual']:['individual','installation']))for(const order of (process.env.PROBE_ONE?['delete-first']:['delete-first','delivery-first']))await scenario(`repair-${notifications}-${held}-${deletion}-${order}`,async(p,ctx)=>{
 await prep(p);
 if(held==='action'){await click(p,'Start Balloons practice');await enabled(p,'Pump');await p.evaluate(()=>window.audit.hold='action');await click(p,'Pump');}
 else {await p.evaluate(k=>window.audit.hold=k,held);await click(p,'Start Balloons practice');}
 await p.waitForFunction(()=>window.audit.held.length===1,null,{polling:10});
 const before=await read(p),id=Object.keys(before.records)[0],record=before.records[id];
 if(held==='assignment'||held==='arm')assert.equal(await p.locator('.balloons-play').count(),0);
 if(held==='action') {assert.equal(record.snapshot.core.nextActionId,2);assert.match(await p.locator('.balloons-play').innerText(),/Current: 0 cents/);}
 if(order==='delivery-first'){await p.evaluate(()=>window.audit.held.splice(0).forEach(f=>f()));await enabled(p,held==='action'?'Next balloon':'Pump');}
 const q=await ctx.newPage();await q.goto(url);await click(q,'Open Balloons');await click(q,'Balloons history');
 const started=Date.now();await click(q,deletion==='individual'?'Delete this result':'Delete all Balloons data');
 while(Object.keys((await read(q)).records).length && Date.now()-started<2600)await q.waitForTimeout(25);
 assert.equal(Object.keys((await read(q)).records).length,0);
 const elapsedMs=Date.now()-started,deleted=await read(q),locks=await q.evaluate(()=>navigator.locks.query());if(process.env.PROBE_ONE)console.log(JSON.stringify({before,deleted,locks}));
 if(deletion==='individual'){assert.equal(deleted.installationId,before.installationId);assert.equal(deleted.tombstones[id].exposure,order==='delivery-first'?'form_exposed':record.snapshot.exposure);assert.equal(deleted.tombstones[id].chainId,record.header.identity.chainId)}
 else{assert.notEqual(deleted.installationId,before.installationId);assert.deepEqual(deleted.tombstones,{})}
 // Release every notification and transaction callback only after deletion commits.
 await p.evaluate(()=>{window.audit.held.splice(0).forEach(f=>f());window.audit.bcHeld.splice(0).forEach(f=>f());});
 await q.evaluate(()=>window.audit.bcHeld.splice(0).forEach(f=>f()));await p.waitForTimeout(300);
 assert.deepEqual(await read(q),deleted);
 await p.waitForTimeout(1100);assert.equal(await p.locator('.balloons-play').count(),0);
 const visible=await p.locator('main').innerText();assert(!visible.includes('Saved standalone baseline'));
 await q.reload();await click(q,'Open Balloons');await click(q,'Balloons history');assert.equal(await btn(q,'Resume saved session').count(),0);assert.equal(await btn(q,'Open saved report').count(),0);assert.deepEqual(await read(q),deleted);
 return {pass:true,elapsedMs,locks,exposureBefore:record.snapshot.exposure,deletionRoot:deleted,lateDeliveryUnchanged:true,noScoredMountBeforeArmDelivery:held==='assignment'||held==='arm'?true:null,visible};
},notifications);

if(process.env.PROBE_ONE)process.exit(0);
async function seed(p){await p.goto(url);await click(p,'Open Balloons');const root=JSON.parse(await fs.readFile('/private/tmp/balloons-b1b-repair/pre/independent-full-root.json'));await p.evaluate(async root=>{const db=await new Promise(r=>{const q=indexedDB.open('assessment-practice-balloons-v1');q.onsuccess=()=>r(q.result)});await new Promise(r=>{const tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(root,'root');tx.oncomplete=r;});db.close()},root);await p.reload();await click(p,'Open Balloons');await click(p,'Balloons history');await btn(p,'Open saved report').first().click();await p.locator('.balloons-report').waitFor();}
for(const notification of ['absent','delayed'])for(const deletion of ['individual','installation'])await scenario(`repair-slow-report-${notification}-${deletion}`,async(p,ctx)=>{
 await seed(p);await p.evaluate(()=>window.audit.holdReads=1);await p.waitForFunction(()=>window.audit.readHeld.length===1,null,{polling:10});await p.waitForTimeout(100);assert.equal(await p.locator('.balloons-report').count(),0);
 const q=await ctx.newPage();await q.goto(url);await click(q,'Open Balloons');await click(q,'Balloons history');await (deletion==='individual'?btn(q,'Delete this result').first():btn(q,'Delete all Balloons data')).click();const start=Date.now();while(Object.keys((await read(q)).records).length===(deletion==='individual'?2:2)&&Date.now()-start<2600)await q.waitForTimeout(25);
 assert.equal(Object.keys((await read(q)).records).length,deletion==='individual'?1:0);
 const after=await read(q);await p.evaluate(()=>window.audit.readHeld.splice(0).forEach(f=>f()));await p.waitForTimeout(1200);assert.equal(await p.locator('.balloons-report').count(),0);assert.deepEqual(await read(q),after);
 return {pass:true,staleReportHidden:true,durableUnchangedAfterLateRead:true,visible:await p.locator('main').innerText()};
},notification);
await scenario('repair-native-input-positive-controls',async p=>{
 await prep(p);await click(p,'Start Balloons practice');await enabled(p,'Pump');const observations=[];
 async function observe(input,activate,expected){const id=(await cur(p)).snapshot.core.nextActionId;await activate();await enabled(p,'Next balloon');const r=await cur(p),source=r.snapshot.core.events.find(e=>e.actionId===id)?.source;assert.equal(source,expected);observations.push({input,source});await click(p,'Next balloon');await enabled(p,'Pump');}
 await observe('native Space',async()=>{await btn(p,'Collect').focus();await p.keyboard.press('Space')},'keyboard');
 await observe('native Enter',async()=>{await btn(p,'Collect').focus();await p.keyboard.press('Enter')},'keyboard');
 await observe('mouse',()=>click(p,'Collect'),'mouse');
 await observe('emulated touch',()=>btn(p,'Collect').tap(),'touch_or_pen');
 await observe('unclassified click',()=>btn(p,'Collect').evaluate(b=>b.click()),'unknown_or_assistive');
 const id=(await cur(p)).snapshot.core.nextActionId;await btn(p,'Pump').focus();await p.keyboard.down('Space');await p.keyboard.down('Space');await btn(p,'Collect').focus();await p.keyboard.up('Space');assert.equal((await cur(p)).snapshot.core.nextActionId,id);
 return {pass:true,observations,focusChangeReleaseSuppressed:true};
});
} finally {await browser.close();}
if(results.some(r=>r.harnessError||!r.pass))process.exitCode=1;
