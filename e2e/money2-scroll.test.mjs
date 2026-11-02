import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {firstPlay,games} from './live-game-audit.helper.mjs'

test('Money2 report holds reading position during pending authority reads, then withdraws revoked data',{timeout:90000},async()=>{
 const origin='http://127.0.0.1:4989',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4989','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  const compiler=await createServer({server:{middlewareMode:true}})
  let replacement
  try{const core=await compiler.ssrLoadModule('/src/money-exchange-2/core.ts');replacement=core.initialRoot();core.validateRoot(replacement)}finally{await compiler.close()}
  browser=await chromium.launch()
  for(const size of[{width:1005,height:805},{width:375,height:667}]){
   const c=await browser.newContext({viewport:size}),p=await c.newPage()
   await p.addInitScript(()=>{
    // Controlled transaction-delivery delay only after the native report exists.
    const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')
    Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(callback){descriptor.set.call(this,typeof callback==='function'?function(event){const delay=this.mode==='readonly'&&this.db.name==='assessment-practice-money-exchange-2-v1'?window.__tgReadDelay||0:0;const run=()=>{if(this.mode==='readonly'&&window.__tgFailReads>0){window.__tgFailReads--;this.onerror?.call(this,new Event('error'))}else callback.call(this,event)};if(delay)setTimeout(run,delay);else run()}:callback)}})
   })
   const ui=await firstPlay(p,games.find(g=>g[0]==='Money 2'),origin)
   const stage=async()=>{const [id]=await ui.elements('[data-money-stage]');return ui.call(id,function(){return this.getAttribute('data-money-stage')})}
   try{
    for(let i=0;i<65&&await stage()!=='report';i++){
     const current=await stage();if(current.startsWith('fairness_'))await ui.click('4','input[type=radio]',true)
     const [next]=await ui.elements('button','Next',true);if(next&&!await ui.call(next,function(){return this.disabled}))await ui.click('Next')
     await p.waitForTimeout(100)
    }
    assert.equal(await stage(),'report');await p.waitForTimeout(400)
    // Keep heading focus, like a reader who scrolls without clicking a button.
    await p.mouse.wheel(0,1800);await p.waitForTimeout(200)
    const [surface]=await ui.elements('[data-money-stage]')
    const initial=await ui.call(surface,function(){return {height:this.getBoundingClientRect().height,y:scrollY}})
    assert.ok(initial.y>100,'The report must actually be scrolled down')
    await p.evaluate(()=>window.__tgReadDelay=240)
    let pendingSeen=false,resolvedSeen=false
    for(let i=0;i<50;i++){
     const now=await ui.call(surface,function(){return {height:this.getBoundingClientRect().height,y:scrollY,pending:this.textContent.includes('Saved amounts are hidden until local authority is confirmed.'),money:!!this.querySelector('[data-money-pair]')}})
     if(now.pending){pendingSeen=true;assert.equal(now.money,false,'Unconfirmed amounts stay hidden');assert.ok(Math.abs(now.height-initial.height)<2,'Pending read must not shrink report')}
     else if(pendingSeen)resolvedSeen=true
     assert.ok(Math.abs(now.y-initial.y)<2,`Passive report check moved scroll from ${initial.y} to ${now.y}`)
     await p.waitForTimeout(50)
    }
    assert.ok(pendingSeen&&resolvedSeen,'Exercise both pending and confirmed report renders')
    await p.evaluate(()=>window.__tgFailReads=1)
    let failedSeen=false,recovered=false
    for(let i=0;i<55;i++){
     const state=await ui.call(surface,function(){return {failed:this.textContent.includes('Local authority is unavailable.'),money:!!this.querySelector('[data-money-pair]')}})
     if(state.failed){failedSeen=true;assert.equal(state.money,false,'A failed read must hide old money')}
     if(failedSeen&&state.money){recovered=true;break}
     await p.waitForTimeout(50)
    }
    assert.ok(failedSeen&&recovered,'Transient read failure must recover after verified slow reread')
    await p.evaluate(()=>window.__tgReadDelay=0)
    await p.waitForTimeout(400)
    // Replace only this disposable installation with a source-validated empty root, under its normal data lock.
    await p.evaluate(replacement=>navigator.locks.request('assessment-practice-money-exchange-2-data-v1',()=>new Promise((resolve,reject)=>{const request=indexedDB.open('assessment-practice-money-exchange-2-v1',2);request.onsuccess=()=>{const db=request.result,tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(replacement,'root');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};request.onerror=()=>reject(request.error)})),replacement)
    await p.waitForTimeout(1800)
    // A different installation is rejected by Store before controller publication:
    // its route may still be 'report', but no previous saved content may remain.
    assert.equal((await ui.elements('[data-money-pair]')).length,0,'Unconfirmed replacement must hide previous amounts')
    assert.equal((await ui.elements('output','Completed and saved in this browser',true)).length,0)
    assert.equal((await ui.elements('button','Try again',true)).length,0,'No replay from unconfirmed report data')
    assert.equal((await ui.elements('button','Retry',true)).length,1)
    assert.ok((await ui.elements('output','Local authority is unavailable.',false)).length)
   }finally{await ui.close();await c.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
