import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-audit-881b60f/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const delivery=process.env.DELIVERY??'unavailable';
const out={browser:browser.version(),delivery,cases:[],errors:[]};

const click=(p,name)=>p.getByRole('button',{name,exact:true}).click();
const ready=p=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
const api=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts'),R=await import('/src/stop/run.ts');return new Function('S','T','R','s','x',`return (${fn})(S,T,R,s,x)`)(S,T,R,(S.stopLocalStore()??window.auditStore),arg)},{fn:fn.toString(),arg});
async function prep(p){
 await click(p,'Resume Stop training');await click(p,'Try a new Stop sequence');await click(p,'Start retest');await click(p,'See the rule');await click(p,'Try examples');
 for(let i=0;i<4;i++){if(!(i%2))await p.keyboard.press('Space');await click(p,'Check example');await click(p,i===3?'Check my understanding':'Next example')}
 for(const[q,a]of[['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']])await p.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check();
 await click(p,'Check answers');await click(p,'Check your setup');await p.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check();await click(p,'Run input check');await p.keyboard.press('Space');await click(p,'Continue to readiness');await p.evaluate(()=>history.pushState({},'',location.href));await click(p,'I’m ready');await p.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000});
}

const pause=p=>p.waitForTimeout(150);
const poll=(p,expression)=>p.waitForFunction(expression,undefined,{polling:5,timeout:5000});
try {
 for(const point of ['before-arm','fixation','delete-first','present-first','after']) for(const kind of ['drill','all','unrelated']) {
  const c=await browser.newContext({viewport:{width:1200,height:800}});
  if(delivery==='unavailable') await c.addInitScript(()=>{window.BroadcastChannel=undefined});
  if(delivery==='delayed') await c.addInitScript(()=>{const Native=window.BroadcastChannel;window.delayedMessages=[];window.flushMessages=()=>window.delayedMessages.splice(0).forEach(f=>f());window.BroadcastChannel=class{constructor(name){this.inner=new Native(name);this.inner.onmessage=e=>window.delayedMessages.push(()=>this.onmessage?.(e))}postMessage(x){this.inner.postMessage(x)}close(){this.inner.close()}}});
  const a=await c.newPage(),b=await c.newPage();
  for(const p of[a,b])p.on('pageerror',e=>out.errors.push({point,kind,error:String(e)}));
  await a.goto('http://127.0.0.1:5337/');await ready(a);
  const state=structuredClone(F.state),unrelated=F.profiles[1];state.results[unrelated.sessionId]=unrelated;state.exposures[unrelated.form.id]={formId:unrelated.form.id,sessionId:unrelated.sessionId,visualProfile:unrelated.setup.visualProfile,certainty:'confirmed',deleted:false,exposedAtWall:unrelated.completedAtWall};
  await api(a,(S,T,R,s,x)=>s.mutate(q=>Object.assign(q,x)),state);await a.reload();await ready(a);await b.goto('http://127.0.0.1:5337/');await ready(b);await prep(a);
  const claim=await api(a,async(S,T,R,s)=>Object.values((await s.read()).reservations).find(x=>x.family==='retest'));
  await api(a,(S,T,R,s,x)=>{
    window.auditStore=s;window.confirmations=[];window.admissionRequested=false;window.admissionHeld=false;
    const confirm=s.confirm.bind(s);s.confirm=async(...args)=>{window.confirmations.push({at:performance.timeOrigin+performance.now(),args});return confirm(...args)};
    const admit=s.admitPresentation.bind(s);s.admitPresentation=(chain,id,present,signal)=>{window.admissionRequested=true;return admit(chain,id,async()=>{window.admissionHeld=true;if(x==='present-first')await new Promise(r=>window.releasePresentation=r);await present()},signal)};
  },point);
  await click(b,'Stop history');
  if(kind==='all') await click(b,'Delete all Assessment Practice data');
  else await b.locator('article').filter(kind==='drill'?{has:b.getByRole('button',{name:'Review drill attempt',exact:true})}:{hasText:unrelated.form.id}).getByRole('button',{name:'Delete this result',exact:true}).click();
  await api(b,(S,T,R,s,x)=>{
    window.deleteCommitted=false;window.deleteEntered=false;
    const method=x.kind==='all'?'deleteAll':'deleteResult',ordered=x.kind==='all'?'deleteAllOrdered':'deleteResultOrdered';
    const original=s[method].bind(s);s[method]=async(...args)=>{window.deleteRequestedAt=performance.timeOrigin+performance.now();await original(...args);window.deleteCommitted=true;window.deleteCommittedAt=performance.timeOrigin+performance.now()};
    if(x.point==='delete-first'){const inner=s[ordered].bind(s);s[ordered]=async(...args)=>{window.deleteEntered=true;await new Promise(r=>window.releaseDeletion=r);return inner(...args)}}
  },{kind,point});
  const remove=()=>b.getByRole('alertdialog').getByRole('button',{name:kind==='all'?'Delete all local data':'Delete this result',exact:true}).click();
  let blockedWhileHeld=null;
  if(point==='before-arm') {
    await remove();await b.getByRole('alertdialog').waitFor({state:'detached'});
    if(await a.getByRole('button',{name:'Start scored task',exact:true}).count())await click(a,'Start scored task');
  } else {
    await click(a,'Start scored task');
    await api(a,async(S,T,R,s)=>{for(let i=0;i<100;i++){if(Object.values((await s.read()).reservations).some(x=>x.family==='retest'&&x.armed))return;await new Promise(r=>setTimeout(r,5))}throw Error('not armed')});
    if(point==='delete-first') {
      await remove();await poll(b,()=>window.deleteEntered);await poll(a,()=>window.admissionRequested);
      blockedWhileHeld=await a.evaluate(()=>window.confirmations.length===0);assert(blockedWhileHeld);await b.evaluate(()=>window.releaseDeletion());
    } else {
      if(point==='present-first')await poll(a,()=>window.admissionHeld);
      if(point==='after')await poll(a,()=>window.confirmations.length===1);
      await remove();
      if(point==='present-first') {await b.waitForTimeout(30);blockedWhileHeld=await b.evaluate(()=>!window.deleteCommitted);assert(blockedWhileHeld);await a.evaluate(()=>window.releasePresentation())}
    }
    await b.getByRole('alertdialog').waitFor({state:'detached'});
  }
  await a.waitForTimeout(1300);
  const observed=await api(a,async(S,T,R,s)=>({confirmations:window.confirmations,active:!!T.currentTrainingChain(),state:await s.read(),drafts:R.developmentDrafts(),messages:window.delayedMessages?.length,body:document.body.innerText}));
  const deletion=await b.evaluate(()=>({requestedAt:window.deleteRequestedAt,committedAt:window.deleteCommittedAt}));
  const before= ['before-arm','fixation','delete-first'].includes(point), affected=kind!=='unrelated', expectOnset=!affected||!before;
  assert.equal(observed.confirmations.length,expectOnset?1:0,`${delivery}/${point}/${kind}: onset`);
  assert.equal(observed.active,!affected,`${point}/${kind}: eligibility`);
  if(affected)assert(observed.body.includes('Stop could not finish')||!observed.body.includes('Timed Stop task'));
  if(kind==='unrelated')assert.equal(observed.drafts.length,0,'unrelated must not interrupt');
  if(delivery==='delayed')await a.evaluate(()=>window.flushMessages());
  if(!observed.drafts.length)await a.goBack();await pause(a);
  const end=await api(a,async(S,T,R,s)=>({drafts:R.developmentDrafts(),state:await s.read(),memoryExposure:(await import('/src/stop/exposure.ts')).stopExposure.snapshot(),active:!!T.currentTrainingChain()}));
  const draft=end.drafts.find(d=>d.sessionId===claim.sessionId);
  // Before-arm notification can unmount the run before it owns a scored form.
  assert(draft, 'invalid journal is retained');assert.equal(draft.realizedSequence.length,expectOnset?1:0);
  const marker=end.state.exposures[claim.formId]??null;
  assert.equal(!!marker,expectOnset&&kind!=='all');if(marker)assert.equal(marker.certainty,'confirmed');
  assert(!end.state.reservations[claim.sessionId]);
  if(kind!=='all'){assert.equal(JSON.stringify(end.state.results[unrelated.sessionId]??null),JSON.stringify(kind==='unrelated'?null:unrelated));assert.equal(!!end.state.chains[F.chain.id],!affected)}
  let replacement=null;
  if(kind==='all'){
    await api(b,(S,T,R,s)=>s.reserve('replacement-baseline','baseline',0));
    const fresh=await api(b,(S,T,R,s)=>s.read());
    replacement=await api(a,async(S,T,R,s,x)=>{const errors=[];for(const action of [()=>s.arm(x.claim.sessionId,x.claim.formId,'standard'),()=>s.reserve('stale','retest',0,null,x.chain.id,x.chain),()=>s.saveChain(x.chain),()=>s.saveDraft(x.draft,x.chain.id),()=>s.deleteAll()]){try{await action();errors.push('accepted')}catch(e){errors.push(e.constructor.name)}}return errors},{claim,chain:F.chain,draft});
    assert(replacement.every(x=>x==='InstallationClearedError'));assert.equal(JSON.stringify(await api(b,(S,T,R,s)=>s.read())),JSON.stringify(fresh));
  }
  const row={delivery,point,kind,pass:true,blockedWhileHeld,claim,confirmations:observed.confirmations,deletion,onsets:draft.realizedSequence.length,marker,reservation:end.state.reservations[claim.sessionId]??null,eligible:end.active,draftStorage:draft.storageMode,invalidRule:draft.invalidRule,revisionDelivery:observed.messages??null,replacement};
  // Full journals and store snapshots retained as raw local evidence, outside the commit.
  await writeFile(`/private/tmp/stop-m5-f2-${delivery}-${point}-${kind}.json`,JSON.stringify({observed,end,deletion,replacement},null,2));
  out.cases.push(row);console.log(JSON.stringify(row));await writeFile(root+`matrix-${delivery}.json`,JSON.stringify(out,null,2));await c.close();
 }
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+`matrix-${delivery}.json`,JSON.stringify(out,null,2));await browser.close()}
