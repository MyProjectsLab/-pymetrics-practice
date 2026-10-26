import source from './bank.json'
import bankRaw from './bank.json?raw'
import { copyBoard, sameBoard } from '../towers/engine'
import type { Board } from '../towers/forms'
import type { WorkScope } from './authority'

export type Family = 'baseline' | 'retest' | 'drill'
export interface TrainingForm {
  id: string
  family: Family
  version: 'towers-training-form/1'
  start: Board
  target: Board
  limitMs: 120000
  optimalMoves: 9
  structureKey: string
  shortestPathCount: 1
  solution: [number, number, number][]
  solutionStates: Board[]
  descriptors: {
    disks: 5; towers: 3; startHeights: [3, 0, 2]; targetHeights: [5, 0, 0]
    correctTargetPrefix: 0; legalFirstMoves: 4; optimalFirstMoves: 1; optimalPathUnique: true
  }
  hash: string
}
const BANK_HASH = 'd2e7e55dbe05b63b257c1897ac9abd83faf559007de28088b9ac1cc802452f11'
function freezePlain(value:unknown):void {
  if(!value||typeof value!=='object'||Object.isFrozen(value))return
  for(const child of Object.values(value))freezePlain(child)
  Object.freeze(value)
}
freezePlain(source)
const target: Board = [[1, 2, 3, 4, 5], [], []]
const forms = source.forms as TrainingForm[]
const byId = new Map(forms.map(form => [form.id, form]))
let checked: Promise<void> | null = null

export function canonical(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) ||
      (!Number.isSafeInteger(value) && !(Number.isSafeInteger(value * 2) && value * 2 % 2 === 1)))
      throw Error('Unsupported canonical number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`
  }
  throw Error('Unsupported canonical value')
}
async function hashBytes(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function sha256(value: unknown): Promise<string> { return hashBytes(canonical(value)) }

export function placement(board: Board, from: number, to: number): Board {
  if (![0, 1, 2].includes(from) || ![0, 1, 2].includes(to) || from === to || !board[from].length)
    throw Error('Illegal top-disk move')
  const next = copyBoard(board)
  next[to].push(next[from].pop()!)
  return next
}
export function formById(id: string): TrainingForm {
  const form = byId.get(id)
  if (!form) throw Error('Unknown training form')
  return form
}
export function formsFor(family: Family): readonly TrainingForm[] {
  return forms.filter(form => form.family === family)
}
export async function verifyBank(): Promise<void> {
  if (checked) return checked
  checked = (async () => {
    if (source.version !== 'towers-training-bank/1' || forms.length !== 20 ||
      new Set(forms.map(form => form.id)).size !== 20 ||
      new Set(forms.map(form => form.structureKey)).size !== 20 ||
      forms.filter(form => form.family === 'baseline').length !== 6 ||
      forms.filter(form => form.family === 'retest').length !== 6 ||
      forms.filter(form => form.family === 'drill').length !== 8 ||
      await hashBytes(bankRaw) !== BANK_HASH) throw Error('Training bank identity changed')
    for (const [index, form] of forms.entries()) {
      const family: Family = index < 6 ? 'baseline' : index < 12 ? 'retest' : 'drill'
      const prefix = family === 'baseline' ? 'B' : family === 'retest' ? 'R' : 'D'
      const number = family === 'baseline' ? index + 1 : family === 'retest' ? index - 5 : index - 11
      if (form.id !== `TT1-${prefix}${String(number).padStart(2, '0')}` || form.family !== family ||
        form.version !== 'towers-training-form/1' || form.limitMs !== 120000 || form.optimalMoves !== 9 ||
        form.shortestPathCount !== 1 || form.solution.length !== 9 || form.solutionStates.length !== 10 ||
        !sameBoard(form.target, target) || form.start.map(stack => stack.length).join() !== '3,0,2' ||
        new Set(form.start.flat()).size !== 5 || form.start.flat().sort().join() !== '1,2,3,4,5' ||
        await sha256(Object.fromEntries(Object.entries(form).filter(([key]) => key !== 'hash'))) !== form.hash)
        throw Error(`Training form integrity: ${form.id}`)
      let board = copyBoard(form.start)
      if (!sameBoard(board, form.solutionStates[0])) throw Error('Solution start changed')
      for (const [step, [from, to, disk]] of form.solution.entries()) {
        if (board[from].at(-1) !== disk) throw Error('Solution disk changed')
        board = placement(board, from, to)
        if (!sameBoard(board, form.solutionStates[step + 1])) throw Error('Solution state changed')
      }
      if (!sameBoard(board, target)) throw Error('Solution target changed')
    }
  })().catch(reason => { checked = null; throw reason })
  return checked
}

function boardKey(board: Board): string { return board.map(stack => stack.join('')).join('|') }
type RouteLink={readonly distance:number;readonly nextKey:string|null;
  readonly step:readonly [number,number,number]|null}
let routeMap: Map<string, RouteLink> | null = null
let preparing:Promise<void>|null=null
async function routeYield(scope:WorkScope):Promise<void>{
  scope.check()
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel()
    let settled=false
    const finish=(retired:boolean)=>{if(settled)return;settled=true
      channel.port1.close();channel.port2.close()
      scope.signal.removeEventListener('abort',abort)
      if(retired)reject(Error('Training route preparation retired'));else resolve()}
    const abort=()=>finish(true)
    scope.signal.addEventListener('abort',abort,{once:true})
    channel.port1.onmessage=()=>finish(false)
    channel.port2.postMessage(null)
    if(scope.signal.aborted)finish(true)
  })
  scope.check()
}
/** Prepare the immutable route graph cooperatively before a scored sequencing input. */
export async function prepareRouteMap(scope:WorkScope):Promise<void>{
  scope.check()
  if(routeMap)return
  if(preparing){await preparing;scope.check();return}
  const work=async()=>{
  const map=new Map<string,RouteLink>()
  const boards=new Map<string,Board>()
  const queue:Board[]=[target]
  map.set(boardKey(target),{distance:0,nextKey:null,step:null});boards.set(boardKey(target),target)
  let slice=performance.now()
  for(let head=0;head<queue.length;head++){
    if(head%64===0||performance.now()-slice>=2){await routeYield(scope);slice=performance.now()}
    const current=queue[head],distance=map.get(boardKey(current))!.distance
    for(let from=0;from<3;from++)for(let to=0;to<3;to++){
      if(from===to||!current[from].length)continue
      const previous=placement(current,from,to),key=boardKey(previous)
      if(!map.has(key)){map.set(key,{distance:distance+1,nextKey:null,step:null})
        boards.set(key,previous);queue.push(previous)}
    }
  }
  if(map.size!==2520)throw Error('Training graph incomplete')
  let count=0
  for(const [key,entry] of map){
    if(++count%64===0||performance.now()-slice>=2){await routeYield(scope);slice=performance.now()}
    if(entry.distance===0)continue
    const current=boards.get(key)!,candidates:[number,number,number,Board][]=[]
    for(let from=0;from<3;from++)for(let to=0;to<3;to++){
      if(from===to||!current[from].length)continue
      const disk=current[from].at(-1)!,next=placement(current,from,to)
      if(map.get(boardKey(next))?.distance===entry.distance-1)
        candidates.push([from,to,disk,next])
    }
    candidates.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])
    const [from,to,disk,next]=candidates[0]
    map.set(key,Object.freeze({distance:entry.distance,nextKey:boardKey(next),
      step:Object.freeze([from,to,disk] as [number,number,number])}))
  }
  scope.check()
  map.set(boardKey(target),Object.freeze({distance:0,nextKey:null,step:null}))
  for(const [key,entry] of map)if(entry.distance>0&&
    (!entry.nextKey||!entry.step||map.get(entry.nextKey)?.distance!==entry.distance-1))
    throw Error(`Training route link unavailable: ${key}`)
  scope.check();routeMap=map
  }
  preparing=work().finally(()=>{preparing=null})
  await preparing
  scope.check()
}
/** Full 2,520-state graph. Sort edges lexically, then choose the first shortest continuation. */
export function shortestRoute(board: Board): [number, number, number][] {
  if(!routeMap)throw Error('Training route graph not prepared')
  let result = routeMap.get(boardKey(board))
  if (!result) throw Error('Unrecognized training board')
  const path:[number,number,number][]=[]
  while(result.distance){
    if(path.length>=2519||!result.step||!result.nextKey)
      throw Error('Training route link cycle or missing step')
    path.push([...result.step] as [number,number,number])
    const next=routeMap.get(result.nextKey)
    if(!next||next.distance!==result.distance-1)throw Error('Training route distance changed')
    result=next
  }
  return path
}
