// Contradictory journal probes through real IndexedDB, production admission and history UI.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-r1-r2-fixtures.json','utf8'))
F.state.deletedSessions={};F.state.attemptChains={};
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const b=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const p=await b.newPage({viewport:{width:1200,height:800}}), out={browser:b.version(),cases:[],errors:[]}
p.on('pageerror',e=>out.errors.push(String(e)))
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const api=(fn,arg)=>p.evaluate(async({code,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts'),R=await import('/src/stop/run.ts');return new Function('S','T','R','_s','arg',`return (${code})(S,T,R,_s,arg)`)(S,T,R,S.stopLocalStore(),arg)},{code:fn.toString(),arg})
const ready=()=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
const marker=r=>({formId:r.form.id,sessionId:r.sessionId,exposedAtWall:r.completedAtWall,visualProfile:r.setup.visualProfile,certainty:'confirmed',deleted:false})
function insert(r, items) {
  const events=[...r.events,...items.map((e,i)=>({schemaVersion:'stop_engine_event_v1',sessionId:r.sessionId,sequenceNumber:-i-1,...e}))]
    .sort((a,b)=>a.timestampMs-b.timestampMs || (a.sequenceNumber<0?-1:b.sequenceNumber<0?1:a.sequenceNumber-b.sequenceNumber))
  const mapping=new Map(events.map((e,i)=>[e.sequenceNumber,i+1]))
  events.forEach((e,i)=>{e.sequenceNumber=i+1;for(const k of ['triggerSequenceNumber','inputSequenceNumber'])if(e.payload[k]>0)e.payload[k]=mapping.get(e.payload[k]);if(e.type==='session_completed')e.payload.eventCount=i+1})
  r.events=events
}
try {
  await p.goto('http://127.0.0.1:5227/');await ready()
  const cases=[['intact',true],['timing-note',true],['hidden',false],...['pagehide','freeze','resume','pageshow'].map(x=>[x,false]),
    ...['response_key','visual_profile','timing_profile','input_device_class','accessibility'].map(x=>[x,false]),
    ['width-767',false],['height-599',false],['viewport-boundary',true],['blur-999',true],['blur-1000',true],['blur-1001',false],
    ['unmatched-blur-1000',true],['unmatched-blur-1001',false],['lying-blur-duration',false],['repeated-brief-blur',true],
    ['severe-tail',false],['false-nonsevere-tail',false],['two-nonsevere',false],['second-warmup-anomaly',false],
    ['fixation-2',true],['fixation-3',false],['wrong_key-4',true],['wrong_key-5',false],['extra-9',true],['extra-10',false],['repeat-20',true],
    ['pre-start-setting',true],['hidden-during-warmup',false],['held-outcome',false],['repeat-outcome',false],['negative-time',false],['missing-stimulus',false]]
  for(const mode of ['baseline','retest']) for(const [name,valid] of cases) {
    if(mode==='baseline'&&['held-outcome','repeat-outcome'].includes(name))continue // baseline deliberately has zero responses
    const state=structuredClone(F.state)
    let r=structuredClone(name==='timing-note'?F.standardNotes[mode]:F[mode])
    const completion=r.events.at(-2).timestampMs, items=[]
    const add=(type,payload,at=completion-1)=>items.push({type,payload,timestampMs:at})
    if(name==='hidden'||name==='hidden-during-warmup')add('visibility_changed',{visible:false},name==='hidden'?completion-1:1001)
    if(['pagehide','freeze','resume','pageshow'].includes(name))add('page_lifecycle_changed',{state:name})
    if(['response_key','visual_profile','timing_profile','input_device_class','accessibility'].includes(name))add('setting_changed',{setting:name})
    if(name==='pre-start-setting')add('setting_changed',{setting:'visual_profile'},0)
    if(name.startsWith('width-')||name.startsWith('height-')||name==='viewport-boundary')add('viewport_changed',{width:name==='width-767'?767:768,height:name==='height-599'?599:600})
    if(name.startsWith('blur-')||name.startsWith('unmatched-blur-')||name==='lying-blur-duration') {
      const duration=name==='lying-blur-duration'?1001:Number(name.split('-').at(-1))
      const start=completion-(name.startsWith('unmatched')?duration:1100)
      add('focus_changed',{focused:false,durationMs:null},start)
      if(!name.startsWith('unmatched'))add('focus_changed',{focused:true,durationMs:name==='lying-blur-duration'?999:duration},start+duration)
    }
    if(name==='repeated-brief-blur')for(const offset of [1100,500]){add('focus_changed',{focused:false,durationMs:null},completion-offset);add('focus_changed',{focused:true,durationMs:400},completion-offset+400)}
    if(['severe-tail','false-nonsevere-tail','two-nonsevere'].includes(name))for(let i=0;i<(name==='two-nonsevere'?2:1);i++)add('timing_anomaly',{trialIndex:79,issues:['transition'],severity:name==='severe-tail'?'severe':'non_severe',expectedMs:completion-1000,observedMs:completion-1})
    if(name==='second-warmup-anomaly')for(let i=0;i<2;i++)add('timing_anomaly',{trialIndex:0,issues:['visibility'],severity:'non_severe',expectedMs:1200,observedMs:1280},1280+i)
    const counted=/^(fixation|wrong_key|extra|repeat)-(\d+)$/.exec(name)
    if(counted){for(let i=0;i<Number(counted[2]);i++)add('response_ignored',{trialIndex:79,reason:counted[1],inputSequenceNumber:0},completion-100+i)
      if(counted[1]==='extra')add('quality_note',{ruleId:'stop_validity_v1.five_extra_inputs',triggerSequenceNumber:0},completion-80)}
    if(name==='held-outcome'||name==='repeat-outcome'){const accepted=r.events.find(e=>e.type==='response_accepted');r.events.find(e=>e.sequenceNumber===accepted.payload.inputSequenceNumber).payload[name==='held-outcome'?'held':'repeated']=true}
    if(name==='negative-time')r.events.find(e=>e.type==='stimulus_presented').timestampMs=-1
    if(name==='missing-stimulus')r.events.splice(r.events.findLastIndex(e=>e.type==='stimulus_presented'),1)
    insert(r,items)
    if(counted?.[1]==='extra')r.events.find(e=>e.type==='quality_note'&&e.payload.ruleId==='stop_validity_v1.five_extra_inputs').payload.triggerSequenceNumber=r.events.filter(e=>e.type==='response_ignored'&&e.payload.reason==='extra')[4].sequenceNumber
    if(mode==='baseline') { state.results={ [r.sessionId]:r };state.exposures={ [r.form.id]:marker(r) };state.chains[F.chain.id].baseline=structuredClone(r) }
    else { state.results[r.sessionId]=r;state.exposures[r.form.id]=marker(r);Object.assign(state.chains[F.chain.id],{retest:structuredClone(r),retestAttempts:[{sessionId:r.sessionId,formId:r.form.id,valid:true}],status:'complete'}) }
    if(mode==='baseline'&&name==='timing-note')state.chains[F.chain.id].recommendation=await api((S,T,R,_s,r)=>T.routeStop(r),r)
    await api(async(S,T,R,_s,state)=>{await _s.deleteAll();await _s.mutate(x=>Object.assign(x,state))},state)
    await p.reload();await ready()
    const checked=await api(async(S,T,R,_s,id)=>{const state=await _s.read(),c=S.inspectLocalState(state);return {raw:state,validIds:c.valid.map(r=>r.sessionId),active:!!c.activeChain,recordAdmitted:R.verifyCompletedResult(state.results[id]),memory:T.currentTrainingChain()?.id??null}},r.sessionId)
    assert.equal(checked.recordAdmitted,valid,`${mode}/${name}`)
    assert.equal(checked.validIds.includes(r.sessionId),valid,`${mode}/${name}`)
    assert.equal(checked.active,valid,`${mode}/${name}`)
    assert.equal(hash(checked.raw),hash(state),'read must preserve source and exposure')
    await p.getByRole('button',{name:'Stop history',exact:true}).click()
    const reports=await p.getByRole('button',{name:'Open original report',exact:true}).count()
    const progress=await p.getByRole('img').count()
    assert.equal(reports,(mode==='retest'?1:0)+(valid?1:0))
    assert.equal(progress,mode==='retest'||valid?1:0)
    assert.equal(await p.getByRole('button',{name:'Start recommended training',exact:true}).count(),0)
    out.cases.push({mode,name,expectedValid:valid,admitted:checked.recordAdmitted,activeChain:checked.active,memory:checked.memory,reportButtons:reports,progressSeries:progress,
      invalidatingEventAbsent:r.events.every(e=>e.type!=='session_invalidated'),resultHash:hash(r),exposureHash:hash(state.exposures),rawHashBefore:hash(state),rawHashAfter:hash(checked.raw),pass:true})
  }
  assert.equal(out.errors.length,0);console.log(JSON.stringify({cases:out.cases.length,pass:true,errors:out.errors}))
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}
finally{await writeFile(new URL('reload-evidence.json',import.meta.url),JSON.stringify(out,null,2));await b.close()}
