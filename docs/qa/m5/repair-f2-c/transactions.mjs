import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const F=JSON.parse(await readFile(process.env.M5_FIXTURES??'/private/tmp/stop-m5-audit-53286f7/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const out={browser:browser.version(),cases:[],errors:[]};
try{for(const boundary of ['read-delivery','write-uncommitted'])for(const kind of ['drill','all']){
 const c=await browser.newContext({viewport:{width:1200,height:800}});await c.addInitScript(()=>{window.BroadcastChannel=undefined});const p=await c.newPage();p.on('pageerror',e=>out.errors.push(String(e)));
 await p.goto('http://127.0.0.1:5357/');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
 const row=await p.evaluate(async({F,boundary,kind})=>{
  const S=await import('/src/stop/storage.ts');const s=S.stopLocalStore();await s.mutate(q=>Object.assign(q,F.state));const other=await S.StopLocalStore.open();
  const claim=await s.reserve('transaction-probe','retest',0,Date.now()+1800000,F.chain.id,F.chain);await s.arm(claim.sessionId,claim.formId,'standard');
  const before=await s.read(),activityBefore=await s.activities(),signal=new AbortController(),trace=[];let held=false,delivery=()=>{},aborted=false,settled=false;
  const nativeGet=IDBObjectStore.prototype.get,nativePut=IDBObjectStore.prototype.put;
  function intercept(req,store){
   store.transaction.addEventListener('abort',()=>{aborted=true;trace.push('transaction-aborted')});
   function keepActive(){try{const ping=nativeGet.call(store,'deletion_revision');ping.onsuccess=keepActive;ping.onerror=e=>e.preventDefault()}catch{}}
   if(boundary==='read-delivery')Object.defineProperty(req,'onsuccess',{set(fn){req.addEventListener('success',e=>{held=true;trace.push('read-delivery-held');delivery=()=>fn(e);keepActive()})}});
   else req.addEventListener('success',()=>{held=true;trace.push('write-not-committed');keepActive()});
  }
  let selected=false;
  IDBObjectStore.prototype.get=function(...args){const r=nativeGet.apply(this,args);if(!selected&&boundary==='read-delivery'&&this.transaction.mode==='readwrite'&&this.name==='installation'){selected=true;intercept(r,this)}return r};
  IDBObjectStore.prototype.put=function(...args){const r=nativePut.apply(this,args);if(!selected&&boundary==='write-uncommitted'&&this.transaction.mode==='readwrite'&&this.name==='installation'){selected=true;intercept(r,this)}return r};
  const pending=s.confirm(claim.sessionId,claim.formId,'2099-01-01',F.chain.id,signal.signal).then(()=>{settled=true;trace.push('unexpected-commit')},e=>{settled=true;trace.push('confirmation-rejected:'+e.name)});
  while(!held)await new Promise(r=>setTimeout(r,1));
  signal.abort();trace.push('signal-aborted');
  IDBObjectStore.prototype.get=nativeGet;IDBObjectStore.prototype.put=nativePut;
  if(kind==='all')await other.deleteAll();else await other.deleteResult(F.drills.detection.id);
  const atDeletion={aborted,settled,state:await other.read(),activity:await other.activities(),locks:await navigator.locks.query()};
  if(kind==='all')await other.reserve('replacement-transaction','baseline',0);
  const replacement={state:await other.read(),activity:await other.activities()};
  delivery();await pending;await new Promise(r=>setTimeout(r,30));
  const after={state:await other.read(),activity:await other.activities()};other.close();return{boundary,kind,before,activityBefore,atDeletion,replacement,after,trace};
 },{F,boundary,kind});
 assert(row.atDeletion.aborted);if(boundary==='read-delivery')assert.equal(row.atDeletion.settled,false);
 assert.deepEqual(row.after,row.replacement);assert(!row.trace.includes('unexpected-commit'));
 if(kind==='drill'){assert.equal(row.after.state.exposures['stop-retest-01'].certainty,'uncertain');assert(!row.after.activity.some(x=>x.sessionId==='transaction-probe'&&x.type==='retest_exposed'))}
 out.cases.push(row);console.log(boundary,kind,'PASS');await c.close();
}}catch(e){out.error=String(e.stack);process.exitCode=1;console.error(e)}finally{await writeFile(new URL('transactions.json',import.meta.url),JSON.stringify(out,null,2));await browser.close()}
