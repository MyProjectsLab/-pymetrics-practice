import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {gameBrowser} from './game-browser.helper.mjs'
import {games} from './live-game-audit.helper.mjs'

const guidePurpose = {
 Stop: 'Reacting quickly to one signal while holding back for another',
 Balloons: 'Deciding how much risk to take',
 Keypresses: 'How quickly you can repeat a keypress',
 Arrows: 'Staying focused on the relevant arrows',
 Lengths: 'Spotting a small visual difference',
 Digits: 'Holding a short sequence in memory',
 Cards: 'Learning from gains and losses',
 'Easy or Hard': 'Weighing how much effort',
 Towers: 'Planning a sequence of moves',
 'Money 1': 'This exercise explores trust under uncertainty',
 'Money 2': 'This task explores how you share money and judge fairness',
 Faces: 'This task explores how you use facial clues',
}

// Native clicks/keys only. Inspect author-owned closed roots without altering them.
test('all twelve preparation flows return to their visited screen with Back below content', {timeout:120000}, async()=>{
 const origin='http://127.0.0.1:4979',server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4979','--strictPort'],{stdio:'pipe'})
 let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const size of [{width:1005,height:805},{width:375,height:667}]) for(const [name,path] of games){
   const context=await browser.newContext({viewport:size}),page=await context.newPage(),ui=await gameBrowser(page)
   const click=async(label,selector='button',exact=true)=>{await ui.click(label,selector,exact);await page.waitForTimeout(150)}
   try{
    await page.goto(origin+path);await page.waitForTimeout(400)
    const initial=(await ui.snapshot()).filter(n=>/^H[12]$/.test(n.tag)).map(n=>n.text)
    const advance = name === 'Money 2' ? 'Next' : 'Continue'
    const [purpose] = await ui.elements('p,output', guidePurpose[name])
    const [advanceButton] = await ui.elements('button', advance, true)
    assert.ok(purpose && advanceButton, `${name}: first screen must explain the purpose before continuing`)
    const purposeBottom = await ui.call(purpose, function () { return this.getBoundingClientRect().bottom })
    const advanceTop = await ui.call(advanceButton, function () { return this.getBoundingClientRect().top })
    assert.ok(purposeBottom <= advanceTop, `${name}: purpose should be above the advance button`)
    if (name === 'Lengths') {
     assert.equal((await ui.elements('p', 'If the mouth is short, choose Short.')).length, 1)
     assert.equal((await ui.elements('li', 'With the default keyboard controls, Left arrow means Short and Right arrow means Long.')).length, 1)
    }
    await click(advance)
    const [back]=await ui.elements('button','Back',false);assert.ok(back,`${name}: no Back on second screen`)
    const buttons=await ui.snapshot(),backBox=buttons.find(n=>n.tag==='BUTTON'&&/^(← )?Back$/.test(n.text))
    assert.ok(backBox,`${name}: exact previous-screen action missing`)
    const headingBottom=Math.max(...buttons.filter(n=>/^H[12]$/.test(n.tag)||n.tag==='LEGEND').map(n=>n.box.y+n.box.height))
    assert.ok(backBox.box.y>=headingBottom,`${name}: Back is above content`)
    await click('Back','button',false)
    const restored=(await ui.snapshot()).filter(n=>/^H[12]$/.test(n.tag)).map(n=>n.text)
    assert.deepEqual(restored,initial,`${name}: Back did not return to actual first screen`)
    assert.equal((await ui.elements('button','← Back',true)).length,0,`${name}: stale Back on first screen`)
    await click(name==='Money 2'?'Next':'Continue')
    const radio={Stop:'Press Space once.',Balloons:'Only this balloon',Keypresses:'Only after GO',Arrows:'Follow the four side',Lengths:'Short uses Left',Digits:'Same digits, same order',Cards:'A draw can lose money;','Easy or Hard':'Easy needs five presses',Towers:'Only the top disk','Money 1':'$6','Money 2':'You $8.00',Faces:'Choose one label; after'}[name]
    const check={Stop:'Check',Balloons:'Check answer',Keypresses:'Check answer',Arrows:'Check answers',Lengths:'Check answers',Digits:'Check answer',Cards:'Check answers','Easy or Hard':'Check answers',Towers:'Check answer','Money 1':'Check answer','Money 2':'Check',Faces:'Check answers'}[name]
    const quiz=(await ui.snapshot()).filter(n=>/^H[12]$/.test(n.tag)).map(n=>n.text)
    await click(radio,'input[type=radio]',false);await click(check)
    if(name==='Stop'){
     await click('Back','button',false)
     await click('Press Space once.','input[type=radio]',false);await click('Check')
     await click('Do nothing.','input[type=radio]',false);await click('Check')
    }
    await click('Back','button',false);await page.waitForTimeout(250)
    const returned=(await ui.snapshot()).filter(n=>/^H[12]$/.test(n.tag)).map(n=>n.text)
    assert.deepEqual(returned,name==='Stop'?['A NO-GO symbol appears. What do you do?']:quiz,`${name}: ready Back did not restore the previous rule screen`)
    if(name==='Money 2'){
     await click('Back','button',false);assert.deepEqual((await ui.snapshot()).filter(n=>/^H[12]$/.test(n.tag)).map(n=>n.text),initial,'Money2: duplicated intermediate library visit')
    }
    console.log(`${name} ${size.width}: previous screen restored; ready Back restored; Back below content`)
   }catch(e){console.log(name,JSON.stringify(await ui.snapshot()));throw e}
   finally{await ui.close();await context.close()}
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
