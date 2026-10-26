import type {TrainingRoot} from './model'
import type {WorkScope} from './authority'
import {exactJson} from './domain'

export const PARTITION_STORES=['meta','attempts','chains','comparisons','requests','activity','tombstones'] as const
type StoreName=typeof PARTITION_STORES[number]
type Pair=[IDBValidKey,unknown]
export type PhysicalImage=Record<StoreName,Pair[]>
type Data=PhysicalImage
const ROW_LIMIT:Record<StoreName,number>={meta:1,attempts:64,chains:6,
  comparisons:6,requests:128,activity:1,tombstones:1}
export function assertPhysicalSchema(tx:IDBTransaction):void{
  const names=Array.from(tx.db.objectStoreNames).sort()
  if(names.length!==PARTITION_STORES.length||
    names.some((name,index)=>name!==[...PARTITION_STORES].sort()[index]))
    throw Error('Native training store names changed')
  for(const name of PARTITION_STORES){const store=tx.objectStore(name)
    if(store.keyPath!==null||store.autoIncrement||store.indexNames.length!==0)
      throw Error('Native training store schema changed')}
}

/** Compare the complete physical image inside W, retaining only cursor state. */
export function comparePhysical(tx:IDBTransaction,expected:TrainingRoot,scope:WorkScope,
  onEqual:()=>void,onError:(reason:unknown)=>void):void{
  assertPhysicalSchema(tx)
  const meta={version:expected.version,installationId:expected.installationId,
    revision:expected.revision,nextOrdinal:expected.nextOrdinal}
  const values:Record<StoreName,Record<string,unknown>>={
    meta:{root:meta},attempts:expected.attempts,chains:expected.chains,
    comparisons:expected.comparisons,requests:expected.requests,
    activity:{all:expected.activity},tombstones:{all:expected.tombstones}}
  let settled=false
  const fail=(reason:unknown)=>{if(settled)return;settled=true
    try{tx.abort()}catch{/* registered terminal owns native truth */}
    onError(reason)}
  tx.addEventListener('abort',()=>fail(tx.error??Error('Physical scan aborted')))
  tx.addEventListener('complete',()=>{
    if(!settled)fail(Error('Physical scan completed before final callback'))})
  const scan=(storeIndex:number)=>{
    scope.check()
    if(storeIndex===PARTITION_STORES.length){
      try{scope.check();onEqual();settled=true}
      catch(reason){fail(reason)}
      return
    }
    const name=PARTITION_STORES[storeIndex]
    const rows=values[name]
    const keys=Object.keys(rows).sort((a,b)=>indexedDB.cmp(a,b))
    if(keys.length>ROW_LIMIT[name])throw Error('Expected physical row capacity')
    let index=0
    const request=tx.objectStore(name).openCursor()
    request.onerror=()=>fail(request.error??Error('Physical cursor request failed'))
    request.onsuccess=()=>{
      if(settled)return
      try{
        scope.check()
        const cursor=request.result
        if(!cursor){
          if(index!==keys.length)throw Error('Physical row missing')
          scan(storeIndex+1);return
        }
        if(index>=ROW_LIMIT[name]||index>=keys.length||typeof cursor.key!=='string'||
          cursor.key!==keys[index]||!exactJson(cursor.value,rows[keys[index]],scope))
          throw Error('Physical source differs from private proof')
        index++
        cursor.continue()
      }catch(reason){fail(reason)}
    }
  }
  try{scan(0)}catch(reason){fail(reason)}
}
const maps=(name:StoreName,pairs:Pair[])=>{
  if(pairs.some(([key])=>typeof key!=='string'||
    ['__proto__','prototype','constructor'].includes(key as string)))
    throw Error('Invalid native partition key')
  const result=Object.fromEntries(pairs as Array<[string,unknown]>)
  if(Object.keys(result).length!==pairs.length)throw Error('Native key collision')
  void name
  return result
}
export function logical(data:Data):TrainingRoot|null{
  if(PARTITION_STORES.every(name=>data[name].length===0))return null
  for(const [name,key] of [['meta','root'],['activity','all'],['tombstones','all']] as const)
    if(data[name].length!==1||data[name][0][0]!==key)throw Error('Native envelope changed')
  const meta=maps('meta',data.meta).root
  if(!meta||typeof meta!=='object'||Array.isArray(meta)||
    Object.getPrototypeOf(meta)!==Object.prototype)throw Error('Invalid native meta')
  const keys=Object.keys(meta)
  if(keys.length!==4||!['version','installationId','revision','nextOrdinal']
    .every(key=>Object.hasOwn(meta,key)))throw Error('Native meta fields changed')
  return {...meta,attempts:maps('attempts',data.attempts),chains:maps('chains',data.chains),
    comparisons:maps('comparisons',data.comparisons),requests:maps('requests',data.requests),
    activity:maps('activity',data.activity).all,tombstones:maps('tombstones',data.tombstones).all} as TrainingRoot
}
/** All reads are issued synchronously; callback runs in the final request task while W is active. */
export function readLogical(tx:IDBTransaction,callback:(value:TrainingRoot|null)=>void,
  onError:(error:unknown)=>void):void{
  readPhysical(tx,data=>callback(logical(data)),onError)
}
export function readPhysical(tx:IDBTransaction,callback:(value:PhysicalImage)=>void,
  onError:(error:unknown)=>void):void{
  assertPhysicalSchema(tx)
  const data={} as Data
  let outstanding=PARTITION_STORES.length
  let settled=false
  const fail=(error:unknown)=>{if(settled)return;settled=true;onError(error)}
  tx.addEventListener('abort',()=>fail(tx.error??Error('Native partition read aborted')))
  tx.addEventListener('complete',()=>{if(!settled)fail(Error('Partition read completed without logical source'))})
  for(const name of PARTITION_STORES){
    let keys:IDBValidKey[]|null=null,values:unknown[]|null=null
    const ready=()=>{if(settled||keys===null||values===null)return
      if(keys.length>ROW_LIMIT[name]||values.length>ROW_LIMIT[name]){
        fail(Error('Native partition row capacity changed'));try{tx.abort()}catch{};return}
      if(keys.length!==values.length){fail(Error('Native key/value count changed'));try{tx.abort()}catch{};return}
      data[name]=keys.map((key,i)=>[key,values![i]])
      if(--outstanding===0){try{callback(data);settled=true}catch(error){
        fail(error)
        try{tx.abort()}catch{/* native outcome owns truth */}
      }}
    }
    const store=tx.objectStore(name),k=store.getAllKeys(undefined,ROW_LIMIT[name]+1),
      v=store.getAll(undefined,ROW_LIMIT[name]+1)
    k.onsuccess=()=>{keys=k.result;ready()}
    v.onsuccess=()=>{values=v.result;ready()}
    const error=()=>{fail(k.error??v.error??Error('Native partition request failed'))
      try{tx.abort()}catch{/* registered terminal callback owns truth */}}
    k.onerror=error;v.onerror=error
  }
}
export function putLive(tx:IDBTransaction,next:TrainingRoot,attemptId:string,requestId:string,
  onSubmitted:()=>void){
  tx.objectStore('meta').put({version:next.version,installationId:next.installationId,
    revision:next.revision,nextOrdinal:next.nextOrdinal},'root')
  onSubmitted()
  tx.objectStore('attempts').put(next.attempts[attemptId],attemptId)
  tx.objectStore('requests').put(next.requests[requestId],requestId)
}

/** Used only after a completed empty or exact legacy source check in W. */
export function putFull(tx:IDBTransaction,root:TrainingRoot,onSubmitted:()=>void):void{
  assertPhysicalSchema(tx)
  tx.objectStore('meta').put({version:root.version,installationId:root.installationId,
    revision:root.revision,nextOrdinal:root.nextOrdinal},'root')
  onSubmitted()
  for(const name of ['attempts','chains','comparisons','requests'] as const)
    for(const [key,value] of Object.entries(root[name]))tx.objectStore(name).put(value,key)
  tx.objectStore('activity').put(root.activity,'all')
  tx.objectStore('tombstones').put(root.tombstones,'all')
}
export function putChanged(tx:IDBTransaction,source:TrainingRoot,next:TrainingRoot,
  onSubmitted:()=>void){
  tx.objectStore('meta').put({version:next.version,installationId:next.installationId,
    revision:next.revision,nextOrdinal:next.nextOrdinal},'root')
  onSubmitted()
  for(const name of ['attempts','chains','comparisons','requests','tombstones'] as const){
    const oldMap=source[name],newMap=next[name]
    const store=tx.objectStore(name)
    if(name==='tombstones'){
      if(JSON.stringify(oldMap)!==JSON.stringify(newMap))store.put(newMap,'all')
      continue
    }
    for(const key of Object.keys(oldMap))if(!Object.hasOwn(newMap,key))store.delete(key)
    for(const [key,value] of Object.entries(newMap))
      if(!Object.hasOwn(oldMap,key)||JSON.stringify(oldMap[key])!==JSON.stringify(value))
        store.put(value,key)
  }
  if(JSON.stringify(source.activity)!==JSON.stringify(next.activity)){
    tx.objectStore('activity').put(next.activity,'all')}
}
