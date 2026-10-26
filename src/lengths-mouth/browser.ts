import { advance, requiredDue } from './engine'
import type { Command, InputProfile, InvalidReason, PointerSource, State } from './engine'
import type { Side } from './contracts'
import { MouthEntry } from './entry'
import type { MouthAdmission } from './entry'
import { MouthRecovery } from './recovery'
import type { ArmedAttempt, MouthStore, StartRequest } from './storage'
import { captureMouthDisplayContext } from './display-context'

export function faceSvg(mouth:Side,profile:InputProfile):string {
 const length=profile.variant==='standard'?(mouth==='short'?22:30):(mouth==='short'?18:38)
 return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="44" cy="48" r="4" fill="currentColor"/><circle cx="76" cy="48" r="4" fill="currentColor"/><line x1="${60-length/2}" x2="${60+length/2}" y1="77" y2="77" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
}
const terminal=(s:State)=>s.phase==='invalid'||s.phase==='completed'
export type RunUpdate = {state:State|null;message:string;recovery:MouthRecovery|null;checkpoint:'none'|'pending'|'uncertain'|'confirmed';gated:boolean}
/** DOM effects and synchronous input use the document's one monotonic clock.
 * The presentation order is held through each face's confirmed DOM frame. */
export class MouthBrowserRun {
 readonly entry:MouthEntry
 readonly host:HTMLElement
 private readonly update:(value:RunUpdate)=>void
 private state:State|null=null
 private arm:ArmedAttempt|null=null
 private profile:InputProfile|null=null
 private generation=0
 private stageGeneration=0
 private canceled=false
 private protected=false
 private gate=false
 private checkpointStatus:RunUpdate['checkpoint']='none'
 private recovery:MouthRecovery|null=null
 private firstToken:MouthAdmission|null=null
 private held=new Set<string>()
 private pointerHeld=new Set<number>()
 private stageTimer=0;private stageFrame=0;private watchdog=0;private monitor=0
 private previousFrame:number|null=null
 private pendingConfirmation:((gap?:number)=>void)|null=null
 private starting=false
 private capturedViewport=''
 private readonly cleanup:Array<()=>void>=[]
 constructor(store:MouthStore,host:HTMLElement,update:(value:RunUpdate)=>void){
  this.entry=new MouthEntry(store);this.host=host;this.update=update
  this.listen(window,'keydown',e=>this.key(e as KeyboardEvent,true),true)
  this.listen(window,'keyup',e=>this.key(e as KeyboardEvent,false),true)
  this.listen(host,'pointerdown',e=>this.pointer(e as PointerEvent,true))
  this.listen(window,'pointerup',e=>this.pointer(e as PointerEvent,false),true)
  this.listen(window,'pointercancel',e=>this.pointer(e as PointerEvent,false),true)
  this.listen(document,'visibilitychange',()=>{if(document.visibilityState!=='visible')this.interrupt('hidden')})
  this.listen(window,'blur',()=>this.interrupt('blur'))
  this.listen(document,'freeze',()=>this.interrupt('freeze'))
  this.listen(window,'pagehide',()=>this.interrupt('page_exit'))
  this.listen(window,'resize',()=>{if(this.protected&&this.viewport()!==this.capturedViewport)this.interrupt('viewport')})
  this.listen(window,'error',()=>this.interrupt('technical'))
 }
 private listen(target:EventTarget,type:string,fn:EventListener,capture=false){target.addEventListener(type,fn,capture);this.cleanup.push(()=>target.removeEventListener(type,fn,capture))}
 private viewport(){return JSON.stringify([document.documentElement.clientWidth,document.documentElement.clientHeight,visualViewport?.width,visualViewport?.height,devicePixelRatio])}
 private now(){return performance.now()}
 current(){return this.state}
 inheritControls(prior:MouthBrowserRun|null){if(prior){this.held=new Set(prior.held);this.pointerHeld=new Set(prior.pointerHeld)}}
 private contentVisible(element:Element):boolean {
  if(!element.isConnected)return false
  const b=element.getBoundingClientRect();if(b.width<=0||b.height<=0)return false
  for(let p:Element|null=element;p;p=p.parentElement){const style=getComputedStyle(p);if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)!==1)return false}
  const hit=document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2);return !!hit&&(element.contains(hit)||hit.contains(element))
 }
 private notify(message=''){this.update({state:this.state,message,recovery:this.recovery,checkpoint:this.checkpointStatus,gated:this.gate})}
 private send(command:Command){if(!this.state||terminal(this.state)||this.canceled)return;this.state=advance(this.state,command);if(terminal(this.state))this.capture();else this.notify()}
 private draw(content:string){const stage=this.host.querySelector<HTMLElement>('.mouth-stage');if(stage)stage.innerHTML=content}
 prepare(profile:InputProfile,preview=true){
  this.profile=profile
  this.host.classList.toggle('mouth-inverted',profile.contrast==='light_on_dark')
  this.host.innerHTML=`<div class="mouth-stage">${preview?faceSvg('short',profile):''}</div><div class="mouth-responses"><button type="button" data-mouth-side="short">Short${profile.kind==='keyboard'?` · ${profile.leftCode}`:''}</button><button type="button" data-mouth-side="long">Long${profile.kind==='keyboard'?` · ${profile.rightCode}`:''}</button></div>`
 }
 layoutReady():boolean {
  const els=[this.host.querySelector('svg')??this.host.querySelector('.mouth-stage'),...this.host.querySelectorAll('button[data-mouth-side]')]
  const vv=window.visualViewport;const left=vv?.offsetLeft??0,top=vv?.offsetTop??0,width=vv?.width??innerWidth,height=vv?.height??innerHeight
  if(els.length!==3)return false
  for(const el of els){
   if(!el?.isConnected)return false
   const b=el.getBoundingClientRect();if(b.width<=(el.tagName.toLowerCase()==='svg'?239:0)||b.height<=0||b.left<left||b.top<top||b.right>left+width||b.bottom>top+height)return false
   for(let p:Element|null=el;p;p=p.parentElement){const st=getComputedStyle(p);if(st.display==='none'||st.visibility!=='visible'||Number(st.opacity)<1)return false}
   for(const [x,y] of [[b.left+2,b.top+2],[b.right-2,b.bottom-2],[(b.left+b.right)/2,(b.top+b.bottom)/2]]){const hit=document.elementFromPoint(x,y);if(!hit||!(el.contains(hit)||hit.contains(el)))return false}
  }
  // A pointer-transparent app overlay still obscures the task visually.
  for(const overlay of document.querySelectorAll<HTMLElement>('[role="dialog"],dialog,[popover],[data-mouth-overlay]')){
   const b=overlay.getBoundingClientRect(),s=getComputedStyle(overlay);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0||!b.width||!b.height)continue
   if(els.some(el=>{const r=el!.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top}))return false
  }
  return true
 }
 async start(request:StartRequest):Promise<void>{
  if(this.canceled||this.state)throw Error('Run already started')
  if(!this.layoutReady()||this.held.size||this.pointerHeld.size)throw Error('Release response controls and keep the whole face and both controls visible')
  const generation=++this.generation;this.profile=request.profile;this.capturedViewport=this.viewport()
  this.notify('Confirming local start')
  this.starting=true
  try {
  const arm=await this.entry.begin(request)
  if(this.canceled||generation!==this.generation){this.entry.release();return}
  this.arm=arm;this.state=arm.state
  await this.entry.admitStart(arm,token=>{
   if(this.canceled||generation!==this.generation)return
   this.firstToken=token;this.protected=true
   this.send({kind:'start',atMs:this.now(),responseHeld:this.held.size>0||this.pointerHeld.size>0,displayContext:captureMouthDisplayContext(this.host)})
   this.starting=false;this.beginMonitor();this.schedule()
  })
  } catch (error) { this.starting=false;this.stopProtection();this.entry.release(false);throw error }
 }
 private clearStage(){this.stageGeneration++;clearTimeout(this.stageTimer);cancelAnimationFrame(this.stageFrame);clearTimeout(this.watchdog);this.pendingConfirmation=null}
 private schedule(){
  if(!this.state||terminal(this.state)||!this.protected)return
  this.clearStage();const token=this.stageGeneration,generation=this.generation,phase=this.state.phase,due=requiredDue(this.state)!
  const current=()=>!this.canceled&&this.protected&&generation===this.generation&&token===this.stageGeneration&&this.state?.phase===phase
  const watch=()=>{if(!current())return;if(this.now()<due+2000){this.watchdog=window.setTimeout(watch,due+2000-this.now());return}this.send({kind:'watchdog',atMs:this.now()})}
  this.watchdog=window.setTimeout(watch,Math.max(0,due+2000-this.now()))
  const confirm=(frameGapMs?:number)=>{
   if(!current())return
   const time=this.now();frameGapMs=Math.max(frameGapMs??0,time-(this.previousFrame??time));if(time>=due+2000){watch();return}
   if(time<due){this.stageTimer=window.setTimeout(write,due-time);return}
   const kind=phase==='fixation_pending'?'fixation':phase==='fixation'?'onset':phase==='stimulus'?'remove':phase==='removed'?'resolve':phase==='resolved'?'feedback':'offset'
   const stage=this.host.querySelector<HTMLElement>('.mouth-stage'),svg=stage?.querySelector('svg')
   const expectedFace=document.createElement('div');if(phase==='fixation')expectedFace.innerHTML=faceSvg(this.state!.form.trials[this.state!.trialIndex-1].mouth,this.profile!)
   const exactFace=phase!=='fixation'||!!svg&&svg.outerHTML===expectedFace.firstElementChild?.outerHTML
   const reward=phase==='resolved'&&this.state!.firstResponse?.side===this.state!.form.trials[this.state!.trialIndex-1].mouth&&this.state!.form.trials[this.state!.trialIndex-1].rewardEligible
   const expected=phase==='fixation_pending'?stage?.textContent==='+'&&!svg:phase==='fixation'?!!svg&&svg.querySelectorAll('circle').length===3&&svg.querySelectorAll('line').length===1:phase==='resolved'?stage?.textContent===(reward?'+50¢ simulated':'')&&!svg:!!stage&&!svg&&stage.childElementCount===0&&stage.textContent===''
   const visibleContent=phase==='fixation'?!!svg&&this.contentVisible(svg)&&[...svg.children].every(el=>{const style=getComputedStyle(el);return style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)===1}):phase==='fixation_pending'||reward?!!stage?.firstElementChild&&this.contentVisible(stage.firstElementChild):true
   if(!expected||!exactFace||!visibleContent||!stage?.isConnected||!this.layoutReady()){
    this.pendingConfirmation=null;this.interrupt('viewport');return
   }
   this.pendingConfirmation=null;this.previousFrame=time
   this.send({kind,atMs:time,...(frameGapMs !== undefined?{frameGapMs}:{})})
   if(kind==='onset'&&this.firstToken&&this.arm){this.entry.confirmFirstPresentation(this.arm,this.firstToken,this.state!.trialIndex);this.firstToken=null}
   if(!this.state||terminal(this.state))return
   if(this.state.phase==='break'){this.checkpoint();return}
   this.schedule()
  }
  const write=()=>{
   if(!current())return
   if(this.now()<due){this.stageTimer=window.setTimeout(write,due-this.now());return}
   if(this.now()>=due+2000){watch();return}
   const paint=()=>{
    if(!current())return
    if(phase==='fixation_pending')this.draw('<span aria-hidden="true">+</span>')
    if(phase==='fixation')this.draw(faceSvg(this.state!.form.trials[this.state!.trialIndex-1].mouth,this.profile!))
    if(phase==='stimulus'||phase==='feedback')this.draw('')
    if(phase==='resolved'){
     const s=this.state!,trial=s.form.trials[s.trialIndex-1],reward=s.firstResponse?.side===trial.mouth&&trial.rewardEligible
     this.draw(reward?'<span>+50¢ simulated</span>':'')
    }
    this.pendingConfirmation=confirm
    this.stageFrame=requestAnimationFrame(()=>confirm())
   }
   if(phase==='fixation'&&!this.firstToken){
    void this.entry.admitTrial(this.arm!,this.state!,token=>{this.firstToken=token;paint()}).catch(()=>{if(current())this.interrupt('ownership')})
   }else paint()
  }
  this.stageTimer=window.setTimeout(write,Math.max(0,due-this.now()))
 }
 private beginMonitor(){
  this.previousFrame=this.now();cancelAnimationFrame(this.monitor)
  const frame=()=>{
   if(!this.protected||this.canceled)return
   const time=this.now();const gap=time-(this.previousFrame??time);this.previousFrame=time
   const confirmation=this.pendingConfirmation
   if(confirmation)confirmation(gap>50?gap:undefined)
   else if(gap>50)this.send({kind:'frameGap',atMs:time,gapMs:gap})
   if(this.protected&&(this.viewport()!==this.capturedViewport||!this.layoutReady()))this.interrupt('viewport')
   if(this.protected&&document.visibilityState!=='visible')this.interrupt('hidden')
   if(this.protected&&!document.hasFocus())this.interrupt('blur')
   if(this.protected)this.monitor=requestAnimationFrame(frame)
  };this.monitor=requestAnimationFrame(frame)
 }
 private stopProtection(){this.protected=false;this.clearStage();cancelAnimationFrame(this.monitor);this.previousFrame=null;this.firstToken=null}
 private checkpoint(){
  // State is frozen before protection ends; no pending stage can extend it.
  const prefix=this.state!;this.stopProtection();this.draw('Checking local progress…');this.checkpointStatus='pending'
  this.recovery=new MouthRecovery(this.entry,this.arm!,prefix);const recovery=this.recovery,generation=this.generation
  this.notify()
  void recovery.recover(true).then(result=>{
   if(this.canceled||generation!==this.generation||this.recovery!==recovery)return
   this.checkpointStatus=result.kind==='confirmed'?'confirmed':'uncertain';this.notify()
   if(result.kind==='confirmed'&&!this.gate&&document.visibilityState==='visible'&&document.hasFocus())void this.continue().catch(e=>this.notify(String(e)))
  })
 }
 async retryCheckpoint(){
  if(!this.recovery||this.state?.phase!=='break')return
  this.checkpointStatus='pending';this.notify();const result=await this.recovery.recover()
  if(this.canceled)return
  this.checkpointStatus=result.kind==='confirmed'?'confirmed':'uncertain';this.gate=true;this.notify()
 }
 async continue(){
  if(!this.state||this.state.phase!=='break'||!this.arm||this.checkpointStatus!=='confirmed'||!this.recovery)throw Error('Checkpoint needs exact confirmation')
  const generation=this.generation;await this.entry.reclaim(this.arm)
  this.prepare(this.profile!,false)
  if(!this.layoutReady()||this.held.size||this.pointerHeld.size)throw Error('Release controls and keep the face and controls visible')
  await this.entry.admitContinue(this.arm,this.recovery.authority,token=>{
   if(this.canceled||generation!==this.generation)return
   this.firstToken=token;this.gate=false;this.protected=true;this.recovery=null;this.checkpointStatus='none';this.capturedViewport=this.viewport()
   this.send({kind:'continue',atMs:this.now(),responseHeld:false,displayContext:captureMouthDisplayContext(this.host)});this.beginMonitor();this.schedule()
  })
 }
 private capture(){
  const captured=this.state!;this.stopProtection();this.draw('');this.entry.release(false)
  this.recovery=new MouthRecovery(this.entry,this.arm!,captured);this.notify()
  void this.recovery.recover(true).then(()=>{if(!this.canceled)this.notify()})
 }
 interrupt(reason:InvalidReason){
  if(this.starting){this.starting=false;this.generation++;this.entry.release(false);this.stopProtection();this.notify('Start canceled before confirmed play. Retry reconciles the same request.');return}
  if(this.protected){this.send({kind:'invalidate',atMs:this.now(),reason});return}
  if(this.state?.phase==='break'){this.gate=true;this.entry.release(false);this.notify('Progress paused. Confirm the checkpoint, then Continue when ready.')}
 }
 private key(event:KeyboardEvent,down:boolean){
  if(this.profile?.kind!=='keyboard'||![this.profile.leftCode,this.profile.rightCode].includes(event.code))return
  if(down)this.held.add(event.code);else this.held.delete(event.code)
  if(!this.state||terminal(this.state))return
  event.preventDefault()
  const phase=this.state.phase
  this.send(down?{kind:'keydown',atMs:this.now(),code:event.code,repeat:event.repeat,modified:event.altKey||event.ctrlKey||event.metaKey||event.shiftKey,composing:event.isComposing}:{kind:'keyup',atMs:this.now(),code:event.code})
  if(phase==='removed'&&this.state?.firstResponse)this.schedule()
 }
 private pointer(event:PointerEvent,down:boolean){
  if(this.profile?.kind!=='pointer')return
  const side=(event.target as Element).closest?.('[data-mouth-side]')?.getAttribute('data-mouth-side') as Side|null
  if(down){if(!side)return;this.pointerHeld.add(event.pointerId)}else this.pointerHeld.delete(event.pointerId)
  if(!this.state||terminal(this.state))return
  event.preventDefault();const phase=this.state.phase
  if(down)this.send({kind:'pointerdown',atMs:this.now(),side:side!,pointerId:event.pointerId,pointerType:event.pointerType as PointerSource,button:event.button,isPrimary:event.isPrimary})
  else this.send({kind:'pointerup',atMs:this.now(),pointerId:event.pointerId})
  if(phase==='removed'&&this.state?.firstResponse)this.schedule()
 }
 dispose(){
  if(this.canceled)return
  if(this.protected)this.interrupt('page_exit')
  this.canceled=true;this.generation++;this.stopProtection();this.entry.release();for(const remove of this.cleanup)remove()
 }
}
