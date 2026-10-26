import { advance, requiredDue } from './engine'
import type { Command, InputProfile, InvalidReason, PointerSource, State } from './engine'
import type { Side } from './contracts'
import { MouthEntry } from './entry'
import type { MouthAdmission } from './entry'
import { MouthRecovery } from './recovery'
import type { ArmedAttempt, MouthStore, StartRequest } from './storage'
import { captureMouthDisplayContext } from './display-context'
import type { ExclusiveMouthDocument } from './exclusive-document'

export function faceSvg(mouth:Side,profile:InputProfile):string {
 const length=profile.variant==='standard'?(mouth==='short'?38:43):(mouth==='short'?34:56)
 const body=profile.contrast==='dark_on_light'?'#006153':'#FFFFFF'
 const feature=profile.contrast==='dark_on_light'?'#FFFFFF':'#111111'
 return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-mouth-v12="face"><circle cx="60" cy="60" r="48" fill="${body}"/><circle cx="42" cy="53" r="11.5" fill="${feature}"/><circle cx="78" cy="53" r="11.5" fill="${feature}"/><line x1="${60-length/2}" x2="${60+length/2}" y1="84" y2="84" stroke="${feature}" stroke-width="3" stroke-linecap="round"/></svg>`
}
export function fixationSvg(profile:InputProfile):string {
 const ink=profile.contrast==='dark_on_light'?'#111111':'#FFFFFF'
 return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-mouth-v12="fixation"><rect x="20" y="57" width="80" height="6" fill="${ink}"/><rect x="57" y="20" width="6" height="80" fill="${ink}"/></svg>`
}
const terminal=(s:State)=>s.phase==='invalid'||s.phase==='completed'
export type RunUpdate = {state:State|null;message:string;recovery:MouthRecovery|null;checkpoint:'none'|'pending'|'uncertain'|'confirmed';gated:boolean}
/** DOM effects and synchronous input use the document's one monotonic clock.
 * The presentation order is held through each face's confirmed DOM frame. */
export class MouthBrowserRun {
 readonly entry:MouthEntry
 readonly host:HTMLElement
 private readonly boundary:ExclusiveMouthDocument|null
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
 private readonly normalizedSvg=new Map<string,string>()
 private pendingConfirmation:((gap?:number)=>void)|null=null
 private starting=false
 private continuing=false
 private capturedViewport=''
 private readonly onMockReturn:(()=>void)|null
 private readonly cleanup:Array<()=>void>=[]
 constructor(store:MouthStore,host:HTMLElement,update:(value:RunUpdate)=>void,boundary:ExclusiveMouthDocument|null=null,onMockReturn:(()=>void)|null=null){
  this.entry=new MouthEntry(store);this.host=host;this.update=update;this.boundary=boundary;this.onMockReturn=onMockReturn
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
  const root=element.getRootNode(),hit=root instanceof ShadowRoot?root.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2):document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2)
  return !!hit&&(element.contains(hit)||hit.contains(element))
 }
 private notify(message=''){this.update({state:this.state,message,recovery:this.recovery,checkpoint:this.checkpointStatus,gated:this.gate})}
 private send(command:Command){if(!this.state||terminal(this.state)||this.canceled)return;this.state=advance(this.state,command);if(terminal(this.state))this.capture();else if(command.kind!=='frameGap')this.notify()}
 private draw(content:string){const stage=this.host.querySelector<HTMLElement>('.mouth-stage');if(stage)stage.innerHTML=content}
 prepare(profile:InputProfile,preview=true){
  this.profile=profile
  this.host.classList.toggle('mouth-inverted',profile.contrast==='light_on_dark')
  this.host.innerHTML=`<fieldset class="mouth-stage">${preview?faceSvg('short',profile):''}</fieldset><fieldset class="mouth-responses"><button type="button" data-mouth-side="short">Short${profile.kind==='keyboard'?` · ${profile.leftCode}`:''}</button><button type="button" data-mouth-side="long">Long${profile.kind==='keyboard'?` · ${profile.rightCode}`:''}</button></fieldset>`
 }
 layoutReady():boolean {
  if(this.protected&&this.boundary&&!this.boundary.check(this.host))return false
  const els=[this.host.querySelector('svg')??this.host.querySelector('.mouth-stage'),...this.host.querySelectorAll('button[data-mouth-side]')]
  const vv=window.visualViewport;const left=vv?.offsetLeft??0,top=vv?.offsetTop??0,width=vv?.width??innerWidth,height=vv?.height??innerHeight
  if(els.length!==3)return false
  for(const el of els){
   if(!el?.isConnected)return false
   const b=el.getBoundingClientRect();if(b.width<=(el.tagName.toLowerCase()==='svg'?239:0)||b.height<=0||b.left<left||b.top<top||b.right>left+width||b.bottom>top+height)return false
   for(let p:Element|null=el;p;p=p.parentElement){const st=getComputedStyle(p);if(st.display==='none'||st.visibility!=='visible'||Number(st.opacity)<1)return false}
   for(const [x,y] of [[b.left+2,b.top+2],[b.right-2,b.bottom-2],[(b.left+b.right)/2,(b.top+b.bottom)/2]]){
    const tree:Node=el.getRootNode()
    const hit:Element|null=tree instanceof ShadowRoot?tree.elementFromPoint(x,y):document.elementFromPoint(x,y)
    if(!hit||!(el.contains(hit)||hit.contains(el)))return false
   }
  }
  // A pointer-transparent app overlay still obscures the task visually.
  for(const overlay of document.querySelectorAll<HTMLElement>('[role="dialog"],dialog,[popover],[data-mouth-overlay]')){
   const b=overlay.getBoundingClientRect(),s=getComputedStyle(overlay);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0||!b.width||!b.height)continue
   if(els.some(el=>{const r=el!.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top}))return false
  }
  return true
 }
 private protectedVisualValid():boolean {
  if(!this.protected||!this.state||!this.profile)return true
  if(!this.layoutReady()||this.boundary&&!this.boundary.bankValid(this.pendingConfirmation?undefined:this.state.bankedCents))return false
  // The new stage is painted in the frame before its phase event is appended.
  // The pending confirmation validates that image and timing in that frame.
  if(this.pendingConfirmation)return true
  const stage=this.host.querySelector<HTMLElement>('.mouth-stage'),svg=stage?.querySelector('svg')
  const phase=this.state.phase
  if(phase==='fixation')return !!svg&&this.exactSvg(svg,fixationSvg(this.profile))&&this.contentVisible(svg)&&this.svgPaintValid(svg as SVGSVGElement,'fixation')
  if(phase==='stimulus')return !!svg&&this.exactSvg(svg,faceSvg(this.state.form.trials[this.state.trialIndex-1].mouth,this.profile))&&this.contentVisible(svg)&&this.svgPaintValid(svg as SVGSVGElement,'face')
  if(phase==='feedback'){
   const trial=this.state.form.trials[this.state.trialIndex-1]
   const earned=this.state.firstResponse?.side===trial.mouth&&trial.rewardCents>0
   return earned?!!stage&&stage.textContent===`+${trial.rewardCents}¢ simulated`&&stage.children.length===1&&stage.firstElementChild?.tagName==='OUTPUT'&&this.contentVisible(stage.firstElementChild):!!stage&&stage.children.length===0&&stage.textContent===''
  }
  return !!stage&&stage.children.length===0&&stage.textContent===''
 }
 private exactSvg(svg:Element,source:string):boolean {
  let expected=this.normalizedSvg.get(source)
  if(expected===undefined){const box=document.createElement('div');box.innerHTML=source;expected=box.firstElementChild?.outerHTML??'';this.normalizedSvg.set(source,expected)}
  return svg.outerHTML===expected
 }
  private svgPaintValid(svg: SVGSVGElement,kind:'face'|'fixation'):boolean {
   if(!this.profile)return false
   const body=this.profile.contrast==='dark_on_light'?'rgb(0, 97, 83)':'rgb(255, 255, 255)'
   const feature=this.profile.contrast==='dark_on_light'?'rgb(255, 255, 255)':'rgb(17, 17, 17)'
   const fixationInk=this.profile.contrast==='dark_on_light'?'rgb(17, 17, 17)':'rgb(255, 255, 255)'
   const paintNeutral=(node:Element)=>{
    const s=getComputedStyle(node)
    return s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)===1&&
     Number(s.fillOpacity)===1&&Number(s.strokeOpacity)===1&&s.filter==='none'&&
     s.backdropFilter==='none'&&s.transform==='none'&&s.clipPath==='none'&&
     s.maskImage==='none'&&s.mixBlendMode==='normal'
   }
   // A stylesheet on the stage or any ancestor can erase or recolor every SVG child
   // without changing the SVG markup or the child's own computed fill.
   for(let node:Element|null=svg;node;node=node.parentElement)if(!paintNeutral(node))return false
   const nodes=[svg,...svg.querySelectorAll<SVGElement>('*')]
   if(nodes.some(node=>!paintNeutral(node)))return false
   const bounds=svg.getBoundingClientRect()
   if(Math.abs(bounds.width-240)>1||Math.abs(bounds.height-240)>1)return false
   // getBoundingClientRect reports the full SVG even when a narrow ancestor
   // clips away the eye or mouth. Require the whole fixed task image inside
   // every effective overflow/paint containment boundary before admission.
   for(let node=svg.parentElement;node;node=node.parentElement){
    const style=getComputedStyle(node)
    const clips=style.overflowX!=='visible'||style.overflowY!=='visible'||
     style.contain.split(/\s+/).includes('paint')||style.clip!=='auto'
    if(!clips)continue
    const area=node.getBoundingClientRect()
    if(bounds.left<area.left-0.5||bounds.top<area.top-0.5||
     bounds.right>area.right+0.5||bounds.bottom>area.bottom+0.5)return false
   }
   const at=(node:Element,x:number,y:number,width:number,height:number)=>{
    const b=node.getBoundingClientRect()
    return Math.abs(b.left-(bounds.left+x))<1&&Math.abs(b.top-(bounds.top+y))<1&&
     Math.abs(b.width-width)<1&&Math.abs(b.height-height)<1
   }
   if(kind==='face'){
    const circles=svg.querySelectorAll('circle'),line=svg.querySelector('line')
    if(circles.length!==3||!line)return false
    const x1=Number(line.getAttribute('x1')),x2=Number(line.getAttribute('x2'))
    const strokeRadius=3*(bounds.width/120)/2
    const lineGeometry=at(line,x1*2,168,(x2-x1)*2,0)||
     at(line,x1*2-strokeRadius,168-strokeRadius,(x2-x1)*2+2*strokeRadius,2*strokeRadius)
    const geometry=at(circles[0],24,24,192,192)&&at(circles[1],61,83,46,46)&&
     at(circles[2],133,83,46,46)&&lineGeometry
    const lineStyle=getComputedStyle(line)
    return geometry&&getComputedStyle(circles[0]).fill===body&&
     [...circles].every(node=>getComputedStyle(node).stroke==='none')&&
     [...circles].slice(1).every(node=>getComputedStyle(node).fill===feature)&&
     lineStyle.stroke===feature&&lineStyle.strokeWidth==='3px'&&
     lineStyle.strokeLinecap==='round'&&lineStyle.strokeDasharray==='none'
   }
   const bars=svg.querySelectorAll('rect')
   return bars.length===2&&at(bars[0],40,114,160,12)&&at(bars[1],114,40,12,160)&&
    [...bars].every(node=>getComputedStyle(node).fill===fixationInk&&getComputedStyle(node).stroke==='none')
  }
 async start(request:StartRequest,beforeArm?:()=>Promise<void>):Promise<void>{
  if(this.canceled||this.state)throw Error('Run already started')
  if(this.boundary&&!this.boundary.active)throw Error('The protected Lengths display is unavailable')
  if(!this.layoutReady()||this.boundary&&!this.boundary.check(this.host)||this.held.size||this.pointerHeld.size)throw Error('Release response controls and keep the whole face and both controls visible')
  const generation=++this.generation;this.profile=request.profile;this.capturedViewport=this.viewport()
  this.notify('Confirming local start')
  this.starting=true
  try {
  const arm=await this.entry.begin(request,beforeArm)
  if(this.canceled||generation!==this.generation){this.entry.release();return}
  this.arm=arm;this.state=arm.state
  await this.entry.admitStart(arm,token=>{
   if(this.canceled||generation!==this.generation)return
   this.firstToken=token;this.boundary?.setBank(0);this.protected=true
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
   if(phase==='fixation_pending')expectedFace.innerHTML=fixationSvg(this.profile!)
   const exactFace=(phase!=='fixation'&&phase!=='fixation_pending')||!!svg&&svg.outerHTML===expectedFace.firstElementChild?.outerHTML
   const currentTrial=this.state!.form.trials[this.state!.trialIndex-1]
   const reward=phase==='resolved'&&this.state!.firstResponse?.side===currentTrial.mouth&&currentTrial.rewardCents>0
   const prospective=this.state!.bankedCents+(reward?currentTrial.rewardCents:0)
   const expected=phase==='fixation_pending'?!!svg&&svg.querySelectorAll('rect').length===2:phase==='fixation'?!!svg&&svg.querySelectorAll('circle').length===3&&svg.querySelectorAll('line').length===1:phase==='resolved'?stage?.textContent===(reward?`+${currentTrial.rewardCents}¢ simulated`:'')&&!svg:!!stage&&!svg&&stage.childElementCount===0&&stage.textContent===''
   const visibleSvg=!!svg&&this.contentVisible(svg)&&this.svgPaintValid(svg,phase==='fixation'?'face':'fixation')
   const visibleContent=phase==='fixation'||phase==='fixation_pending'?visibleSvg:reward?!!stage?.firstElementChild&&this.contentVisible(stage.firstElementChild):true
   if(!expected||!exactFace||!visibleContent||!stage?.isConnected||!this.layoutReady()||this.boundary&&!this.boundary.check(this.host)||this.boundary&&!this.boundary.bankValid(prospective)){
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
   if(!this.protectedVisualValid()){this.interrupt('viewport');return}
   const paint=()=>{
    if(!current())return
    if(phase==='fixation_pending')this.draw(fixationSvg(this.profile!))
    if(phase==='fixation')this.draw(faceSvg(this.state!.form.trials[this.state!.trialIndex-1].mouth,this.profile!))
    if(phase==='stimulus'||phase==='feedback')this.draw('')
    if(phase==='resolved'){
     const s=this.state!,trial=s.form.trials[s.trialIndex-1],reward=s.firstResponse?.side===trial.mouth&&trial.rewardCents>0
     this.boundary?.setBank(s.bankedCents+(reward?trial.rewardCents:0))
     this.draw(reward?`<output>+${trial.rewardCents}¢ simulated</output>`:'')
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
   if(this.protected&&(this.viewport()!==this.capturedViewport||!this.protectedVisualValid()))this.interrupt('viewport')
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
  if(this.continuing)return
  if(!this.state||this.state.phase!=='break'||!this.arm||this.checkpointStatus!=='confirmed'||!this.recovery)throw Error('Checkpoint needs exact confirmation')
  this.continuing=true
  const generation=this.generation,arm=this.arm,recovery=this.recovery
  const current=()=>!this.canceled&&generation===this.generation&&this.arm===arm&&this.recovery===recovery&&this.state?.phase==='break'
  let committed=false
  try {
   await this.entry.reclaim(arm)
   if(!current())throw Error('Checkpoint Continue was canceled')
   await this.entry.admitContinue(arm,recovery.authority,token=>{
    if(!current()||recovery.outcome().kind!=='confirmed')throw Error('Checkpoint Continue source changed')
    if(document.visibilityState!=='visible'||!document.hasFocus()||this.held.size||this.pointerHeld.size)
     throw Error('Release controls and keep this tab visible and focused before Continue')
    const profile=this.profile!
    this.prepare(profile,false)
    if(this.boundary&&!this.boundary.active){this.boundary.setBank(this.state!.bankedCents);this.boundary.enter(()=>{this.interrupt('page_exit');this.onMockReturn?.()},profile.contrast==='light_on_dark')}
    if(!this.layoutReady()||this.boundary&&!this.boundary.check(this.host))throw Error('Release controls and keep the face and controls visible')
    const displayContext=captureMouthDisplayContext(this.host),viewport=this.viewport()
    const next=advance(this.state!,{kind:'continue',atMs:this.now(),responseHeld:false,displayContext})
    if(next.phase!=='fixation_pending')throw Error('Checkpoint Continue did not start the next trial')
    // All fallible preflight work is complete. A confirmed source remains
    // retryable until this one synchronous state/token commitment.
    this.state=next;this.firstToken=token;this.gate=false;this.protected=true
    this.recovery=null;this.checkpointStatus='none';this.capturedViewport=viewport;committed=true
    this.notify();this.beginMonitor();this.schedule()
   })
  } catch(error) {
   if(committed){
    if(!this.canceled&&!terminal(this.state!))this.interrupt('technical')
   }else if(current()){
    this.boundary?.leave()
    this.checkpointStatus=recovery.outcome().kind==='confirmed'?'confirmed':'uncertain'
    this.gate=true
    this.notify(`Checkpoint Continue was not confirmed: ${String(error)}. Retry when ready.`)
   }
   throw error
  }
  finally { this.continuing=false }
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
  if(this.protected&&!this.protectedVisualValid()){this.interrupt('viewport');return}
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
  if(this.protected&&!this.protectedVisualValid()){this.interrupt('viewport');return}
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
