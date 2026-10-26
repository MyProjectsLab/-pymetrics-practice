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
async function prep(p,stopAtSetup=false){
 await click(p,'Resume Stop training');await click(p,'Try a new Stop sequence');await click(p,'Start retest');await click(p,'See the rule');await click(p,'Try examples');
 for(let i=0;i<4;i++){if(!(i%2))await p.keyboard.press('Space');await click(p,'Check example');await click(p,i===3?'Check my understanding':'Next example')}
 for(const[q,a]of[['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']])await p.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check();
 await click(p,'Check answers');await click(p,'Check your setup');await p.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check();await click(p,'Run input check');await p.keyboard.press('Space');if(stopAtSetup)return;await click(p,'Continue to readiness');await p.evaluate(()=>history.pushState({},'',location.href));await click(p,'I’m ready');await p.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000});
}

try {
 for(const kind of ['read-pending','confirm-pending']){
  const c=await browser.newContext({viewport:{width:1200,height:800}});await c.addInitScript(()=>{window.BroadcastChannel=undefined});
  if(kind.startsWith('no-locks'))await c.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  if(kind==='no-locks-temporary')await c.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));
  const a=await c.newPage(),b=await c.newPage();for(const p of[a,b])p.on('pageerror',e=>out.errors.push({kind,error:String(e)}));
  await a.goto('http://127.0.0.1:5357/');
  if(kind==='no-locks-temporary'){
   await click(a,'Continue without saving');await ready(a);await api(a,(S,T,R,s,F)=>{const base={...F.baseline,storageMode:'temporary_memory'};T.beginTrainingChain(base);T.updateTrainingChain({drillAttempts:[F.drills.detection],status:'drill_complete'})},F);
  }else{
   await ready(a);await api(a,(S,T,R,s,x)=>s.mutate(q=>Object.assign(q,x)),F.state);await a.reload();await ready(a);await b.goto('http://127.0.0.1:5357/');await ready(b);
  }
  await prep(a,kind==='no-locks-persistent');
  if(kind==='no-locks-persistent'){
   const text=await a.getByRole('alert').innerText();assert.equal(text,'This browser cannot provide the timing or storage checks required for a valid session.');assert(await a.getByRole('button',{name:'Continue to readiness',exact:true}).isDisabled());
   const failure=await api(a,async(S,T,R,s)=>{try{await s.admitPresentation(T.currentTrainingChain(),'unused',async()=>{window.unsafePaint=true},new AbortController().signal);return 'accepted'}catch(e){return String(e)}});assert(failure.includes('Browser cannot order deletion and presentation'));
   out.cases.push({kind,pass:true,text,failure});await c.close();continue;
  }
  const claim=kind==='no-locks-temporary'?null:await api(a,async(S,T,R,s)=>Object.values((await s.read()).reservations).find(x=>x.family==='retest'));
  await api(a,(S,T,R,s,kind)=>{
   window.auditStore=s;window.trace=[];window.mark=(what)=>window.trace.push({what,at:performance.now()});
   if(!s)return;
   const originalRead=s.read.bind(s);window.originalRead=originalRead;
   const originalConfirm=s.confirm.bind(s);
   const originalAdmit=s.admitPresentation.bind(s);
   s.admitPresentation=(...args)=>{window.admissionStarted=true;window.mark('admission-request');return originalAdmit(...args)};
   if(kind.startsWith('read-'))s.read=async()=>{const state=await originalRead();if(window.admissionStarted&&!window.readHeld){window.readHeld=true;window.mark('read-held');if(kind==='read-reject')throw Error('injected admission read rejection');await new Promise(r=>window.releaseStorage=r)}return state};
   if(kind.startsWith('confirm-'))s.confirm=async(...args)=>{window.mark('confirm-held');window.confirmHeld=true;if(kind==='confirm-reject')throw Error('injected exposure write rejection');await new Promise(r=>window.releaseStorage=r);await originalConfirm(...args);window.mark('confirm-committed')};
  },kind);
  if(!kind.startsWith('no-locks')){await click(b,'Stop history');await click(b,'Delete all Assessment Practice data')}
  await click(a,'Start scored task');
  if(kind==='no-locks-temporary'){
   await a.waitForTimeout(1250);await a.goBack();await a.waitForTimeout(100);const d=await api(a,(S,T,R)=>R.developmentDrafts().at(-1));assert(d.realizedSequence.length===1);assert.equal(d.storageMode,'temporary_memory');out.cases.push({kind,pass:true,draft:d,locksAbsent:true});await c.close();continue;
  }
  await a.waitForFunction(()=>window.readHeld||window.confirmHeld);
  if(kind.endsWith('pending'))await a.goBack();
  await b.getByRole('alertdialog').getByRole('button',{name:'Delete all local data',exact:true}).click();
  await a.waitForTimeout(2200);
  if(kind==='confirm-reject')await a.goBack();
  const before=await api(a,async(S,T,R,_s)=>({drafts:R.developmentDrafts(),locks:await navigator.locks.query(),state:await window.originalRead(),trace:window.trace,body:document.body.innerText}));
  const blocked=await b.getByRole('alertdialog').count()===1;
  if(kind.endsWith('pending')){assert(!blocked);assert(!before.locks.held.some(x=>x.name==='assessment-practice-stop-presentation-v1'));assert(before.drafts.some(d=>d.sessionId===claim.sessionId));await a.evaluate(()=>window.releaseStorage());}
  await b.getByRole('alertdialog').waitFor({state:'detached'});await a.waitForTimeout(100);
  const after=await api(b,async(S,T,R,s)=>({state:await s.read(),locks:await navigator.locks.query()}));
  const row={kind,blockedAfterCancellation:blocked,claim,before,after};out.cases.push(row);await writeFile(root+'candidate-'+kind+'.json',JSON.stringify(row,null,2));await c.close();
 }
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+'audit-candidate-edges.json',JSON.stringify(out,null,2));await browser.close()}
