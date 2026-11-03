import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium,webkit} from 'playwright'

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function waitForServer(server,origin){
 let output=''
 server.stdout.on('data',data=>{output+=data});server.stderr.on('data',data=>{output+=data})
 for(let i=0;i<100;i++){
  assert.equal(server.exitCode,null,`The test server exited before owning ${origin}: ${output}`)
  try{if(output.includes(origin)&&(await fetch(origin)).ok)return}catch{ /* starting */ }
  await pause(100)
 }
 assert.fail(`The test server did not become ready at ${origin}: ${output}`)
}
async function observeClosedRoots(page){
 await page.addInitScript(()=>{
  // Retain references for test observation only. Closed mode, real nodes,
  // input events, image decoding and product presentation checks stay native.
  window.__moneyTestRoots=[]
  const attach=Element.prototype.attachShadow
  Element.prototype.attachShadow=function(options){const root=attach.call(this,options);window.__moneyTestRoots.push(root);return root}
 })
 const state=()=>page.evaluate(()=>{
  const roots=[document,...window.__moneyTestRoots.filter(root=>root.host.isConnected)]
  const find=selector=>roots.flatMap(root=>[...root.querySelectorAll(selector)])
  return {stage:find('[data-money-stage]')[0]?.getAttribute('data-money-stage'),heading:find('h1,fieldset[data-money-stage]>legend')[0]?.textContent,
   buttons:find('button').map(button=>({text:button.textContent,disabled:button.disabled}))}
 })
 const click=async(text,selector='button')=>{
  for(let i=0;i<50;i++){
   const point=await page.evaluate(({text,selector})=>{
    const roots=[document,...window.__moneyTestRoots.filter(root=>root.host.isConnected)]
    const e=roots.flatMap(root=>[...root.querySelectorAll(selector)]).find(e=>e.textContent.trim()===text&&!e.disabled&&e.getBoundingClientRect().width>0)
    if(!e)return null
    e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}
   },{text,selector})
   if(point){await page.mouse.click(point.x,point.y);await page.waitForTimeout(120);return}
   await page.waitForTimeout(80)
  }
  throw Error('No enabled control '+text+'; '+JSON.stringify(await state()))
 }
 return {state,click}
}
async function root(page){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const request=indexedDB.open('assessment-practice-money-exchange-1-v1',1)
 request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('installation').objectStore('installation').get('root');read.onerror=()=>{db.close();reject(read.error)};read.onsuccess=()=>{db.close();resolve(read.result)}}
}))}
async function reachResponse(page,ui,origin,amount){
 await page.goto(origin+'/money.html');await page.waitForTimeout(300)
 await ui.click('Continue');await ui.click('$6','label');await ui.click('Check answer');await ui.click('Start')
 for(let i=0;i<4;i++)await ui.click('Next')
 assert.equal((await ui.state()).stage,'transfer')
 const point=await page.evaluate(()=>{const e=window.__moneyTestRoots.filter(r=>r.host.isConnected).flatMap(r=>[...r.querySelectorAll('input[type=text]')])[0];e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})
 await page.mouse.click(point.x,point.y);await page.keyboard.insertText(amount);await ui.click('Next')
 for(let i=0;i<40&&(await ui.state()).stage!=='response_ready';i++)await page.waitForTimeout(80)
 assert.equal((await ui.state()).stage,'response_ready')
}
async function expectStage(ui,page,stage){
 for(let i=0;i<50&&(await ui.state()).stage!==stage;i++)await page.waitForTimeout(50)
 assert.equal((await ui.state()).stage,stage,JSON.stringify(await ui.state()))
}
// WebKit page.screenshot() inserts/removes a HEAD stylesheet to sync animations.
// That is real owned-document tampering; never do it inside a functional journey.
async function capture(page,name){if(name.startsWith('money1-webkit-'))return;if(process.env.TRAITGAME_MONEY1_OUTPUT){await mkdir(process.env.TRAITGAME_MONEY1_OUTPUT,{recursive:true});await page.screenshot({path:resolve(process.env.TRAITGAME_MONEY1_OUTPUT,name+'.png')})}}

test('Money 1 completes the $2 exchange in WebKit and Chromium without treating laid-out SVG rounding as corrupt source',{timeout:120000},async()=>{
 const origin='http://127.0.0.1:4967',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4967','--strictPort'],{stdio:'pipe'})
 try{
  await waitForServer(server,origin)
  for(const [name,type]of [['webkit',webkit],['chromium',chromium]]){
   const browser=await type.launch()
   try{for(const viewport of[{width:1512,height:830},{width:1190,height:626},{width:375,height:667},{width:800,height:400}]){
    const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)))
    const ui=await observeClosedRoots(page)
    try{
     await reachResponse(page,ui,origin,'2');await ui.click('Next');await page.waitForTimeout(350)
     await capture(page,`money1-${name}-result-${viewport.width}`)
     assert.equal((await ui.state()).stage,'final_allocation','A normal decoded, visible result must not become incomplete')
     await ui.click('Next');await expectStage(ui,page,'fairness');await ui.click('4','label');await ui.click('Next')
     await expectStage(ui,page,'test_complete');await ui.click('Next');await expectStage(ui,page,'report')
     const run=Object.values((await root(page)).runs).find(run=>run.status==='complete')
     assert.ok(run);assert.equal(run.report.status,'complete_valid')
     for(const [key,value]of Object.entries({sentCents:200,returnedCents:246,selfCents:1046,partnerCents:354,rating:4}))assert.equal(run.report[key],value,key)
     assert.equal(run.events.filter(e=>e.kind==='return_presented').length,1);assert.equal(run.events.filter(e=>e.kind==='completed').length,1)
     assert.deepEqual(errors,[]);await capture(page,`money1-${name}-report-${viewport.width}`)
    }finally{await context.close()}
   }}finally{await browser.close()}
  }
 }finally{if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}}
})


test('Money 1 detached-size proof stays source-bound and cancellation-safe in WebKit',{timeout:120000},async()=>{
 const origin='http://127.0.0.1:4968',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4968','--strictPort'],{stdio:'pipe'})
 let browser
 try{
  await waitForServer(server,origin)
  browser=await webkit.launch()
  for(const fault of ['none','wrong-size','wrong-source','opacity','head-style','close','restart']){
   const context=await browser.newContext({viewport:{width:1512,height:830}}),page=await context.newPage()
   // Fault injection holds only a real detached decode, then corrupts its
   // dimensions or resource where requested. No receipt or journal is injected.
   await page.addInitScript(fault=>{
    const decode=HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode=async function(){
     await decode.call(this)
     if(!this.isConnected&&this.src.startsWith('data:image/svg+xml')){
      window.__detachedResultPending=true
      await new Promise(resolve=>setTimeout(resolve,1200))
      if(fault==='wrong-size')Object.defineProperty(this,'naturalWidth',{value:1})
      if(fault==='wrong-source'){
       this.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="680" height="240"/>'
       await decode.call(this)
      }
     }
    }
   },fault)
   const ui=await observeClosedRoots(page)
   try{
    await reachResponse(page,ui,origin,'2');await ui.click('Next')
    await page.waitForFunction(()=>window.__detachedResultPending===true)
    const pending=await ui.state()
    assert.equal(pending.stage,'final_allocation')
    for(const label of ['Next','More options'])assert.equal(pending.buttons.find(b=>b.text===label)?.disabled,true)
    for(const label of ['Close','Restart'])assert.equal(pending.buttons.find(b=>b.text===label)?.disabled,false)
    assert.equal(Object.values((await root(page)).runs)[0].events.filter(e=>e.kind==='return_presented').length,0)
    if(fault==='opacity')await page.evaluate(()=>window.__moneyTestRoots.filter(r=>r.host.isConnected).flatMap(r=>[...r.querySelectorAll('[data-money-result]')])[0].style.opacity='0')
    if(fault==='head-style')await page.evaluate(()=>{const style=document.createElement('style');style.textContent='body {}';document.head.append(style);style.remove()})
    if(fault==='close')await ui.click('Close')
    if(fault==='restart')await ui.click('Restart')
    await page.waitForTimeout(1600)
    const saved=Object.values((await root(page)).runs)[0]
    assert.equal(saved.events.filter(e=>e.kind==='return_presented').length,fault==='none'?1:0,fault)
    if(fault==='none'){
     assert.equal(saved.status,'active');await expectStage(ui,page,'final_allocation')
     await ui.click('Next');await expectStage(ui,page,'fairness')
    }else{
     assert.equal(saved.status,'incomplete',fault)
     assert.equal(saved.events.filter(e=>e.kind==='completed').length,0,fault)
    }
    if(fault==='close')assert.equal(new URL(page.url()).pathname,'/practice')
    if(fault==='restart')assert.equal((await ui.state()).heading,'Ready?')
   }finally{await context.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}}
})
