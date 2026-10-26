import type { WorkScope } from './authority'

const MAX_BYTES=2097152,MAX_OCCURRENCES=1928175,MAX_DEPTH=96
const encoder=new TextEncoder()
const ownedMembers=new WeakMap<object,number>()
type Slice={visits:number;started:number}

async function pause(scope:WorkScope,slice:Slice):Promise<void>{
  scope.check()
  if(++slice.visits%64!==0&&performance.now()-slice.started<2)return
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel()
    let done=false
    const finish=(error?:Error)=>{if(done)return;done=true
      channel.port1.close();channel.port2.close();scope.signal.removeEventListener('abort',abort)
      if(error)reject(error);else resolve()}
    const abort=()=>finish(Error('Training JSON admission retired'))
    scope.signal.addEventListener('abort',abort,{once:true})
    channel.port1.onmessage=()=>finish()
    channel.port2.postMessage(null)
    if(scope.signal.aborted)abort()
  })
  scope.check();slice.started=performance.now()
}

/** Own an occurrence-expanded, deeply frozen native JSON image before semantic admission. */
export async function ownJson(value:unknown,scope:WorkScope):Promise<{value:unknown;bytes:number;visits:number}>{
  const active=new Set<object>(),slice={visits:0,started:performance.now()}
  let bytes=0,occurrences=0
  const charge=(count:number)=>{bytes+=count
    if(bytes>MAX_BYTES)throw Error('Training native JSON byte capacity exceeded')}
  const copy=async(input:unknown,depth:number):Promise<unknown>=>{
    await pause(scope,slice)
    if(++occurrences>MAX_OCCURRENCES||depth>MAX_DEPTH)
      throw Error('Training native JSON occurrence capacity exceeded')
    if(input===null){charge(4);return null}
    if(typeof input==='boolean'){charge(input?4:5);return input}
    if(typeof input==='number'){
      if(!Number.isFinite(input)||Object.is(input,-0)||
        !Number.isSafeInteger(input)&&!(Number.isSafeInteger(input*2)&&input*2%2===1))
        throw Error('Unsupported training JSON number')
      charge(String(input).length);return input
    }
    if(typeof input==='string'){
      if(input.length>64)throw Error('Training JSON string exceeds schema length')
      charge(encoder.encode(JSON.stringify(input)).length);return input
    }
    if(typeof input!=='object')throw Error('Unsupported training JSON value')
    if(active.has(input))throw Error('Training JSON cycle')
    const array=Array.isArray(input),proto=Object.getPrototypeOf(input)
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)
      throw Error('Unsupported training JSON native container')
    const keys:string[]=[]
    if(array){
      if(input.length>1024)throw Error('Training JSON array shape')
    }else for(const key in input){
      if(!Object.hasOwn(input,key))continue
      if(keys.length>=4096)throw Error('Training JSON object member capacity exceeded')
      keys.push(key)
    }
    const ownKeys=Reflect.ownKeys(input)
    if(ownKeys.length>4097)throw Error('Training JSON object member capacity exceeded')
    active.add(input)
    try{
      if(array){
        if(ownKeys.length!==input.length+1)
          throw Error('Training JSON array shape')
        charge(2+Math.max(0,input.length-1))
        const output:unknown[]=[]
        for(let i=0;i<input.length;i++){
          const descriptor=Object.getOwnPropertyDescriptor(input,String(i))
          if(!descriptor||!descriptor.enumerable||!('value' in descriptor))
            throw Error('Training JSON array hole or accessor')
          output.push(await copy(descriptor.value,depth+1))
        }
        ownedMembers.set(output,output.length)
        return Object.freeze(output)
      }
      if(ownKeys.length!==keys.length)throw Error('Training JSON hidden member or symbol')
      charge(2+Math.max(0,keys.length-1))
      const output:Record<string,unknown>={}
      for(const key of keys){
        if(key.length>64)throw Error('Training JSON member name')
        const descriptor=Object.getOwnPropertyDescriptor(input,key)
        if(!descriptor||!descriptor.enumerable||!('value' in descriptor))
          throw Error('Training JSON hidden member or accessor')
        charge(encoder.encode(JSON.stringify(key)).length+1)
        Object.defineProperty(output,key,{value:await copy(descriptor.value,depth+1),
          enumerable:true,writable:false,configurable:false})
      }
      ownedMembers.set(output,keys.length)
      return Object.freeze(output)
    }finally{active.delete(input)}
  }
  const owned=await copy(value,0)
  scope.check()
  return {value:owned,bytes,visits:occurrences}
}

/** Short final-W exact value/domain comparison; no yield can occur inside IDB's active callback. */
export function exactJson(current:unknown,expected:unknown,scope:WorkScope):boolean{
  const active=new Set<object>()
  let visits=0
  const equal=(a:unknown,b:unknown,depth:number):boolean=>{
    if(++visits%64===0)scope.check()
    if(visits>MAX_OCCURRENCES||depth>MAX_DEPTH)return false
    if(a===null||b===null||typeof a!=='object'||typeof b!=='object')
      return Object.is(a,b)&&typeof a!=='undefined'&&typeof a!=='bigint'&&
        typeof a!=='symbol'&&typeof a!=='function'&&
        (typeof a!=='number'||Number.isFinite(a)&&!Object.is(a,-0))
    if(active.has(a))return false
    const array=Array.isArray(a)
    if(array!==Array.isArray(b)||Object.getPrototypeOf(a)!==(array?Array.prototype:Object.prototype)&&
      !(Object.getPrototypeOf(a)===null&&!array))return false
    if(array&&(a as unknown[]).length>1024)return false
    active.add(a)
    try{
      if(array){
        if((a as unknown[]).length!==(b as unknown[]).length||
          (a as unknown[]).length>1024||
          Reflect.ownKeys(a).length!==(a as unknown[]).length+1)return false
        for(let i=0;i<(a as unknown[]).length;i++){
          const descriptor=Object.getOwnPropertyDescriptor(a,String(i))
          if(!descriptor||!descriptor.enumerable||!('value' in descriptor)||
            !equal(descriptor.value,(b as unknown[])[i],depth+1))return false
        }
        return true
      }
      let count=0
      const targetCount=ownedMembers.get(b)??Object.keys(b).length
      for(const key in a){if(Object.hasOwn(a,key)){
        if(++count>4096)return false
        if(key.length>64||!Object.hasOwn(b,key))return false
        const descriptor=Object.getOwnPropertyDescriptor(a,key)
        if(!descriptor||!descriptor.enumerable||!('value' in descriptor)||
          !equal(descriptor.value,(b as Record<string,unknown>)[key],depth+1))return false
      }}
      return count===targetCount&&Reflect.ownKeys(a).length===count
    }finally{active.delete(a)}
  }
  scope.check()
  const same=equal(current,expected,0)
  scope.check()
  return same
}
