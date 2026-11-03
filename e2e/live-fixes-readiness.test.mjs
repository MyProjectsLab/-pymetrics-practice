import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { gameBrowser } from './game-browser.helper.mjs'
import { firstPlay,games } from './live-game-audit.helper.mjs'

test('ready controls and compact task layouts retain their real admission checks',{timeout:90000},async()=>{
 const origin='http://127.0.0.1:4977',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4977','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  const c=await browser.newContext({viewport:{width:1005,height:805}}),p=await c.newPage(),ui=await gameBrowser(p)
  await p.goto(origin+'/mouth-v13.html');await p.waitForTimeout(300);await ui.click('Continue');await ui.click('Short uses Left','input',false);await ui.click('Check answers');await p.waitForTimeout(200)
  const start=async()=>{const [id]=await ui.elements('button','Start',true);return ui.call(id,function(){return this.disabled})}
  assert.equal(await start(),true,'The quiz alone must not skip the physical key check')
  assert.ok((await ui.elements('p','Press and release Left arrow, then Right arrow to enable Start.',true)).length,'The Start prerequisite must be explained beside the preview')
  await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);assert.equal(await start(),false)
  await p.mouse.wheel(0,1000);await p.waitForTimeout(150);assert.equal(await start(),true,'An offscreen preview must withdraw readiness')
  await p.mouse.wheel(0,-2000);await p.waitForTimeout(150);assert.equal(await start(),false,'Scroll back must refresh readiness without resizing')
  await ui.click('Start');await p.waitForTimeout(300);assert.ok((await ui.elements('button','End this attempt',true)).length)
  await ui.close();await c.close()
  for(const size of[{width:1005,height:805},{width:1366,height:768},{width:375,height:667}]){
   const context=await browser.newContext({viewport:size}),page=await context.newPage(),game=games.find(g=>g[0]==='Easy or Hard'),view=await firstPlay(page,game,origin)
   await view.click('Hard','button',false);await page.waitForTimeout(500)
   const [task]=await view.elements('.easy-hard-task');assert.ok(task)
   const box=await view.call(task,function(){const r=this.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})
   const [timer]=await view.elements('.easy-hard-top p:last-child strong')
   assert.ok(await view.call(timer,function(){
    const range=document.createRange();range.selectNodeContents(this)
    const rects=[...range.getClientRects()]
    return rects.length>0&&rects.every(rect=>Math.abs(rect.top-rects[0].top)<1)
   }),'The timer value and unit fit on one line')
   assert.ok(box.top>=0&&box.bottom<=size.height,`Task does not fit ${size.width}x${size.height}: ${JSON.stringify(box)}`)
   await view.close();await context.close()
  }
  for(const size of[{width:1005,height:805},{width:1920,height:1080},{width:375,height:667}]){
   const context=await browser.newContext({viewport:size}),page=await context.newPage()
   const view=await firstPlay(page,games.find(g=>g[0]==='Faces'),origin)
   for(let index=1;index<=14;index++){
    let choices=[]
    for(let attempt=0;attempt<30;attempt++){
     const state=await view.snapshot()
     const current=(await view.elements('.question-top > span:first-child',`Item ${index} of 14`,true)).length
     choices=state.filter(row=>row.tag==='BUTTON'&&!['Restart','Close'].includes(row.text))
     if(current&&choices.length===10&&choices.every(row=>!row.disabled))break
     choices=[]
     await page.waitForTimeout(80)
    }
    assert.equal(choices.length,10,`Faces item ${index} must accept choices at ${size.width}px`)
    for(const choice of choices)assert.ok(choice.box.y>=0&&choice.box.y+choice.box.height<=size.height,
     `Faces item ${index}: ${choice.text} requires scrolling at ${size.width}×${size.height}`)
    await view.click('Anger')
   }
   for(let attempt=0;attempt<30&&!(await view.elements('button','Next — see report',true)).length;attempt++)await page.waitForTimeout(80)
   await view.click('Next — see report')
   for(let attempt=0;attempt<30&&!(await view.elements('h1','Your Faces result',true)).length;attempt++)await page.waitForTimeout(80)
   assert.equal((await view.elements('h1','Your Faces result',true)).length,1)
   await view.close();await context.close()
  }
  for(const touch of[false,true]){
   const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:touch}),page=await context.newPage()
   let view
   if(touch){
    view=await gameBrowser(page)
    await page.goto(origin+'/arrows.html');await page.waitForTimeout(350)
    await view.click('Continue');await view.click('Follow the four side','input[type=radio]',false)
    await view.click('Check answers');await view.click('Use mouse or touch')
    await view.click('Mouse, touch or pen buttons','input[type=radio]',false)
    for(const label of['Check Left','Check Right']){
     const [id]=await view.elements('button',label,true)
     const point=await view.call(id,function(){this.scrollIntoView({block:'nearest'});const r=this.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})
     await page.touchscreen.tap(...point)
    }
    await view.click('Start')
   }else view=await firstPlay(page,games.find(g=>g[0]==='Arrows'),origin)
   await page.waitForTimeout(850)
   const [stage]=await view.elements('fieldset[aria-label="Arrows visual task display"]')
   assert.ok(stage,`Arrows must start at 375px with ${touch?'touch':'keyboard'}`)
   assert.ok(await view.call(stage,function(){
    const r=this.getBoundingClientRect()
    return r.left>=0&&r.right<=375&&r.top>=0&&r.bottom<=667
   }),'Arrows protected stage fits in the viewport')
   await view.close();await context.close()
  }
  const phone=await browser.newContext({viewport:{width:375,height:667}}),page=await phone.newPage(),view=await gameBrowser(page)
  await page.goto(origin+'/practice/balloons');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('radio',{name:/Only this balloon/}).check();await page.getByRole('button',{name:'Check answer',exact:true}).click()
  const labels=page.locator('.balloons-ready .balloons-identity-label'),actions=page.locator('.balloons-ready .balloons-actions')
  const lastBottom=await labels.evaluateAll(nodes=>Math.max(...nodes.map(n=>n.getBoundingClientRect().bottom)))
  assert.ok((await actions.boundingBox()).y-lastBottom>=23.9)
  assert.equal(await labels.locator('span').first().evaluate(e=>getComputedStyle(e,'::before').content),'none')
  await page.getByRole('button',{name:'Pump',exact:true}).click();await page.getByRole('button',{name:'Collect',exact:true}).click();await page.waitForTimeout(150)
  const button=page.getByRole('button',{name:'Start',exact:true}),box=await button.boundingBox();assert.ok(await button.isEnabled());assert.ok(box.y>=0&&box.y+box.height<=667)
  await view.close();await phone.close()
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
