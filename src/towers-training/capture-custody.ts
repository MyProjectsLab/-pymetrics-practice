export interface CaptureTicket {
  readonly ownerGeneration:number
  readonly captureOrder:number
  readonly offsetUs:number
  readonly withdrawal:null
}

type CaptureFact={ticket:CaptureTicket;atPerformanceMs:number;isCurrent:()=>boolean;
  requestId:string|null;digest:string|null}
const captured=new WeakMap<object,CaptureFact>()

/** Minted at the existing Journey capture point; controlled proofs use explicit fixtures. */
export function issueCapturedTicket(ticket:CaptureTicket,atPerformanceMs:number,
  isCurrent:()=>boolean):CaptureTicket {
  if(!Number.isFinite(atPerformanceMs)||atPerformanceMs<0)
    throw Error('Invalid capture timestamp')
  const owned=Object.freeze({...ticket})
  captured.set(owned,{ticket:owned,atPerformanceMs,isCurrent,requestId:null,digest:null})
  return owned
}

export function isCapturedCurrent(value:unknown):boolean {
  if(!value||typeof value!=='object')return false
  const fact=captured.get(value)
  return !!fact&&fact.isCurrent()
}

export function claimCapture(value:CaptureTicket,requestId:string,digest:string){
  const fact=captured.get(value)
  if(!fact||!fact.isCurrent()||fact.requestId!==null&&
    (fact.requestId!==requestId||fact.digest!==digest))
    throw Error('Training capture owner or request changed')
  fact.requestId=requestId;fact.digest=digest
  return Object.freeze({ticket:fact.ticket,atPerformanceMs:fact.atPerformanceMs,
    isCurrent:fact.isCurrent,requestId,digest})
}
