import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('.',import.meta.url).pathname.replaceAll('%20',' ');
const F=JSON.parse(await readFile('/private/tmp/stop-m5-audit-53286f7/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const out={browser:browser.version(),cases:[],errors:[]};
const kinds=['read-pending-cancel'];
try {for(const kind of kinds){
 const ctx=await browser.newContext({viewport:{width:1200,height:800}});await ctx.addInitScript(()=>{window.BroadcastChannel=undefined});const p=await ctx.newPage();p.on('pageerror',e=>out.errors.push({kind,error:String(e)}));
 await p.goto('http://127.0.0.1:5357/');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
 const row=await p.evaluate(async({F,kind})=>{
  const S=await import('/src/stop/storage.ts'),P=await import('/src/stop/presentation-order.ts'),E=await import('/src/stop/engine/engine.ts'),B=await import('/src/stop/browser.ts');
  const a=S.stopLocalStore();await a.mutate(s=>Object.assign(s,F.state));const b=await S.StopLocalStore.open();
  const claim=await a.reserve('independent-protocol','retest',0,Date.now()+1800000,F.chain.id,F.chain);await a.arm(claim.sessionId,claim.formId,'standard');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));const trace=[];const mark=(what,extra={})=>trace.push({what,time:performance.now(),...extra});let releaseRead,releaseWrite,releaseOuter,frameTimer,first=true,confirmation=Promise.resolve(),cancelCount=0;
  let engine;const clock=()=>performance.now();const host=document.createElement('div');host.style.cssText='width:200px;height:200px;position:fixed;top:0;left:0';document.body.append(host);
  const canvas=B.createBrowserCanvas(clock,'standard',()=>engine.technicalFailure('canvas failure'));canvas.attach(host);canvas.fixation();
  const read=a.read.bind(a),confirm=a.confirm.bind(a);
  if(kind==='read-reject')a.read=async()=>{mark('read-rejected');throw Error('injected admission read rejection')};
  if(kind==='read-pending-cancel')a.read=async()=>{mark('read-pending');await new Promise(r=>releaseRead=r);return read()};
  if(['confirm-pending-cancel','later-storage-pending'].includes(kind))a.confirm=async(...args)=>{mark('confirm-pending');await new Promise(r=>releaseWrite=r);await confirm(...args);mark('confirm-durable')};
  if(kind==='confirm-reject')a.confirm=async()=>{mark('confirm-rejected');throw Error('injected exposure write rejection')};
  const baseFrames={request(q,cb){
   if(first&&q.kind==='onset'){first=false;mark('frame-request',{eligible:q.notBeforeMs});if(kind==='frame-throw')throw Error('injected frame request throw');
    if(['frame-missing','frame-cancel','frame-delay-200'].includes(kind)){
     let canceled=false,inner=()=>{};const delay=kind==='frame-delay-200'?200:1800;
     frameTimer=setTimeout(()=>{mark('held-frame-delivered',{canceled});if(!canceled)inner=canvas.frames.request(q,cb)},Math.max(0,q.notBeforeMs-clock())+delay);
     return()=>{canceled=true;inner();cancelCount++;mark('frame-canceled')};
    }
   }return canvas.frames.request(q,cb)
  }};
  const gated=P.firstScoredAdmission(baseFrames,(present,signal)=>kind==='lock-reject'?Promise.reject(Error('injected lock rejection')):a.admitPresentation(F.chain,claim.sessionId,async()=>{mark('admitted');await present();mark('frame-settled');await confirmation;mark('admission-done')},signal),e=>{mark('admission-error',{message:String(e)});engine.technicalFailure('admission failed')});
  engine=E.createStopEngine({sessionId:claim.sessionId,responseKey:'Space',clock,scheduler:B.createBrowserScheduler(clock),frames:gated,sink(e){if(e.type==='stimulus_presented'){mark('onset',{payload:e.payload});if(e.payload.trialIndex===0)confirmation=a.confirm(claim.sessionId,claim.formId,new Date().toISOString(),F.chain.id).catch(e=>mark('write-error',{message:String(e)}))}if(e.type==='session_invalidated')canvas.clear()}});
  let deletionDone=false,deletionError=null;const del=()=>{mark('delete-request');void b.deleteResult(F.drills.detection.id).then(()=>{deletionDone=true;mark('delete-committed')},e=>{deletionError=String(e)})};
  if(['delete-first','queued-cancel'].includes(kind)){
   void navigator.locks.request(P.STOP_PRESENTATION_LOCK,async()=>{mark('outer-held');await new Promise(r=>releaseOuter=r)});while(!releaseOuter)await sleep(2);
   if(kind==='delete-first')del();
  }
  engine.begin({responseKeyHeld:false});engine.start([{phase:'scored',index:0,stimulus:'GO'},{phase:'scored',index:1,stimulus:'NO_GO'}]);
  if(kind==='delete-first'){await sleep(1100);releaseOuter()}
  if(kind==='queued-cancel'){await sleep(1100);engine.lifecycle('pagehide');releaseOuter();del()}
  if(kind==='frame-cancel'){await sleep(1100);engine.lifecycle('pagehide');del()}
  if(kind==='present-first'){
   // The synchronous sink fires in the frame while the same Web Lock is still held.
   while(!trace.some(x=>x.what==='onset'))await sleep(2);del();
  }
  if(['read-pending-cancel','confirm-pending-cancel'].includes(kind)){
   while(!trace.some(x=>x.what===(kind==='read-pending-cancel'?'read-pending':'confirm-pending')))await sleep(2);
   mark('await-watchdog');del();
  }
  if(kind==='later-storage-pending'){
   while(!trace.some(x=>x.what==='onset'))await sleep(2);await sleep(350);engine.keyDown('Space');engine.keyUp('Space');mark('input-sent');
  }
  await sleep(kind==='later-storage-pending'?2500:2100);
  const beforeRelease={deletionDone,deletionError,locks:await navigator.locks.query(),snapshot:engine.snapshot(),trace:structuredClone(trace),presentation:host.dataset.presentation??null};
  releaseRead?.();releaseWrite?.();await sleep(150);
  if(!['delete-first','present-first','queued-cancel','frame-cancel','read-pending-cancel','confirm-pending-cancel'].includes(kind))del();
  await sleep(150);engine.lifecycle('pagehide');await sleep(50);
  const result={kind,beforeRelease,after:{deletionDone,deletionError,locks:await navigator.locks.query(),state:await read(),events:engine.snapshot().events,trace,cancelCount}};
  clearTimeout(frameTimer);b.close();return result;
 },{F,kind});
 assert(row.beforeRelease.deletionDone);assert.equal(row.beforeRelease.locks.held.length,0);assert.equal(row.beforeRelease.snapshot.invalidRule,'stop_validity_v1.severe_timing');assert.equal(row.after.events.filter(e=>e.type==='stimulus_presented').length,0);out.cases.push(row);console.log(kind,JSON.stringify({invalid:row.beforeRelease.snapshot.invalidRule,onsets:row.beforeRelease.trace.filter(x=>x.what==='onset').length,deletedBeforeRelease:row.beforeRelease.deletionDone,locks:row.beforeRelease.locks,deletedFinally:row.after.deletionDone}));
 await writeFile(root+'/watchdog-'+kind+'.json',JSON.stringify(row,null,2));await writeFile(root+'/audit-watchdog.json',JSON.stringify(out,null,2));await ctx.close();
}}finally{await browser.close();await writeFile(root+'/audit-watchdog.json',JSON.stringify(out,null,2))}
