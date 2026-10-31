import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import{resolve}from'node:path'
import{chromium}from'playwright'
import{firstPlay,games}from'./live-game-audit.helper.mjs'
const origin='http://127.0.0.1:4976'
async function inertExtension(page){await page.evaluate(()=>{
 document.documentElement.dataset.extension='enabled';document.documentElement.classList.add('translator-marker');document.body.dataset.passwordManager='ready'
 const style=document.createElement('style');style.textContent='.unrelated-extension-marker { color:blue }';document.head.append(style)
 const host=document.createElement('aside');host.className='unrelated-extension-marker';host.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px';host.textContent='Extension';document.body.append(host)
})}
test('outside extension additions are harmless; owned and external paint tampering still stop play',{timeout:120000},async()=>{
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4976','--strictPort'],{stdio:'pipe'});let browser
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch()
  for(const name of['Arrows','Money 2'])for(const mutation of['inert','variables','owned','pseudo','transform','overlay','critical-head','critical-body','viewport-body',...(name==='Money 2'?['padding','margin','inset','transient-title','transient-charset','transient-viewport','transient-paint']:[])]){
   const context=await browser.newContext({viewport:{width:1005,height:805}}),page=await context.newPage()
   await context.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1',configurable:true}))
   const game=games.find(g=>g[0]===name),ui=await firstPlay(page,game,origin,inertExtension)
   assert.ok((await ui.elements(game[2])).length,`${name} did not start with inert extension`)
   if(mutation==='variables'){await page.evaluate(()=>{const style=document.createElement('style');style.textContent='body { --ap-panel-width:1px !important; --ap-button-height:1px !important; --ap-font-body:1px !important }';document.head.append(style)});await page.waitForTimeout(1100);const [id]=await ui.elements('button');assert.ok(id);const h=await ui.call(id,function(){return this.getBoundingClientRect().height});assert.equal(h,56);const w=await ui.call(id,function(){return (this.closest('fieldset')||this.getRootNode().querySelector('fieldset')).getBoundingClientRect().width});assert.ok(w>=(name==='Money 2'?900:400));assert.equal((await ui.snapshot()).some(x=>/Display changed|document changed/.test(x.text)),false)}
   else if(mutation==='inert'){await inertExtension(page);if(name==='Money 2')await ui.click('Next');await page.waitForTimeout(1100);assert.equal((await ui.snapshot()).some(x=>/document changed|Display changed/.test(x.text)),false)}
   else{
    if(['critical-head','critical-body','viewport-body'].includes(mutation))await page.evaluate(kind=>{const node=document.createElement(kind==='viewport-body'?'meta':'base');if(kind==='viewport-body'){node.name='viewport';node.content='width=200'}else node.href='https://example.invalid/';(kind==='critical-head'?document.head:document.body).append(node)},mutation)
    else if(mutation.startsWith('transient-')&&mutation!=='transient-paint')await page.evaluate(kind=>{
      const selector=kind==='transient-title'?'title':kind==='transient-charset'?'meta[charset]':'meta[name=viewport]'
      const node=document.querySelector(selector),parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next)
    },mutation)
    else if(mutation==='transient-paint')await page.evaluate(async()=>{const style=document.createElement('style');style.textContent='html { padding-top:200px!important }';document.head.append(style);await new Promise(r=>setTimeout(r,100));style.remove()})
    else if(['padding','margin','inset'].includes(mutation))await page.evaluate(kind=>{const style=document.createElement('style');style.textContent=kind==='padding'?'html { padding-top:200px!important }':kind==='margin'?'body { margin-top:200px!important }':'body { position:relative!important;top:200px!important }';document.head.append(style)},mutation)
    else if(mutation==='owned'){
     const ids=await ui.elements(name==='Arrows'?'img':'button');assert.ok(ids.length)
     await ui.call(ids[0],function(){if(this.tagName==='IMG')this.setAttribute('src','data:,changed');else this.textContent='tampered'})
    }else await page.evaluate(kind=>{
     const style=document.createElement('style');style.textContent=kind==='pseudo'?"body::before { content:'';position:fixed;inset:0;background:black;pointer-events:none;z-index:999999 }":kind==='transform'?'body { transform:translateX(10px)!important }':'.cover { position:fixed;inset:0;background:black;pointer-events:none;z-index:999999 }';document.head.append(style)
     if(kind==='overlay'){const div=document.createElement('div');div.className='cover';document.documentElement.append(div)}
    },mutation)
    await page.waitForTimeout(1200)
    const paragraphs=[];for(const id of await ui.elements('p,output'))paragraphs.push(await ui.call(id,function(){return this.textContent}));const text=(await ui.snapshot()).map(x=>x.text).concat(paragraphs).join(' ')
    assert.match(text,name==='Arrows'?/Invalid attempt\.|document changed|technical/i:/Display changed/,`${name} ${mutation} was not rejected: ${text}`)
   }
   await ui.close();await context.close()
  }
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r))}}
})
