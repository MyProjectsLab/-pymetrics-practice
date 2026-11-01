import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {firstPlay,games} from './live-game-audit.helper.mjs'

test('Money 2 keeps the slider below the amount, Next right, secondary exits separate and report compact',{timeout:90000},async()=>{
 const origin='http://127.0.0.1:4984',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4984','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const size of[{width:1005,height:805},{width:1920,height:1080},{width:375,height:667}]){
   const c=await browser.newContext({viewport:size}),p=await c.newPage(),ui=await firstPlay(p,games.find(g=>g[0]==='Money 2'),origin)
   const stage=async()=>{const [id]=await ui.elements('[data-money-stage]');return id?ui.call(id,function(){return this.getAttribute('data-money-stage')}):'missing'}
   const errors=[];p.on('pageerror',error=>errors.push(String(error)))
   let capturedChoice=false,capturedConnection=false,capturedFairness=false
   const capture=async name=>{if(process.env.TRAITGAME_BACK_OUTPUT){await mkdir(process.env.TRAITGAME_BACK_OUTPUT,{recursive:true});await p.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,`money2-${name}-${size.width}.png`),fullPage:false})}}
   const bounds=async id=>ui.call(id,function(){const r=this.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}})
   try{
    for(let i=0;i<50&&await stage()!=='report';i++){
     const current=await stage();console.log('Money2 native',size.width,i,current)
     if(current.startsWith('connecting_')||current==='checking'){await p.waitForTimeout(150);continue}
     if(current.startsWith('connected_')&&!capturedConnection){assert.ok((await ui.elements('output','simulated partner.',false)).length);await capture('connection');capturedConnection=true}
     if(current.startsWith('choice_')){
      const [range]=await ui.elements('input[type=range]');assert.ok(range)
      const [tile]=await ui.elements('[data-decision-value]'),[pair]=await ui.elements('[data-money-pair]'),[next]=await ui.elements('button','Next',true),[more]=await ui.elements('button','More options',true)
      assert.ok(tile&&pair&&next&&more)
      const t=await bounds(tile),n=await bounds(next),m=await bounds(more)
      const r=await bounds(range);assert.ok(r.top>=t.bottom,'Slider must not overlap amount')
      assert.ok(n.left>m.right,'Next is right of separate More options')
      assert.equal((await ui.elements('button','Restart',true)).length,0)
      assert.equal((await ui.elements('button','Close',true)).length,0)
      await ui.click('More options');await p.waitForTimeout(80)
      for(const label of['Restart','Close']){
       const [id]=await ui.elements('button',label,true);assert.ok(id)
       const box=await bounds(id),[currentRange]=await ui.elements('input[type=range]');assert.ok(box.top>=(await bounds(currentRange)).bottom,`${label} below task`)
      }
      const [options]=await ui.elements('button','More options',true)
      assert.ok(await ui.call(options,function(){return this.getRootNode().activeElement===this}),'Options retains focus')
      await ui.click('More options');await p.waitForTimeout(80)
      assert.equal((await ui.elements('button','Back',true)).length,0,'No previous-trial Back during an exchange')
      if(!capturedChoice&&process.env.TRAITGAME_BACK_OUTPUT){await mkdir(process.env.TRAITGAME_BACK_OUTPUT,{recursive:true});await p.screenshot({path:resolve(process.env.TRAITGAME_BACK_OUTPUT,`money2-choice-${size.width}.png`),fullPage:false});capturedChoice=true}
      // Native pointer focus and key events on the existing amount slider.
      await ui.call(range,function(){this.scrollIntoView({block:'nearest'})});const box=await ui.call(range,function(){const r=this.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.mouse.click(box.x,box.y);await p.keyboard.press('ArrowRight');await ui.click('Next')
     }else{
      if(current.startsWith('fairness_')){
       const [next]=await ui.elements('button','Next',true);assert.ok(await ui.call(next,function(){return this.disabled}),'No preset fairness answer')
       await ui.click('4','input[type=radio]',true);await p.waitForTimeout(80)
       const [rating]=await ui.elements('input[type=radio]','4',true);assert.ok(await ui.call(rating,function(){return this.checked&&this.getRootNode().activeElement===this}),'Rating and focus survive render')
       if(!capturedFairness){await capture('fairness');capturedFairness=true}
      }
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
    await ui.click('Next');await ui.click('You $8.00','input[type=radio]',false);await ui.click('Check');await p.waitForTimeout(200);await ui.click('Start');await p.waitForTimeout(200)
    await ui.click('More options');await ui.click('Restart');await p.waitForTimeout(250);assert.equal(await stage(),'ready','Existing Restart still opens unarmed Ready')
    await ui.click('Start');await p.waitForTimeout(250);await ui.click('More options');await ui.click('Close');await p.waitForTimeout(250);assert.equal(await stage(),'library','Existing Close still settles and exits')
    assert.deepEqual(errors,[],'No uncaught browser errors')
   }catch(e){console.log(size,JSON.stringify(await ui.snapshot()));throw e}
   finally{await ui.close();await c.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
