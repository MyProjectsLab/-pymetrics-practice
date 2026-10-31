import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdir,writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { firstPlay,games } from './live-game-audit.helper.mjs'

// A production-browser audit, not jsdom or a simulated clock. Each independent
// context follows the public intro and native controls; no stored receipts or
// form answers/results are injected. A genuinely unsupported viewport is reported.
test('all twelve assessments: native entry, visible fonts, 10-second CLS and errors', {timeout:900000},async()=>{
 const port=Number(process.env.TRAITGAME_AUDIT_PORT||4975),origin=`http://127.0.0.1:${port}`,outputDir=process.env.TRAITGAME_AUDIT_OUTPUT||'/tmp/traitgame-live-game-audit'
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'})
 let output='',browser;server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x)
 const rows=[]
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(server.exitCode!==null)throw Error(output)}
  browser=await chromium.launch({headless:true});await mkdir(outputDir,{recursive:true})
  for(const size of [{width:1005,height:805},{width:1920,height:1080},{width:375,height:667}])for(const game of games){
   const context=await browser.newContext({viewport:size,hasTouch:true}),page=await context.newPage(),errors=[],pageErrors=[]
   page.on('pageerror',e=>{errors.push(String(e));pageErrors.push(String(e))});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
   await context.addInitScript(()=>{
    Object.defineProperty(navigator,'doNotTrack',{value:'1',configurable:true})
    window.gameAudit={active:false,cls:0,raw:0,session:0,start:0,last:0,shifts:[]}
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(window.gameAudit.active){window.gameAudit.raw+=e.value;if(!e.hadRecentInput){const m=window.gameAudit;if(m.last===0||e.startTime-m.last>1000||e.startTime-m.start>5000){m.session=0;m.start=e.startTime}m.session+=e.value;m.last=e.startTime;m.cls=Math.max(m.cls,m.session);}window.gameAudit.shifts.push({value:e.value,recent:e.hadRecentInput})}}).observe({type:'layout-shift',buffered:true})
   })
   const row={pageErrors,game:game[0],size:`${size.width}x${size.height}`,status:'PLAY',smallText:[],cls:null,errors}
   let ui
   try{
    ui=await firstPlay(page,game,origin)
    // The stable play container must actually exist, rather than a successful
    // click being mistaken for a successful start.
    const nodes=await ui.elements(game[2]);if(!nodes.length)throw Error('First play not reached: '+JSON.stringify((await ui.snapshot()).map(x=>x.text).slice(0,8)))
    const initial=await ui.call(nodes[0],function(){const r=this.getBoundingClientRect();return {height:r.height,top:r.top}})
    await page.evaluate(()=>{window.gameAudit.active=true})
    const small=new Map();let maxHeightDelta=0,missing=0
    for(let second=0;second<10;second++){
     for(const item of await ui.fonts())if(item.size<15)small.set(`${item.text}:${item.size}`,item)
     const current=await ui.elements(game[2]);if(!current.length)missing++
     else {const height=await ui.call(current[0],function(){return this.getBoundingClientRect().height});maxHeightDelta=Math.max(maxHeightDelta,Math.abs(height-initial.height))}
     // Exercise an actual state change where a passive wait would miss it.
     if(game[0]==='Cards')await ui.click('Deck B','button',false)
     if(game[0]==='Keypresses')await page.keyboard.press('Space')
     if(game[0]==='Easy or Hard'&&second===0)await ui.click('Hard','button',false)
     await page.waitForTimeout(1000)
    }
    const measured=await page.evaluate(()=>{window.gameAudit.active=false;return window.gameAudit})
    Object.assign(row,{cls:Number(measured.cls.toFixed(5)),rawShift:Number(measured.raw.toFixed(5)),smallText:[...small.values()],maxHeightDelta,missing})
    await page.screenshot({path:`${outputDir}/${game[0].replaceAll(' ','-')}-${row.size}.png`})
   }catch(e){row.status='BLOCKED';row.reason=e.message;row.snapshot=e.snapshot||await ui?.snapshot()}
   finally{await ui?.close().catch(()=>{});await context.close()}
   rows.push(row);console.log(JSON.stringify(row));await writeFile(`${outputDir}/all12.json`,JSON.stringify(rows,null,2))
  }
  // Do not manufacture passing desktop/phone support when an admission guard
  // refused play. Blocked rows remain explicit review findings in the table.
  assert.equal(rows.length,36)
  assert.equal(rows.flatMap(r=>r.pageErrors).length,0,'Uncaught browser errors; console diagnostics are reported separately in the table')
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
