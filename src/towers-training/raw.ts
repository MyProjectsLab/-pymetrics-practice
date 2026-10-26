import type { WorkScope } from './authority'

const LIMIT=4194304,NODES=1928175,EDGES=1928175,DEPTH=96,MEMBERS=4096
const dateTime=Date.prototype.getTime
const mapSize=Object.getOwnPropertyDescriptor(Map.prototype,'size')!.get!
const setSize=Object.getOwnPropertyDescriptor(Set.prototype,'size')!.get!
const boolValue=Boolean.prototype.valueOf,numberValue=Number.prototype.valueOf
const stringValue=String.prototype.valueOf,bigintValue=BigInt.prototype.valueOf
const regexpSource=Object.getOwnPropertyDescriptor(RegExp.prototype,'source')!.get!
const regexpFlags=Object.getOwnPropertyDescriptor(RegExp.prototype,'flags')!.get!
const trustedStack=Object.getOwnPropertyDescriptor(new Error(),'stack')?.get
function nativeStack(value:object):unknown{
  const formatter=Object.getOwnPropertyDescriptor(Error,'prepareStackTrace')
  if(formatter&&(!('value' in formatter)||formatter.value!==undefined))
    fail('Raw Error formatter unavailable')
  if(!trustedStack)fail('Raw Error stack intrinsic unavailable')
  return trustedStack.call(value)
}
const errorFamilies=new Map<object,string>([
  [Error.prototype,'Error'],[EvalError.prototype,'EvalError'],
  [RangeError.prototype,'RangeError'],[ReferenceError.prototype,'ReferenceError'],
  [SyntaxError.prototype,'SyntaxError'],[TypeError.prototype,'TypeError'],
  [URIError.prototype,'URIError'],[AggregateError.prototype,'AggregateError'],
])
const bigLimitBits=8n*BigInt(Math.floor(LIMIT/4))
export function exceedsRawBigIntLimit(value:bigint):boolean {
  return ((value<0n?-value:value)>>bigLimitBits)!==0n
}
type Scalar=null|boolean|number|string|bigint|undefined
type Atom={scalar:Scalar}|{reference:number}
type Part={key:string;value:unknown}
interface Description {tag:string;slots:readonly [string,Scalar][];parts:Part[];
  binary?:Uint8Array;blob?:Blob;handle?:FileSystemHandle}
interface Node {tag:string;slots:readonly [string,Scalar][];parts:readonly {key:string;value:Atom}[];
  binary?:Uint8Array;blobIndex?:number;handleIndex?:number}
export interface RawIndex {readonly root:Atom;readonly nodes:readonly Node[];
  readonly blobs:readonly Blob[];readonly handles:readonly FileSystemHandle[];
  readonly image:unknown;readonly bytes:number}
export interface RawMatch {equal:boolean;blobs:Blob[];
  handles:[FileSystemHandle,FileSystemHandle][]}
export class RawUnavailable extends Error {constructor(message:string){super(message)}}
class RawDifferent extends Error {}
function fail(message:string):never{throw new RawUnavailable(message)}
const scalar=(value:unknown):value is Scalar=>value===null||
  ['boolean','number','string','bigint','undefined'].includes(typeof value)
function sameScalar(a:Scalar,b:Scalar){return Object.is(a,b)}
function ownData(value:object,skip?:Set<string>|((key:string)=>boolean),
  includeHidden=false,scope?:WorkScope):Part[]{
  const parts:Part[]=[]
  let visited=0
  // Native structured cloning retains enumerable string members of ordinary
  // objects. Enumerate incrementally so an oversized dictionary is refused
  // before allocating a complete keys array in application memory.
  for(const key in value){
    if(++visited%64===0)scope?.check()
    if(!Object.hasOwn(value,key))continue
    if(parts.length>MEMBERS)fail('Raw member capacity')
    if(typeof skip==='function'?skip(key):skip?.has(key))continue
    const descriptor=Object.getOwnPropertyDescriptor(value,key)
    if(!descriptor)fail('Raw property disappeared')
    if(!('value' in descriptor)){
      if(key==='stack'&&trustedStack&&descriptor.get===trustedStack){
        parts.push({key,value:nativeStack(value)});continue}
      fail('Raw accessor is not a qualified intrinsic')
    }
    parts.push({key,value:descriptor.value})
  }
  if(includeHidden){
    const keys=Object.getOwnPropertyNames(value)
    if(keys.length>MEMBERS)fail('Raw member capacity')
    for(const key of keys){
      if(++visited%64===0)scope?.check()
      if(Object.getOwnPropertyDescriptor(value,key)?.enumerable)continue
      const descriptor=Object.getOwnPropertyDescriptor(value,key)
      if(!descriptor)fail('Raw property disappeared')
      if('value' in descriptor)parts.push({key,value:descriptor.value})
      else if(key==='stack'&&trustedStack&&descriptor.get===trustedStack)
        parts.push({key,value:nativeStack(value)})
      else fail('Raw hidden accessor unavailable')
    }
  }
  if(Object.getOwnPropertySymbols(value).length)fail('Raw symbol property unavailable')
  parts.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
  return parts
}
function nativeSlot<T>(getter:((this:T)=>unknown)|undefined,value:T,name:string):Scalar{
  if(!getter)fail(`Raw ${name} intrinsic unavailable`)
  try{const result=getter.call(value)
    if(!scalar(result))fail(`Raw ${name} slot unavailable`)
    return result
  }catch{fail(`Raw ${name} intrinsic rejected`)}
}
function inheritedGetter(prototype:object,name:string):((this:never)=>unknown)|undefined{
  let current:object|null=prototype
  while(current){const descriptor=Object.getOwnPropertyDescriptor(current,name)
    if(descriptor?.get)return descriptor.get as (this:never)=>unknown
    current=Object.getPrototypeOf(current)}
  return undefined
}
const capturedGetters=new WeakMap<object,Map<string,(this:never)=>unknown>>()
function captureFields(prototype:object,names:string[]):void{
  const fields=new Map<string,(this:never)=>unknown>()
  for(const name of names){const getter=inheritedGetter(prototype,name)
    if(getter)fields.set(name,getter)}
  capturedGetters.set(prototype,fields)
}
const matrixFields=['is2D','isIdentity',...Array.from({length:4},(_,i)=>
  Array.from({length:4},(_,j)=>`m${i+1}${j+1}`)).flat()]
if(typeof DOMException!=='undefined')captureFields(DOMException.prototype,['name','message','code'])
if(typeof DOMPointReadOnly!=='undefined')captureFields(DOMPointReadOnly.prototype,['x','y','z','w'])
if(typeof DOMRectReadOnly!=='undefined')captureFields(DOMRectReadOnly.prototype,
  ['x','y','width','height','top','right','bottom','left'])
if(typeof DOMMatrixReadOnly!=='undefined')captureFields(DOMMatrixReadOnly.prototype,matrixFields)
if(typeof DOMQuad!=='undefined')captureFields(DOMQuad.prototype,['p1','p2','p3','p4'])
if(typeof Blob!=='undefined')captureFields(Blob.prototype,['size','type'])
if(typeof File!=='undefined')captureFields(File.prototype,['name','lastModified'])
if(typeof ImageData!=='undefined')captureFields(ImageData.prototype,
  ['width','height','colorSpace','pixelFormat','data'])
if(typeof FileSystemHandle!=='undefined')captureFields(FileSystemHandle.prototype,['kind','name'])
if(typeof FileList!=='undefined')captureFields(FileList.prototype,['length'])
captureFields(ArrayBuffer.prototype,['byteLength','maxByteLength','resizable'])
const typedViewPrototype=Object.getPrototypeOf(Uint8Array.prototype)
captureFields(typedViewPrototype,['buffer','byteOffset','byteLength','length'])
captureFields(DataView.prototype,['buffer','byteOffset','byteLength'])
const viewTags=new Map<object,string>([
  [DataView.prototype,'DataView'],[Int8Array.prototype,'Int8Array'],
  [Uint8Array.prototype,'Uint8Array'],[Uint8ClampedArray.prototype,'Uint8ClampedArray'],
  [Int16Array.prototype,'Int16Array'],[Uint16Array.prototype,'Uint16Array'],
  [Int32Array.prototype,'Int32Array'],[Uint32Array.prototype,'Uint32Array'],
  [Float32Array.prototype,'Float32Array'],[Float64Array.prototype,'Float64Array'],
  [BigInt64Array.prototype,'BigInt64Array'],[BigUint64Array.prototype,'BigUint64Array'],
])
const fileListItem=typeof FileList!=='undefined'?FileList.prototype.item:undefined
export function rawBlobSize(blob:Blob):number{
  const size=nativeSlot(capturedGetters.get(Blob.prototype)?.get('size'),blob as never,'Blob size')
  if(typeof size!=='number'||!Number.isSafeInteger(size)||size<0)
    fail('Raw Blob size unavailable')
  return size
}
function nativeFields(value:object,prototype:object,names:string[]):[string,Scalar][]{
  const fields=capturedGetters.get(prototype)
  return names.map(name=>[name,nativeSlot(fields?.get(name),value as never,name)])
}
function nativeObjectField(value:object,prototype:object,name:string):object{
  const getter=capturedGetters.get(prototype)?.get(name)
  if(!getter)fail(`Raw ${name} intrinsic unavailable`)
  try{const result=getter.call(value as never)
    if(!result||typeof result!=='object')fail(`Raw ${name} object unavailable`)
    return result}catch{fail(`Raw ${name} intrinsic rejected`)}
}
function describe(value:object,scope:WorkScope):Description {
  scope.check()
  if(Array.isArray(value)){
    const parts=ownData(value,new Set(['length']),false,scope)
    return {tag:'Array',slots:[['length',value.length]],parts}
  }
  try{const count=mapSize.call(value) as number
    if(count>MEMBERS)fail('Raw Map member capacity')
    const parts:Part[]=[];let index=0
    for(const [key,item] of Map.prototype.entries.call(value)){
      if(index%64===0)scope.check()
      parts.push({key:`${index}:key`,value:key},{key:`${index}:value`,value:item});index++}
    return {tag:'Map',slots:[['size',count]],parts}
  }catch(error){if(error instanceof RawUnavailable)throw error}
  try{const count=setSize.call(value) as number
    if(count>MEMBERS)fail('Raw Set member capacity')
    const parts:Part[]=[];let index=0
    for(const item of Set.prototype.values.call(value)){
      if(index%64===0)scope.check()
      parts.push({key:String(index++),value:item})}
    return {tag:'Set',slots:[['size',count]],parts}
  }catch(error){if(error instanceof RawUnavailable)throw error}
  try{return {tag:'Date',slots:[['time',dateTime.call(value)]],parts:[]}}
  catch{/* another native class */}
  try{const state=Object.getOwnPropertyDescriptor(value,'lastIndex')
    if(!state||!('value' in state)||!scalar(state.value))
      fail('Raw RegExp state unavailable')
    return {tag:'RegExp',slots:[['source',regexpSource.call(value)],
      ['flags',regexpFlags.call(value)],['lastIndex',state.value]],parts:[]}}
  catch{/* another native class */}
  for(const [tag,getter] of [['BooleanObject',boolValue],['NumberObject',numberValue],
    ['StringObject',stringValue],['BigIntObject',bigintValue]] as const){
    try{const primitive=(getter as (this:unknown)=>Scalar).call(value)
      if(tag==='StringObject'&&typeof primitive==='string'){
        if(primitive.length*2>LIMIT)fail('Raw boxed String byte capacity')
        const length=Object.getOwnPropertyDescriptor(value,'length')
        if(!length||!('value' in length)||length.value!==primitive.length)
          fail('Raw boxed String length unavailable')
        const parts=ownData(value,key=>{
          const index=Number(key)
          if(!Number.isSafeInteger(index)||index<0||index>=primitive.length||String(index)!==key)
            return false
          const descriptor=Object.getOwnPropertyDescriptor(value,key)
          if(!descriptor||!descriptor.enumerable||!('value' in descriptor)||
            descriptor.value!==primitive[index])fail('Raw boxed String index unavailable')
          return true
        },false,scope)
        return {tag,slots:[['value',primitive],['length',primitive.length]],parts}
      }
      return {tag,slots:[['value',primitive]],parts:ownData(value,undefined,false,scope)}
    }catch(error){if(error instanceof RawUnavailable)throw error}
  }
  if(typeof File!=='undefined'&&value instanceof File)return {tag:'File',
    slots:[...nativeFields(value,Blob.prototype,['size','type']),
      ...nativeFields(value,File.prototype,['name','lastModified'])],parts:[],blob:value}
  if(typeof Blob!=='undefined'&&value instanceof Blob)return {tag:'Blob',
    slots:nativeFields(value,Blob.prototype,['size','type']),parts:[],blob:value}
  if(value instanceof ArrayBuffer){
    const length=nativeSlot(capturedGetters.get(ArrayBuffer.prototype)?.get('byteLength'),
      value as never,'ArrayBuffer byteLength')
    if(typeof length!=='number')fail('Raw ArrayBuffer byteLength unavailable')
    if(length>LIMIT)fail('Raw buffer byte capacity')
    // The native read image is private while the token is retained. Index its
    // own backing bytes without allocating a second old-image copy.
    const bytes=new Uint8Array(value)
    const fields=capturedGetters.get(ArrayBuffer.prototype)
    return {tag:'ArrayBuffer',slots:[['byteLength',length],
      ['maxByteLength',fields?.has('maxByteLength')?
        nativeSlot(fields.get('maxByteLength'),value as never,'ArrayBuffer maxByteLength'):length],
      ['resizable',fields?.has('resizable')?
        nativeSlot(fields.get('resizable'),value as never,'ArrayBuffer resizable'):false]],
      parts:[],binary:bytes}
  }
  if(ArrayBuffer.isView(value)){
    const tag=viewTags.get(Object.getPrototypeOf(value))
    if(!tag)fail('Raw view brand unavailable')
    const prototype=tag==='DataView'?DataView.prototype:typedViewPrototype
    const fields=nativeFields(value,prototype,['byteOffset','byteLength'])
    if(tag!=='DataView')fields.push(...nativeFields(value,prototype,['length']))
    return {tag,slots:fields,
      parts:[{key:'buffer',value:nativeObjectField(value,prototype,'buffer')}]}
  }
  if(typeof ImageData!=='undefined'&&value instanceof ImageData){
    const names=['width','height','colorSpace']
    if(capturedGetters.get(ImageData.prototype)?.has('pixelFormat'))names.push('pixelFormat')
    return {tag:'ImageData',slots:nativeFields(value,ImageData.prototype,names),
      parts:[{key:'data',value:nativeObjectField(value,ImageData.prototype,'data')}]}
  }
  if(typeof DOMException!=='undefined'&&value instanceof DOMException){
    const fields=nativeFields(value,DOMException.prototype,['name','message','code'])
    return {tag:'DOMException',slots:fields,parts:ownData(value,undefined,true,scope)}
  }
  if(typeof DOMQuad!=='undefined'&&value instanceof DOMQuad){
    const parts:Part[]=[]
    for(const name of ['p1','p2','p3','p4']){
      parts.push({key:name,value:nativeObjectField(value,DOMQuad.prototype,name)})
    }
    return {tag:'DOMQuad',slots:[],parts}
  }
  if(value instanceof Error){
    const prototype=Object.getPrototypeOf(value),family=errorFamilies.get(prototype)
    if(!family)fail('Raw Error family unavailable')
    const parts=ownData(value,undefined,true,scope)
    const slot=(key:'name'|'message'):Scalar=>{
      const own=parts.find(part=>part.key===key)
      if(own){if(!scalar(own.value))fail(`Raw Error ${key} unavailable`)
        return own.value}
      const inherited=Object.getOwnPropertyDescriptor(prototype,key)??
        Object.getOwnPropertyDescriptor(Error.prototype,key)
      if(!inherited||!('value' in inherited)||!scalar(inherited.value))
        fail(`Raw Error ${key} unavailable`)
      return inherited.value
    }
    return {tag:family,slots:[['name',slot('name')],['message',slot('message')]],parts}
  }
  const geometry:[string,object,string[]][]=[]
  if(typeof DOMPointReadOnly!=='undefined')geometry.push(['DOMPoint',DOMPointReadOnly.prototype,
    ['x','y','z','w']])
  if(typeof DOMRectReadOnly!=='undefined')geometry.push(['DOMRect',DOMRectReadOnly.prototype,
    ['x','y','width','height','top','right','bottom','left']])
  if(typeof DOMMatrixReadOnly!=='undefined')geometry.push(['DOMMatrix',DOMMatrixReadOnly.prototype,
    matrixFields])
  for(const [tag,prototype,fields] of geometry)try{
    const slots=nativeFields(value,prototype,fields)
    return {tag:`${tag}:${Object.getPrototypeOf(value)===prototype?'readonly':'mutable'}`,
      slots,parts:[]}
  }catch{/* next class */}
  if(typeof FileList!=='undefined'&&value instanceof FileList){
    const parts:Part[]=[]
    const length=nativeSlot(capturedGetters.get(FileList.prototype)?.get('length'),
      value as never,'FileList length')
    if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>MEMBERS||
      !fileListItem)fail('Raw FileList capacity')
    for(let i=0;i<length;i++){if(i%64===0)scope.check()
      parts.push({key:String(i),value:fileListItem.call(value,i)})}
    return {tag:'FileList',slots:[['length',length]],parts}
  }
  if(typeof FileSystemHandle!=='undefined'&&value instanceof FileSystemHandle)
    return {tag:'FileSystemHandle',slots:nativeFields(value,FileSystemHandle.prototype,['kind','name']),
      parts:[],handle:value}
  if(typeof CryptoKey!=='undefined'&&value instanceof CryptoKey)
    fail('Raw CryptoKey serialized Handle is unavailable')
  const prototype=Object.getPrototypeOf(value)
  if(prototype===Object.prototype||prototype===null)return {tag:'Object',slots:[],
    parts:ownData(value,undefined,false,scope)}
  fail('Raw native type has no qualified exact adapter')
}

async function cooperate(scope:WorkScope,state:{visits:number;started:number}):Promise<void>{
  scope.check()
  if(++state.visits%64!==0&&performance.now()-state.started<2)return
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel();let done=false
    const finish=(error?:Error)=>{if(done)return;done=true;channel.port1.close();channel.port2.close()
      scope.signal.removeEventListener('abort',abort);if(error)reject(error);else resolve()}
    const abort=()=>finish(Error('Training raw analysis retired'))
    scope.signal.addEventListener('abort',abort,{once:true})
    channel.port1.onmessage=()=>finish();channel.port2.postMessage(null)
    if(scope.signal.aborted)abort()
  })
  scope.check();state.started=performance.now()
}

/** Build a bounded private graph index from one completed native image. */
export async function inspectRaw(image:unknown,scope:WorkScope):Promise<RawIndex>{
  const nodes:Node[]=[],blobs:Blob[]=[],handles:FileSystemHandle[]=[]
  const seen=new WeakMap<object,number>(),state={visits:0,started:performance.now()}
  let bytes=0,edges=0
  const charge=(amount:number)=>{if(!Number.isSafeInteger(amount)||amount<0||
    bytes+amount>LIMIT)fail('Raw byte capacity');bytes+=amount}
  const item=async(value:unknown,depth:number):Promise<Atom>=>{
    await cooperate(scope,state)
    if(depth>DEPTH)fail('Raw graph depth capacity')
    if(scalar(value)){
      if(typeof value==='string')charge(value.length*2+8)
      else if(typeof value==='bigint'){
        if(exceedsRawBigIntLimit(value))fail('Raw BigInt byte capacity')
        charge(value.toString(16).length*2+8)
      }else charge(16)
      return {scalar:value}
    }
    if(typeof value!=='object')fail('Raw native scalar unavailable')
    const prior=seen.get(value)
    if(prior!==undefined)return {reference:prior}
    if(nodes.length>=NODES)fail('Raw graph node capacity')
    const id=nodes.length;seen.set(value,id)
    nodes.push({tag:'pending',slots:[],parts:[]})
    const description=describe(value,scope)
    const slots:[string,Scalar][]=[]
    for(const [key,slot] of description.slots){charge(key.length*2+8)
      if(typeof slot==='string')charge(slot.length*2+8)
      else if(typeof slot==='bigint'){
        if(exceedsRawBigIntLimit(slot))fail('Raw BigInt slot capacity')
        charge(slot.toString(16).length*2+8)
      }else charge(16)
      slots.push([key,slot])}
    if(description.binary)charge(description.binary.byteLength)
    let blobIndex:number|undefined,handleIndex:number|undefined
    if(description.blob){charge(rawBlobSize(description.blob))
      blobIndex=blobs.length;blobs.push(description.blob)}
    if(description.handle){handleIndex=handles.length;handles.push(description.handle)}
    const parts:{key:string;value:Atom}[]=[]
    if(description.parts.length>MEMBERS*2)fail('Raw edge capacity')
    for(const child of description.parts){
      if(++edges>EDGES)fail('Raw graph edge capacity')
      charge(child.key.length*2+8)
      parts.push({key:child.key,value:await item(child.value,depth+1)})
    }
    nodes[id]={tag:description.tag,slots,parts,binary:description.binary,
      blobIndex,handleIndex}
    return {reference:id}
  }
  const root=await item(image,0)
  scope.check()
  return {root,nodes,blobs,handles,image,bytes}
}

/** Short active-W typed graph match; Blob bytes and locator identities follow in bounded stage. */
export function compareRaw(index:RawIndex,current:unknown,scope:WorkScope):RawMatch{
  const paired=new Map<number,object>(),reverse=new WeakMap<object,number>()
  const blobs:Blob[]=[],handles:[FileSystemHandle,FileSystemHandle][]=[]
  let visits=0
  const match=(atom:Atom,value:unknown,depth:number):void=>{
    if(++visits%64===0)scope.check()
    if(depth>DEPTH)fail('Current raw depth capacity')
    if('scalar' in atom){if(!scalar(value)||!sameScalar(atom.scalar,value))throw new RawDifferent();return}
    if(!value||typeof value!=='object')throw new RawDifferent()
    const existing=paired.get(atom.reference),reverseId=reverse.get(value)
    if(existing!==undefined||reverseId!==undefined){
      if(existing!==value||reverseId!==atom.reference)throw new RawDifferent()
      return
    }
    paired.set(atom.reference,value);reverse.set(value,atom.reference)
    const old=index.nodes[atom.reference],now=describe(value,scope)
    if(old.tag!==now.tag||old.slots.length!==now.slots.length||
      old.parts.length!==now.parts.length||
      Boolean(old.binary)!==Boolean(now.binary)||
      (old.blobIndex!==undefined)!==Boolean(now.blob)||
      (old.handleIndex!==undefined)!==Boolean(now.handle))throw new RawDifferent()
    for(let i=0;i<old.slots.length;i++)if(old.slots[i][0]!==now.slots[i][0]||
      !sameScalar(old.slots[i][1],now.slots[i][1]))throw new RawDifferent()
    if(old.binary&&now.binary){if(old.binary.byteLength!==now.binary.byteLength)
      throw new RawDifferent()
      for(let i=0;i<old.binary.byteLength;i++){
        if(i%64===0)scope.check()
        if(old.binary[i]!==now.binary[i])throw new RawDifferent()
      }}
    if(now.blob)blobs.push(now.blob)
    if(now.handle)handles.push([index.handles[old.handleIndex!],now.handle])
    for(let i=0;i<old.parts.length;i++){
      if(old.parts[i].key!==now.parts[i].key)throw new RawDifferent()
      match(old.parts[i].value,now.parts[i].value,depth+1)
    }
  }
  scope.check()
  try{match(index.root,current,0);scope.check();return {equal:true,blobs,handles}}
  catch(error){if(error instanceof RawDifferent)return {equal:false,blobs:[],handles:[]};throw error}
}
