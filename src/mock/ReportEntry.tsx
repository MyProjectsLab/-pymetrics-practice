import {useEffect,useMemo,useState} from 'react'
import {Shell} from '../core/Shell'
import {KeypressesJourney} from '../keypresses/Journey'
import {DigitsJourney} from '../digits/Journey'
import {BalloonsJourney} from '../balloons/Journey'
import {TowersJourney} from '../towers/Journey'
import {TowersRuntime} from '../towers/runtime'
import {CardsJourney} from '../cards/Journey'
import {EasyHardJourney} from '../easy-hard/Journey'
import {StopMockReport} from '../stop/MockReport'
import {reportHint,verifiedReportTarget,withVerifiedReportPublication} from './report-route'

const runtime=new TowersRuntime()
export default function MockReportEntry(){
 const [target,setTarget]=useState<Awaited<ReturnType<typeof verifiedReportTarget>>|null>(null),[error,setError]=useState('')
 const parsed=useMemo(()=>{try{return {hint:reportHint(),linkError:''}}catch{return {hint:null,linkError:'Mock link unavailable.'}}},[])
 const hint=parsed.hint,returnUrl=hint?`/mock?mock=${encodeURIComponent(hint.mockId)}`:'/mock'
 const back=()=>location.assign(returnUrl)
 useEffect(()=>{if(!hint)return;let live=true;void verifiedReportTarget(hint).then(value=>{if(live)setTarget(value)}).catch(()=>{if(live)setError('Mock link unavailable. Check the saved mock and its native game history.')});return()=>{live=false}},[hint])
 useEffect(()=>{if(!target)return;let live=true,inFlight=false
  const check=async()=>{if(!live||inFlight||document.visibilityState!=='visible'||!document.hasFocus())return;inFlight=true
   try{await withVerifiedReportPublication(target,()=>{})}
   catch{if(live){setTarget(null);setError('The saved native report changed or is unavailable. Return to the mock history.')}}
   finally{inFlight=false}}
  const timer=window.setInterval(()=>void check(),250),focus=()=>void check()
  window.addEventListener('focus',focus);window.addEventListener('pageshow',focus)
  return()=>{live=false;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus)}
 },[target])
 if(!hint||error||!target)return <Shell onLibrary={back}><section className="journey"><h1>Saved game report</h1><p role={parsed.linkError||error?'alert':'status'}>{parsed.linkError||error||(!hint?'Mock link unavailable.':'Checking the exact source result…')}</p><button onClick={back}>Back to mock</button></section></Shell>
 switch(target.game){
  case 'keypresses':return <KeypressesJourney onLibrary={back} reportTarget={target}/>
  case 'stop':return <StopMockReport target={target} onLibrary={back}/>
  case 'digits':return <DigitsJourney onLibrary={back} reportTarget={target}/>
  case 'balloons':return <BalloonsJourney onLibrary={back} reportTarget={target}/>
  case 'towers':return <TowersJourney onLibrary={back} runtime={runtime} reportTarget={target}/>
  case 'cards':return <CardsJourney onLibrary={back} reportTarget={target}/>
  case 'easy_hard':return <EasyHardJourney onLibrary={back} reportTarget={target}/>
  default:return <Shell onLibrary={back}><p role="alert">This saved game uses its dedicated document.</p><button onClick={back}>Back to mock</button></Shell>
 }
}
