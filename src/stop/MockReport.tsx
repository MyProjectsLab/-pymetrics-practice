import {useEffect,useState} from 'react'
import {flushSync} from 'react-dom'
import {Shell} from '../core/Shell'
import {InvalidReport,StopReport} from './Report'
import {StopLocalStore,inspectLocalState} from './storage'
import type {DevelopmentDraft,StopResult} from './run'
import {reportDocumentCurrent,withVerifiedReportPublication} from '../mock/report-route'
import type {ReportTarget} from '../mock/report-route'

/** Source-owned exact report route. No Stop preparation or reservation is created. */
export function StopMockReport({target,onLibrary}:{target:ReportTarget;onLibrary:()=>void}){
 const [result,setResult]=useState<StopResult|null>(null),[draft,setDraft]=useState<DevelopmentDraft|null>(null),[error,setError]=useState('')
 useEffect(()=>{
  let live=true,store:StopLocalStore|null=null,inFlight=false
  const check=async()=>{if(!live||inFlight||document.visibilityState!=='visible'||!document.hasFocus())return
   inFlight=true
   try{await withVerifiedReportPublication(target,async permit=>{
    store??=await StopLocalStore.openRetained(new AbortController().signal)
    const root=await store.readRetained(new AbortController().signal),checked=inspectLocalState(root)
    const exact=checked.valid.find(item=>item.sessionId===target.attemptId)
    const invalid=checked.invalid.find(item=>item.sessionId===target.attemptId)
    if(!exact&&!invalid)throw Error('The exact Stop report is unavailable')
    if(root.installationId!==target.reference.installationId)throw Error('Stop installation changed')
    permit()
    if(live&&reportDocumentCurrent())flushSync(()=>{setResult(exact??null);setDraft(invalid??null);setError('')})
   })}catch(cause){if(live)flushSync(()=>{setResult(null);setDraft(null);setError(String(cause))})}
   finally{inFlight=false}
  }
  void check()
  const focus=()=>void check()
  window.addEventListener('focus',focus);window.addEventListener('pageshow',focus)
  const timer=window.setInterval(focus,250)
  return()=>{live=false;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);store?.close()}
 },[target])
 return <Shell onLibrary={onLibrary}><section className="journey">{result?<StopReport result={result} onReplay={onLibrary} onLibrary={onLibrary} returnToMock/>:draft?<InvalidReport draft={draft} onRestart={onLibrary} onGuide={onLibrary} onMockReturn={onLibrary}/>:<p role={error?'alert':'status'}>{error||'Checking the exact Stop result…'}</p>}<button onClick={onLibrary}>Return to mock</button></section></Shell>
}
