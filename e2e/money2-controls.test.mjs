import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {firstPlay,games} from './live-game-audit.helper.mjs'

test('Money 2 keeps exits below the choice and uses a compact report action row',{timeout:90000},async()=>{
 const origin='http://127.0.0.1:4984',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4984','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const size of[{width:1005,height:805},{width:375,height:667}]){
   const c=await browser.newContext({viewport:size}),p=await c.newPage(),ui=await firstPlay(p,games.find(g=>g[0]==='Money 2'),origin)
   const stage=async()=>{const [id]=await ui.elements('[data-money-stage]');return id?ui.call(id,function(){return this.getAttribute('data-money-stage')}):'missing'}
   let capturedChoice=false
   try{
    for(let i=0;i<50&&await stage()!=='report';i++){
     const current=await stage();console.log('Money2 native',size.width,i,current)
     if(current.startsWith('connecting_')||current==='checking'){await p.waitForTimeout(150);continue}
     if(current.startsWith('choice_')){
      const [range]=await ui.elements('input[type=range]');assert.ok(range)
      const rangeBox=await ui.call(range,function(){const r=this.getBoundingClientRect();return {bottom:r.bottom}})
      for(const label of['Restart','Close']){
       const [id]=await ui.elements('button',label,true);assert.ok(id)
       const box=await ui.call(id,function(){const r=this.getBoundingClientRect();return {top:r.top}})
       assert.ok(box.top>=rangeBox.bottom,`${label} must be below the choice controls at ${size.width}`)
      }
      assert.equal((await ui.elements('button','Back',true)).length,0,'No previous-trial Back during an exchange')
      if(!capturedChoice&&process.env.TRAITGAME_BACK_OUTPUT){await mkdir(process.env.TRAITGAME_BACK_OUTPUT,{recursive:true});await p.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,`money2-choice-${size.width}.png`),fullPage:false});capturedChoice=true}
      // Native pointer focus and key events on the existing amount slider.
      await ui.call(range,function(){this.scrollIntoView({block:'nearest'})});const box=await ui.call(range,function(){const r=this.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.mouse.click(box.x,box.y);await p.keyboard.press('ArrowRight');await ui.click('Confirm')
     }else{
      if(current.startsWith('fairness_'))await ui.click('4','input[type=radio]',true)
      const [id]=await ui.elements('button','Next',true)
      if(!id||await ui.call(id,function(){return this.disabled})){await p.waitForTimeout(150);continue}
      await ui.click('Next')
     }
     await p.waitForTimeout(180)
    }
    assert.equal(await stage(),'report','Both rounds must reach their saved report')
    for(const removed of['Previous page','Next page','Page 1','Page 2'])assert.equal((await ui.elements('button',removed,true)).length,0)
    for(const label of['Try again','Round 1','Round 2','Details','Main menu'])assert.equal((await ui.elements('button',label,true)).length,1)
    const filled=[];for(const id of await ui.elements('button'))if(await ui.call(id,function(){return getComputedStyle(this).backgroundColor==='rgb(14, 116, 144)'}))filled.push(await ui.call(id,function(){return this.textContent}))
    assert.deepEqual(filled,['Try again'],'Only Try again should be filled')
    await ui.click('Round 2');await p.waitForTimeout(200)
    assert.ok((await ui.elements('output','Round 2 ·',false)).length)
    const [round2]=await ui.elements('button','Round 2',true);assert.ok(await ui.call(round2,function(){return this.getRootNode().activeElement===this}),'Round 2 must retain focus after authority checking')
    await p.keyboard.press('Enter');await p.waitForTimeout(200);const [round2Again]=await ui.elements('button','Round 2',true);assert.ok(await ui.call(round2Again,function(){return this.getRootNode().activeElement===this}),'Keyboard activation must also retain Round 2 focus')
    await ui.click('Round 1');await p.waitForTimeout(200)
    assert.ok((await ui.elements('output','Round 1 ·',false)).length)
    await ui.click('Details');await p.waitForTimeout(200);assert.ok((await ui.elements('button','How the amounts were calculated',true)).length)
    const [details]=await ui.elements('button','Details',true);assert.ok(await ui.call(details,function(){return this.getRootNode().activeElement===this}),'Details must retain focus after authority checking')
    await ui.click('Details');await p.waitForTimeout(200);assert.equal((await ui.elements('button','How the amounts were calculated',true)).length,0)
    if(process.env.TRAITGAME_BACK_OUTPUT)await p.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,`money2-report-${size.width}.png`),fullPage:false})
    await ui.click('Main menu');await p.waitForTimeout(200)
    await ui.click('Skip guide using a completed saved run');await p.waitForTimeout(300)
    assert.equal(await stage(),'ready')
    await ui.click('Back','button',true);await p.waitForTimeout(300)
    assert.equal(await stage(),'library','Back after skipping must return directly to the guide, not the skipped quiz')
   }catch(e){console.log(size,JSON.stringify(await ui.snapshot()));throw e}
   finally{await ui.close();await c.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
