import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-audit-881b60f/fixtures.json'));
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const out={browser:browser.version(),cases:[],errors:[]};
const click=(p,name)=>p.getByRole('button',{name,exact:true}).click();
const ready=p=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
async function prep(p){
 await click(p,'Resume Stop training');await click(p,'Try a new Stop sequence');await click(p,'Start retest');await click(p,'See the rule');await click(p,'Try examples');
 for(let i=0;i<4;i++){if(!(i%2))await p.keyboard.press('Space');await click(p,'Check example');await click(p,i===3?'Check my understanding':'Next example')}
 for(const[q,a]of[['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']])await p.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check();
 await click(p,'Check answers');await click(p,'Check your setup');await p.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check();await click(p,'Run input check');await p.keyboard.press('Space');await click(p,'Continue to readiness');await p.evaluate(()=>history.pushState({},'',location.href));await click(p,'I’m ready');await p.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000});
}

const p=await browser.newPage({viewport:{width:1200,height:800}});p.on('pageerror',e=>out.errors.push(String(e)));
const raw=()=>p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('assessment-practice-stop',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const value=await new Promise((resolve,reject)=>{const r=db.transaction('installation').objectStore('installation').get('stop');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return value});
try {
 await p.goto('http://127.0.0.1:5338/');await ready(p);
 await p.evaluate(async state=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('assessment-practice-stop',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(state,'stop');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()},F.state);
 await p.reload();await ready(p);await prep(p);await click(p,'Start scored task');
 await p.getByRole('heading',{name:'Stop complete',exact:true}).waitFor({timeout:230000});await click(p,'View my result');
 const state=await raw(),result=Object.values(state.results).find(x=>x.mode==='retest');assert(result);assert.equal(result.validity,'valid');assert.equal(result.events.filter(e=>e.type==='stimulus_presented').length,88);assert(state.exposures[result.form.id].certainty==='confirmed');
 const original=JSON.stringify(result);await p.reload();await ready(p);await click(p,'Stop history');await p.locator('article').filter({hasText:result.form.id}).getByRole('button',{name:'Open original report',exact:true}).click();assert(await p.getByRole('heading',{name:'Your Stop practice result',exact:true}).count());assert.equal(JSON.stringify((await raw()).results[result.sessionId]),original);
 const chain=Object.values((await raw()).chains)[0];assert.equal(chain.status,'complete');assert.equal(chain.retest.sessionId,result.sessionId);
 const onsets=result.events.filter(e=>e.type==='stimulus_presented'),offsets=result.events.filter(e=>e.type==='stimulus_removed');
 out.result={id:result.sessionId,form:result.form.id,events:result.events.length,counts:result.summarySnapshot.counts,firstOnsetDelayMs:onsets[8].payload.confirmedOnsetMs-onsets[8].payload.eligibleAtMs,scoredVisibilityMs:offsets.slice(8).map(e=>e.payload.visibleDurationMs),anomalies:result.events.filter(e=>e.type==='timing_anomaly'),sameAfterReload:true,chainComplete:true};out.pass=true;
 await writeFile(root+'retest-completion-result.json',JSON.stringify(result,null,2));await p.screenshot({path:root+'retest-completion.png',fullPage:true});assert.deepEqual(out.errors,[]);
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(root+'retest-completion.json',JSON.stringify(out,null,2));await browser.close()}
