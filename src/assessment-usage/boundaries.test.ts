import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
let Attempt:typeof import('./client')['Attempt']
import { confirmedLengthsMetrics,standardDigits,unassistedDigitsMetrics } from './boundaries'
import { freshMouthRoot,MouthStore } from '../lengths-mouth-v13/storage'
import type { MouthBackend,MouthRoot } from '../lengths-mouth-v13/storage'
import { advance,MOUTH_PRESENTATION_VERSION,requiredDue } from '../lengths-mouth-v13/engine'
import type { State } from '../lengths-mouth-v13/engine'
import { initialRun,visual,closeTrial,nextTrial,openEntry } from '../digits/test-support'
import { advanceDigits } from '../digits/engine'
import { scoreDigits } from '../digits/scoring'

let send:ReturnType<typeof vi.fn<typeof fetch>>
beforeEach(async()=>{
  vi.resetModules()
  vi.stubGlobal('window',Object.assign(new EventTarget(),{location:new URL('https://traitgame.com/practice/cards')}))
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
  vi.spyOn(document,'hasFocus').mockReturnValue(true)
  Object.defineProperty(navigator,'doNotTrack',{configurable:true,value:null})
  Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:false})
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(_name:string,_options:unknown,fn:(lock:object)=>unknown)=>fn({})}})
  send=vi.fn<typeof fetch>().mockResolvedValue({} as Response);vi.stubGlobal('fetch',send)
  ;({Attempt}=await import('./client'))
})
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();vi.restoreAllMocks()})
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve()}
function held(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return {promise,resolve}}

// Execute the actual nested function, with controlled native storage/publication
// dependencies. This is a source-bound ordering test, not a duplicate algorithm
// or a claim of browser gameplay. No test hook enters the shipped component.
function cardsPublisher(env:Record<string,unknown>){
  const text=readFileSync(process.cwd()+'/src/cards/Journey.tsx','utf8')
  const source=ts.createSourceFile('Journey.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let found:ts.FunctionDeclaration|undefined
  const visit=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='showReport')found=node;ts.forEachChild(node,visit)};visit(source)
  if(!found)throw Error('Native publisher missing')
  const code=ts.transpileModule(found.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return new Function('env',`with(env){${code};return showReport}`)(env) as (id:string,source:'live'|'history')=>Promise<void>
}
it.each([false,true])('Cards keeps native release and HTTP after held publication/view; stale=%s',async stale=>{
  const publication=held(),view=held(),release=vi.fn(),nav={current:1},currentReportId={current:null as string|null}
  const usage=new Attempt('cards');usage.begin('mock');usage.admit('fresh')
  const report={status:'complete_valid',committedDrawCount:80,endingBalance:2400,gains:4000,losses:3600}
  const store={list:async()=>[],view:()=>view.promise}
  const noop=()=>{}
  const show=cardsPublisher({storeRef:{current:store},nav,currentReportId,reportTarget:null,
    checkedRun:async()=>({run:{id:'fresh'},report}),flushSync:(fn:()=>void)=>fn(),setReport:noop,setRun:noop,setComparison:noop,setStep:noop,setError:noop,
    withCardsDataOrder:async(fn:()=>Promise<void>)=>{await publication.promise;await fn()},money:String,release,usage:{current:usage},
    mock:{terminal:async()=>'ready'},mockTerminalSeen:{current:null},setMockReady:noop,setMockError:noop})
  const pending=show('fresh','live');await flush()
  expect(release).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled()
  publication.resolve();await flush()
  expect(release).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled()
  if(stale)nav.current++
  view.resolve();await pending;await flush()
  expect(release).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(stale?0:1)
})
function thirty(prior:State){
  let state=advance(prior,{kind:prior.phase==='armed'?'start':'continue',atMs:prior.commands.at(-1)?.atMs??0,responseHeld:false})
  for(let trial=0;trial<30;trial++)for(const kind of ['fixation','onset','remove','resolve','feedback','offset'] as const)state=advance(state,{kind,atMs:requiredDue(state)!})
  return state
}
it('Lengths native recoverable complete sends zero; confirmed terminal sends once; saved/history does not admit',async()=>{
  let root=freshMouthRoot()
  const backend:MouthBackend={read:async()=>structuredClone(root),change:async<T>(op:(root:MouthRoot)=>T)=>{const next=structuredClone(root),result=op(next);root=next;return result}}
  const store=new MouthStore(backend,root.installationId),id=crypto.randomUUID()
  const profile={kind:'keyboard',variant:'standard',deviceClass:'test',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false,presentationVersion:MOUTH_PRESENTATION_VERSION} as const
  const displayContext={layoutWidthCssPx:1200,layoutHeightCssPx:900,visualWidthCssPx:1200,visualHeightCssPx:900,taskHostWidthCssPx:500,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true} as const
  const arm=await store.start({requestId:id,sessionId:id,clockDomainId:id,profile,variant:'standard',route:'standalone',atMs:0,wallMs:1,displayContext})
  const first=thirty(arm.state);await store.saveSnapshot(arm,first,0)
  const second=thirty(first);await store.saveSnapshot(arm,second,1)
  const state=thirty(second),handle=store.authority.handle(arm,state)
  const usage=new Attempt('lengths');usage.begin();usage.admit(id)
  const finish=()=>{const metrics=confirmedLengthsMetrics(handle.resultStatus(),handle.armedOnly);if(metrics)usage.finish(id,'completed',()=>metrics)}
  expect(handle.resultStatus().kind).toBe('recoverable');finish();await flush();expect(send).not.toHaveBeenCalled()
  await store.saveSnapshot(arm,state,2)
  expect(handle.resultStatus().kind).toBe('confirmed');finish();finish();await flush();expect(send).toHaveBeenCalledTimes(1)
  const metrics=confirmedLengthsMetrics(handle.resultStatus(),true);expect(metrics).toBeNull()
  const history=new Attempt('lengths');history.finish(id,'completed',()=>({correct:0,trials:90}));await flush();expect(send).toHaveBeenCalledTimes(1)
})
it('Digits keeps only standard keyboard setup and actual unassisted native final reviews',async()=>{
  expect(standardDigits(visual)).toBe(true)
  expect(standardDigits({...visual,entryMethod:'keypad'})).toBe(false)
  expect(standardDigits({...visual,assistedEntryDeclared:true})).toBe(false)
  for(const assisted of [false,true]){
    let state=await initialRun()
    for(let n=0;n<3;n++){
      if(assisted){state=openEntry(state);state=advanceDigits(state,{kind:'edit',atMs:state.entryOpenedMs!+1,value:'',assisted:true,source:'assisted'});state=advanceDigits(state,{kind:'submit',atMs:state.entryOpenedMs!+2})}
      else state=closeTrial(state,false)
      if(state.phase==='feedback')state=nextTrial(state)
    }
    const report=scoreDigits(state);expect(report.status).toBe('valid')
    if(report.status!=='valid')throw Error('Expected native terminal')
    expect(report.assistedEntry).toBe(assisted)
    const usage=new Attempt('digits');usage.begin();usage.admit('fresh-'+assisted,standardDigits(state.profile))
    const metrics=unassistedDigitsMetrics(report)
    if(metrics)usage.finish('fresh-'+assisted,'completed',()=>metrics);else usage.cancel()
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
  }
  expect(String(send.mock.calls[0][1]?.body)).not.toMatch(/assisted|keypad|profile|entryMethod/)
})
