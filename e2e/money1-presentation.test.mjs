import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {firstPlay,games} from './live-game-audit.helper.mjs'

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function savedRoot(page){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const request=indexedDB.open('assessment-practice-money-exchange-1-v1',1)
 request.onerror=()=>reject(request.error)
 request.onsuccess=()=>{const db=request.result,read=db.transaction('installation').objectStore('installation').get('root');read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=()=>{db.close();reject(read.error)}}
}))}
async function heading(ui){return (await ui.snapshot()).find(item=>['H1','LEGEND'].includes(item.tag))?.text??''}
async function next(ui,page){
 for(let i=0;i<40;i++){
  const [id]=await ui.elements('button','Next',true)
  if(id&&!await ui.call(id,function(){return this.disabled})){await ui.click('Next');await page.waitForTimeout(120);return}
  if((await heading(ui))==='Checking your exchange')throw Error('Exchange stopped before its result was confirmed visible')
  await page.waitForTimeout(100)
 }
 throw Error('Next never became available: '+await heading(ui))
}

test('Money 1 confirms the complete visible result and saves the filmed $5 exchange on a phone',{timeout:60000},async()=>{
 const origin='http://127.0.0.1:4998',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4998','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await pause(100)}
  browser=await chromium.launch()
  const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:true}),page=await context.newPage()
  const ui=await firstPlay(page,games.find(game=>game[0]==='Money 1'),origin)
  try{
   for(let i=0;i<4;i++)await next(ui,page)
   assert.equal(await heading(ui),'Send an amount')
   const [input]=await ui.elements('input[type=text]')
   const point=await ui.call(input,function(){const r=this.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})
   await page.mouse.click(point.x,point.y);await page.keyboard.insertText('5')
   await next(ui,page)
   for(let i=0;i<30&&await heading(ui)==='Sending';i++)await page.waitForTimeout(100)
   assert.equal(await heading(ui),'Your partner has received the money')
   await next(ui,page)
   await page.waitForTimeout(400)
   const [image]=await ui.elements('[data-money-result]')
   const evidence={heading:await heading(ui),snapshot:await ui.snapshot(),root:await savedRoot(page)}
   if(process.env.TRAITGAME_BACK_OUTPUT){await mkdir(process.env.TRAITGAME_BACK_OUTPUT,{recursive:true});await writeFile(resolve(process.env.TRAITGAME_BACK_OUTPUT,'money1-phone-result.json'),JSON.stringify(evidence,null,2));await page.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,'money1-phone-result.png')})}
   assert.equal(evidence.heading,'The partner returned an amount','A normal phone exchange must stay on its confirmed result')
   assert.ok(image,'The complete result image must remain mounted')
   const rect=await ui.call(image,function(){const r=this.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}})
   assert.ok(rect.top>=0&&rect.bottom<=667&&rect.left>=0&&rect.right<=375,JSON.stringify(rect))
   const active=Object.values(evidence.root.runs).find(run=>run.status==='active')
   assert.equal(active.events.filter(event=>event.kind==='return_presented').length,1)
   await next(ui,page)
   assert.equal(await heading(ui),'How fair was the return?')
   await ui.click('10','input[type=radio]',true);await next(ui,page)
   assert.equal(await heading(ui),'Test Complete');await next(ui,page)
   assert.equal(await heading(ui),'Your exchange')
   const root=await savedRoot(page),run=Object.values(root.runs).find(item=>item.status==='complete')
   assert.ok(run)
   for(const [key,value]of Object.entries({sentCents:500,returnedCents:615,selfCents:1115,partnerCents:885,rating:10}))assert.equal(run.report[key],value,key)
   assert.equal(run.events.filter(event=>event.kind==='return_presented').length,1)
   assert.equal(run.events.filter(event=>event.kind==='completed').length,1)
  }finally{await ui.close();await context.close()}
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}}
})

async function reachTransfer(ui,page){for(let i=0;i<4;i++)await next(ui,page);assert.equal(await heading(ui),'Send an amount')}
async function enterAmount(ui,page,value){
 const [input]=await ui.elements('input[type=text]');assert.ok(input)
 const point=await ui.call(input,function(){const r=this.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})
 await page.mouse.click(point.x,point.y);await page.keyboard.insertText(value)
}
async function responseReady(ui,page){await next(ui,page);for(let i=0;i<30&&await heading(ui)==='Sending';i++)await page.waitForTimeout(100);assert.equal(await heading(ui),'Your partner has received the money')}

test('Money 1 keeps Next separate, both final balances readable and history/help unchanged across sizes',{timeout:90000},async()=>{
 const origin='http://127.0.0.1:4999',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4999','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await pause(100)}
  browser=await chromium.launch()
  for(const viewport of[{width:1005,height:805},{width:1920,height:1080},{width:375,height:667},{width:800,height:400}])for(const amount of ['5','0']){
   const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage(),errors=[]
   page.on('pageerror',error=>errors.push(String(error)))
   const ui=await firstPlay(page,games.find(game=>game[0]==='Money 1'),origin)
   const shot=async name=>{if(process.env.TRAITGAME_BACK_OUTPUT&&amount==='5'){await mkdir(process.env.TRAITGAME_BACK_OUTPUT,{recursive:true});await page.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,`money1-${name}-${viewport.width}.png`),fullPage:false})}}
   const bounds=async id=>ui.call(id,function(){const r=this.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}})
   try{
    await shot('award')
    const [firstNext]=await ui.elements('button','Next',true)
    assert.ok((await bounds(firstNext)).left>viewport.width/2,'Award Next is on the right')
    for(const text of['Restart','Close'])assert.equal((await ui.elements('button',text,true)).length,0)
    await ui.click('More options');await page.waitForTimeout(100);assert.equal((await ui.elements('button','Restart',true)).length,1)
    await ui.click('More options');await page.waitForTimeout(100);await reachTransfer(ui,page);await enterAmount(ui,page,amount)
    const [field]=await ui.elements('[data-money-stage]')
    assert.equal(await ui.call(field,function(){return !!this.querySelector('[data-site-nav]')}),false,'Site menu is outside the game card')
    await shot('transfer');await responseReady(ui,page);await next(ui,page);await page.waitForTimeout(250)
    assert.equal(await heading(ui),'The partner returned an amount')
    await shot('result')
    const [result]=await ui.elements('[data-money-result]'),rect=await bounds(result)
    assert.ok(rect.top>=0&&rect.bottom<=viewport.height&&rect.left>=0&&rect.right<=viewport.width,JSON.stringify({viewport,rect}))
    const [more]=await ui.elements('button','More options',true),[go]=await ui.elements('button','Next',true)
    assert.ok((await bounds(go)).left>(await bounds(more)).right,'Next is right of More options')
    assert.ok((await bounds(go)).bottom<=viewport.height,'Next remains in the viewport')
    await ui.click('More options');await page.waitForTimeout(100);for(const label of['Restart','Close'])assert.equal((await ui.elements('button',label,true)).length,1)
    const [focus]=await ui.elements('button','More options',true)
    assert.ok(await ui.call(focus,function(){return this.getRootNode().activeElement===this}),'Options retains keyboard focus')
    await ui.click('More options');await page.waitForTimeout(100)
    if(viewport.width===1005&&amount==='5'){
     await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter');await page.waitForTimeout(150)
     assert.equal(await heading(ui),'How fair was the return?','Native keyboard Next advances')
    }else if(viewport.width===375){
     const [nextButton]=await ui.elements('button','Next',true),point=await bounds(nextButton)
     await page.touchscreen.tap((point.left+point.right)/2,(point.top+point.bottom)/2);await page.waitForTimeout(150)
     assert.equal(await heading(ui),'How fair was the return?','Native touch Next advances')
    }else await next(ui,page)
    if(amount==='5')await ui.click('10','input[type=radio]',true)
    await shot('fairness');await next(ui,page);assert.equal(await heading(ui),'Test Complete');await next(ui,page)
    assert.equal(await heading(ui),'Your exchange');await shot('report')
    const facts=[];for(const id of await ui.elements('[data-money-fact]'))facts.push(await ui.call(id,function(){return this.textContent}))
    assert.deepEqual(facts,amount==='5'?['You finished with$11.15','Partner finished with$8.85']:['You finished with$10.00','Partner finished with$0.00'])
    const filled=[];for(const id of await ui.elements('button'))if(await ui.call(id,function(){return getComputedStyle(this).backgroundColor==='rgb(14, 116, 144)'}))filled.push(await ui.call(id,function(){return this.textContent}))
    assert.deepEqual(filled,['Try Again'],'One filled action on the report')
    await ui.click('Detailed numbers');await page.waitForTimeout(100);assert.equal((await ui.elements('button','How the amounts were calculated',true)).length,1)
    await ui.click('How the amounts were calculated');await page.waitForTimeout(150);assert.equal(await heading(ui),'How the amounts were calculated')
    await ui.click('Back to result');await page.waitForTimeout(150);assert.equal(await heading(ui),'Your exchange')
    const root=await savedRoot(page),run=Object.values(root.runs).find(item=>item.status==='complete')
    assert.ok(run);assert.equal(run.report.status,'complete_valid');assert.equal(run.report.rating,amount==='5'?10:null)
    assert.equal(run.events.filter(e=>e.kind==='return_presented').length,1)
    assert.equal(run.events.filter(e=>e.kind==='completed').length,1)
    await ui.click('History');await page.waitForTimeout(150);await ui.click('Open ME1-1 result');await page.waitForTimeout(150);assert.equal(await heading(ui),'Your exchange')
    const before=JSON.stringify(run)
    await page.reload();await page.waitForTimeout(500);await ui.click('Examples and saved results','summary',true);await ui.click('Saved results');await page.waitForTimeout(150)
    await ui.click('Open','button',true);await page.waitForTimeout(150)
    assert.equal(await heading(ui),'Your exchange')
    const reopened=Object.values((await savedRoot(page)).runs).find(item=>item.id===run.id)
    assert.equal(JSON.stringify(reopened),before,'Opening and reload preserve the immutable run')
    assert.deepEqual(errors,[])
   }catch(error){console.log(viewport,amount,await ui.snapshot());throw error}
   finally{await ui.close();await context.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}}
})

test('Money 1 preserves pending-proof exits and rejects altered result pixels',{timeout:60000},async()=>{
 const origin='http://127.0.0.1:4994',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4994','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await pause(100)}
  browser=await chromium.launch()
  for(const fault of['none','opacity','source','close','restart']){
   const context=await browser.newContext({viewport:{width:375,height:667}}),page=await context.newPage()
   // Fault injection: hold only the image-decode promise; no events/results are fabricated.
   await page.addInitScript(()=>{const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){await decode.call(this);if(this.hasAttribute('data-money-result'))await new Promise(resolve=>setTimeout(resolve,1200))}})
   const ui=await firstPlay(page,games.find(game=>game[0]==='Money 1'),origin)
   try{
    await reachTransfer(ui,page);await enterAmount(ui,page,'5');await responseReady(ui,page);await next(ui,page)
    assert.equal(await heading(ui),'The partner returned an amount')
    const [more]=await ui.elements('button','More options',true),[go]=await ui.elements('button','Next',true)
    assert.ok(await ui.call(more,function(){return this.disabled}));assert.ok(await ui.call(go,function(){return this.disabled}))
    const root=await savedRoot(page);assert.equal(Object.values(root.runs)[0].events.filter(e=>e.kind==='return_presented').length,0)
    for(const label of['Restart','Close'])assert.equal((await ui.elements('button',label,true)).length,1)
    if(fault==='opacity'||fault==='source'){
     const [image]=await ui.elements('[data-money-result]')
     await ui.call(image,function(fault){if(fault==='opacity')this.style.opacity='0';else this.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'},[fault])
    }else if(fault==='close')await ui.click('Close')
    else if(fault==='restart')await ui.click('Restart')
    await page.waitForTimeout(1450)
    const saved=Object.values((await savedRoot(page)).runs)[0]
    assert.equal(saved.events.filter(e=>e.kind==='return_presented').length,fault==='none'?1:0)
    if(fault==='none'){assert.equal(await heading(ui),'The partner returned an amount');await next(ui,page);assert.equal(await heading(ui),'How fair was the return?')}
    else{assert.equal(saved.status,'incomplete');assert.equal(saved.events.filter(e=>e.kind==='completed').length,0)}
    if(fault==='close')assert.equal(new URL(page.url()).pathname,'/practice')
    if(fault==='restart')assert.equal(await heading(ui),'Ready?')
   }finally{await ui.close();await context.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve))}}
})
