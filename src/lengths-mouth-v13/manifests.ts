import packet from '../../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FORMS_V1_3.json'
import { MOUTH_FORM_VERSION } from './contracts'
import type { Form, FormId } from './contracts'
export const MOUTH_CANONICAL_SHA256 = '9a847ec1bf3fe17bbfed5144eb17ca4a21881dbeffc167defc084c8aa49d4634'
const HASHES = [
  'b048730ab2791c9fdbb7e4199db65a311910259ab8a72bdc55d9cbd257aa23b6',
  '3c64da390d94f51f49391d5aaa0d99a7617cd5f3f330e3979450c1cb4fc1143d',
  'eb81e07d2d83c1bec7d72dac0822076baf719ad6cbebbe0cb39efc6f5fa0370f',
  'cdd150fda322db895e60839553f806f1470acbf1eb1b2656e5dd7267ee76a3cf',
  '463d381c26c7f4fb7f615a533c58af1b6cb15a6891950f50ff965c47e2fdd3dc',
  '48e91b6fd201d2d13eeaf8996c62e67ef88cf802b523a66396419b6abd828032',
] as const
const trusted = new WeakSet<Form>()
let cached: Promise<ReadonlyMap<FormId, Form>> | null = null
const fields=(value:unknown, names:string[])=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).toSorted().join('|')===names.toSorted().join('|')
const canonical=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
async function sha(value:unknown):Promise<string>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')}
const fail=():never=>{throw Error('Mouth V1.3 manifest unsupported')}
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
export function isVerifiedMouthForm(form:Form){return trusted.has(form)}
export function loadMouthForms(raw:unknown=packet):Promise<ReadonlyMap<FormId,Form>>{
 if(raw===packet&&cached)return cached
 const work=(async()=>{
  const data=structuredClone(raw) as typeof packet
  if(!fields(data,['version','baseSeed','forms','sha256'])||data.version!==MOUTH_FORM_VERSION||data.baseSeed!==507970305||data.sha256!==MOUTH_CANONICAL_SHA256||!Array.isArray(data.forms)||data.forms.length!==6)fail()
  const forms=new Map<FormId,Form>()
  for(let f=0;f<6;f++){
   const form=data.forms[f]
   if(!fields(form,['id','seed','richSide','surplusSet','tenCentTrial','trials','sha256'])||form.id!==`LM13-${f+1}`||form.sha256!==HASHES[f]||!Number.isSafeInteger(form.seed)||!Array.isArray(form.trials)||form.trials.length!==90)fail()
   const body={id:form.id,seed:form.seed,richSide:form.richSide,surplusSet:form.surplusSet,tenCentTrial:form.tenCentTrial,trials:form.trials}
   if(await sha(body)!==HASHES[f])fail()
   const counters={short:0,long:0},setShort=[0,0,0],rich=[0,0,0],lean=[0,0,0];let tens=0,fifties=0,lastReward=-1
   if(form.richSide!==(f%2===0?'short':'long')||form.surplusSet!==f%3+1)fail()
   for(let i=0;i<90;i++){
    const t=form.trials[i]
    if(!fields(t,['index','block','mouth','rewardEligible','rewardCents'])||t.index!==i+1||t.block!==Math.floor(i/30)+1||(t.mouth!=='short'&&t.mouth!=='long')||typeof t.rewardEligible!=='boolean'||![0,10,50].includes(t.rewardCents)||t.rewardEligible!==(t.rewardCents>0))fail()
    counters[t.mouth as keyof typeof counters]++;if(t.mouth==='short')setShort[t.block-1]++
    if(t.rewardEligible){if(i+1-lastReward===1)fail();lastReward=i+1;if(t.mouth===form.richSide)rich[t.block-1]++;else lean[t.block-1]++;if(t.rewardCents===10){tens++;if(form.tenCentTrial!==i+1)fail()}else fifties++}
    if(i>=3&&form.trials.slice(i-3,i+1).every(x=>x.mouth===t.mouth))fail()
   }
   const switches=[0,1,2].map(block=>form.trials.slice(block*30,block*30+30).reduce((n,t,i,rows)=>n+(i>0&&t.mouth!==rows[i-1].mouth?1:0),0))
   if(switches.some(n=>n<12||n>22)||counters.short!==46||counters.long!==44||setShort.some((v,i)=>v!==(i+1===form.surplusSet?16:15))||rich.some(v=>v!==4)||lean.some((v,i)=>v!==(i+1===form.surplusSet?2:1))||tens!==1||fifties!==15)fail()
   const accepted=freeze(form as Form);trusted.add(accepted);forms.set(accepted.id,accepted)
  }
  if(await sha({version:data.version,baseSeed:data.baseSeed,forms:data.forms})!==MOUTH_CANONICAL_SHA256)fail()
  for(const a of forms.values())for(const b of forms.values())if(a.id<b.id&&a.trials.filter((v,i)=>v.mouth!==b.trials[i].mouth).length<30)fail()
  return forms
 })()
 if(raw===packet)cached=work
 return work
}
