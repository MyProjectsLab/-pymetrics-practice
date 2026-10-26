import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=[]
const origin=process.env.ARROWS_QA_ORIGIN || 'http://127.0.0.1:4193'
async function probe(name, fn, options={}) {
 if(process.env.AUDIT_FOCUS && !new RegExp(process.env.AUDIT_FOCUS).test(name))return
 const context=await browser.newContext({viewport:{width:1000,height:800}})
 const page=await context.newPage()
 try {
  await page.goto(origin)
  await page.evaluate(async options=>{
   if(!options.app)document.body.replaceChildren(); document.documentElement.style.overflow='hidden'
   const {ArrowsStore}=await import('/src/arrows/storage.ts')
   const {ArrowsEntry}=await import('/src/arrows/entry.ts')
   const {ArrowsBrowserRun}=await import('/src/arrows/browser.ts')
   const host=document.createElement('div'); Object.assign(host.style,{position:'fixed',left:'100px',top:'100px',width:'600px',height:'280px',background:'white',color:'black'}); document.body.append(host)
   const store=await ArrowsStore.open(), entry=new ArrowsEntry(store)
   const original={raf:requestAnimationFrame,caf:cancelAnimationFrame,timer:window.setTimeout.bind(window),clear:window.clearTimeout.bind(window)}
   let now=10000,id=0; const frames=new Map(), timers=new Map()
   const virtual=options.virtual!==false
   const sleep=ms=>new Promise(r=>original.timer(r,ms))
   const install=()=>{
    window.requestAnimationFrame=fn=>{frames.set(++id,fn); return id}
    window.cancelAnimationFrame=id=>frames.delete(id)
    window.setTimeout=(fn,delay=0)=>{timers.set(++id,{fn,due:now+delay});return id}
    window.clearTimeout=id=>timers.delete(id)
   }
   if(virtual)install()
   const profile=options.pointer?{kind:'pointer',pointerSource:'mouse',alternative:false,accommodation:'default',reducedMotion:false}:{kind:'keyboard',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,accommodation:'default',reducedMotion:false}
   const request={requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),clockDomainId:crypto.randomUUID(),atMs:virtual?now:performance.now(),wallMs:Date.now(),profile}
   let publishHook=()=>{}; const run=new ArrowsBrowserRun(entry,host,s=>publishHook(s),virtual?()=>now:undefined)
   const tick=(time=now+16,{timer=true,frame=true}={})=>{
    now=time
    if(timer)for(const [id,t] of [...timers])if(t.due<=now && timers.has(id)){timers.delete(id);t.fn()}
    if(frame)for(const [id,fn] of [...frames])if(frames.has(id)){frames.delete(id);fn(now)}
   }
   const through=time=>{while(now+16<time)tick(now+16);tick(time)}
   const key=(type,code='ArrowLeft',extras={})=>{const event=new KeyboardEvent(type,{code,bubbles:true,cancelable:true,...extras});window.dispatchEvent(event);return event.defaultPrevented}
   const pointer=(direction='left',extras={})=>{host.querySelector(`[data-direction="${direction}"]`).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,isPrimary:true,...extras}))}
   const up=(id=1)=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:id,bubbles:true}))
   const counts=()=>Object.fromEntries(['stimulus_presented','response','response_extra','boundary_extra','trial_closed','invalidated','block_started','timing_note'].map(type=>[type,run.snapshot().events.filter(e=>e.type===type).length]))
   const summary=()=>({phase:run.snapshot()?.phase,reason:run.snapshot()?.invalidReason,protected:run.protectedNow(),trial:run.snapshot()?.trialIndex,counts:counts()})
   const lock=async()=>{await sleep(20);return (await navigator.locks.query()).held.some(l=>l.name==='assessment-practice-arrows-live-v1')}
   const start=async()=>{await run.begin(request);if(virtual)tick(now+16)}
   const onset=()=>through(run.snapshot().stimulusDueMs)
   const close=()=>through(run.snapshot().resolutionDueMs)
   const block=()=>{while(run.snapshot().phase!=='break' && run.snapshot().phase!=='completed' && run.snapshot().phase!=='invalid'){if(run.snapshot().phase==='fixation_pending')tick();if(run.snapshot().phase==='fixation')onset();if(run.snapshot().phase==='stimulus')close()}}
   window.p={setPublish:fn=>{publishHook=fn},ArrowsBrowserRun,ArrowsEntry,host,store,entry,run,request,frames,timers,original,sleep,tick,through,key,pointer,up,counts,summary,lock,start,onset,close,block,get now(){return now},set now(t){now=t}}
  },options)
  const result=await page.evaluate(fn)
  results.push({name,...result}); console.log(name,JSON.stringify(result))
 } catch(error){results.push({name,error:String(error)});console.log(name,String(error))}
 finally{await context.close();writeFileSync(new URL('./A6-F3R2-browser.json',import.meta.url),JSON.stringify({browser:await browser.version(),results},null,2)+'\n')}
}
try {
for(const behind of [false,true])await probe('attribute_paint_'+(behind?'underlay':'overlay'),new Function(`return (async()=>{
 const p=window.p;p.host.style.zIndex='10';await p.start();const end=performance.now()+3500;while(p.run.snapshot()?.phase!=='stimulus'&&performance.now()<end)await p.sleep(5);if(p.run.snapshot()?.phase!=='stimulus')throw Error('No healthy onset');
 const cue=p.host.querySelector('[data-arrows-cue]'),box=cue.getBoundingClientRect();
 const sheet=document.createElement('style');sheet.textContent='#paint-candidate {position:fixed;left:'+box.left+'px;top:'+box.top+'px;width:'+box.width+'px;height:'+box.height+'px;background:black;pointer-events:none;z-index:${behind?'0':'99'}} #paint-candidate[style] {z-index:${behind?'99':'0'}}';document.head.append(sheet);
 const el=document.createElement('div');el.id='paint-candidate';document.body.append(el);
 const read=()=>({style:el.getAttribute('style'),zIndex:getComputedStyle(el).zIndex,pointerEvents:getComputedStyle(el).pointerEvents,background:getComputedStyle(el).backgroundColor,rect:el.getBoundingClientRect().toJSON()});
 const originalSheets=[...document.adoptedStyleSheets];
 const before=read(),ready=p.run.layoutReady(),after=read(),sheetsRestored=document.adoptedStyleSheets.length===originalSheets.length&&document.adoptedStyleSheets.every((item,index)=>item===originalSheets[index]);
 await p.sleep(160);const observed=p.summary(),afterMonitor=read(),ownerHeld=await p.lock();
 return {before,ready,after,afterMonitor,sheetsRestored,observed,ownerHeld,css:sheet.textContent,pass:sheetsRestored&&after.pointerEvents===before.pointerEvents&&after.zIndex===before.zIndex&&(${behind}?(ready&&observed.phase==='stimulus'):(!ready&&observed.reason==='viewport'&&!ownerHeld))};
})()`),{virtual:false});
await probe('native_absent_style',async()=>{
 const p=window.p;p.host.style.zIndex='10';await p.start();while(p.run.snapshot()?.phase!=='stimulus')await p.sleep(5);
 const style=document.createElement('style');style.textContent='#plain-candidate{position:fixed;left:100px;top:103px;width:300px;height:18px;background:black;pointer-events:none;z-index:0}';document.head.append(style);
 const el=document.createElement('div');el.id='plain-candidate';document.body.append(el);
 const originalSheets=[...document.adoptedStyleSheets],before=el.getAttribute('style'),beforePointer=getComputedStyle(el).pointerEvents,ready=p.run.layoutReady(),after=el.getAttribute('style'),afterPointer=getComputedStyle(el).pointerEvents;
 const sheetsRestored=document.adoptedStyleSheets.length===originalSheets.length&&document.adoptedStyleSheets.every((item,index)=>item===originalSheets[index]);
 await p.sleep(160);return {before,ready,after,beforePointer,afterPointer,sheetsRestored,afterMonitor:el.getAttribute('style'),observed:p.summary(),pass:before===after&&beforePointer===afterPointer&&sheetsRestored};
},{virtual:false});
}finally{await browser.close()}
if (results.some(result => result.error || !result.pass)) process.exitCode = 1
