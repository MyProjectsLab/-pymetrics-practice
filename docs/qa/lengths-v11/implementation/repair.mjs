import { createRequire } from 'node:module'
import {writeFile} from 'node:fs/promises'
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=[]
async function setup(){
 const {Storage:S,Engine:E,Browser:B,Entry,Order,Publication}=window.mouthProbe
 const nativeTimeout=window.setTimeout.bind(window),sleep=ms=>new Promise(r=>nativeTimeout(r,ms));let now=1000,id=0
 const timers=new Map(),frames=new Map(),retired=[]
 window.setTimeout=(fn,delay=0)=>{timers.set(++id,{fn,due:now+delay});return id};window.clearTimeout=id=>timers.delete(id)
 window.requestAnimationFrame=fn=>{frames.set(++id,fn);retired.push(fn);return id};window.cancelAnimationFrame=id=>frames.delete(id)
 const host=document.createElement('div');host.className='mouth-host';host.tabIndex=-1;host.style.cssText='position:fixed;left:100px;top:100px;width:450px';document.body.append(host);host.focus()
 const store=await S.MouthStore.open();let latest
 const run=new B.MouthBrowserRun(store,host,value=>{latest=value});run.now=()=>now
 const profile={kind:'keyboard',variant:'standard',deviceClass:'browser-observed',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false};run.prepare(profile)
 const displayContext={layoutWidthCssPx:1280,layoutHeightCssPx:900,visualWidthCssPx:1280,visualHeightCssPx:900,taskHostWidthCssPx:450,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true}
 const req={requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),clockDomainId:crypto.randomUUID(),profile,variant:'standard',route:'standalone',atMs:now,wallMs:Date.now(),displayContext}
 const tick=async(amount=10)=>{now+=amount;for(const [k,t]of [...timers])if(t.due<=now&&timers.has(k)){timers.delete(k);t.fn()};for(const[k,fn]of [...frames])if(frames.has(k)){frames.delete(k);fn(now)};await sleep(1)}
 const until=async(fn,max=2000)=>{for(let n=0;n<max;n++){if(fn())return;await tick()}throw Error('phase timeout '+run.current()?.phase+' '+run.current()?.invalidReason)}
 const check=(v,m)=>{if(!v)throw Error(m)}
 const press=side=>{const code=side==='short'?'ArrowLeft':'ArrowRight';window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}))}
 const play=async(stop=90)=>{let answered=0;await until(()=>{const s=run.current();if(!s)return false;if(s.phase==='invalid')throw Error('unexpected invalid '+s.invalidReason);if(s.phase==='stimulus'&&now>=s.onsetMs+110&&answered!==s.trialIndex){answered=s.trialIndex;press(s.form.trials[s.trialIndex-1].mouth)}return s.phase==='completed'||stop<90&&s.events.filter(e=>e.type==='trial_closed').length>=stop},20000)}
 const read=store.backend.read.bind(store.backend),change=store.backend.change.bind(store.backend)
 const h={S,E,B,Entry,Order,Publication,host,store,run,req,profile,read,change,sleep,tick,until,press,play,frames,timers,retired,check,now:()=>now,latest:()=>latest,begin:()=>run.start(req),phase:()=>run.current()?.phase,bytes:()=>JSON.stringify(run.current()),owner:async()=> (await navigator.locks.query()).held.some(x=>x.name===Entry.MOUTH_LIVE_LOCK)}
 window.h=h;return {layout:run.layoutReady()}
}
async function test(name,fn,args){const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto('http://127.0.0.1:4190/docs/qa/lengths-v11/implementation/probe.html');await p.waitForFunction(()=>window.mouthProbe);await p.evaluate(setup);const detail=await p.evaluate(fn,args);if(errors.length)throw Error(errors.join(';'));results.push({name,status:'PASS',detail});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:String(e),errors});console.log('FAIL',name,String(e))}finally{await c.close();await writeFile('docs/qa/lengths-v11/implementation/repair-results.json',JSON.stringify(results,null,2))}}

for(const reason of ['page_exit','hidden','blur'])await test('pending committed arm '+reason+' cancellation cannot start late',async({reason})=>{
 const h=window.h,original=h.store.backend.read.bind(h.store.backend);let release;const held=new Promise(r=>release=r);let sampled=false
 h.store.backend.read=async signal=>{const root=await original(signal);sampled=true;await held;return root}
 const start=h.begin().catch(()=>null);while(!sampled)await h.sleep(1);h.run.interrupt(reason);h.store.backend.read=original;release();await start;await h.sleep(10)
 h.check(!h.run.current()||h.run.current().phase==='armed','late protected play');h.check(!await h.owner(),'owner leaked');const root=await h.store.read();h.check(root.counters.standard===1,'committed arm not consumed once');return {reason,noLatePlay:true,counter:1}
},{reason})
await test('selected held key during arm cleans ownership; same request retry and fresh release',async()=>{
 const h=window.h,original=h.store.backend.read.bind(h.store.backend);let release;const held=new Promise(r=>release=r);let sampled=false
 h.store.backend.read=async signal=>{const root=await original(signal);sampled=true;await held;return root}
 const start=h.begin().catch(e=>e);while(!sampled)await h.sleep(1);window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true}));h.store.backend.read=original;release();const error=await start;h.check(error instanceof Error,'held start admitted');h.check(!await h.owner(),'owner leaked');
 const prior=h.run;prior.dispose();const next=new h.B.MouthBrowserRun(h.store,h.host,()=>{});next.inheritControls(prior);next.prepare(h.profile);next.now=h.now
 let rejected=false;try{await next.start(h.req)}catch{rejected=true}h.check(rejected,'held key lost on replacement');window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft',bubbles:true}));await next.start(h.req);h.check(next.current().phase==='fixation_pending','same-request retry failed');h.check((await h.store.read()).counters.standard===1,'retry consumed another form');next.dispose();return {sameRequest:true,counter:1,heldInherited:true,ownerReusable:true}
})
for(const failure of ['missing-face','retained-face','missing-positive','retained-feedback'])await test('exact DOM confirmation '+failure,async({failure})=>{
 const h=window.h;await h.begin();const draw=h.run.draw.bind(h.run)
 if(failure==='missing-face')h.run.draw=content=>{if(content.includes('<svg'))return;draw(content)}
 if(failure==='retained-face')h.run.draw=content=>{if(content===''&&h.host.querySelector('svg'))return;draw(content)}
 if(failure==='missing-positive')h.run.draw=content=>{if(content.includes('+50'))return;draw(content)}
 if(failure==='retained-feedback')h.run.draw=content=>{if(content===''&&h.host.textContent.includes('+50'))return;draw(content)}
 await h.until(()=>{const s=h.run.current();if(s.phase==='stimulus'&&h.now()>=s.onsetMs+110&&!s.firstResponse)h.press(s.form.trials[s.trialIndex-1].mouth);return s.phase==='invalid'},3000)
 const s=h.run.current(),current=s.events.filter(e=>e.trialIndex===s.trialIndex)
 if(failure==='missing-face')h.check(!current.some(e=>e.type==='face_presented'),'fabricated face')
 if(failure==='retained-face')h.check(!current.some(e=>e.type==='face_removed'),'fabricated removal')
 if(failure==='missing-positive')h.check(!current.some(e=>e.type==='reward_earned'),'fabricated payout')
 if(failure==='retained-feedback')h.check(!current.some(e=>e.type==='feedback_offset'||e.type==='trial_closed'),'fabricated feedback offset')
 return {failure,reason:s.invalidReason,events:current.map(e=>e.type)}
},{failure})
for(const order of ['monitor-first','stage-first'])await test('same delayed frame factual onset before failure '+order,async({order})=>{
 const h=window.h;await h.begin();await h.until(()=>h.phase()==='fixation');const due=h.run.current().stimulusDueMs
 // Run the onset due timer and wait for the visible write, holding rendering callbacks.
 const original=window.requestAnimationFrame,held=[];window.requestAnimationFrame=fn=>{held.push(fn);return 99999};h.frames.clear()
 while(h.now()<due+10)await h.tick();while(!h.host.querySelector('svg'))await h.sleep(1)
 const stage=held.at(-1),monitor=()=>h.run.pendingConfirmation?.(h.now()-h.run.previousFrame)
 // Move sampled document time, without dispatching the stage watchdog.
 h.run.now=()=>due+300
 if(order==='monitor-first'){monitor();stage(due+300)}else {stage(due+300);monitor()}
 window.requestAnimationFrame=original;const events=h.run.current().events.map(e=>e.type),onset=events.lastIndexOf('face_presented'),invalid=events.indexOf('invalidated');h.check(onset>=0&&onset<invalid,'factual onset erased');h.check(events.filter(t=>t==='invalidated').length===1,'duplicate terminal');return {order,onsetBeforeInvalid:true,reason:h.run.current().invalidReason}
},{order})
await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1
