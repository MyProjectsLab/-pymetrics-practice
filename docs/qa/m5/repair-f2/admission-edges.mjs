import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-audit-881b60f/fixtures.json'));
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
 for(const kind of ['drill-no-observer','all-no-observer','queued-cancel','admitted-cancel','unsupported']) {
  const c=await browser.newContext({viewport:{width:1200,height:800}});await c.addInitScript(()=>{window.BroadcastChannel=undefined});
  if(kind==='unsupported')await c.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  const a=await c.newPage(),b=await c.newPage();for(const p of [a,b])p.on('pageerror',e=>out.errors.push(String(e)));
  await a.goto('http://127.0.0.1:5337/');await ready(a);await api(a,(S,T,R,s,x)=>s.mutate(q=>Object.assign(q,x)),F.state);await a.reload();await ready(a);await b.goto('http://127.0.0.1:5337/');await ready(b);await prep(a,kind==='unsupported');
  if(kind==='unsupported'){assert(await a.getByRole('button',{name:'Continue to readiness',exact:true}).isDisabled());assert(await a.getByRole('alert').count());out.cases.push({kind,pass:true});await c.close();continue}
  await api(a,(S,T,R,s,x)=>{window.auditStore=s;window.confirmations=[];const confirm=s.confirm.bind(s);s.confirm=async(...args)=>{window.confirmations.push(args);return confirm(...args)};
   if(x.includes('no-observer'))s.deletionRevision=async()=>{throw Error('injected observer read unavailable')};
   if(x==='admitted-cancel'){const admit=s.admitPresentation.bind(s);s.admitPresentation=(chain,id,present,signal)=>admit(chain,id,async()=>{window.admissionHeld=true;await new Promise(r=>window.releaseAdmission=r);await present()},signal)}
  },kind);
  const claim=await api(a,async(S,T,R,s)=>Object.values((await s.read()).reservations).find(x=>x.family==='retest'));
  if(kind.includes('no-observer')){await click(b,'Stop history');if(kind.startsWith('all'))await click(b,'Delete all Assessment Practice data');else await b.locator('article').filter({has:b.getByRole('button',{name:'Review drill attempt',exact:true})}).getByRole('button',{name:'Delete this result',exact:true}).click()}
  await click(a,'Start scored task');await a.waitForTimeout(100);
  if(kind.includes('no-observer')){await b.getByRole('alertdialog').getByRole('button',{name:kind.startsWith('all')?'Delete all local data':'Delete this result',exact:true}).click();await b.getByRole('alertdialog').waitFor({state:'detached'})}
  if(kind==='queued-cancel') {await b.evaluate(()=>{void navigator.locks.request('assessment-practice-stop-presentation-v1',async()=>{window.lockHeld=true;await new Promise(r=>window.releaseLock=r)})});await b.waitForFunction(()=>window.lockHeld)}
  if(kind==='admitted-cancel')await a.waitForFunction(()=>window.admissionHeld);
  await a.waitForTimeout(1800);
  const prior=await api(a,(S,T,R)=>({drafts:R.developmentDrafts(),confirms:window.confirmations}));assert(prior.drafts.some(x=>x.sessionId===claim.sessionId));assert.equal(prior.confirms.length,0);
  if(kind==='queued-cancel')await b.evaluate(()=>window.releaseLock());if(kind==='admitted-cancel')await a.evaluate(()=>window.releaseAdmission());await a.waitForTimeout(100);
  const end=await api(a,async(S,T,R,s)=>({draft:R.developmentDrafts().find(x=>x.sessionId===window.claimId),drafts:R.developmentDrafts(),state:await s.read(),confirmations:window.confirmations}));
  assert.equal(end.confirmations.length,0);assert(!end.state.exposures[claim.formId]);assert(!end.state.reservations[claim.sessionId]);assert.equal(end.drafts.find(x=>x.sessionId===claim.sessionId).realizedSequence.length,0);
  out.cases.push({kind,pass:true,claim,zeroAfterRelease:true,invalidRule:end.drafts.find(x=>x.sessionId===claim.sessionId).invalidRule});await writeFile(`/private/tmp/stop-m5-f2-edge-${kind}.json`,JSON.stringify(end,null,2));await c.close();
 }
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+'admission-edges.json',JSON.stringify(out,null,2));await browser.close()}
