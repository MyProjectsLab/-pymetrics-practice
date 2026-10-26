import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ModelScope } from './authority'
import { formById, placement } from './bank'
import { FragmentTree } from './fragments'
import { liveCandidate } from './live'
import { closureProjectionBytes, roundProjection, validateRoot } from './model'
import type { Attempt, JournalRecord } from './model'

const source=process.env.TOWERS_FROZEN_DIR
const cases=source?JSON.parse(readFileSync(`${source}/EXAMPLE-ROOTS.json`,'utf8')).cases as
  {id:string;root:unknown}[]:[]

describe('private live proof against full frozen validation',()=>{
  it.skipIf(!source)('keeps the exact two-round answer reserve without building a growing journal',async()=>{
    const scope=new ModelScope()
    const root=await validateRoot(cases.find(item=>item.id==='current_g2_early_reserved')!.root,scope)
    const drill=Object.values(root.attempts).find(item=>item.kind==='drill')!
    const withCount=(count:number):Attempt=>({...drill,
      records:Array.from({length:count},()=>drill.records[0]??{} as JournalRecord)})
    const answer={moveId:'x'.repeat(64),firstAnswer:false,correct:false}
    const arrayBytes=(count:number)=>JSON.stringify(Array.from({length:count},()=>answer)).length
    const first=await closureProjectionBytes(withCount(0),8,scope)
    for(const count of [1,7,48,1000]){
      const projected=await closureProjectionBytes(withCount(count),8,scope)
      const expected=2*(arrayBytes(Math.ceil((count+8)/3))-arrayBytes(Math.ceil(8/3)))
      expect(projected-first).toBe(expected)
    }
  })
  it.skipIf(!source)('admits exact onset, moves and solved snapshot without replaying retained roots',async()=>{
    const scope=new ModelScope(),fixture=cases.find(item=>item.id==='intent_without_onset')!
    let root=await validateRoot(fixture.root,scope)
    const fragments=new FragmentTree()
    await fragments.cold(root,scope)
    const attemptId='fresh_reserved',roundIndex=0
    const form=formById(root.attempts[attemptId].rounds[0].formId)
    let expectedBoard=structuredClone(form.start)
    for(let step=0;step<=form.solution.length;step++){
      const attempt=root.attempts[attemptId],round=attempt.rounds[0]
      const kind=step===0?'board_onset':'move'
      const [from,to,disk]=step===0?[0,0,0]:form.solution[step-1]
      const record:JournalRecord={seq:attempt.records.length+1,
        id:`${attemptId}_e${attempt.records.length+1}`,roundId:round.id,
        elapsedMs:step===0?0:step*1000,wallMs:100000+step*1000,
        puzzleRevision:attempt.records.filter(item=>
          ['board_onset','move','undo','reset','solved','expired','interrupted','exited']
            .includes(item.kind)).length,kind,
        payload:step===0?{}:{from,to,disk,input:'keyboard'}}
      root=await liveCandidate(root,{kind:step===0?'onset':'append',attemptId,roundIndex,
        record,body:{record},requestId:`rq_live_${step}`,payloadDigest:'a'.repeat(64),
        expectedRootRevision:root.revision},fragments,scope)
      await expect(validateRoot(root,scope)).resolves.toBeTruthy()
      if(step)expectedBoard=placement(expectedBoard,from,to)
      expect(roundProjection(root.attempts[attemptId],0).board).toEqual(expectedBoard)
    }
    expect(root.attempts[attemptId].phase).toBe('terminal')
    expect(root.attempts[attemptId].snapshot).toBeTruthy()
  })
})
