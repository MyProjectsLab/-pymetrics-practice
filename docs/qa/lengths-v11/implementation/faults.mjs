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
async function test(name,fn,args){const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto('http://127.0.0.1:4190/docs/qa/lengths-v11/implementation/probe.html');await p.waitForFunction(()=>window.mouthProbe);await p.evaluate(setup);const detail=await p.evaluate(fn,args);if(errors.length)throw Error(errors.join(';'));results.push({name,status:'PASS',detail});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:String(e),errors});console.log('FAIL',name,String(e))}finally{await c.close();await writeFile('docs/qa/lengths-v11/implementation/fault-results.json',JSON.stringify(results,null,2))}}
for(const phase of ['fixation_pending','fixation','stimulus','removed','resolved','feedback'])await test('missing '+phase+' all confirmation frames, watchdog and late frames fenced',async({phase})=>{
 const h=window.h;await h.begin();await h.until(()=>h.phase()===phase)
 const held=[...h.frames.values()];h.frames.clear();const original=window.requestAnimationFrame
 window.requestAnimationFrame=fn=>{held.push(fn);return 99999}
 await h.until(()=>h.phase()==='invalid',350);const bytes=h.bytes();window.requestAnimationFrame=original;for(const fn of held)fn(h.now());h.check(h.bytes()===bytes,'late frame changed terminal');h.check(!await h.owner(),'owner leaked');return {reason:h.run.current().invalidReason,lateUnchanged:true}
},{phase})
for(const mode of ['individual','replacement'])for(const order of ['delete-first','onset-first'])await test(mode+' '+order+' at trial 2 without notifications',async({mode,order})=>{
 const h=window.h;window.BroadcastChannel=undefined;await h.begin();await h.until(()=>h.run.current()?.trialIndex===2&&h.phase()==='fixation')
 if(order==='onset-first')await h.until(()=>h.phase()==='stimulus')
 if(mode==='individual')await h.store.deleteAttempt(h.req.sessionId);else await h.store.deleteAll()
 await h.until(()=>h.phase()==='invalid');const s=h.run.current(),onsets=s.events.filter(e=>e.type==='face_presented').length
 h.check(onsets===(order==='onset-first'?2:1),'wrong onset order '+onsets);const r=await h.read();h.check(!r.attempts[h.req.sessionId],'resurrection');return {onsets,reason:s.invalidReason,rootRetired:true}
},{mode,order})
await test('held authority read canceled; order lock and late callback released',async()=>{
 const h=window.h;await h.begin();await h.until(()=>h.run.current()?.trialIndex===2&&h.phase()==='fixation')
 let release;const original=h.store.backend.read.bind(h.store.backend),held=new Promise(r=>release=r);h.store.backend.read=async signal=>{const value=await original(signal);await held;return value}
 await h.until(()=>h.run.admission!==null||h.now()>h.run.current().stimulusDueMs+20,100);h.run.interrupt('page_exit');const bytes=h.bytes();h.store.backend.read=original;await h.store.deleteAll();release();await h.sleep(20);h.check(h.bytes()===bytes,'late read changed terminal');h.check(!await h.owner(),'owner leaked');return {canceled:true,lateUnchanged:true,deletionCompleted:true}
})
await test('canceled owner acquisition callback cannot start later',async()=>{
 const h=window.h,original=navigator.locks.request.bind(navigator.locks);let release;const held=new Promise(r=>release=r)
 navigator.locks.request=(name,options,callback)=>name===h.Entry.MOUTH_LIVE_LOCK?original(name,options,async lock=>{await held;return callback(lock)}):original(name,options,callback)
 const start=h.begin().catch(()=>null);await h.sleep(20);h.run.dispose();release();await start;await h.sleep(20);h.check(h.run.current()===null,'late arm started');h.check(!await h.owner(),'owner leaked');return {noLateStart:true}
})
await test('two live owners cannot arm simultaneously',async()=>{
 const h=window.h;await h.begin();const otherHost=h.host.cloneNode(true);otherHost.style.left='600px';document.body.append(otherHost);const other=new h.B.MouthBrowserRun(h.store,otherHost,()=>{});other.prepare(h.profile);other.now=h.now;let failed=false;try{await other.start({...h.req,requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()})}catch{failed=true}h.check(failed,'second owner accepted');h.check((await h.store.read()).counters.standard===1,'second form consumed');other.dispose();h.run.dispose();return {secondBlocked:true,arms:1}
})
for(const kind of ['write-failed','delivery-held'])await test('checkpoint '+kind+' gates and exact same-byte recovery',async({kind})=>{
 const h=window.h;await h.begin();const original=h.store.backend.change.bind(h.store.backend);let release;const held=new Promise(r=>release=r)
 h.store.backend.change=async(op,signal)=>{if(kind==='write-failed')throw Error('injected write failure');const result=await original(op,signal);await held;return result}
 await h.play(30);await h.until(()=>h.latest().checkpoint==='uncertain',300);h.check(h.phase()==='break','advanced checkpoint');const bytes=h.bytes();h.store.backend.change=original;await h.run.retryCheckpoint();h.check(h.latest().checkpoint==='confirmed','retry unconfirmed');h.check(h.bytes()===bytes,'retry changed prefix');release();await h.sleep(10);h.check(h.phase()==='break','late auto advancement');await h.run.continue();h.check(h.phase()==='fixation_pending','continue missing');h.run.interrupt('blur');await h.sleep(30);return {closed:30,confirmedAfterRetry:true,lateNoAdvance:true}
},{kind})
await test('hide after checkpoint capture is gated; exact read confirms before manual Continue',async()=>{
 const h=window.h;await h.begin();const original=h.store.backend.change.bind(h.store.backend);let release;const held=new Promise(r=>release=r);h.store.backend.change=async(op,signal)=>{const result=await original(op,signal);await held;return result}
 await h.play(30);h.run.interrupt('hidden');h.check(h.phase()==='break','checkpoint hide invalidated');h.store.backend.change=original;await h.until(()=>h.latest().checkpoint==='uncertain',300);await h.run.retryCheckpoint();h.check(h.phase()==='break','auto continued after hide');await h.run.continue();h.check(h.phase()==='fixation_pending','manual continue');h.run.interrupt('page_exit');release();return {hideGated:true,manualReacquired:true}
})
for(const kind of ['write-failed','delivery-held'])await test('terminal '+kind+' retains immutable review and releases live owner',async({kind})=>{
 const h=window.h;await h.begin();await h.play(89);const original=h.store.backend.change.bind(h.store.backend);let release;const held=new Promise(r=>release=r)
 h.store.backend.change=async(op,signal)=>{if(kind==='write-failed')throw Error('injected terminal failure');const value=await original(op,signal);await held;return value}
 await h.play();await h.until(()=>!h.latest().recovery.pending(),300);h.check(!await h.owner(),'terminal owner held');const bytes=h.bytes();h.store.backend.change=original;const result=await h.latest().recovery.recover();h.check(result.kind==='confirmed','terminal not confirmed');h.check(JSON.stringify(result.snapshot.state)===bytes,'terminal bytes changed');release();return {phase:h.phase(),bankedCents:h.run.current().bankedCents,ownerReleased:true,recovered:true}
},{kind})
await test('pointer held outside response control and simultaneous contact ignored',async()=>{
 const h=window.h;h.run.dispose();const p={...h.profile,kind:'pointer',pointerSource:'mouse'};delete p.leftCode;delete p.rightCode
 const run=new h.B.MouthBrowserRun(h.store,h.host,()=>{});run.prepare(p);run.now=h.now;await run.start({...h.req,profile:p,requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()});h.run=run;await h.until(()=>run.current()?.phase==='stimulus');const control=h.host.querySelector('[data-mouth-side="short"]');control.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:0,isPrimary:true,bubbles:true}));control.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,pointerType:'mouse',button:0,isPrimary:true,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',bubbles:true}));const s=run.current();h.check(s.events.filter(e=>e.type==='response').length===1,'multiple pointer response');h.check(s.activePointer===null,'outside release did not rearm');run.dispose();return {oneAnswer:true,outsideReleased:true}
})
await browser.close();console.log(JSON.stringify(results.map(r=>({name:r.name,status:r.status,error:r.error})),null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1
