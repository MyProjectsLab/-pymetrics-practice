import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-audit-881b60f/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const out={browser:browser.version(),cases:[],errors:[]};
const click=(p,name)=>p.getByRole('button',{name,exact:true}).click();
const ready=p=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
const api=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts'),R=await import('/src/stop/run.ts');return new Function('S','T','R','s','x',`return (${fn})(S,T,R,s,x)`)(S,T,R,(S.stopLocalStore()??window.auditStore),arg)},{fn:fn.toString(),arg});
async function prep(p){
 await click(p,'Resume Stop training');await click(p,'Try a new Stop sequence');await click(p,'Start retest');await click(p,'See the rule');await click(p,'Try examples');
 for(let i=0;i<4;i++){if(!(i%2))await p.keyboard.press('Space');await click(p,'Check example');await click(p,i===3?'Check my understanding':'Next example')}
 for(const[q,a]of[['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']])await p.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check();
 await click(p,'Check answers');await click(p,'Check your setup');await p.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check();await click(p,'Run input check');await p.keyboard.press('Space');await click(p,'Continue to readiness');await p.evaluate(()=>history.pushState({},'',location.href));await click(p,'I’m ready');await p.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000});
}
try{
 for(const [delivery,kind,point]of [
 ['delivered','drill','before'],['delivered','all','before'],['unavailable','drill','before'],['unavailable','all','before'],['delayed','drill','before'],['delayed','all','before'],['delivered','drill','after'],['delivered','unrelated','before']]){
 const c=await browser.newContext({viewport:{width:1200,height:800}});
 if(delivery==='unavailable')await c.addInitScript(()=>{window.BroadcastChannel=undefined});
 if(delivery==='delayed')await c.addInitScript(()=>{const Native=window.BroadcastChannel;window.delayedMessages=[];window.flushMessages=()=>window.delayedMessages.splice(0).forEach(f=>f());window.BroadcastChannel=class{constructor(name){this.inner=new Native(name);this.inner.onmessage=e=>window.delayedMessages.push(()=>this.onmessage?.(e))}postMessage(x){this.inner.postMessage(x)}close(){this.inner.close()}}});
 const a=await c.newPage(),b=await c.newPage();for(const p of[a,b])p.on('pageerror',e=>out.errors.push({delivery,kind,error:String(e)}));
 await a.goto('http://127.0.0.1:5337/');await ready(a);
 const state=structuredClone(F.state);if(kind==='unrelated'){const r=F.profiles[1];state.results[r.sessionId]=r;state.exposures[r.form.id]={formId:r.form.id,sessionId:r.sessionId,visualProfile:r.setup.visualProfile,certainty:'confirmed',deleted:false,exposedAtWall:r.completedAtWall}}
 await api(a,async(S,T,R,s,x)=>s.mutate(q=>Object.assign(q,x)),state);await a.reload();await ready(a);await b.goto('http://127.0.0.1:5337/');await ready(b);await prep(a);
 await api(a,(S,T,R,s)=>{window.auditStore=s;window.confirmations=[];const f=s.confirm.bind(s);s.confirm=async(...args)=>{window.confirmations.push({at:performance.now(),args});return f(...args)}});
 await click(b,'Stop history');
 if(kind==='all')await click(b,'Delete all Assessment Practice data');else {const row=kind==='drill'?b.locator('article').filter({has:b.getByRole('button',{name:'Review drill attempt',exact:true})}):b.locator('article').filter({hasText:F.profiles[1].form.id});await row.getByRole('button',{name:'Delete this result',exact:true}).click()}
 await click(a,'Start scored task');
 const claim=await api(a,async(S,T,R,s)=>{for(let i=0;i<100;i++){const r=Object.values((await s.read()).reservations).find(x=>x.family==='retest');if(r?.armed)return r;await new Promise(r=>setTimeout(r,5))}throw Error('not armed')});
 if(point==='after')await a.waitForFunction(()=>window.confirmations.length===1);
 const before=await a.evaluate(()=>({confirmations:window.confirmations,at:performance.now()}));
 await b.getByRole('alertdialog').getByRole('button',{name:kind==='all'?'Delete all local data':'Delete this result',exact:true}).click();await b.getByRole('alertdialog').waitFor({state:'detached'});
 const deletion=await api(b,async(S,T,R,s)=>({state:await s.read(),at:performance.now()}));
 await a.waitForTimeout(1500);
 const visible=await a.locator('body').innerText();const observed=await api(a,async(S,T,R,s)=>({confirmations:window.confirmations,active:!!T.currentTrainingChain(),state:await s.read(),drafts:R.developmentDrafts(),messages:window.delayedMessages?.length}));
 await a.screenshot({path:`${root}/onset-${delivery}-${kind}-${point}.png`,fullPage:true});
 if(delivery==='delayed')await a.evaluate(()=>window.flushMessages());else if(observed.drafts.length===0)await a.goBack();
 await a.waitForTimeout(150);
 const end=await api(a,async(S,T,R,s)=>({drafts:R.developmentDrafts(),state:await s.read(),active:!!T.currentTrainingChain()}));
 const draft=end.drafts.find(d=>d.sessionId===claim.sessionId);
 const row={delivery,kind,point,claim,confirmedBeforeDeletion:before.confirmations.length,confirmedAfterDeletion:observed.confirmations.length,activeAfterDeletion:observed.active,onsetsInDraft:draft?.realizedSequence.length,markerAfterDeletion:observed.state.exposures[claim.formId]??null,markerAfterExit:end.state.exposures[claim.formId]??null,retired:!!end.state.retiredChains[F.chain.id],expectedBlocked:point==='before'&&kind!=='unrelated',visible};
 row.pass=row.expectedBlocked?observed.confirmations.length===0:observed.confirmations.length===1;
 out.cases.push(row);await writeFile(`${root}/onset-${delivery}-${kind}-${point}.json`,JSON.stringify({before,deletion,observed,end},null,2));console.log(JSON.stringify({...row,visible:undefined}));await c.close();
 }
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+'/audit-onset.json',JSON.stringify(out,null,2));await browser.close()}
