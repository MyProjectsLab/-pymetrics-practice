import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
const F=JSON.parse(await readFile(process.env.M5_FIXTURES??'/private/tmp/stop-m5-r1-r2-fixtures.json','utf8'))
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const b=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const p=await b.newPage({viewport:{width:1200,height:800}}),out={cases:[],errors:[]}
p.on('pageerror',e=>out.errors.push(String(e)))
const api=(fn,arg)=>p.evaluate(async({code,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts');return new Function('S','T','_s','arg',`return (${code})(S,T,_s,arg)`)(S,T,S.stopLocalStore(),arg)},{code:fn.toString(),arg})
const click=name=>p.getByRole('button',{name,exact:true}).click()
try {
 await p.goto('http://127.0.0.1:5217/');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 await api(async(S,T,_s,state)=>{await _s.deleteAll();await _s.mutate(x=>Object.assign(x,state))},F.state)
 await p.reload();await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 const draft=F.drafts.find(d=>d.mode==='retest'&&!d.realizedSequence.length)
 await api(async(S,T,_s,d)=>{await _s.saveDraft(d);window.realSave=_s.saveChain.bind(_s);_s.saveChain=async()=>{throw Error('transient')};T.updateTrainingChain({retestAttempts:[{sessionId:d.sessionId,formId:d.form.id,valid:false}]})},draft)
 await p.getByRole('button',{name:'Try saving training again',exact:true}).waitFor()
 await click('Stop history')
 await p.locator('article').filter({has:p.getByRole('button',{name:'Review attempt',exact:true})}).getByRole('button',{name:'Delete this result',exact:true}).click()
 await p.getByRole('alertdialog').getByRole('button',{name:'Delete this result',exact:true}).click()
 await p.getByRole('alertdialog').waitFor({state:'detached'})
 const first=await api(async(S,T,_s)=>{_s.saveChain=realSave;await T.retryTrainingSave();return {state:await _s.read(),active:T.currentTrainingChain(),status:T.trainingSaveStatus()}})
 assert.equal(first.active,null);assert.equal(first.status,'saved');assert(!first.state.drafts[draft.sessionId]);assert(first.state.retiredChains[F.chain.id]);assert.equal(first.state.retiredChains[F.chain.id].retestAttempts.length,0)
 out.cases.push({name:'delete a retest attempt linked only in failed queue',active:first.active,status:first.status,retired:true,retainedDrillEvents:first.state.retiredChains[F.chain.id].drillAttempts[0].events.length})
 // Delete a remaining drill from the already retired chain, then replay the old snapshot.
 await p.locator('article').filter({has:p.getByRole('button',{name:'Review drill attempt',exact:true})}).getByRole('button',{name:'Delete this result',exact:true}).click()
 await p.getByRole('alertdialog').getByRole('button',{name:'Delete this result',exact:true}).click()
 await p.getByRole('alertdialog').waitFor({state:'detached'})
 const second=await api(async(S,T,_s,chain)=>{let rejected=false;try{await _s.saveChain(chain)}catch{rejected=true}const state=await _s.read();return {rejected,active:state.activeChainId,retainedAttempts:state.retiredChains[chain.id].drillAttempts.length,admitted:S.inspectLocalState(state).activeChain}},F.chain)
 assert(second.rejected);assert.equal(second.active,null);assert.equal(second.retainedAttempts,0);assert.equal(second.admitted,null)
 // Load defense also rejects an old pre-repair store containing both retired and stale active entries.
 const old=await api(async(S,T,_s,chain)=>{await _s.mutate(state=>{state.chains[chain.id]=chain;state.activeChainId=chain.id});return !!S.inspectLocalState(await _s.read()).activeChain},F.chain)
 assert.equal(old,false)
 out.cases.push({name:'delete from retired chain, replay, and legacy contradictory reload',...second,legacyAdmitted:old})
 assert.equal(out.errors.length,0);console.log(JSON.stringify(out))
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}
finally{await writeFile(new URL('deletion-edges.json',import.meta.url),JSON.stringify(out,null,2));await b.close()}
