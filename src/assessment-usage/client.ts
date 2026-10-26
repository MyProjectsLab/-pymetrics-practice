import { USAGE_WEBSITE_ID } from '../discovery/config'
import { project } from './contract'
import type { Context, Metrics, Outcome, Summary, Task } from './contract'

const active=new Set<Attempt<Task>>()
let flight:{owner:object;abort:AbortController;timer:ReturnType<typeof setTimeout>}|null=null
let generation=0, listening=false
const paths=new Set(['/practice','/mock','/arrows.html','/mouth-v13.html','/money.html','/money2.html','/practice/keypresses','/practice/stop','/practice/digits','/practice/balloons','/practice/towers','/practice/cards','/practice/easy-or-hard','/faces.html'])
function abortFlight(){generation++;if(flight){clearTimeout(flight.timer);flight.abort.abort();flight=null}}
function eligible(){
  return typeof window!=='undefined'&&window.location.protocol==='https:'&&window.location.hostname==='traitgame.com'&&
    paths.has(window.location.pathname)&&document.visibilityState==='visible'&&document.hasFocus()&&
    navigator.doNotTrack!=='1'&&(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl!==true
}
function lifecycle(){abortFlight();for(const attempt of active)attempt.cancel();active.clear()}
function listen(){
  if(listening||typeof window==='undefined')return
  listening=true
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')lifecycle()})
  window.addEventListener('pagehide',lifecycle)
  window.addEventListener('blur',lifecycle)
  document.addEventListener('freeze',lifecycle)
  // Any subsequent input cancels a pending send before it can start another task,
  // including excluded training. This does not run a timer or send during play.
  window.addEventListener('pointerdown',abortFlight,true)
  window.addEventListener('keydown',abortFlight,true)
}

/** One fresh native attempt. Identity is local matching only and never serialized. */
export class Attempt<T extends Task>{
  private identity:string|null=null
  private supported=false
  private reserved=false
  private epoch=0
  private context:Context='practice'
  private task:T
  constructor(task:T){this.task=task}
  begin(context:Context='practice'){
    try{listen();abortFlight();this.cancel();this.reserved=true;this.context=context;active.add(this as Attempt<Task>)}catch{/* analytics never owns gameplay */}
  }
  admit(identity:string,supported=true){
    try{if(this.reserved&&this.identity===null){this.identity=identity;this.supported=supported}}catch{/* optional */}
  }
  finish(identity:string,outcome:Outcome,metrics?:()=>Metrics<T>){
    try{
      if(!this.reserved||this.identity!==identity)return
      this.reserved=false;this.identity=null;active.delete(this as Attempt<Task>)
      const epoch=generation, ownEpoch=this.epoch
      if(!this.supported||active.size||!eligible())return
      // Copy only the closed scalar summary while native report authority is live.
      // This is reached after protection ends; no report/journal crosses into the job.
      const data=project(this.task,this.context,outcome,outcome==='completed'?metrics?.():undefined)
      if(data)this.queue(data,epoch,ownEpoch)
    }catch{/* optional analytics must not change any native outcome */}
  }
  private queue(data:Summary,epoch:number,ownEpoch:number){
      // Leave all native save/publication/cleanup stacks before HTTP.
      void Promise.resolve().then(()=>{
        try{
          if(epoch!==generation||ownEpoch!==this.epoch||active.size||!eligible())return
          const body=JSON.stringify({type:'event',payload:{website:USAGE_WEBSITE_ID,hostname:'traitgame.com',url:'/assessment',name:'assessment_outcome',data}})
          const abort=new AbortController()
          abortFlight()
          const timer=setTimeout(()=>{if(flight?.abort===abort){abort.abort();flight=null}},2000)
          flight={owner:this,abort,timer}
          void fetch('https://gateway.umami.is/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body,
            signal:abort.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',keepalive:false})
            .catch(()=>undefined).finally(()=>{if(flight?.abort===abort){clearTimeout(timer);flight=null}})
        }catch{/* no response parsing, logging, retry or gameplay dependency */}
      })
  }
  cancel(){try{if(flight?.owner===this)abortFlight();this.epoch++;this.reserved=false;this.identity=null;active.delete(this as Attempt<Task>)}catch{/* optional */}}
}
