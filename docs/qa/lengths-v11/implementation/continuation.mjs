import { createRequire } from 'node:module'
import {writeFile,readFile} from 'node:fs/promises'
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=process.argv.includes('61')?JSON.parse(await readFile('docs/qa/lengths-v11/implementation/continuation-results.json','utf8')).filter(r=>r.status==='PASS'&&r.detail.trialIndex===31):[]
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
async function test(name,fn,args){const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto('http://127.0.0.1:4190/docs/qa/lengths-v11/implementation/probe.html');await p.waitForFunction(()=>window.mouthProbe);await p.evaluate(setup);const detail=await p.evaluate(fn,args);if(errors.length)throw Error(errors.join(';'));results.push({name,status:'PASS',detail});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:String(e),errors});console.log('FAIL',name,String(e))}finally{await c.close();await writeFile('docs/qa/lengths-v11/implementation/continuation-results.json',JSON.stringify(results,null,2))}}
for(const trialIndex of process.argv.includes('61')?[61]:[31,61])for(const path of ['automatic','manual'])for(const mode of ['individual','replacement'])for(const order of ['delete-first','onset-first'])await test('continuation '+trialIndex+' '+path+' '+mode+' '+order+' without notifications',async({trialIndex,path,mode,order})=>{
 const h=window.h;window.BroadcastChannel=undefined;await h.begin()
 const originalChange=h.store.backend.change.bind(h.store.backend),originalAdmission=h.run.entry.admitContinue.bind(h.run.entry)
 let releaseCheckpoint,releaseAdmission,admissionCalled=false
 const checkpointHeld=new Promise(r=>releaseCheckpoint=r),admissionHeld=new Promise(r=>releaseAdmission=r)
 h.store.backend.change=async(op,signal)=>{const result=await originalChange(op,signal);if(h.run.current().phase==='break'&&h.run.current().trialIndex===trialIndex){if(path==='manual')h.run.gate=true;await checkpointHeld}return result}
 h.run.entry.admitContinue=async(...args)=>{if(h.run.current().trialIndex!==trialIndex)return originalAdmission(...args);admissionCalled=true;await admissionHeld;return originalAdmission(...args)}
 await h.play(trialIndex-1);h.store.backend.change=originalChange;releaseCheckpoint();await h.sleep(30)
 let continuation
 if(path==='manual'){h.check(h.phase()==='break'&&h.latest().checkpoint==='confirmed','manual checkpoint not confirmed');continuation=h.run.continue().catch(e=>String(e))}
 for(let n=0;n<100&&!admissionCalled;n++)await h.sleep(1)
 h.check(admissionCalled,'continuation not pending at ordered admission')
 const neutralBeforeAdmission=!h.host.querySelector('.mouth-stage svg'),prefix=JSON.stringify(h.run.current().events),before=await h.read(),revisionBefore=before.attempts[h.req.sessionId].resultRevision
 // A next-trial face is prohibited before the ordered authority check in either path.
 h.check(neutralBeforeAdmission,'answer-bearing short face exposed before continuation authority')
 if(order==='delete-first'){
  if(mode==='individual')await h.store.deleteAttempt(h.req.sessionId);else await h.store.deleteAll()
  releaseAdmission();if(continuation)await continuation;await h.sleep(30);for(let n=0;n<80;n++)await h.tick()
  h.check(!h.host.querySelector('.mouth-stage svg'),'rejected continuation retained face')
  h.check(JSON.stringify(h.run.current().events)===prefix,'rejected continuation extended journal')
 }else{
  releaseAdmission();if(continuation)await continuation;await h.until(()=>h.run.current().trialIndex===trialIndex&&h.phase()==='stimulus',300)
  h.check(!!h.host.querySelector('.mouth-stage svg'),'confirmed continuation missing face')
  const authoritative=await h.read();h.check(authoritative.attempts[h.req.sessionId].resultRevision===revisionBefore,'onset changed durable checkpoint bytes')
  if(mode==='individual')await h.store.deleteAttempt(h.req.sessionId);else await h.store.deleteAll()
  await h.until(()=>h.phase()==='invalid',300)
 }
 const s=h.run.current(),onsets=s.events.filter(e=>e.type==='face_presented').length,root=await h.read();h.check(onsets===(order==='onset-first'?trialIndex:trialIndex-1),'continuation exposed wrong prefix '+onsets);h.check(!root.attempts[h.req.sessionId],'retired attempt revived');h.run.dispose();return {trialIndex,path,mode,order,onsets,neutralBeforeAdmission,retiredRoot:true}
},{trialIndex,path,mode,order})
await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1
