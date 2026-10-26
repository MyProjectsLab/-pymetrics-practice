import type { LiveCommand } from './live'
import { claimCapture } from './capture-custody'
import type { CaptureTicket } from './capture-custody'

// A page-local custody marker. Store validation remains mandatory after issuance.
const issued = new WeakSet<object>()
const captures = new WeakMap<object,{ticket:CaptureTicket;atPerformanceMs:number;
  isCurrent:()=>boolean;requestId:string;digest:string}>()

function freezeTree(value:unknown, seen=new WeakSet<object>()):void {
  if(!value || typeof value!=='object' || seen.has(value))return
  seen.add(value)
  for(const key of Reflect.ownKeys(value)){
    const part=Object.getOwnPropertyDescriptor(value,key)
    if(part && 'value' in part)freezeTree(part.value,seen)
  }
  Object.freeze(value)
}

/** Own the complete command before any Store await. */
export function issueLiveEnvelope(source:LiveCommand,ticket:CaptureTicket):LiveCommand {
  const fact=claimCapture(ticket,source.requestId,source.payloadDigest)
  const owned=structuredClone(source) as LiveCommand
  freezeTree(owned)
  issued.add(owned)
  captures.set(owned,fact)
  return owned
}

export function isLiveEnvelope(value:unknown):value is LiveCommand {
  return !!value && typeof value==='object' && issued.has(value)
}

export function liveCapture(value:LiveCommand){return captures.get(value)??null}

