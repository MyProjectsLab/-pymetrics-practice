import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const F=JSON.parse(await readFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-r1-r2-fixtures.json'));
F.state.deletedSessions={};F.state.attemptChains={};
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const b=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'}),p=await b.newPage({viewport:{width:1200,height:800}});
const out={cases:[],errors:[]};p.on('pageerror',e=>out.errors.push(String(e)));
const ready=()=>p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
const api=(fn,arg)=>p.evaluate(async({code,arg})=>{const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts'),R=await import('/src/stop/run.ts');return new Function('S','T','R','s','x',`return (${code})(S,T,R,s,x)`)(S,T,R,S.stopLocalStore(),arg)},{code:fn.toString(),arg});
function insert(r, items){const es=[...r.events,...items.map((x,i)=>({...x,schemaVersion:'stop_engine_event_v1',sessionId:r.sessionId,sequenceNumber:-i-1}))].sort((a,b)=>a.timestampMs-b.timestampMs||a.sequenceNumber-b.sequenceNumber);const map=new Map(es.map((e,i)=>[e.sequenceNumber,i+1]));es.forEach((e,i)=>{e.sequenceNumber=i+1;for(const key of ['triggerSequenceNumber','inputSequenceNumber'])if(key in e.payload)e.payload[key]=map.get(e.payload[key])??e.payload[key];if(e.type==='session_completed')e.payload.eventCount=i+1});r.events=es}
const marker=r=>({formId:r.form.id,sessionId:r.sessionId,exposedAtWall:r.completedAtWall,visualProfile:r.setup.visualProfile,certainty:'confirmed',deleted:false});
try{
 await p.goto('http://127.0.0.1:5337/');await ready();
 for(const mode of ['baseline','retest'])for(const name of ['control','hidden-warmup','freeze-tail','settings-initial','viewport-initial','blur-1000','blur-1001','initial-fixation-2','initial-fixation-3','initial-wrong-4','initial-wrong-5','warmup-second-severe']){
  const r=structuredClone(F[mode]),state=structuredClone(F.state),items=[];
  const first=r.events.findIndex(e=>e.type==='trial_scheduled'&&e.payload.trial.phase==='scored');
  const initial=r.events.slice(0,first).findLast(e=>e.type==='fixation_started').timestampMs,tail=r.events.at(-2).timestampMs;
  const add=(type,payload,timestampMs)=>items.push({type,payload,timestampMs});
  if(name==='hidden-warmup')add('visibility_changed',{visible:false},1002);
  if(name==='freeze-tail')add('page_lifecycle_changed',{state:'freeze'},tail-1);
  if(name==='settings-initial')add('setting_changed',{setting:'response_key'},initial+100);
  if(name==='viewport-initial')add('viewport_changed',{width:767,height:600},initial+100);
  if(name.startsWith('blur-')){const n=Number(name.split('-')[1]);add('focus_changed',{focused:false,durationMs:null},tail-1100);add('focus_changed',{focused:true,durationMs:n},tail-1100+n)}
  if(name.startsWith('initial-fixation-')||name.startsWith('initial-wrong-')){
   const count=Number(name.split('-').at(-1)),reason=name.includes('wrong')?'wrong_key':'fixation';
   for(let i=0;i<count;i++){const seq=-items.length-1;add('input_received',{key:reason==='wrong_key'?'KeyZ':'Space',repeated:false,held:false,focused:true,trialIndex:null},initial+100+i*10);add('response_ignored',{reason,trialIndex:null,inputSequenceNumber:seq},initial+100+i*10);add('key_released',{key:reason==='wrong_key'?'KeyZ':'Space'},initial+101+i*10)}
  }
  if(name==='warmup-second-severe')for(let i=0;i<2;i++)add('timing_anomaly',{trialIndex:0,issues:['visibility'],severity:'severe',expectedMs:1200,observedMs:1800+i},1800+i);
  insert(r,items);
  if(mode==='baseline'){state.results={[r.sessionId]:r};state.exposures={[r.form.id]:marker(r)};state.chains[F.chain.id].baseline=r}
  else{state.results[r.sessionId]=r;state.exposures[r.form.id]=marker(r);Object.assign(state.chains[F.chain.id],{retest:r,status:'complete',retestAttempts:[{sessionId:r.sessionId,formId:r.form.id,valid:true}]})}
  const before=JSON.stringify(state);await api(async(S,T,R,s,x)=>{await s.deleteAll();await s.mutate(q=>Object.assign(q,x))},state);await p.reload();await ready();
  const check=await api(async(S,T,R,s,id)=>{const raw=await s.read(),q=S.inspectLocalState(raw);return {raw,accepted:R.verifyCompletedResult(raw.results[id]),chain:!!q.activeChain,memory:!!T.currentTrainingChain()}},r.sessionId);
  assert.equal(JSON.stringify(check.raw),before);await p.getByRole('button',{name:'Stop history',exact:true}).click();
  const row={mode,name,accepted:check.accepted,chain:check.chain,memory:check.memory,reports:await p.getByRole('button',{name:'Open original report',exact:true}).count(),comparisons:await p.getByRole('heading',{name:/Training chain /}).count(),preserved:true,derivedInvalidationAbsent:r.events.every(e=>e.type!=='session_invalidated')};
  const expected=['control','blur-1000','initial-fixation-2','initial-wrong-4'].includes(name);
  assert.equal(row.accepted,expected,mode+' '+name);assert.equal(row.chain,expected);assert.equal(row.memory,expected);assert.equal(row.reports,(mode==='baseline'?0:1)+(expected?1:0));assert.equal(row.comparisons,mode==='retest'&&expected?1:0);
  out.cases.push(row);
  if(['initial-fixation-3','initial-wrong-5'].includes(name)&&row.accepted){await writeFile(new URL(`accepted-${mode}-${name}.json`,import.meta.url),JSON.stringify(state,null,2));await p.screenshot({path:new URL(`accepted-${mode}-${name}.png`,import.meta.url).pathname,fullPage:true})}
 }
 console.log(JSON.stringify(out.cases));
}catch(e){out.error=String(e.stack);console.error(e);process.exitCode=1}finally{await writeFile(new URL('initial-fixation-load.json',import.meta.url),JSON.stringify(out,null,2));await b.close()}
