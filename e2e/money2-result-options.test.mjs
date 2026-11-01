import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {firstPlay,games} from './live-game-audit.helper.mjs'

test('Money2 options cannot replace a pending result proof and existing exits remain available',{timeout:60000},async()=>{
 const origin='http://127.0.0.1:4985',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4985','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const exitDuringProof of[false,true]){
   const c=await browser.newContext({viewport:{width:1005,height:805}}),p=await c.newPage()
   // Controlled slow image decode only, to hold the real result-receipt window open.
   await p.addInitScript(()=>{const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){await decode.call(this);if(this.hasAttribute('data-money-result'))await new Promise(r=>setTimeout(r,1200))}})
   const ui=await firstPlay(p,games.find(g=>g[0]==='Money 2'),origin)
   const stage=async()=>{const [id]=await ui.elements('[data-money-stage]');return ui.call(id,function(){return this.getAttribute('data-money-stage')})}
   try{
    for(let i=0;i<30&&!(await stage()).startsWith('choice_');i++){
     const [next]=await ui.elements('button','Next',true);if(await ui.call(next,function(){return this.disabled})){await p.waitForTimeout(80);continue}
     await ui.click('Next');await p.waitForTimeout(80)
    }
    assert.equal(await stage(),'choice_1');await ui.click('Next');await p.waitForTimeout(40)
    assert.equal(await stage(),'result_1')
    const [more]=await ui.elements('button','More options',true),[next]=await ui.elements('button','Next',true)
    assert.ok(await ui.call(next,function(){return this.disabled}),'Receipt really is pending')
    assert.ok(await ui.call(more,function(){return this.disabled}),'Options cannot replace the unconfirmed result image')
    for(const label of['Restart','Close'])assert.equal((await ui.elements('button',label,true)).length,1,'Original exit remains reachable while proof is pending')
    if(exitDuringProof){await ui.click('Close');await p.waitForTimeout(1500);assert.equal(await stage(),'library','Closing before receipt stays closed after late decode')}
    else{
     const box=await ui.call(more,function(){const r=this.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.mouse.click(box.x,box.y)
     await p.waitForTimeout(1500);assert.equal(await stage(),'result_1')
     const [ready]=await ui.elements('button','Next',true);assert.equal(await ui.call(ready,function(){return this.disabled}),false,'Receipt completes after attempted early click')
     assert.equal((await ui.elements('button','Close',true)).length,0,'Secondary exits collapse after confirmation')
     await ui.click('More options');assert.equal((await ui.elements('button','Close',true)).length,1)
     await ui.click('More options');await ui.click('Next');await p.waitForTimeout(100);assert.equal(await stage(),'fairness_1')
    }
   }finally{await ui.close();await c.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
