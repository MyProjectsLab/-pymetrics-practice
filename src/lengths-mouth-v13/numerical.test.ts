import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/qa/lengths-v13/ACCEPTANCE-FIXTURES.json'
import { loadMouthForms } from './manifests'
import type { FormId } from './contracts'
import { advance, armHeadless, requiredDue, verifyHeadless } from './engine'
import type { State } from './engine'
import { reconcileHeadless, summarizeTimes } from './report'

const profile={kind:'keyboard',variant:'standard',deviceClass:'test',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false,presentationVersion:'lengths_mouth_presentation_v1_2'} as const
function play(form:Awaited<ReturnType<typeof loadMouthForms>> extends ReadonlyMap<string,infer F>?F:never,rows:readonly {trial:number;selected:string|null;actionMs:number|null;qualityNote:boolean}[]):State{
 let state=armHeadless(form,{installationId:'test',sessionId:'test',clockDomainId:'test',route:'standalone'},profile,0)
 state=advance(state,{kind:'start',atMs:0,responseHeld:false})
 for(let n=0;n<rows.length;n++){
  const row=rows[n]
  state=advance(state,{kind:'fixation',atMs:requiredDue(state)!})
  state=advance(state,{kind:'onset',atMs:requiredDue(state)!})
  const onset=state.onsetMs!
  if(row.actionMs!==null&&row.actionMs<180){state=advance(state,{kind:'keydown',atMs:onset+row.actionMs,code:row.selected==='short'?'ArrowLeft':'ArrowRight',repeat:false,modified:false,composing:false});state=advance(state,{kind:'keyup',atMs:onset+row.actionMs+0.1,code:row.selected==='short'?'ArrowLeft':'ArrowRight'})}
  state=advance(state,{kind:'remove',atMs:onset+180})
  if(row.qualityNote)state=advance(state,{kind:'frameGap',atMs:onset+200,gapMs:51})
  if(row.actionMs!==null&&row.actionMs>=180){state=advance(state,{kind:'keydown',atMs:onset+row.actionMs,code:row.selected==='short'?'ArrowLeft':'ArrowRight',repeat:false,modified:false,composing:false});state=advance(state,{kind:'keyup',atMs:onset+row.actionMs+0.1,code:row.selected==='short'?'ArrowLeft':'ArrowRight'})}
  state=advance(state,{kind:'resolve',atMs:Math.max(requiredDue(state)!,state.commands.at(-1)!.atMs)})
  state=advance(state,{kind:'feedback',atMs:requiredDue(state)!})
  state=advance(state,{kind:'offset',atMs:requiredDue(state)!})
  if(state.phase==='break'&&n<rows.length-1)state=advance(state,{kind:'continue',atMs:state.commands.at(-1)!.atMs+1,responseHeld:false})
 }
 return state
}
const cell=(c:{correct:number;wrong:number;omitted:number;denominator:number;correctPercent:number|null;time:{cleanCount:number;medianMs:number|null;medianDisplayMs:number|null;iqrMs:number|null;iqrDisplayMs:number|null}})=>({correct:c.correct,wrong:c.wrong,omitted:c.omitted,denominator:c.denominator,correctPercent:c.correctPercent,time:{cleanCount:c.time.cleanCount,medianMs:c.time.medianMs,medianDisplayMs:c.time.medianDisplayMs,iqrMs:c.time.iqrMs,iqrDisplayMs:c.time.iqrDisplayMs}})
describe('V1.3 frozen numerical acceptance',()=>{
 it('replays every complete 90-trial vector with production logic',async()=>{
  const forms=await loadMouthForms()
  for(const f of fixtures.fullRuns.filter(f=>f.status==='Valid')){
   const form=forms.get(f.formId as FormId)!
   expect(form.sha256,f.id).toBe(f.formHash)
   const state=play(form,f.rows)
   const review=reconcileHeadless(state),expected=f.expected
   expect(review.status,f.id).toBe('complete_headless')
   expect([review.presented,review.closed,review.unresolvedPresented,review.unpresented,review.bankedCents],f.id).toEqual([90,90,0,0,expected.bankedCents])
   expect(review.rewardsBySet,f.id).toEqual(expected.rewardsBySet)
   expect(review.rewardBreakdown,f.id).toEqual(expected.rewardBreakdown)
   expect(cell(review.metrics!.overall),f.id).toEqual(expected.metrics!.overall)
   expect({short:cell(review.metrics!.byCategory.short),long:cell(review.metrics!.byCategory.long)},f.id).toEqual(expected.metrics!.byCategory)
   expect(review.metrics!.byBlock.map(cell),f.id).toEqual(expected.metrics!.bySet)
   expect(review.metrics!.postReward,f.id).toEqual(expected.metrics!.postReward)
   expect(state.events.filter(e=>e.type==='reward_earned').map(e=>({trial:e.trialIndex,cents:e.detail.cents,balanceCents:e.detail.balanceCents,feedbackConfirmed:true,bankConfirmed:true,afterInvalidation:false})),f.id).toEqual(f.rewardReceipts)
  }
 })
 it('preserves factual rewards for incomplete and invalid prefixes',async()=>{
  const form=(await loadMouthForms()).get('LM13-1')!
  for(const f of fixtures.fullRuns.filter(f=>f.status!=='Valid')){
   let state=f.rows.length?play(form,f.rows):armHeadless(form,{installationId:'test',sessionId:'test',clockDomainId:'test',route:'standalone'},profile,0)
   if(f.status==='Invalid')state=advance(state,{kind:'invalidate',atMs:state.commands.at(-1)!.atMs+1,reason:'hidden'})
   const review=reconcileHeadless(state)
   expect(review.status,f.id).toBe(f.status==='Invalid'?'invalid_headless':'incomplete_headless')
   expect(review.metrics,f.id).toBeNull()
   expect([review.presented,review.closed,review.unresolvedPresented,review.unpresented,review.bankedCents],f.id).toEqual([f.expected.presented,f.expected.closed,f.expected.unresolvedPresented,f.expected.unpresented,f.expected.bankedCents])
   expect(review.rewardBreakdown,f.id).toEqual(f.expected.rewardBreakdown)
  }
 })
 it('rejects changed, missing, duplicate, or reordered reward receipts',async()=>{
  const form=(await loadMouthForms()).get('LM13-1')!,fixture=fixtures.fullRuns[0]
  const good=play(form,fixture.rows),position=good.events.findIndex(e=>e.type==='reward_earned')
  const mutated=[...good.events];mutated[position]={...mutated[position],detail:{...mutated[position].detail,cents:10}}
  expect(verifyHeadless({...good,events:mutated})).toBe(false)
  expect(verifyHeadless({...good,events:good.events.filter((_,i)=>i!==position)})).toBe(false)
  expect(verifyHeadless({...good,events:[...good.events.slice(0,position),good.events[position],...good.events.slice(position)]})).toBe(false)
  const moved=[...good.events];[moved[position],moved[position+1]]=[moved[position+1],moved[position]]
  expect(verifyHeadless({...good,events:moved})).toBe(false)
 })
 it('matches frozen time cells',()=>{for(const t of fixtures.timeCells)expect(summarizeTimes(t.valuesMs),t.id).toMatchObject(t.expected)})
})
