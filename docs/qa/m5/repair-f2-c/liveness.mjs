import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-audit-53286f7/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const delivery='unavailable';
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

const stages=(process.env.STAGES??'queued,read,frame,confirm-before,confirm-after').split(',');
try {
 for(const stage of stages) for(const cancel of (stage.startsWith('confirm')?['back']:['back','watchdog'])) for(const kind of ['drill','all','unrelated']) {
  const label=`${stage}-${cancel}-${kind}`; if(process.env.CASE && label!==process.env.CASE)continue;
  const c=await browser.newContext({viewport:{width:1200,height:800}});await c.addInitScript(()=>{window.BroadcastChannel=undefined});
  const a=await c.newPage(),b=await c.newPage();for(const p of[a,b])p.on('pageerror',e=>out.errors.push({label,error:String(e)}));
  await a.goto('http://127.0.0.1:5357/');await ready(a);
  const state=structuredClone(F.state),unrelated=F.profiles[1];state.results[unrelated.sessionId]=unrelated;state.exposures[unrelated.form.id]={formId:unrelated.form.id,sessionId:unrelated.sessionId,visualProfile:unrelated.setup.visualProfile,certainty:'confirmed',deleted:false,exposedAtWall:unrelated.completedAtWall};
  await api(a,(S,T,R,s,x)=>s.mutate(q=>Object.assign(q,x)),state);await a.reload();await ready(a);await b.goto('http://127.0.0.1:5357/');await ready(b);await prep(a);
  const claim=await api(a,async(S,T,R,s)=>Object.values((await s.read()).reservations).find(x=>x.family==='retest'));
  await api(a,async(S,T,R,s,stage)=>{
   window.auditStore=s;window.trace=[];window.mark=what=>window.trace.push({what,at:performance.timeOrigin+performance.now()});window.held=false;window.released=false;
   window.hold=async()=>{window.held=true;window.mark('promise-held');await new Promise(r=>window.releaseHeld=()=>{window.released=true;window.mark('promise-released');r()})};
   const read=s.read.bind(s),confirm=s.confirm.bind(s),admit=s.admitPresentation.bind(s);window.readOriginal=read;
   s.admitPresentation=(chain,id,present,signal)=>{window.admissionRequested=true;window.mark('admission-request');return admit(chain,id,async()=>{window.mark('admitted');if(stage==='frame')await window.hold();await present();window.mark('presentation-settled')},signal)};
   if(stage==='read')s.read=async()=>{const value=await read();if(window.admissionRequested&&!window.held)await window.hold();return value};
   s.confirm=async(...args)=>{window.mark('real-onset-confirm-called');if(stage==='confirm-before')await window.hold();try{await confirm(...args);window.mark('confirmation-committed');if(stage==='confirm-after')await window.hold()}catch(e){window.mark('late-confirm-rejected:'+e.name);throw e}};
   if(stage==='queued')void navigator.locks.request('assessment-practice-stop-presentation-v1',async()=>{window.outerHeld=true;await new Promise(r=>window.releaseOuter=r)});
  },stage);
  if(stage==='queued')await a.waitForFunction(()=>window.outerHeld);
  await click(b,'Stop history');
  if(kind==='all')await click(b,'Delete all Assessment Practice data');
  else await b.locator('article').filter(kind==='drill'?{has:b.getByRole('button',{name:'Review drill attempt',exact:true})}:{hasText:unrelated.form.id}).getByRole('button',{name:'Delete this result',exact:true}).click();
  await click(a,'Start scored task');
  await a.waitForFunction(stage==='queued'?()=>window.admissionRequested:()=>window.held);
  const heldLocks=await a.evaluate(()=>navigator.locks.query());
  if(cancel==='back')await a.goBack();
  else { let invalid=false; for(let i=0;i<100;i++){invalid=await api(a,(S,T,R,s,id)=>R.developmentDrafts().some(x=>x.sessionId===id&&x.invalidRule==='stop_validity_v1.severe_timing'),claim.sessionId);if(invalid)break;await a.waitForTimeout(20)}assert(invalid,'watchdog must actually invalidate before checking lock') }
  await a.waitForTimeout(80);
  const canceled=await api(a,async(S,T,R)=>({drafts:R.developmentDrafts(),locks:await navigator.locks.query(),trace:window.trace}));
  if(stage==='queued'){
   assert(!canceled.locks.pending.some(x=>x.name==='assessment-practice-stop-presentation-v1'),JSON.stringify({message:'canceled admission left queue',canceled,heldLocks}));
   await a.evaluate(()=>window.releaseOuter());
  }else assert(!canceled.locks.held.some(x=>x.name==='assessment-practice-stop-presentation-v1'),'canceled run still holds lock');
  await b.getByRole('alertdialog').getByRole('button',{name:kind==='all'?'Delete all local data':'Delete this result',exact:true}).click();
  await b.getByRole('alertdialog').waitFor({state:'detached',timeout:3000});
  await a.waitForTimeout(100);
  assert.equal(await a.evaluate(()=>window.released),false,'stall released too soon');
  const retained=await api(a,(S,T,R,s,id)=>R.developmentDrafts().find(x=>x.sessionId===id),claim.sessionId);
  assert(retained);const onsets=retained.realizedSequence.length;assert.equal(onsets,stage.startsWith('confirm')?1:0);
  const before=await api(b,async(S,T,R,s)=>({state:await s.read(),activity:await s.activities(),locks:await navigator.locks.query()}));
  assert(!before.state.reservations[claim.sessionId]);
  assert.equal(!!before.state.exposures[claim.formId],!!onsets&&kind!=='all');
  if(onsets&&kind!=='all')assert.equal(before.state.exposures[claim.formId].certainty,'confirmed');
  assert.equal(SafeChains(before.state),kind==='unrelated'?1:0);
  if(kind==='all')await api(b,(S,T,R,s)=>s.reserve('replacement','baseline',0));
  const replacement=await api(b,async(S,T,R,s)=>({state:await s.read(),activity:await s.activities()}));
  if(stage!=='queued')await a.evaluate(()=>window.releaseHeld());
  await a.waitForTimeout(250);
  const after=await api(b,async(S,T,R,s)=>({state:await s.read(),activity:await s.activities(),locks:await navigator.locks.query()}));
  const late=await api(a,(S,T,R,s,id)=>({draft:R.developmentDrafts().find(x=>x.sessionId===id),trace:window.trace,canvas:document.querySelector('[data-presentation]')?.dataset.presentation??null}),claim.sessionId);
  assert.equal(JSON.stringify(late.draft.events),JSON.stringify(retained.events),'late journal mutation');
  assert.equal(late.draft.realizedSequence.length,onsets,'late paint');
  assert.equal(JSON.stringify(after.state),JSON.stringify(replacement.state),'late durable mutation');
  assert.equal(JSON.stringify(after.activity),JSON.stringify(replacement.activity),'late activity write');
  assert(!after.locks.held.length&&!after.locks.pending.length);
  if(stage==='confirm-before')assert(late.trace.some(x=>x.what==='late-confirm-rejected:AbortError'));
  const raw={label,claim,heldLocks,canceled,retained,before,replacement,after,late};
  await writeFile(`/private/tmp/stop-m5-f2c-${label}.json`,JSON.stringify(raw,null,2));
  out.cases.push({label,pass:true,onsets,invalidRule:retained.invalidRule,heldLocks,canceledLocks:canceled.locks,deletionLocks:before.locks,marker:before.state.exposures[claim.formId]??null,reservation:before.state.reservations[claim.sessionId]??null,chainCount:SafeChains(before.state),lateTrace:late.trace,unchangedBytes:true});
  console.log(label,'PASS');await writeFile(root+'liveness.json',JSON.stringify(out,null,2));await c.close();
 }
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+'liveness.json',JSON.stringify(out,null,2));await browser.close()}
function SafeChains(state){return Object.keys(state.chains).length}
