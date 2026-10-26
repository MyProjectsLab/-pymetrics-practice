import { MOUTH_EVENT_VERSION, MOUTH_INPUT_VERSION, MOUTH_SCORING_VERSION, MOUTH_SPEC_VERSION, MOUTH_TIMING_VERSION } from './contracts'
import type { Form, Side, Variant } from './contracts'
import { isVerifiedMouthForm } from './manifests'
import { validMouthDisplayContext } from './display-context'
import type { MouthDisplayContext } from './display-context'
export const HEADLESS_VALIDITY = 'headless_unconfirmed' as const
export type PointerSource = 'mouse' | 'touch' | 'pen'
export type Route = 'standalone' | Readonly<{kind:'mock'; mockRunId:string; mockVersion:string; gameIndex:7}>
export type InputProfile = Readonly<({kind:'keyboard';leftCode:string;rightCode:string}|{kind:'pointer';pointerSource:PointerSource}) & {variant:Variant;deviceClass:string;alternative:boolean;contrast:'dark_on_light'|'light_on_dark';magnification:'none'|'browser_zoom';reducedMotion:boolean}>
export interface Identity { readonly installationId:string;readonly sessionId:string;readonly clockDomainId:string;readonly route:Route }
export type Phase = 'armed'|'fixation_pending'|'fixation'|'stimulus'|'removed'|'resolved'|'feedback'|'break'|'completed'|'invalid'
export type InvalidReason = 'hidden'|'blur'|'freeze'|'page_exit'|'viewport'|'ownership'|'settings'|'timing'|'frame_gap'|'watchdog'|'technical'
export type Command = Readonly<
 | {kind:'start'|'continue';atMs:number;responseHeld:boolean;displayContext?:MouthDisplayContext}
 | {kind:'fixation'|'onset'|'remove'|'resolve'|'feedback'|'offset'|'watchdog';atMs:number;frameGapMs?:number}
 | {kind:'keydown';atMs:number;code:string;repeat:boolean;modified:boolean;composing:boolean}
 | {kind:'keyup';atMs:number;code:string}
 | {kind:'pointerdown';atMs:number;side:Side;pointerId:number;pointerType:PointerSource;button:number;isPrimary:boolean}
 | {kind:'pointerup';atMs:number;pointerId:number}
 | {kind:'frameGap';atMs:number;gapMs:number}
 | {kind:'invalidate';atMs:number;reason:InvalidReason}>
export type EventType = 'prepared'|'form_assigned'|'armed'|'set_started'|'set_continued'|'fixation_confirmed'|'face_presented'|'face_removed'|'response'|'response_ignored'|'response_extra'|'boundary_extra'|'feedback_extra'|'input_released'|'omission'|'trial_resolved'|'feedback_presented'|'reward_earned'|'feedback_offset'|'trial_closed'|'set_checkpoint'|'timing_note'|'frame_gap'|'invalidated'|'session_completed'
export interface Event {readonly schemaVersion:typeof MOUTH_EVENT_VERSION;readonly installationId:string;readonly sessionId:string;readonly formId:Form['id'];readonly variant:Variant;readonly clockDomainId:string;readonly sequenceNumber:number;readonly trialIndex:number;readonly block:number;readonly atMs:number;readonly type:EventType;readonly detail:Readonly<Record<string,string|number|boolean|null>>;readonly validity:typeof HEADLESS_VALIDITY}
export interface FirstResponse {readonly side:Side;readonly atMs:number;readonly source:string}
export interface State {
 readonly specificationVersion:typeof MOUTH_SPEC_VERSION;readonly eventVersion:typeof MOUTH_EVENT_VERSION;readonly scoringVersion:typeof MOUTH_SCORING_VERSION;readonly timingVersion:typeof MOUTH_TIMING_VERSION;readonly inputVersion:typeof MOUTH_INPUT_VERSION;readonly validity:typeof HEADLESS_VALIDITY
 readonly form:Form;readonly identity:Identity;readonly profile:InputProfile;readonly armedAtMs:number;readonly phase:Phase;readonly trialIndex:number;readonly startMs:number|null;readonly fixationDueMs:number|null;readonly fixationMs:number|null;readonly stimulusDueMs:number|null;readonly onsetMs:number|null;readonly removalMs:number|null;readonly resolutionDueMs:number|null;readonly resolutionMs:number|null;readonly feedbackMs:number|null;readonly firstResponse:FirstResponse|null;readonly timingNoted:boolean;readonly bankedCents:number;readonly heldCodes:readonly string[];readonly activePointer:number|null;readonly invalidReason:InvalidReason|null;readonly commands:readonly Command[];readonly events:readonly Event[]
}
const SAFE_CODE = /^(ArrowLeft|ArrowRight|Space|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/
const POINTERS: readonly PointerSource[] = ['mouse', 'touch', 'pen']
const INVALID: readonly InvalidReason[] = ['hidden', 'blur', 'freeze', 'page_exit', 'viewport',
  'ownership', 'settings', 'timing', 'frame_gap', 'watchdog', 'technical']
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Mouth engine: ${reason}`)
}
function keys(value: object, expected: readonly string[]) {
  assert(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'malformed fields')
}
function at(value: unknown) { assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'invalid monotonic time') }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function exactDeep(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right) ||
    Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
    Array.isArray(left) && left.length !== (right as unknown[]).length) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const aKeys = Object.keys(a), bKeys = Object.keys(b)
  return aKeys.length === bKeys.length && aKeys.every(key =>
    Object.hasOwn(b, key) && exactDeep(a[key], b[key]))
}
function profileValid(profile: InputProfile) {
  assert(profile && typeof profile === 'object' && !Array.isArray(profile) &&
    (profile.variant === 'standard' || profile.variant === 'visual_accommodation') &&
    typeof profile.deviceClass === 'string' && profile.deviceClass.trim().length > 0 &&
    typeof profile.alternative === 'boolean' && typeof profile.reducedMotion === 'boolean' &&
    (profile.contrast === 'dark_on_light' || profile.contrast === 'light_on_dark') &&
    (profile.magnification === 'none' || profile.magnification === 'browser_zoom'), 'invalid profile')
  const common = ['kind', 'variant', 'deviceClass', 'alternative', 'contrast', 'magnification', 'reducedMotion']
  if (profile.kind === 'keyboard') {
    keys(profile, [...common, 'leftCode', 'rightCode'])
    assert(typeof profile.leftCode === 'string' && typeof profile.rightCode === 'string' &&
      SAFE_CODE.test(profile.leftCode) && SAFE_CODE.test(profile.rightCode) &&
      profile.leftCode !== profile.rightCode, 'invalid key bindings')
  } else {
    assert(profile.kind === 'pointer', 'invalid profile kind')
    keys(profile, [...common, 'pointerSource'])
    assert(typeof profile.pointerSource === 'string' &&
      POINTERS.includes(profile.pointerSource), 'invalid pointer source')
  }
}
function identityValid(identity: Identity) {
  assert(identity && typeof identity === 'object' && !Array.isArray(identity), 'invalid identity')
  keys(identity, ['installationId', 'sessionId', 'clockDomainId', 'route'])
  assert([identity.installationId, identity.sessionId, identity.clockDomainId]
    .every(value => typeof value === 'string' && value.trim().length > 0), 'invalid identity fields')
  if (identity.route !== 'standalone') {
    assert(identity.route && typeof identity.route === 'object' && !Array.isArray(identity.route), 'invalid route')
    keys(identity.route, ['kind', 'mockRunId', 'mockVersion', 'gameIndex'])
    assert(identity.route.kind === 'mock' && identity.route.gameIndex === 7 &&
      typeof identity.route.mockRunId === 'string' && identity.route.mockRunId.trim().length > 0 &&
      typeof identity.route.mockVersion === 'string' && identity.route.mockVersion.trim().length > 0,
    'invalid mock route')
  }
}
function commandValid(command: unknown): asserts command is Command {
  assert(command && typeof command === 'object' && !Array.isArray(command), 'invalid command')
  const value = command as Record<string, unknown>
  const kind = value.kind
  const fields = kind === 'start' || kind === 'continue' ?
    ['kind', 'atMs', 'responseHeld', ...(value.displayContext === undefined ? [] : ['displayContext'])] :
    kind === 'keydown' ? ['kind', 'atMs', 'code', 'repeat', 'modified', 'composing'] :
      kind === 'keyup' ? ['kind', 'atMs', 'code'] :
        kind === 'pointerdown' ? ['kind', 'atMs', 'side', 'pointerId', 'pointerType', 'button', 'isPrimary'] :
          kind === 'pointerup' ? ['kind', 'atMs', 'pointerId'] :
            kind === 'frameGap' ? ['kind', 'atMs', 'gapMs'] :
              kind === 'invalidate' ? ['kind', 'atMs', 'reason'] :
                ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset', 'watchdog'].includes(kind as string) ?
                  ['kind', 'atMs', ...(value.frameGapMs === undefined ? [] : ['frameGapMs'])] : null
  assert(fields !== null, 'unsupported command')
  keys(command, fields)
  at(value.atMs)
  if (value.frameGapMs !== undefined) assert(typeof value.frameGapMs === 'number' && Number.isFinite(value.frameGapMs) && value.frameGapMs >= 0 && kind !== 'watchdog', 'frame confirmation gap')
  if (kind === 'start' || kind === 'continue') assert(typeof value.responseHeld === 'boolean' &&
    (value.displayContext === undefined || validMouthDisplayContext(value.displayContext)), 'start context evidence')
  if (kind === 'keydown') assert(typeof value.code === 'string' &&
    typeof value.repeat === 'boolean' && typeof value.modified === 'boolean' &&
    typeof value.composing === 'boolean', 'key evidence')
  if (kind === 'keyup') assert(typeof value.code === 'string', 'release evidence')
  if (kind === 'pointerdown') assert((value.side === 'short' || value.side === 'long') &&
    Number.isSafeInteger(value.pointerId) && POINTERS.includes(value.pointerType as PointerSource) &&
    Number.isInteger(value.button) && typeof value.isPrimary === 'boolean', 'pointer evidence')
  if (kind === 'pointerup') assert(Number.isSafeInteger(value.pointerId), 'pointer release')
  if (kind === 'frameGap') assert(typeof value.gapMs === 'number' &&
    Number.isFinite(value.gapMs) && value.gapMs >= 0, 'frame gap')
  if (kind === 'invalidate') assert(typeof value.reason === 'string' &&
    INVALID.includes(value.reason as InvalidReason) && value.reason !== 'watchdog', 'invalid reason')
}
export function safeCode(code:string) { return typeof code === 'string' && SAFE_CODE.test(code) }
function append(state:State,type:EventType,atMs:number,detail:Event['detail']={}):State {
 const event:Event={schemaVersion:MOUTH_EVENT_VERSION,installationId:state.identity.installationId,sessionId:state.identity.sessionId,formId:state.form.id,variant:state.profile.variant,clockDomainId:state.identity.clockDomainId,sequenceNumber:state.events.length+1,trialIndex:state.trialIndex,block:state.form.trials[state.trialIndex-1].block,atMs,type,detail,validity:HEADLESS_VALIDITY}
 return {...state,events:[...state.events,event]}
}
function invalidate(state:State,atMs:number,reason:InvalidReason) { return append({...state,phase:'invalid',invalidReason:reason},'invalidated',atMs,{reason}) }
function stage(state:State,type:EventType,dueMs:number,atMs:number,detail:Event['detail']={},frameGapMs?:number):State {
 assert(atMs>=dueMs,'stage before due');const latenessMs=atMs-dueMs
 let next=append(state,type,atMs,{dueMs,actualMs:atMs,latenessMs,...detail})
 if(frameGapMs !== undefined && frameGapMs > 50) {
  next = append(next,'frame_gap',atMs,{gapMs:frameGapMs})
  if(frameGapMs > 250) return invalidate(next,atMs,'frame_gap')
  next = append({...next,timingNoted:true},'timing_note',atMs,{stage:'frame_gap',latenessMs:frameGapMs})
 }
 if(latenessMs>250)return invalidate(next,atMs,'timing')
 if(latenessMs>50)next=append({...next,timingNoted:true},'timing_note',atMs,{stage:type,latenessMs})
 return next
}
function sideFor(profile:InputProfile,code:string):Side|null { return profile.kind==='keyboard'?(code===profile.leftCode?'short':code===profile.rightCode?'long':null):null }
function action(state:State,atMs:number,side:Side,source:string):State {
 const detail={side,source,handlerMs:atMs}
 if(['stimulus','removed'].includes(state.phase)&&state.onsetMs!==null&&atMs<state.onsetMs+1300){
  if(state.firstResponse)return append(state,'response_extra',atMs,detail)
  return append({...state,firstResponse:{side,atMs,source}},'response',atMs,detail)
 }
 return append(state,state.phase==='feedback'||state.phase==='resolved'?'feedback_extra':['stimulus','removed'].includes(state.phase)?'boundary_extra':'response_ignored',atMs,detail)
}
export function armHeadless(form:Form,identity:Identity,profile:InputProfile,armedAtMs:number):State {
 assert(isVerifiedMouthForm(form),'unverified manifest');identityValid(identity);profileValid(profile);at(armedAtMs)
 let state:State={specificationVersion:MOUTH_SPEC_VERSION,eventVersion:MOUTH_EVENT_VERSION,scoringVersion:MOUTH_SCORING_VERSION,timingVersion:MOUTH_TIMING_VERSION,inputVersion:MOUTH_INPUT_VERSION,validity:HEADLESS_VALIDITY,form,identity:structuredClone(identity),profile:structuredClone(profile),armedAtMs,phase:'armed',trialIndex:1,startMs:null,fixationDueMs:null,fixationMs:null,stimulusDueMs:null,onsetMs:null,removalMs:null,resolutionDueMs:null,resolutionMs:null,feedbackMs:null,firstResponse:null,timingNoted:false,bankedCents:0,heldCodes:[],activePointer:null,invalidReason:null,commands:[],events:[]}
 state=append(state,'prepared',armedAtMs);state=append(state,'form_assigned',armedAtMs,{formId:form.id,variant:profile.variant});state=append(state,'armed',armedAtMs,{profile:JSON.stringify(profile),route:JSON.stringify(identity.route)})
 return freeze(state)
}
export function requiredDue(state:State):number|null {
 return state.phase==='fixation_pending'?state.fixationDueMs:state.phase==='fixation'?state.stimulusDueMs:state.phase==='stimulus'?state.onsetMs!+180:state.phase==='removed'?state.firstResponse?Math.max(state.firstResponse.atMs,state.removalMs!):state.onsetMs!+1300:state.phase==='resolved'?state.resolutionMs:state.phase==='feedback'?state.feedbackMs!+500:null
}
export function advance(prior:State,command:Command):State {
 assert(isVerifiedMouthForm(prior.form),'unverified form');commandValid(command)
 assert(command.atMs>=prior.armedAtMs&&command.atMs>=(prior.commands.at(-1)?.atMs??prior.armedAtMs),'regressing clock')
 assert(prior.phase!=='invalid'&&prior.phase!=='completed','terminal')
 if((command.kind==='keydown'||command.kind==='keyup')&&!sideFor(prior.profile,command.code))return prior
 if((command.kind==='pointerdown'||command.kind==='pointerup')&&prior.profile.kind!=='pointer')return prior
 if(command.kind==='frameGap'&&['armed','break'].includes(prior.phase))return prior
 if(command.kind==='invalidate'&&['armed','break'].includes(prior.phase)&&['hidden','blur','freeze','page_exit','viewport'].includes(command.reason))return prior
 let state:State={...prior,commands:[...prior.commands,structuredClone(command)]};const time=command.atMs
 switch(command.kind){
 case 'start':case 'continue':{
  assert(state.phase===(command.kind==='start'?'armed':'break'),'start order');assert(!command.responseHeld,'held at start')
  // Actual held controls remain held until release; a later trial cannot recycle them.
  state={...state,phase:'fixation_pending',startMs:time,fixationDueMs:time,fixationMs:null,stimulusDueMs:null,onsetMs:null,removalMs:null,resolutionDueMs:null,resolutionMs:null,feedbackMs:null,firstResponse:null,timingNoted:false}
  if(command.kind==='continue')state=append(state,'set_continued',time)
  state=append(state,'set_started',time,{profile:JSON.stringify(state.profile),...(command.displayContext?{displayContext:JSON.stringify(command.displayContext)}:{})});break
 }
 case 'fixation':assert(state.phase==='fixation_pending','fixation order');state=stage({...state,phase:'fixation',fixationMs:time,stimulusDueMs:time+500},'fixation_confirmed',state.fixationDueMs!,time,{},command.frameGapMs);break
 case 'onset':assert(state.phase==='fixation','onset order');state=stage({...state,phase:'stimulus',onsetMs:time,resolutionDueMs:time+1300},'face_presented',state.stimulusDueMs!,time,{},command.frameGapMs);break
 case 'remove':assert(state.phase==='stimulus','remove order');state=stage({...state,phase:'removed',removalMs:time},'face_removed',state.onsetMs!+180,time,{},command.frameGapMs);break
 case 'resolve':{
  assert(state.phase==='removed','resolution order');const due=requiredDue(state)!
  assert(time>=due,'resolution early')
  if(!state.firstResponse)state=append(state,'omission',time,{deadlineMs:state.onsetMs!+1300})
  state=stage({...state,phase:'resolved',resolutionMs:time},'trial_resolved',due,time,{chosenSide:state.firstResponse?.side??null},command.frameGapMs)
  break
 }
 case 'feedback':{
  assert(state.phase==='resolved','feedback order');state=stage({...state,phase:'feedback',feedbackMs:time},'feedback_presented',state.resolutionMs!,time,{},command.frameGapMs)
  if(state.phase!=='invalid'&&state.firstResponse?.side===state.form.trials[state.trialIndex-1].mouth&&state.form.trials[state.trialIndex-1].rewardEligible){state={...state,bankedCents:state.bankedCents+50};state=append(state,'reward_earned',time,{cents:50,balanceCents:state.bankedCents})}
  break
 }
 case 'offset':{
  assert(state.phase==='feedback','offset order');state=stage(state,'feedback_offset',state.feedbackMs!+500,time,{},command.frameGapMs)
  if(state.phase==='invalid')break
  state=append(state,'trial_closed',time,{timingNoted:state.timingNoted})
  if(state.trialIndex===90)state=append({...state,phase:'completed'},'session_completed',time)
  else if(state.trialIndex%30===0){state=append({...state,phase:'break'},'set_checkpoint',time,{closedTrials:state.trialIndex});state={...state,trialIndex:state.trialIndex+1}}
  else state={...state,phase:'fixation_pending',trialIndex:state.trialIndex+1,fixationDueMs:time,fixationMs:null,stimulusDueMs:null,onsetMs:null,removalMs:null,resolutionDueMs:null,resolutionMs:null,feedbackMs:null,firstResponse:null,timingNoted:false}
  break
 }
 case 'keydown':{
  const held=state.heldCodes.includes(command.code)
  state={...state,heldCodes:held?state.heldCodes:[...state.heldCodes,command.code]}
  state=command.repeat||command.modified||command.composing||held?append(state,'response_ignored',time,{source:'keyboard',reason:command.modified?'modified':command.composing?'composition':command.repeat?'repeat':'held'}):action(state,time,sideFor(state.profile,command.code)!,'keyboard');break
 }
 case 'keyup':state=append({...state,heldCodes:state.heldCodes.filter(c=>c!==command.code)},'input_released',time,{source:'keyboard',code:command.code});break
 case 'pointerdown':{
  if(!command.isPrimary||command.button!==0||state.activePointer!==null||state.profile.kind!=='pointer'||state.profile.pointerSource!==command.pointerType){state=append(state,'response_ignored',time,{source:command.pointerType,reason:'unsupported_or_multiple_contact'});break}
  state=action({...state,activePointer:command.pointerId},time,command.side,command.pointerType);break
 }
 case 'pointerup':state=append({...state,activePointer:state.activePointer===command.pointerId?null:state.activePointer},'input_released',time,{source:'pointer',pointerId:command.pointerId});break
 case 'frameGap':{
  if(command.gapMs<=50)break
  state=append(state,'frame_gap',time,{gapMs:command.gapMs})
  if(command.gapMs>250)state=invalidate(state,time,'frame_gap');else state=append({...state,timingNoted:true},'timing_note',time,{stage:'frame_gap',latenessMs:command.gapMs});break
 }
 case 'watchdog':assert(requiredDue(state)!==null&&time>=requiredDue(state)!+2000,'watchdog early');state=invalidate(state,time,'watchdog');break
 case 'invalidate':state=invalidate(state,time,command.reason);break
 }
 return freeze(state)
}
export function verifyHeadless(state:State):boolean {
 try {if(!isVerifiedMouthForm(state.form))return false;let replay=armHeadless(state.form,state.identity,state.profile,state.armedAtMs);for(const command of state.commands)replay=advance(replay,command);return exactDeep(state,replay)}catch{return false}
}
