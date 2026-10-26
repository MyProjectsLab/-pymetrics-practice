import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const b=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const results=[]
const run=async(name,fn)=>{const c=await b.newContext({viewport:{width:1280,height:900}}),p=await c.newPage();try{await p.goto('http://127.0.0.1:4190/docs/qa/lengths-v11/implementation/probe.html');await p.waitForFunction(()=>window.mouthProbe);const detail=await p.evaluate(fn);results.push({name,status:'PASS',detail});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:String(e)});console.error('FAIL',name,String(e))}finally{await c.close();await writeFile('docs/qa/lengths-v11/implementation/publication-results.json',JSON.stringify(results,null,2))}}
await run('ordered report deletion-first and publication-first, held cancellation and stale positive read',async()=>{
 const {Storage:S,Engine:E,Publication:P}=window.mouthProbe,check=(v,m)=>{if(!v)throw Error(m)},sleep=ms=>new Promise(r=>setTimeout(r,ms)),store=await S.MouthStore.open()
 const profile={kind:'keyboard',variant:'standard',deviceClass:'browser',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false},displayContext={layoutWidthCssPx:1280,layoutHeightCssPx:900,visualWidthCssPx:1280,visualHeightCssPx:900,taskHostWidthCssPx:400,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true}
 const arm=await store.start({requestId:'reportreq',sessionId:'report',clockDomainId:'clock',profile,variant:'standard',route:'standalone',atMs:1,wallMs:Date.now(),displayContext});let state=E.advance(arm.state,{kind:'start',atMs:2,responseHeld:false});state=E.advance(state,{kind:'invalidate',atMs:3,reason:'blur'});const snapshot=await store.saveSnapshot(arm,state,0),target=store.authority.published({...arm,snapshot}),gate=new P.MouthReportPublication(),view=document.createElement('div');document.body.append(view)
 const read=async signal=>{await store.loadArmed(arm.sessionId,signal);target.confirmed();return snapshot}
 await gate.run('first',read,()=>view.textContent='observed facts',()=>view.textContent='');check(view.textContent==='observed facts','publication-first failed')
 let release;const held=new Promise(r=>release=r);let sampled=false
 const pending=gate.run('held',async signal=>{const value=await read(signal);sampled=true;await held;return value},()=>view.textContent='stale restored',()=>view.textContent='')
 while(!sampled)await sleep(1)
 gate.cancel();await store.deleteAttempt(arm.sessionId);release();await pending;const text=view.textContent
 check(text!=='stale restored','late callback restored target');await gate.run('deleted',read,()=>view.textContent='restored after delete',()=>view.textContent='');check(view.textContent==='','deletion-first publication shown');return {publicationFirst:true,deletionFirstBlocked:true,canceledLockReleased:true,staleFenced:true}
})
await run('report-view activity survives checkpoint extension in real IndexedDB',async()=>{
 const {Storage:S,Engine:E}=window.mouthProbe,store=await S.MouthStore.open(),check=(v,m)=>{if(!v)throw Error(m)}
 const profile={kind:'keyboard',variant:'standard',deviceClass:'browser',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false},displayContext={layoutWidthCssPx:1280,layoutHeightCssPx:900,visualWidthCssPx:1280,visualHeightCssPx:900,taskHostWidthCssPx:400,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true}
 const arm=await store.start({requestId:'activityreq',sessionId:'activity',clockDomainId:'clock',profile,variant:'standard',route:'standalone',atMs:0,wallMs:Date.now(),displayContext});let s=E.advance(arm.state,{kind:'start',atMs:1,responseHeld:false})
 const trial=()=>{for(const kind of ['fixation','onset','remove','resolve','feedback','offset'])s=E.advance(s,{kind,atMs:E.requiredDue(s)})}
 for(let i=0;i<30;i++)trial();const first=await store.saveSnapshot(arm,s,0),target=store.authority.published({...arm,snapshot:first});const bytes=JSON.stringify(first)
 await store.appendReportView('activity',first,'firstview','history',Date.now(),target);check(JSON.stringify((await store.loadArmed('activity')).snapshot)===bytes,'activity changed prefix')
 s=E.advance(s,{kind:'continue',atMs:s.commands.at(-1).atMs,responseHeld:false});for(let i=0;i<30;i++)trial();const second=await store.saveSnapshot(arm,s,first.revision),root=await store.read();check(root.activity.activity.events[0].resultRevision===first.revision,'old view lost binding');check(second.closedTrials===60,'extension blocked');return {firstClosed:30,secondClosed:60,oldActivityRevisionPreserved:true}
})
await b.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1
