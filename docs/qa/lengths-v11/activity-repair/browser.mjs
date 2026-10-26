import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
const { chromium }=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base='http://127.0.0.1:4280',folder='docs/qa/lengths-v11/activity-repair/'
const html=await readFile('dist/docs/qa/lengths-v11/implementation/probe.html','utf8'),probe=html.match(/src="([^"]+\.js)"/)[1]
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=[]
const check=(condition,message)=>{if(!condition)throw Error(message)}
async function loadProbe(page){await page.addScriptTag({type:'module',url:base+probe});await page.waitForFunction(()=>window.mouthProbe)}
async function root(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('assessment-practice-lengths-mouth-v1-1');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('installation'),r=tx.objectStore('installation').get('root');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close()}}))}
async function seed(page,kind){await page.goto(base+'/');await loadProbe(page);return page.evaluate(async kind=>{
 const {Storage:S,Engine:E}=window.mouthProbe,store=await S.MouthStore.open()
 const arm=await store.start({requestId:'review',sessionId:'review',clockDomainId:'review',variant:'standard',route:'standalone',atMs:0,wallMs:1,profile:{kind:'keyboard',variant:'standard',deviceClass:'developer',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false},displayContext:{layoutWidthCssPx:1280,layoutHeightCssPx:900,visualWidthCssPx:1280,visualHeightCssPx:900,taskHostWidthCssPx:450,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true}})
 if(kind!=='arm'){let s=arm.state;for(let n=0;n<(kind==='checkpoint'?30:90);n++){if(s.phase==='armed')s=E.advance(s,{kind:'start',atMs:0,responseHeld:false});if(s.phase==='break')s=E.advance(s,{kind:'continue',atMs:s.events.at(-1).atMs,responseHeld:false});for(const stage of ['fixation','onset','remove','resolve','feedback','offset'])s=E.advance(s,{kind:stage,atMs:E.requiredDue(s)})}await store.saveSnapshot(arm,s,0)}
 return store.read()
},kind)}
async function history(page){await page.getByRole('button',{name:'Open Lengths',exact:true}).click();await page.getByRole('button',{name:'V1.1 history',exact:true}).click();await page.getByRole('button',{name:'Open recorded review'}).waitFor()}
async function openReview(page){await history(page);await page.getByRole('button',{name:'Open recorded review'}).click();await page.waitForSelector('[data-mouth-report-numbers]')}
async function installHold(page,mode){await page.evaluate(mode=>{
 window.BroadcastChannel=undefined;window.holdFirst=true;window.held=false
 const complete=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete'),put=IDBObjectStore.prototype.put,after=new WeakSet()
 if(mode==='before'){
  const transaction=IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction=function(...args){
   if(args[1]!=='readwrite'||!window.holdFirst)return transaction.apply(this,args)
   window.holdFirst=false;window.held=true;const db=this;let actual,request,store,aborted=false
   const pending={onsuccess:null,onerror:null,get result(){return request?.result}}
   const tx={oncomplete:null,onerror:null,onabort:null,get error(){return actual?.error},abort(){aborted=true;if(actual)actual.abort();else queueMicrotask(()=>tx.onabort?.())},objectStore(){return {get(){return pending},put(...values){return store.put(...values)}}}}
   window.releaseNative=()=>{if(aborted)return;actual=transaction.apply(db,args);store=actual.objectStore('installation');actual.oncomplete=event=>tx.oncomplete?.(event);actual.onerror=event=>tx.onerror?.(event);actual.onabort=event=>tx.onabort?.(event);request=store.get('root');request.onsuccess=event=>pending.onsuccess?.(event);request.onerror=event=>pending.onerror?.(event)}
   return tx
  }
 }
 if(mode==='after'){
  IDBObjectStore.prototype.put=function(value,...args){if(window.holdFirst&&value?.activity?.review?.events.length){window.holdFirst=false;after.add(this.transaction)}return put.call(this,value,...args)}
  Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...complete,set(fn){complete.set.call(this,function(event){if(after.has(this)){window.held=true;window.releaseNative=()=>fn.call(this,event)}else fn?.call(this,event)})}})
 }
},mode)}
async function other(page,context){const p=await context.newPage();await p.goto(base+'/');await loadProbe(p);await p.evaluate(()=>window.BroadcastChannel=undefined);return p}
async function extend(page){return page.evaluate(async()=>{
 const {Storage:S,Engine:E}=window.mouthProbe,store=await S.MouthStore.open(),arm=await store.loadArmed('review');let s=arm.snapshot?.state??arm.state
 for(let n=0;n<30;n++){if(s.phase==='armed')s=E.advance(s,{kind:'start',atMs:0,responseHeld:false});if(s.phase==='break')s=E.advance(s,{kind:'continue',atMs:s.events.at(-1).atMs,responseHeld:false});for(const stage of ['fixation','onset','remove','resolve','feedback','offset'])s=E.advance(s,{kind:stage,atMs:E.requiredDue(s)})}
 const snapshot=await store.saveSnapshot(arm,s,arm.snapshot?.revision??0);return {snapshot,root:await store.read()}
})}
async function remove(page,mode){return page.evaluate(async mode=>{const store=await window.mouthProbe.Storage.MouthStore.open();if(mode==='individual')await store.deleteAttempt('review');else await store.deleteAll();return new Promise(resolve=>{const q=indexedDB.open('assessment-practice-lengths-mouth-v1-1');q.onsuccess=()=>{const db=q.result,tx=db.transaction('installation'),r=tx.objectStore('installation').get('root');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close()}})},mode)}
async function test(name,fn){const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{const detail=await fn(p,c);check(!errors.length,errors.join(';'));results.push({name,status:'PASS',detail});console.log('PASS',name)}catch(error){results.push({name,status:'FAIL',error:String(error),errors});console.log('FAIL',name,String(error))}finally{await c.close();await writeFile(folder+'browser-roots.json.gz',gzipSync(JSON.stringify(results,null,2)));await writeFile(folder+'browser-results.json',JSON.stringify(results.map(({detail:_detail,...row},rootsRecord)=>({...row,rootsRecord,rootsFile:'browser-roots.json.gz'})),null,2))}}
for(const kind of ['arm','checkpoint','terminal'])await test(kind+' candidate opening/retry/reload exact activity and timed bytes',async p=>{
 const before=await seed(p,kind);await openReview(p);await p.getByText('Report opening recorded locally.',{exact:true}).waitFor();let after=await root(p)
 check(JSON.stringify(after.attempts)===JSON.stringify(before.attempts),'timed bytes changed');check(JSON.stringify(after.counters)===JSON.stringify(before.counters),'counter changed');check(after.revision===before.revision+1,'activity root revision');check(after.activity.review.events.length===1,'one actual opening');check(after.activity.review.events[0].resultRevision===(kind==='arm'?0:1),'correct binding')
 if(kind==='arm')check((await p.locator('[data-mouth-report-numbers]').innerText()).includes('Incomplete review saved in this browser'),'arm Saved must refer to incomplete review')
 await p.getByRole('button',{name:'Retry report opening record'}).click();await p.waitForTimeout(400);check(JSON.stringify(await root(p))===JSON.stringify(after),'same view retry changed root')
 await p.reload();await openReview(p);await p.getByText('Report opening recorded locally.',{exact:true}).waitFor();const reloaded=await root(p);check(reloaded.activity.review.events.length===2,'new genuine reload opening');check(JSON.stringify(reloaded.attempts)===JSON.stringify(before.attempts),'reload timed bytes changed');check(JSON.stringify(reloaded.counters)===JSON.stringify(before.counters),'reload counter changed')
 if(kind==='arm')await p.screenshot({path:folder+'arm-review.png',fullPage:true});return {before,after,reloaded}
})
for(const kind of ['arm','checkpoint'])for(const delivery of ['before','after'])await test(kind+' publication-first extension with held '+delivery+'-commit activity delivery',async(p,c)=>{
 const before=await seed(p,kind),q=await other(p,c);await history(p);await installHold(p,delivery);await p.getByRole('button',{name:'Open recorded review'}).click();await p.waitForFunction(()=>window.held)
 let extended=false;const task=extend(q).then(value=>{extended=true;return value});await p.waitForTimeout(150);check(!extended,'extension overtook publication/activity order')
 const during=await root(q);check(JSON.stringify(during.attempts)===JSON.stringify(before.attempts),'extension wrote during admission')
 if(delivery==='before')await p.evaluate(()=>window.releaseNative());else await p.waitForSelector('[data-mouth-report-numbers]',{state:'hidden',timeout:3500})
 const result=await task;await p.waitForTimeout(400);check(result.root.activity.review.events.length===1,'genuine opening lost');check(result.root.activity.review.events[0].resultRevision===(kind==='arm'?0:1),'original view revision lost');check(JSON.stringify(result.root.counters)===JSON.stringify(before.counters),'counter changed')
 if(delivery==='after')await p.evaluate(()=>window.releaseNative());await p.getByRole('button',{name:'Retry report opening record'}).click();await p.waitForTimeout(400)
 const after=await root(q);check(JSON.stringify(after)===JSON.stringify(result.root),'historical retry changed complete root');check(await p.locator('[data-mouth-report-numbers]').count()===0,'stale numbers republished');return {before,during,extended:result.root,after}
})
for(const kind of ['arm','checkpoint','terminal'])for(const mode of ['individual','replacement'])for(const delivery of ['before','after'])await test(kind+' held '+delivery+'-commit opening then '+mode+' without notifications',async(p,c)=>{
 const before=await seed(p,kind),q=await other(p,c);await history(p);await installHold(p,delivery);await p.getByRole('button',{name:'Open recorded review'}).click();await p.waitForFunction(()=>window.held)
 let deleted=false;const deletion=remove(q,mode).then(value=>{deleted=true;return value});await p.waitForTimeout(100);check(!deleted,'deletion overtook held publication')
 const deletedRoot=await deletion;await p.waitForTimeout(300);await p.evaluate(()=>window.releaseNative());await p.getByRole('button',{name:'Retry report opening record'}).click();await p.waitForTimeout(500)
 const after=await root(q);check(JSON.stringify(after)===JSON.stringify(deletedRoot),'late activity changed complete retired root');check(!after.activity?.review&&!after.attempts.review,'retired data revived');check(await p.locator('[data-mouth-report-numbers]').count()===0,'retired report restored');return {before,deletedRoot,after}
})
for(const kind of ['arm','checkpoint','terminal'])for(const mode of ['individual','replacement'])await test(kind+' deletion-first stale history opening '+mode,async(p,c)=>{
 const before=await seed(p,kind),q=await other(p,c);await history(p);await p.evaluate(()=>{window.BroadcastChannel=undefined;window.openButton=[...document.querySelectorAll('button')].find(b=>b.textContent==='Open recorded review')})
 const deletedRoot=await remove(q,mode);await p.evaluate(()=>window.openButton.click());await p.waitForTimeout(600);const after=await root(q)
 check(JSON.stringify(after)===JSON.stringify(deletedRoot),'stale opening wrote activity');check(await p.locator('[data-mouth-report-numbers]').count()===0,'deleted report visible');return {before,deletedRoot,after}
})
await test('native OBS-1 same committed checkpoint ID after extension, mismatched retry/new stale ID rejected',async p=>{
 await seed(p,'checkpoint');await loadProbe(p);return p.evaluate(async()=>{
 const {Storage:S,Engine:E}=window.mouthProbe,store=await S.MouthStore.open(),a=await store.loadArmed('review'),old=a.snapshot,handle=store.authority.published(a),view=await store.appendReportView('review',old,'historical','history',100,handle),before=await store.read()
 let s=E.advance(old.state,{kind:'continue',atMs:old.state.events.at(-1).atMs,responseHeld:false});for(let n=0;n<30;n++)for(const kind of ['fixation','onset','remove','resolve','feedback','offset'])s=E.advance(s,{kind,atMs:E.requiredDue(s)})
 await store.saveSnapshot(a,s,old.revision);const extended=await store.read(),retry=await store.appendReportView('review',old,'historical','history',100,handle);if(JSON.stringify(view)!==JSON.stringify(retry))throw Error('retry mismatch')
 for(const [id,source,time]of [['new','history',100],['historical','live',100],['historical','history',101]]){let rejected=false;try{await store.appendReportView('review',old,id,source,time,handle)}catch{rejected=true}if(!rejected)throw Error('stale or conflicting retry accepted')}
 const after=await store.read();if(JSON.stringify(after)!==JSON.stringify(extended))throw Error('complete root changed');return {before,extended,after,retry,status:handle.status()}
 })
})
await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1
