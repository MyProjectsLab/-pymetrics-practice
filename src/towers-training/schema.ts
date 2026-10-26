import source from './schema.json'
import type { WorkScope } from './authority'

type Schema = {
  $ref?: string; type?: string; enum?: unknown[]; oneOf?: Schema[]; anyOf?: Schema[]
  properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean | Schema
  propertyNames?: Schema; items?: Schema; minItems?: number; maxItems?: number
  minLength?: number; maxLength?: number; minProperties?: number; maxProperties?: number
  minimum?: number; maximum?: number; pattern?: string
}
const schema = source as unknown as Schema & { $defs: Record<string, Schema> }

interface Slice { count:number; started:number }
async function cooperate(scope:WorkScope,slice:Slice):Promise<void>{
  scope.check()
  if(++slice.count%64!==0 && performance.now()-slice.started<2)return
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel()
    let settled=false
    const finish=(retired:boolean)=>{if(settled)return;settled=true
      channel.port1.close();channel.port2.close()
      scope.signal.removeEventListener('abort',abort)
      if(retired)reject(Error('Training schema validation retired'));else resolve()}
    const abort=()=>finish(true)
    scope.signal.addEventListener('abort',abort,{once:true})
    channel.port1.onmessage=()=>finish(false)
    channel.port2.postMessage(null)
    if(scope.signal.aborted)finish(true)
  })
  scope.check();slice.started=performance.now()
}

async function valid(value: unknown, rule: Schema, depth: number,
  scope:WorkScope,slice:Slice): Promise<boolean> {
  await cooperate(scope,slice)
  if (depth > 96) return false
  if (rule.$ref) {
    const key = rule.$ref.split('/').at(-1)!
    const definition = schema.$defs[key]
    return !!definition && await valid(value, definition, depth + 1,scope,slice)
  }
  if (rule.oneOf) {let matches=0
    for(const candidate of rule.oneOf)if(await valid(value,candidate,depth+1,scope,slice))matches++
    if(matches!==1)return false}
  if (rule.anyOf) {let matches=false
    for(const candidate of rule.anyOf)if(await valid(value,candidate,depth+1,scope,slice)){
      matches=true;break}
    if(!matches)return false}
  if (rule.enum && !rule.enum.some(item=>Object.is(item,value))) return false
  if (rule.type === 'null' && value !== null) return false
  if (rule.type === 'boolean' && typeof value !== 'boolean') return false
  if (rule.type === 'integer' && !Number.isSafeInteger(value)) return false
  if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false
  if (rule.type === 'string' && typeof value !== 'string') return false
  if (rule.type === 'array' && (!Array.isArray(value)||
    Object.getPrototypeOf(value)!==Array.prototype)) return false
  if (rule.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)) return false
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) || value < (rule.minimum ?? -Infinity) ||
      value > (rule.maximum ?? Infinity)) return false
  }
  if (typeof value === 'string' && (value.length < (rule.minLength ?? 0) ||
    value.length > (rule.maxLength ?? Infinity) ||
    (rule.pattern && !new RegExp(rule.pattern).test(value)))) return false
  if (Array.isArray(value)) {
    if (value.length < (rule.minItems ?? 0) || value.length > (rule.maxItems ?? Infinity)) return false
    if(rule.items)for(let index=0;index<value.length;index++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(index))
      if(!descriptor||!descriptor.enumerable||!('value' in descriptor)||
        !await valid(descriptor.value,rule.items,depth+1,scope,slice))return false
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value)
    if (keys.length < (rule.minProperties ?? 0) || keys.length > (rule.maxProperties ?? Infinity)) return false
    if (rule.required && !rule.required.every(key => Object.hasOwn(value, key))) return false
    for (const key of keys) {
      if (rule.propertyNames && !await valid(key, rule.propertyNames, depth + 1,scope,slice)) return false
      const child = rule.properties&&Object.hasOwn(rule.properties,key)?
        rule.properties[key]:rule.additionalProperties
      const descriptor=Object.getOwnPropertyDescriptor(value,key)
      if(!descriptor||!descriptor.enumerable||!('value' in descriptor))return false
      if (child === false || (child && typeof child !== 'boolean' &&
        !await valid(descriptor.value, child, depth + 1,scope,slice)))
        return false
    }
  }
  return true
}

export async function validateShape(value: unknown,scope:WorkScope): Promise<void> {
  if (!await valid(value, schema, 0,scope,{count:0,started:performance.now()}))
    throw Error('Training root does not match frozen schema')
  scope.check()
}

/** Validate one changed frozen-schema definition without walking retained history. */
export async function validatePart(value:unknown,name:keyof typeof schema.$defs,
  scope:WorkScope):Promise<void>{
  const rule=schema.$defs[name]
  const selected=name==='record'&&value&&typeof value==='object'?
    rule?.oneOf?.find(candidate=>candidate.properties?.kind?.enum?.includes(
      (value as {kind?:unknown}).kind)):undefined
  if(!rule||name==='record'&&!selected||
    !await valid(value,selected??rule,0,scope,{count:0,started:performance.now()}))
    throw Error(`Training ${name} does not match frozen schema`)
  scope.check()
}

export function validateEnvelope(value: unknown,scope:WorkScope): void {
  scope.check()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Training root unavailable')
  const root = value as Record<string, unknown>
  const count = (key: string) => root[key] && typeof root[key] === 'object' ?
    Object.keys(root[key] as object).length : Infinity
  if (count('attempts') > 64 || count('chains') > 6 || count('comparisons') > 6 ||
    count('requests') > 128 || count('tombstones') > 256 || !Array.isArray(root.activity) ||
    root.activity.length > 128) throw Error('Training root exceeds finite envelope')
  let records = 0
  for (const attempt of Object.values(root.attempts as Record<string, unknown>)) {
    scope.check()
    if (!attempt || typeof attempt !== 'object' || !Array.isArray((attempt as { records?: unknown }).records))
      throw Error('Training attempt records unavailable')
    records += (attempt as { records: unknown[] }).records.length
    if (records > 4096 || (attempt as { records: unknown[] }).records.length > 1024)
      throw Error('Training record capacity exceeded')
  }
}
