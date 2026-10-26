import type {Root} from './model'

// Application graphs only. Browser handles and functions are authority/resources,
// not traversable private records. Each native result is admitted separately.
const traversable=(x:object)=>x instanceof Node||x instanceof Map||x instanceof Set||Array.isArray(x)||Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null
const children=(x:object):unknown[]=>x instanceof Node?[...x.childNodes,...(x instanceof Element?[...x.attributes]:[])]:x instanceof Map?[...x.entries()].flat():x instanceof Set?[...x]:Object.values(x)
export function wipe(value:unknown,allowed:(x:object)=>boolean=()=>true,seen=new Set<object>()){
 if(!value||typeof value!=='object'||!traversable(value)||seen.has(value)||!allowed(value))return
 seen.add(value)
 for(const child of children(value))wipe(child,allowed,seen)
 if(value instanceof Node){value.textContent='';if(value instanceof Element)for(const a of [...value.attributes])value.removeAttribute(a.name);return}
 if(value instanceof Map||value instanceof Set){value.clear();return}
 for(const key of Object.keys(value))delete (value as Record<string,unknown>)[key]
 if(Array.isArray(value))value.length=0
}
export type NativeCarrier={tx:IDBTransaction;requests:Set<IDBRequest>;owner:string|null;claim:string|null;epoch:{live:boolean};write:boolean;settled:boolean;imported:Set<IDBRequest>;done:Promise<void>;finish:()=>void;cancel:()=>void}
export class Ownership {
 epoch={live:true}
 generationKey=crypto.randomUUID()
 private epochOwners=new WeakMap<object,string>([[this.epoch,this.generationKey]])
 beforeErase:()=>void=()=>{}
 afterErase:()=>void=()=>{}
 readonly retired=new Set<string>()
 readonly revokedClaims=new Set<string>()
 readonly assignments=new WeakMap<object,string>()
 private graphs=new Map<string,Set<WeakRef<object>>>()
 readonly native=new Set<NativeCarrier>()
 private roots=new Set<WeakRef<Root>>()
 private resources=new Map<string,Set<{url:string}>>()
 private identity:string|null=null
 private preserving:NativeCarrier|null=null
 private prepare(owner:string,value:unknown,proposed=new Map<object,string>()){
  const graph=new Set<object>()
  const visit=(x:unknown)=>{if(!x||typeof x!=='object'||!traversable(x)||graph.has(x))return;const prior=this.assignments.get(x)??proposed.get(x);if(prior!==undefined&&prior!==owner)throw Error('Private ownership alias rejected');proposed.set(x,owner);graph.add(x);for(const child of children(x))visit(child)}
  visit(value);return graph
 }
 private publish(owner:string,graph:Set<object>){let set=this.graphs.get(owner);if(!set)this.graphs.set(owner,set=new Set());for(const x of graph)if(!this.assignments.has(x)){this.assignments.set(x,owner);set.add(new WeakRef(x))}for(const ref of set)if(!ref.deref())set.delete(ref)}
 asset<T extends {url:string}>(owner:string,value:T):T{this.prepare(owner,value);if(this.retired.has(owner))URL.revokeObjectURL(value.url);else{let set=this.resources.get(owner);if(!set)this.resources.set(owner,set=new Set());set.add(value)}return this.own(owner,value)}
 releaseAsset(owner:string,value:{url:string}){if(value.url)URL.revokeObjectURL(value.url);this.resources.get(owner)?.delete(value)}
 own<T>(owner:string,value:T):T{const graph=this.prepare(owner,value);if(this.retired.has(owner))this.erase(owner,value);else this.publish(owner,graph);return value}
 erase(owner:string,value:unknown){wipe(value,x=>!this.assignments.has(x)||this.assignments.get(x)===owner)}
 result<T>(value:T,owner:string|null):T{
  if(value==null)return value
  if(typeof value!=='object')throw Error('Private primitive result rejected')
  if('schema' in value&&(value.schema==='faces-root-v2'||value.schema==='faces-root-v3'))return this.importRoot(value) as T
  if('attemptId' in value&&typeof value.attemptId==='string')return this.own(value.attemptId,value)
  if('status' in value&&'root' in value&&['applied','absent','retired'].includes(String(value.status))&&Object.keys(value).every(k=>k==='root'||k==='status')){
   const assigned=this.assignments.get(value);if(assigned&&assigned!==this.generationKey)throw Error('Private ownership alias rejected')
   this.importRoot(value.root);this.publish(this.generationKey,new Set([value]));return value
  }
  if(owner)return this.own(owner,value)
  throw Error('Unowned storage result rejected')
 }
 owner(value:object){return this.assignments.get(value)}
 dom(owner:string,node:Node){const assigned=this.assignments.get(node);if(assigned&&assigned!==owner)return;this.publish(owner,new Set([node]));for(const child of [...node.childNodes,...(node instanceof Element?[...node.attributes]:[])])this.dom(owner,child);if(this.retired.has(owner))this.erase(owner,node)}
 /** All partitions validate before any assignment or erasure, including retired imports. */
 importRoot(value:unknown,epoch=this.epoch,borrow=false):Root{
  if(!value||typeof value!=='object')return value as Root
  const root=value as Root,proposed=new Map<object,string>()
  const parts=(Array.isArray(root.attempts)?root.attempts:[]).map(a=>({owner:typeof a?.id==='string'?a.id:this.generationKey,value:a}))
  const prepared=parts.map(p=>({...p,graph:this.prepare(p.owner,p.value,proposed)}))
  const metadataOwner=this.epochOwners.get(epoch)??this.generationKey,metadata=new Set<object>([root])
  if(Array.isArray(root.attempts))metadata.add(root.attempts)
  for(const [key,field] of Object.entries(root))if(key!=='attempts'||!Array.isArray(field))for(const object of this.prepare(metadataOwner,field,proposed))metadata.add(object)
  for(const object of metadata){const prior=this.assignments.get(object)??proposed.get(object);if(prior!==undefined&&prior!==metadataOwner)throw Error('Private ownership alias rejected')}
  if(!epoch.live&&!borrow)this.erase(metadataOwner,root);else this.publish(metadataOwner,metadata)
  for(const p of prepared){if((!epoch.live||this.retired.has(p.owner))&&!borrow)this.erase(p.owner,p.value);else this.publish(p.owner,p.graph)}
  this.roots.add(new WeakRef(root));for(const ref of this.roots)if(!ref.deref())this.roots.delete(ref)
  return root
 }
 enter(root:Root,epoch:{live:boolean},carrier?:NativeCarrier){const proposed=new Map<object,string>();for(const a of Array.isArray(root?.attempts)?root.attempts:[])this.prepare(typeof a?.id==='string'?a.id:this.generationKey,a,proposed);for(const [key,value] of Object.entries(root??{}))if(key!=='attempts')this.prepare(this.epochOwners.get(epoch)??this.generationKey,value,proposed);const identity=root?.installationId+':'+root?.generation;if(epoch===this.epoch&&this.identity!==null&&identity!==this.identity){this.reset(carrier);this.identity=identity;return this.epoch}if(epoch===this.epoch)this.identity=identity;return epoch}
 reconcile(root:Root){for(const id of root.attemptFences??[])this.retire(id)}
 scrubRetired(){for(const id of this.retired)for(const ref of this.graphs.get(id)??[]){const value=ref.deref();if(value)this.erase(id,value)}}
 private sweep(){for(const c of this.native)if(c!==this.preserving)for(const request of c.requests)if(request.readyState==='done'){try{if(request.result&&typeof request.result==='object')this.importRoot(request.result,c.epoch)}catch{/* fixed native failure; no private error retained */}}}
 retire(owner:string){
  this.retired.add(owner)
  this.beforeErase()
  for(const resource of this.resources.get(owner)??[])if(resource.url)URL.revokeObjectURL(resource.url)
  this.resources.get(owner)?.clear();this.resources.delete(owner)
  this.sweep()
  for(const c of this.native)if(c!==this.preserving&&(c.owner===owner||(c.owner===null&&!c.write))&&(c.write||[...c.requests].some(r=>r.readyState==='pending'))){try{c.tx.abort()}catch{/* already finished */}}
  for(const ref of this.graphs.get(owner)??[]){const value=ref.deref();if(value)this.erase(owner,value)}
  this.graphs.delete(owner)
  for(const ref of this.roots){const root=ref.deref();if(root&&Array.isArray(root.attempts))root.attempts=root.attempts.filter(a=>!!a.id)}
  this.afterErase()
 }
 reset(preserve?:NativeCarrier){this.preserving=preserve??null;this.epoch.live=false;for(const id of [...this.graphs.keys()])this.retire(id);this.sweep();for(const c of this.native)if(c!==this.preserving){try{c.tx.abort()}catch{}}this.preserving=null;this.epoch={live:true};this.generationKey=crypto.randomUUID();this.epochOwners.set(this.epoch,this.generationKey)}
 allowed(owner:string|null,claim:string|null){return (!owner||!this.retired.has(owner))&&(!claim||!this.revokedClaims.has(claim))}
 async revoke(claim:string){this.revokedClaims.add(claim);const carriers=[...this.native].filter(c=>c.claim===claim);for(const c of carriers)c.cancel();await Promise.all(carriers.map(c=>c.done))}
 async drain(owner?:string,claim?:string){const carriers=[...this.native].filter(c=>(owner===undefined||c.owner===owner)&&(claim===undefined||c.claim===claim));await Promise.all(carriers.map(c=>c.done))}
}
