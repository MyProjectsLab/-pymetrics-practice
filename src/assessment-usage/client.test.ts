import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { Task } from './contract'

let Attempt:typeof import('./client')['Attempt']
let send:ReturnType<typeof vi.fn<typeof fetch>>
const examples={
  stop:{correct:72,trials:80,false_alarms:3}, balloons:{rounds:39,banked_cents:12345,bursts:10,collections:29,pumps:380},
  keypresses:{accepted:40,target:40,target_reached:1},arrows:{correct:125,trials:135},lengths:{correct:81,trials:90},
  digits:{correct:8,trials:11,maximum_length:7}, cards:{draws:80,ending_dollars:2400,gains_dollars:4000,losses_dollars:3600},
  easy_hard:{attempts:12,completed:10,hard_choices:7,easy_choices:5,earned_cents:450},towers:{solved:1,moves:11,optimal_moves:9},
  money_1:{exchanges:1},money_2:{exchanges:2},faces:{correct:11,trials:14},
} as const
beforeEach(async()=>{
  vi.resetModules();vi.useFakeTimers()
  vi.stubGlobal('window',Object.assign(new EventTarget(),{location:new URL('https://traitgame.com/practice?practiceGame=stop')}))
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
  vi.spyOn(document,'hasFocus').mockReturnValue(true)
  Object.defineProperty(navigator,'doNotTrack',{configurable:true,value:null})
  Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:false})
  send=vi.fn<typeof fetch>().mockResolvedValue({json:vi.fn(),text:vi.fn()} as unknown as Response)
  vi.stubGlobal('fetch',send)
  ;({Attempt}=await import('./client'))
})
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
it.each(Object.keys(examples) as Task[])('one closed terminal summary for %s; no identity or report/history duplication',async task=>{
  const routes:Record<Task,string>={stop:'/practice/stop',balloons:'/practice/balloons',keypresses:'/practice/keypresses',arrows:'/arrows.html',lengths:'/mouth-v13.html',digits:'/practice/digits',cards:'/practice/cards',easy_hard:'/practice/easy-or-hard',towers:'/practice/towers',money_1:'/money.html',money_2:'/money2.html',faces:'/faces.html'}
  window.location.pathname=routes[task]
  const a=new Attempt(task);a.begin('mock')
  expect(send).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
  a.admit('private-attempt-id')
  a.finish('different','completed',()=>examples[task])
  expect(send).not.toHaveBeenCalled()
  a.finish('private-attempt-id','completed',()=>examples[task]);await flush()
  expect(send).toHaveBeenCalledTimes(1)
  const [url,options]=send.mock.calls[0]
  expect(url).toBe('https://gateway.umami.is/api/send')
  expect(options).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',keepalive:false})
  const body=JSON.parse(String(options?.body))
  expect(body.payload).toMatchObject({website:'d8dcc218-8bca-4dea-988a-9eb3e71e90c0',hostname:'traitgame.com',url:'/assessment',name:'assessment_outcome',data:{schema:1,task,context:'mock',outcome:'completed',...examples[task]}})
  expect(String(options?.body)).not.toMatch(/private-attempt|practiceGame|time|referrer|profile|rating|answer|journal|email/)
  a.finish('private-attempt-id','completed',()=>examples[task]);await flush()
  expect(send).toHaveBeenCalledTimes(1)
})
it('rejects report-only and unaccepted starts; save retry uses the same live admission once',async()=>{
  const a=new Attempt('money_1');a.finish('saved','completed',()=>({exchanges:1}));a.begin();a.finish('new','completed',()=>({exchanges:1}));await flush()
  expect(send).not.toHaveBeenCalled()
  a.admit('new');a.admit('new');a.finish('new','completed',()=>({exchanges:1}));a.finish('new','completed',()=>({exchanges:1}));await flush()
  expect(send).toHaveBeenCalledTimes(1)
})
it.each(['invalid','incomplete'] as const)('only a terminal status for %s, never metrics',async status=>{
  const a=new Attempt('arrows'),metrics=vi.fn(()=>examples.arrows)
  a.begin();a.admit('a');a.finish('a',status,metrics);await flush()
  const data=JSON.parse(String(send.mock.calls[0][1]?.body)).payload.data
  expect(data).toEqual({schema:1,task:'arrows',family:'arrows_1_1',context:'practice',outcome:status});expect(metrics).not.toHaveBeenCalled()
})
it('blocks projection, timers and HTTP while another standard or excluded attempt is protected',async()=>{
  const a=new Attempt('faces'),b=new Attempt('lengths'),m=vi.fn(()=>examples.faces)
  a.begin();a.admit('a');b.begin();b.admit('modified',false)
  a.finish('a','completed',m);await flush()
  expect(m).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
  b.cancel();a.finish('a','completed',m);await flush();expect(send).not.toHaveBeenCalled()
})
it.each(['pagehide','blur','freeze','hidden','cancel','next-start','next-input'])('drops late publication on %s without resurrection',async action=>{
  const a=new Attempt('money_2');a.begin();a.admit('a');a.finish('a','completed',()=>examples.money_2)
  if(action==='hidden'){Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))}
  else if(action==='cancel')a.cancel()
  else if(action==='next-start')a.begin()
  else if(action==='next-input')window.dispatchEvent(new Event('pointerdown'))
  else if(action==='freeze')document.dispatchEvent(new Event('freeze'))
  else window.dispatchEvent(new Event(action))
  await flush();a.finish('a','completed',()=>examples.money_2);await flush();expect(send).not.toHaveBeenCalled()
})
it.each(['dnt','gpc','preview','hidden','unfocused','unsupported'])('denies %s at terminal, then never retries it',async reason=>{
  const a=new Attempt('stop');a.begin();a.admit('a',reason!=='unsupported')
  if(reason==='dnt')Object.defineProperty(navigator,'doNotTrack',{configurable:true,value:'1'})
  if(reason==='gpc')Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:true})
  if(reason==='preview')window.location.hostname='preview.vercel.app'
  if(reason==='hidden')Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
  if(reason==='unfocused')vi.mocked(document.hasFocus).mockReturnValue(false)
  a.finish('a','completed',()=>examples.stop);await flush();a.finish('a','completed',()=>examples.stop);expect(send).not.toHaveBeenCalled()
})
it('aborts held HTTP and its timeout before the next protected start, with no retry',async()=>{
  send.mockImplementation(()=>new Promise(()=>{}))
  const a=new Attempt('money_1');a.begin();a.admit('a');a.finish('a','completed',()=>examples.money_1);await flush()
  const signal=send.mock.calls[0][1]?.signal;expect(signal?.aborted).toBe(false);expect(vi.getTimerCount()).toBe(1)
  a.begin();expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(10000);expect(send).toHaveBeenCalledTimes(1)
})
it('ignores a provider response and contains synchronous and rejected transport errors',async()=>{
  for(const outcome of ['resolve','reject','throw']){
    const json=vi.fn(),text=vi.fn()
    send.mockImplementation(()=>{if(outcome==='throw')throw Error('blocked');if(outcome==='reject')return Promise.reject(Error('offline'));return Promise.resolve({json,text} as unknown as Response)})
    const a=new Attempt('money_1');expect(()=>{a.begin();a.admit(outcome);a.finish(outcome,'completed',()=>examples.money_1)}).not.toThrow();await flush()
    expect(json).not.toHaveBeenCalled();expect(text).not.toHaveBeenCalled();a.cancel()
  }
  expect(send).toHaveBeenCalledTimes(3)
})
