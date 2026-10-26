// Reused independent audit fixture generator, redirected to the current checkout.
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({root:fileURLToPath(new URL('../../../../',import.meta.url)),server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const load=n=>server.ssrLoadModule(`/src/stop/${n}.ts`);
const [R,E,D,T,S,P]=await Promise.all(['run','exposure','drill-run','training','storage','drills'].map(load));
const plain=x=>JSON.parse(JSON.stringify(x));
const settings={binding:{code:'Space',label:'Space'},physicalKeyboard:true,visualProfile:'standard'};
function scheduler({delayOffset=false,onset=()=>{}}={}){
 let now=0,seq=0,delayed=false;const tasks=new Map();
 const put=(at,fn)=>{const id=++seq;tasks.set(id,{at,fn,id});return()=>tasks.delete(id)};
 const flush=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate)};
 const clock=()=>now;
 return {clock,scheduler:{at:put,after:(t,fn)=>put(t+0.01,fn)},
 frames:{request:(q,fn)=>{let lag=0;if(delayOffset&&!delayed&&q.kind==='offset'&&(delayOffset!=='scored'||q.trial.phase==='scored')){lag=80;delayed=true}return put(q.notBeforeMs+lag,()=>{fn();if(q.kind==='onset')onset(q,put,clock)})}},
 async until(predicate){for(let n=0;n<20000;n++){await flush();if(predicate())return;const next=[...tasks.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!next)throw Error('No tasks while waiting');tasks.delete(next.id);now=Math.max(now,next.at);next.fn()}throw Error('step budget')},
 flush, advance(ms){now+=ms}
 };
}
async function standard({mode='baseline',binding=settings.binding,profile='standard',choice=0,exit=null,hits=false,timingNote=false}={}){
 const setup={...settings,binding,visualProfile:profile}; let run;
 const sim=scheduler({delayOffset:timingNote?'scored':false,onset:(q,put,clock)=>{if(hits&&q.trial.stimulus==='GO')put(clock()+350,()=>{run.engine.keyDown(binding.code);run.engine.keyUp(binding.code)})}});
 const sessionId=crypto.randomUUID(), exposure=E.createMemoryExposureRepository();
 const device={schemaVersion:'stop_event_v1',sequenceNumber:1,sessionId,timestampMs:0,type:'device_check_completed',payload:{inputBinding:binding.code,inputDeviceClass:'physical_keyboard',visualProfile:profile,timingProfile:'standard'}};
 const preparation={sessionId,snapshot:()=>[device]};
 const reservedFormId=mode==='retest'?exposure.reserve(sessionId,()=>choice,mode,Date.now()+1800000).id:undefined;
 run=R.createStopRun({preparation,setup,exposure,...sim,mode,reservedFormId,random:()=>choice,clear(){},changed(){},environment:{userAgent:'Independent deterministic audit clock',width:1200,height:800}});
 run.begin(false);run.startWarmup();await sim.until(()=>run.snapshot().screen==='warmup_complete');await run.startScored();
 if(exit!==null){if(exit)await sim.until(()=>run.snapshot().exposed);run.leave();await sim.flush();assert.equal(run.snapshot().draft.realizedSequence.length,exit?1:0);return plain(run.snapshot().draft)}
 await sim.until(()=>run.snapshot().screen==='complete');const result=plain(run.snapshot().result);result.storageMode='persistent_local';assert(R.verifyCompletedResult(result));
 assert.deepEqual(result.summarySnapshot.counts,hits?{hits:60,misses:0,withholds:20,falseAlarms:0}:{hits:0,misses:60,withholds:20,falseAlarms:0});assert.equal(result.summarySnapshot.rates.overall,hits?1:.25);return result;
}
async function drill(id,note=null){let run,extra=false;let starts=[];
 const sim=scheduler({delayOffset:note==='timing',onset:(q,put,clock)=>{if(note==='extra'&&!extra){extra=true;put(clock()+350,()=>{for(let i=0;i<6;i++){run.engine.keyDown('Space');run.engine.keyUp('Space')}})}}});
 run=D.createDrillRun({id:crypto.randomUUID(),manifest:P.drillById(id),setup:settings,...sim,initialFrame:f=>f(),clear(){},changed(){},started:id=>starts.push({id,events:run.engine.snapshot().events.length})});
 await run.begin(false);await run.begin(false);
 for(;;){await sim.until(()=>['summary','complete','invalid'].includes(run.snapshot().screen));if(run.snapshot().screen!=='summary')break;sim.advance(run.snapshot().resetRemainingMs);assert(run.continue())}
 const attempt=plain(run.snapshot().attempt);assert(attempt.valid);assert.equal(starts.length,1);assert(S.verifyDrillAttempt(attempt,'Space'),`intact ${id} ${note}`);return attempt;
}
try{
 const baseline=await standard(),retest=await standard({mode:'retest',hits:true});
 const drills={};for(const id of ['detection','withholding','consistency','stability','maintenance'])drills[id]=await drill(id);
 const notes={timing:await drill('detection','timing'),extra:await drill('detection','extra')};
 const chain={schemaVersion:'stop_training_chain_v1',id:crypto.randomUUID(),baseline,recommendation:T.routeStop(baseline),drillAttempts:[drills.detection],retestAttempts:[],retest:null,status:'drill_complete'};
 const marker=r=>({formId:r.form.id,sessionId:r.sessionId,exposedAtWall:r.completedAtWall,visualProfile:r.setup.visualProfile,certainty:'confirmed',deleted:false});
 const state={schemaVersion:'stop_local_v1',installationId:'independent-audit',results:{[baseline.sessionId]:baseline},drafts:{},chains:{[chain.id]:chain},retiredChains:{},activeChainId:chain.id,exposures:{[baseline.form.id]:marker(baseline)},reservations:{}};
 assert(S.inspectLocalState(state).activeChain);
 const drafts=[];for(const mode of ['baseline','replay','retest'])for(const exit of [false,true])drafts.push(await standard({mode,exit}));
 const profiles=[];for(const [code,label,choice] of [['KeyA','A',0],['KeyQ','A',.3],['KeyA','Different display',.6]])profiles.push(await standard({binding:{code,label},choice,hits:true}));
 const standardNotes={baseline:await standard({timingNote:true}),retest:await standard({mode:'retest',timingNote:true,hits:true})};
 const data={baseline,retest,chain,state,drills,notes,drafts,profiles,standardNotes};await writeFile(process.env.M5_FIXTURES ?? '/private/tmp/stop-m5-r1-r2-fixtures.json',JSON.stringify(data,null,2));
 console.log(JSON.stringify({baselineEvents:baseline.events.length,retestEvents:retest.events.length,drills:Object.fromEntries(Object.entries(drills).map(([k,v])=>[k,v.events.length])),notes:Object.fromEntries(Object.entries(notes).map(([k,v])=>[k,v.events.filter(e=>e.type==='quality_note')]))}));
}finally{await server.close()}
