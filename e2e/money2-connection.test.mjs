import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {firstPlay,games} from './live-game-audit.helper.mjs'

test('Money2 connection stays readable with either motion setting and cannot advance after exit',{timeout:45000},async()=>{
 const origin='http://127.0.0.1:4990',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4990','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const kind of['normal','reduced','Close','Restart']){
   const c=await browser.newContext({viewport:{width:1005,height:805},reducedMotion:kind==='reduced'?'reduce':'no-preference'}),p=await c.newPage(),ui=await firstPlay(p,games.find(g=>g[0]==='Money 2'),origin)
   const stage=async()=>{const [id]=await ui.elements('[data-money-stage]');return ui.call(id,function(){return this.getAttribute('data-money-stage')})}
   try{
    const [surface]=await ui.elements('[data-money-stage]')
    await ui.call(surface,function(){window.__tgStages=[];new MutationObserver(()=>window.__tgStages.push({stage:this.getAttribute('data-money-stage'),at:performance.now()})).observe(this,{attributes:true,attributeFilter:['data-money-stage']})})
    await ui.click('Next');await p.waitForTimeout(650);assert.equal(await stage(),'connecting_1','Connection text still visible after650ms')
    const [next]=await ui.elements('button','Next',true);assert.ok(await ui.call(next,function(){return this.disabled}))
    if(kind==='Close'||kind==='Restart'){
     await ui.click('More options');await ui.click(kind);await p.waitForTimeout(1800);assert.equal(await stage(),kind==='Close'?'library':'ready','Old timer cannot advance an exited connection')
    }else{
     await p.waitForTimeout(1000);assert.equal(await stage(),'connected_1')
     const events=await p.evaluate(()=>window.__tgStages),a=events.find(e=>e.stage==='connecting_1'),b=events.find(e=>e.stage==='connected_1');assert.ok(a&&b);assert.ok(b.at-a.at>=1450&&b.at-a.at<2500,`Connection duration ${b.at-a.at}ms`)
     console.log(kind,'connection ms',b.at-a.at)
    }
   }finally{await ui.close();await c.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
