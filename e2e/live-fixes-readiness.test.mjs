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
  for(const size of[{width:1005,height:805},{width:1366,height:768}]){
   const context=await browser.newContext({viewport:size}),page=await context.newPage(),game=games.find(g=>g[0]==='Easy or Hard'),view=await firstPlay(page,game,origin)
   await view.click('Hard','button',false);await page.waitForTimeout(500)
   const [task]=await view.elements('.easy-hard-task');assert.ok(task)
   const box=await view.call(task,function(){const r=this.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})
   assert.ok(box.top>=0&&box.bottom<=size.height,`Task does not fit ${size.width}x${size.height}: ${JSON.stringify(box)}`)
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
