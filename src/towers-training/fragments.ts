import type { WorkScope } from './authority'

type Leaf={kind:'leaf';length:number;text:string}
type Composite={kind:'array'|'object';length:number;parts:readonly Fragment[]}
export type Fragment=Leaf|Composite
const encoder=new TextEncoder()
const MAX_BYTES=2097152

/** Canonical JSON is represented once per immutable node, not copied into ancestors. */
export class FragmentTree {
  private readonly objects=new WeakMap<object,Fragment>()
  private lastSlice=performance.now()
  private visited=0

  private async cooperate(scope:WorkScope):Promise<void>{
    scope.check()
    if(++this.visited%64!==0&&performance.now()-this.lastSlice<2)return
    await new Promise<void>((resolve,reject)=>{
      const channel=new MessageChannel()
      let done=false
      const finish=(error?:Error)=>{if(done)return;done=true
        channel.port1.close();channel.port2.close();scope.signal.removeEventListener('abort',abort)
        if(error)reject(error);else resolve()}
      const abort=()=>finish(Error('Training fragment work retired'))
      scope.signal.addEventListener('abort',abort,{once:true})
      channel.port1.onmessage=()=>finish()
      channel.port2.postMessage(null)
      if(scope.signal.aborted)abort()
    })
    scope.check();this.lastSlice=performance.now()
  }
  private leaf(text:string):Leaf{return Object.freeze({kind:'leaf',text,length:encoder.encode(text).length})}
  private combine(kind:'array'|'object',parts:Fragment[]):Composite{
    const length=parts.reduce((sum,part)=>sum+part.length,0)
    if(length>MAX_BYTES)throw Error('Training fragment byte capacity exceeded')
    return Object.freeze({kind,length,parts:Object.freeze(parts)})
  }
  /** Cold construction traverses every occurrence of the already-owned JSON tree. */
  async cold(value:unknown,scope:WorkScope):Promise<Fragment>{
    await this.cooperate(scope)
    if(value===null||typeof value!=='object')return this.leaf(JSON.stringify(value))
    if(Array.isArray(value)){
      const parts:Fragment[]=[this.leaf('[')]
      for(let index=0;index<value.length;index++){
        if(index)parts.push(this.leaf(','))
        parts.push(await this.cold(value[index],scope))
      }
      parts.push(this.leaf(']'))
      const fragment=this.combine('array',parts);this.objects.set(value,fragment);return fragment
    }
    const parts:Fragment[]=[this.leaf('{')]
    const keys=Object.keys(value).sort()
    for(let index=0;index<keys.length;index++){
      if(index)parts.push(this.leaf(','))
      const key=keys[index]
      parts.push(this.leaf(`${JSON.stringify(key)}:`))
      parts.push(await this.cold((value as Record<string,unknown>)[key],scope))
    }
    parts.push(this.leaf('}'))
    const fragment=this.combine('object',parts);this.objects.set(value,fragment);return fragment
  }
  /** Changed path construction reuses proved, immutable descendant fragments. */
  delta(value:unknown,scope:WorkScope):Fragment{
    scope.check()
    if(value===null||typeof value!=='object')return this.leaf(JSON.stringify(value))
    const existing=this.objects.get(value)
    if(existing)return existing
    const parts:Fragment[]=[]
    if(Array.isArray(value)){
      parts.push(this.leaf('['))
      for(let index=0;index<value.length;index++){
        if(index)parts.push(this.leaf(','))
        parts.push(this.delta(value[index],scope))
      }
      parts.push(this.leaf(']'))
    }else{
      parts.push(this.leaf('{'))
      const keys=Object.keys(value).sort()
      for(let index=0;index<keys.length;index++){
        if(index)parts.push(this.leaf(','))
        const key=keys[index]
        parts.push(this.leaf(`${JSON.stringify(key)}:`))
        parts.push(this.delta((value as Record<string,unknown>)[key],scope))
      }
      parts.push(this.leaf('}'))
    }
    const fragment=this.combine(Array.isArray(value)?'array':'object',parts)
    this.objects.set(value,fragment)
    scope.check()
    return fragment
  }
  /** Flatten only a selected bounded digest target, never an ancestor root on the live path. */
  async flatten(fragment:Fragment,scope:WorkScope):Promise<string>{
    const parts:string[]=[]
    const append=async(node:Fragment):Promise<void>=>{
      await this.cooperate(scope)
      if(node.kind==='leaf')parts.push(node.text)
      else for(const part of node.parts)await append(part)
    }
    await append(fragment)
    scope.check();return parts.join('')
  }
}
