import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile,writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
const fixture=JSON.parse(gunzipSync(await readFile(new URL('historical-assigned-state.json.gz',import.meta.url))))
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const out={browser:browser.version(),errors:[]}
try {
 const p=await browser.newPage({viewport:{width:1200,height:800}});p.on('pageerror',e=>out.errors.push(String(e)))
 await p.goto('http://127.0.0.1:5566');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 out.router=await p.evaluate(async fixture=>{
  const S=await import('/src/stop/storage.ts'),T=await import('/src/stop/training.ts'),store=S.stopLocalStore()
  await store.mutate(s=>Object.assign(s,fixture))
  const before=await store.read(),original=JSON.stringify(before.chains),checked=S.inspectLocalState(before)
  const legacyAdmitted=checked.activeChain?.recommendation.version==='stop_drill_router_v1'
  const source=structuredClone(checked.activeChain.baseline)
  source.summarySnapshot.counts={hits:54,misses:6,withholds:20,falseAlarms:0}
  source.summarySnapshot.halves=[{hits:27,misses:3,withholds:10,falseAlarms:0},{hits:27,misses:3,withholds:10,falseAlarms:0}]
  source.summarySnapshot.rates={hit:.9,miss:.1,falseAlarm:0}
  source.summarySnapshot.timing.count=54;source.validity='valid';source.events=[]
  const boundaries=[1.001-Number.EPSILON,1.001,1.001+Number.EPSILON].map(severity=>{
   source.summarySnapshot.timing.iqr=severity*150
   return {severity,delta:severity-1,current:T.routeStop(source),legacy:T.routeStop(source,'stop_drill_router_v1')}
  })
  return {legacyAdmitted,unchanged:original===JSON.stringify((await store.read()).chains),boundaries}
 },fixture)
 assert(out.router.legacyAdmitted&&out.router.unchanged)
 assert.deepEqual(out.router.boundaries.map(b=>b.current.drillId),['detection','detection','stability'])
 assert(out.router.boundaries.every(b=>b.current.version==='stop_drill_router_v2'))
 assert.equal(out.router.boundaries[1].legacy.drillId,'stability')
 await p.reload();await p.getByRole('button',{name:'Resume Stop training',exact:true}).click()
 await p.getByRole('button',{name:'Start assigned drill',exact:true}).click()
 const disclosure='This input method can change response timing. You can use it to learn the rule, but this beta will not compare the timing result with the standard physical-keyboard form.'
 assert(await p.getByText(disclosure,{exact:true}).isVisible())
 const affected=p.getByLabel('My input or screen-reader setup adds delay to timed responses.',{exact:true})
 await affected.check();assert(await p.getByRole('button',{name:'Start drill',exact:true}).isDisabled());await affected.uncheck()
 await p.evaluate(()=>{const raf=requestAnimationFrame;window.__late=[];window.requestAnimationFrame=cb=>{if(new Error().stack.includes('/src/stop/TrainingFlow.tsx')){window.__late.push(cb);return -123}return raf(cb)}})
 await p.getByRole('button',{name:'Start drill',exact:true}).click()
 await p.getByRole('heading',{name:'Drill needs to restart',exact:true}).waitFor({timeout:5000})
 const read=()=>p.evaluate(async()=>{const T=await import('/src/stop/training.ts');return {chain:T.currentTrainingChain(),presentation:document.querySelector('.stop-presentation')?.innerHTML}})
 const before=await read();await p.evaluate(()=>{for(const cb of window.__late)cb(performance.now())});await p.waitForTimeout(100)
 assert.deepEqual(await read(),before)
 await p.getByRole('button',{name:'Restart drill',exact:true}).focus();await p.keyboard.press('Enter')
 await p.getByRole('heading',{name:'Recommended Stop exercise',exact:true}).waitFor()
 const after=await read();assert.equal(after.chain.drillAttempts.length,1);assert.equal(after.chain.drillAttempts[0].valid,false)
 assert.equal(after.chain.drillAttempts[0].events.filter(e=>e.type==='stimulus_presented').length,0)
 assert.equal(after.chain.recommendation.version,'stop_drill_router_v1')
 out.drill={before,after,keyboardRestart:true,latencyGate:true};assert.deepEqual(out.errors,[]);out.pass=true
} catch(e){out.pass=false;out.failure=String(e);throw e}
finally{await browser.close();await writeFile(new URL('router-drill-browser.json',import.meta.url),JSON.stringify(out,null,2))}
