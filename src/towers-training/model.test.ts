import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { verifyBank, shortestRoute, formById, prepareRouteMap } from './bank'
import { validateRoot as validateModelRoot } from './model'
import { ModelScope, OperationScope, SettlementScope } from './authority'
import type { TrainingRoot, Attempt } from './model'
import type { TrainingStore } from './store'
const validateRoot=(value:unknown)=>validateModelRoot(value,new ModelScope())
const operation=()=>new OperationScope(performance.now(),()=>true)

const source = process.env.TOWERS_FROZEN_DIR
const cases = source ? JSON.parse(readFileSync(`${source}/EXAMPLE-ROOTS.json`,'utf8')).cases as
  { id: string; root: unknown }[] : []

describe('Towers training frozen source', () => {
  it('checks all 20 forms and 2,520 graph states', async () => {
    await verifyBank()
    await prepareRouteMap(new ModelScope())
    for (const name of ['TT1-B01','TT1-R01','TT1-D01']) {
      const form = formById(name)
      expect(shortestRoute(form.start)).toHaveLength(9)
    }
  })
  it.skipIf(!source)('replays current frozen roots and rejects malformed neighbors', async () => {
    expect(cases).toHaveLength(29)
    for (const item of cases) {
      if (item.id.startsWith('negative_')) await expect(validateRoot(item.root)).rejects.toThrow()
      else { try { await validateRoot(item.root) } catch (error) { throw Error(`${item.id}: ${String(error)}`) } }
    }
  })
  it.skipIf(!source)('rejects native containers and mutable stale shape proofs',async()=>{
    const base=structuredClone(cases.find(item=>item.id==='current_g1_completed')!.root) as TrainingRoot
    const receipt=Object.keys(base.requests)[0]
    const malformed=structuredClone(base) as TrainingRoot
    ;(malformed.requests as Record<string,unknown>)[receipt]=new Map([['unknown',true]])
    await expect(validateRoot(malformed)).rejects.toThrow()
    const special=structuredClone(base) as TrainingRoot
    Object.defineProperty(special.requests,'__proto__',{value:{kind:'append'},
      enumerable:true,configurable:true,writable:true})
    await expect(validateRoot(special)).rejects.toThrow()
    let getterCalls=0
    const trapped=structuredClone(base) as TrainingRoot
    Object.defineProperty(trapped.requests[receipt],'kind',{enumerable:true,
      get(){getterCalls++;return 'append'}})
    await expect(validateRoot(trapped)).rejects.toThrow()
    expect(getterCalls).toBe(0)
    const prior=await validateRoot(base)
    expect(Object.isFrozen(prior.activity)).toBe(true)
    const changed=structuredClone(prior) as TrainingRoot
    ;(changed.activity as unknown[]).push({unknown:true})
    await expect(validateModelRoot(changed,new ModelScope(),prior)).rejects.toThrow()
    const alias=structuredClone(base) as TrainingRoot
    const chain=Object.values(alias.chains)[0]
    const attempt=alias.attempts[chain.baseline.attemptId]
    chain.context=attempt.context
    await expect(validateRoot(alias)).resolves.toBeTruthy()
  })
})

describe('new training command path', () => {
  it.skipIf(!source)('ends an active chain without recycling exposed forms', async () => {
    const { TrainingActions } = await import('./transitions')
    const testStore = { read:async()=>({status:'present',root:structuredClone(root)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next = await change(structuredClone(root))
      await validateRoot(next)
      return next
    } } as unknown as TrainingStore
    const root = structuredClone(cases.find(item=>item.id==='current_g1_completed')!.root) as TrainingRoot
    const next = await new TrainingActions(testStore).endChain(root,'chain1',operation())
    expect(next.chains.chain1.status).toBe('ended')
    expect(next.chains.chain1.firstGrant).toBeNull()
    expect(next.attempts[next.chains.chain1.baseline.attemptId].claim).toBe('retired')
    expect(Object.values(next.attempts).some(a=>a.attachment.type==='detached')).toBe(true)
  })
  it.skip('reserves, exposes, solves and routes a new baseline under the closed root (obsolete fake Store; covered by final native journeys)', async () => {
    const { TrainingActions } = await import('./transitions')
    const { canonical } = await import('./bank')
    const testStore = { read:async()=>({status:'present',root:structuredClone(root)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next = await change(structuredClone(root))
      await validateRoot(next)
      return next
    } } as unknown as TrainingStore
    const actions = new TrainingActions(testStore)
    const context = { contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide' }
    let root = {version:'towers-training-root/1',installationId:'test_install',revision:1,
      nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
    root = await actions.reserveBaseline(root as never,context,operation()) as typeof root
    const first = Object.values(root.attempts)[0] as {id:string}
    root = await actions.intent(root as never,first.id,0,operation()) as typeof root
    root = await actions.onset(root as never,first.id,0,undefined,operation()) as typeof root
    const solution = formById('TT1-B01').solution
    for(const [index,[from,to,disk]] of solution.entries())
      root = await actions.append(root as never,first.id,0,'move',(index+1)*1000,
        {from,to,disk,input:'keyboard'},undefined,operation()) as typeof root
    const solved = Object.values(root.attempts)[0] as {phase:string;snapshot:{moves:number;terminal:string}}
    expect(solved.phase).toBe('terminal')
    expect(solved.snapshot.moves).toBe(9)
    expect(solved.snapshot.terminal).toBe('solved')
    root = await actions.assign(root as never,first.id,operation()) as typeof root
    expect(Object.values(root.chains)).toHaveLength(1)
    expect(canonical(root).length).toBeGreaterThan(1000)
  })
})

describe('training exercise transitions', () => {
  it.skip('executes and records both sequencing rounds (obsolete fake Store; covered by final native journeys)', async () => {
    const { TrainingActions } = await import('./transitions')
    const { shortestRoute } = await import('./bank')
    let latest!:TrainingRoot
    const testStore = { read:async()=>({status:'present',root:structuredClone(latest)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next = await change(structuredClone(root)); await validateRoot(next);latest=next as TrainingRoot; return next
    } } as unknown as TrainingStore
    const actions = new TrainingActions(testStore)
    const context = {contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide'}
    for (const rule of ['sequencing'] as const) {
      let root = {version:'towers-training-root/1',installationId:`test_${rule}`,revision:1,
        nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
      latest=root as TrainingRoot
      root = await actions.reserveBaseline(root as never,context,operation()) as typeof root
      const b = Object.values(root.attempts)[0] as {id:string}
      root = await actions.intent(root as never,b.id,0,operation()) as typeof root
      root = await actions.onset(root as never,b.id,0,undefined,operation()) as typeof root
      for(const [i,[from,to,disk]] of formById('TT1-B01').solution.entries())
        root = await actions.append(root as never,b.id,0,'move',(i+1)*1000,
          {from,to,disk,input:'keyboard'},undefined,operation()) as typeof root
      // A current assigned chain selects the rule from immutable baseline evidence.
      root = await actions.assign(root as never,b.id,operation()) as typeof root
      const chain = Object.values(root.chains)[0] as {id:string;drillRule:string}
      expect(chain.drillRule).toBe(rule)
      root = await actions.reserveDrill(root as never,chain.id,false,operation()) as typeof root
      const drill = Object.values(root.attempts).find((a:unknown)=>(a as {kind:string}).kind==='drill') as {id:string}
      for(let ri=0;ri<2;ri++){
        root = await actions.intent(root as never,drill.id,ri,operation()) as typeof root
        root = await actions.onset(root as never,drill.id,ri,undefined,operation()) as typeof root
        const form = formById(ri?'TT1-D08':'TT1-D07')
        if(rule==='sequencing')
          root = await actions.coach(root as never,drill.id,ri,'checkpoint_ack',0,
            {board:form.start,steps:shortestRoute(form.start).slice(0,3)},undefined,operation()) as typeof root
        for(const [i,[from,to,disk]] of form.solution.entries()) {
          if(rule==='sequencing' && i>0 && i%3===0){
            const board=form.solutionStates[i]
            root = await actions.coach(root as never,drill.id,ri,'checkpoint_ack',i*1000,
              {board,steps:shortestRoute(board).slice(0,3)},undefined,operation()) as typeof root
          }
          root = await actions.append(root as never,drill.id,ri,'move',(i+1)*1000,
            {from,to,disk,input:'keyboard'},undefined,operation()) as typeof root
        }
        root = await actions.review(root as never,drill.id,ri,'round_reviewed',{},operation()) as typeof root
      }
      root = await actions.completeExercise(root as never,drill.id,operation()) as typeof root
      const granted = Object.values(root.chains)[0] as {firstGrant:unknown;status:string}
      expect(granted.status).toBe('drill_complete')
      expect(granted.firstGrant).toBeTruthy()
    }
  })
})

describe('all frozen router branches into native-format transitions', () => {
  it.skipIf(!source)('completes both coached rounds and locks first grant for each rule', async () => {
    const { TrainingActions } = await import('./transitions')
    const { shortestRoute } = await import('./bank')
    const fixtures = JSON.parse(readFileSync(`${source}/NUMERICAL-FIXTURES.json`,'utf8')) as {
      sources:Record<string,unknown>
    }
    let latest!:TrainingRoot
    const testStore = { read:async()=>({status:'present',root:structuredClone(latest)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next = await change(structuredClone(root)); await validateRoot(next);latest=next as TrainingRoot; return next
    } } as unknown as TrainingStore
    const actions = new TrainingActions(testStore)
    const sourceId:Record<string,string>={plan_before_action:'plan_2999',
      timed_planning:'long_15000',state_tracking:'repeated_two',sequencing:'expired_four'}
    for (const [rule,name] of Object.entries(sourceId)) {
      const baseline = structuredClone(fixtures.sources[name]) as Attempt
      let root: TrainingRoot = {version:'towers-training-root/1',installationId:baseline.installationId,
        revision:Math.max(200,baseline.revision),nextOrdinal:baseline.ordinal+1,
        attempts:{[baseline.id]:baseline},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
      await validateRoot(root)
      latest=root
      root = await actions.assign(root as never,baseline.id,operation()) as typeof root
      const chain = Object.values(root.chains)[0] as {id:string;drillRule:string;drillFormIds:string[]}
      expect(chain.drillRule).toBe(rule)
      root = await actions.reserveDrill(root as never,chain.id,false,operation()) as typeof root
      const drill = Object.values(root.attempts).find((a:unknown)=>(a as {kind:string}).kind==='drill') as {id:string}
      for(let ri=0;ri<2;ri++){
        root = await actions.intent(root as never,drill.id,ri,operation()) as typeof root
        root = await actions.onset(root as never,drill.id,ri,undefined,operation()) as typeof root
        const form=formById(chain.drillFormIds[ri])
        if(rule==='plan_before_action'){
          for(const [from,to,disk] of form.solution.slice(0,2))
            root = await actions.coach(root as never,drill.id,ri,'plan_step',0,{from,to,disk},undefined,operation()) as typeof root
          root = await actions.coach(root as never,drill.id,ri,'plan_confirm',0,{},undefined,operation()) as typeof root
        }
        if(rule==='timed_planning') root = await actions.coach(root as never,drill.id,ri,
          'planning_release',0,{},undefined,operation()) as typeof root
        if(rule==='sequencing') root = await actions.coach(root as never,drill.id,ri,
          'checkpoint_ack',0,{board:form.start,steps:shortestRoute(form.start).slice(0,3)},undefined,operation()) as typeof root
        for(const [i,[from,to,disk]] of form.solution.entries()){
          if(rule==='sequencing' && i>0 && i%3===0){const board=form.solutionStates[i]
            root = await actions.coach(root as never,drill.id,ri,'checkpoint_ack',i*1000,
              {board,steps:shortestRoute(board).slice(0,3)},undefined,operation()) as typeof root}
          root = await actions.append(root as never,drill.id,ri,'move',(i+1)*1000,
            {from,to,disk,input:'keyboard'},undefined,operation()) as typeof root
          if(rule==='state_tracking'){
            const records=(root.attempts[drill.id] as unknown as {records:{kind:string;id:string}[]}).records
            const move=records.findLast(item=>item.kind==='move')!
            const answer=(i===8?actions.review(root as never,drill.id,ri,
              'tracking_answer',{moveId:move.id,answer:false},operation()):actions.coach(root as never,drill.id,ri,
              'tracking_answer',(i+1)*1000,{moveId:move.id,answer:false},undefined,operation()))
            root = await answer as typeof root
            const next=(i===8?actions.review(root as never,drill.id,ri,
              'tracking_continue',{moveId:move.id},operation()):actions.coach(root as never,drill.id,ri,
              'tracking_continue',(i+1)*1000,{moveId:move.id},undefined,operation()))
            root = await next as typeof root
          }
        }
        root = await actions.review(root as never,drill.id,ri,'round_reviewed',{},operation()) as typeof root
      }
      root = await actions.completeExercise(root as never,drill.id,operation()) as typeof root
      expect((Object.values(root.chains)[0] as {status:string}).status).toBe('drill_complete')
    }
  })
})

describe('source-dependent training deletion', () => {
  it.skipIf(!source)('closes linked payloads for B, G1 and R while preserving G2-only deletion', async () => {
    const { TrainingActions } = await import('./transitions')
    let latest!:TrainingRoot
    const testStore = { read:async()=>({status:'present',root:structuredClone(latest)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next=await change(structuredClone(root));await validateRoot(next);latest=next as TrainingRoot;return next
    } } as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    const find=(name:string)=>structuredClone(cases.find(item=>item.id===name)!.root) as TrainingRoot
    for(const role of ['baseline','grant'] as const){
      const original=find('current_g1_completed'),c=Object.values(original.chains)[0]
      latest=original
      const id=role==='baseline'?c.baseline.attemptId:c.firstGrant!.attemptId
      const next=await actions.deleteAttempt(original,id,operation())
      expect(next.attempts[id]).toBeUndefined()
      expect(Object.keys(next.chains)).toHaveLength(0)
      expect(Object.keys(next.comparisons)).toHaveLength(0)
      expect(Object.values(next.attempts).filter(a=>a.attachment.type==='linked')).toHaveLength(0)
    }
    const compared=find('current_early_compared'),c=Object.values(compared.chains)[0]
    latest=compared
    const afterR=await actions.deleteAttempt(compared,c.completedRetest!.attemptId,operation())
    expect(Object.keys(afterR.chains)).toHaveLength(0)
    const familiar=find('current_g2_late_completed'),fc=Object.values(familiar.chains)[0]
    latest=familiar
    const g2=Object.values(familiar.attempts).find(a=>a.kind==='drill'&&a.eligibility==='familiar_review')!
    const afterG2=await actions.deleteAttempt(familiar,g2.id,operation())
    expect(afterG2.chains[fc.id].firstGrant).toEqual(fc.firstGrant)
    expect(afterG2.comparisons[fc.id]).toBeDefined()
    latest=compared
    const afterAll=await actions.deleteAll(compared,operation())
    expect(Object.keys(afterAll.attempts)).toHaveLength(0)
    expect(afterAll.installationId).not.toBe(compared.installationId)
  })
})

describe('familiar exercise and finite retest source', () => {
  it.skipIf(!source)('keeps G1 immutable through completed G2 and denies retest while G2 is unresolved', async () => {
    const { TrainingActions } = await import('./transitions')
    const { canonical, shortestRoute } = await import('./bank')
    const testStore = { read:async()=>({status:'present',root:structuredClone(root)}),
      update: async (root: unknown, change: (root: unknown) => Promise<unknown>) => {
      const next=await change(structuredClone(root));await validateRoot(next);return next
    } } as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    let root=structuredClone(cases.find(item=>item.id==='current_g1_completed')!.root) as TrainingRoot
    const chain=Object.values(root.chains)[0],grant=canonical(chain.firstGrant)
    root=await actions.reserveDrill(root,chain.id,true,operation())
    const g2=Object.values(root.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
    await expect(actions.reserveRetest(root,chain.id,operation())).rejects.toThrow(/unresolved/i)
    for(let ri=0;ri<2;ri++){
      root=await actions.intent(root,g2.id,ri,operation())
      root=await actions.onset(root,g2.id,ri,undefined,operation())
      const form=formById(g2.rounds[ri].formId)
      root=await actions.coach(root,g2.id,ri,'checkpoint_ack',0,
        {board:form.start,steps:shortestRoute(form.start).slice(0,3)},undefined,operation())
      for(const [i,[from,to,disk]] of form.solution.entries()){
        if(i>0&&i%3===0){const board=form.solutionStates[i]
          root=await actions.coach(root,g2.id,ri,'checkpoint_ack',i*1000,
            {board,steps:shortestRoute(board).slice(0,3)},undefined,operation())}
        root=await actions.append(root,g2.id,ri,'move',(i+1)*1000,
          {from,to,disk,input:'keyboard'},undefined,operation())
      }
      root=await actions.review(root,g2.id,ri,'round_reviewed',{},operation())
    }
    root=await actions.completeExercise(root,g2.id,operation())
    expect(root.attempts[g2.id].phase).toBe('terminal')
    expect(canonical(root.chains[chain.id].firstGrant)).toBe(grant)
    expect(root.chains[chain.id].status).toBe('drill_complete')
    root=await actions.deleteAttempt(root,g2.id,operation())
    expect(canonical(root.chains[chain.id].firstGrant)).toBe(grant)
  })
})

describe('captured command readback', () => {
  it.skipIf(!source)('rejects an exhausted chain that still has a linked active retest', async () => {
    const root=structuredClone(cases.find(item=>item.id==='current_g2_exhausted_completed')!.root) as TrainingRoot
    const retest=root.attempts.R_exhausted_6
    retest.records.pop()
    retest.rounds[0].puzzlePhase='active'
    retest.phase='active'
    retest.snapshot=null
    await expect(validateRoot(root)).rejects.toThrow('exhausted chain has unresolved retest')
  })
  it.skipIf(!source)('keeps the exact captured onset through a retired settlement and later Check', async () => {
    const { TrainingActions } = await import('./transitions')
    const { RetiredBeforePut } = await import('./store')
    let live=structuredClone(cases.find(item=>item.id==='intent_without_onset')!.root) as TrainingRoot
    const attempt=Object.values(live.attempts)[0]
    const originalRevision=live.revision
    const first=operation(),settlement=new SettlementScope(performance.now())
    let calls=0
    const testStore={read:async()=>({status:'present',root:structuredClone(live)}),
      update:async (_:TrainingRoot,change:(value:TrainingRoot)=>Promise<TrainingRoot>)=>{
        if(++calls===1){first.retire();throw new RetiredBeforePut()}
        if(calls===2){settlement.retire();throw new RetiredBeforePut()}
        const next=await change(structuredClone(live));await validateRoot(next);live=next;return next
      }} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    await expect(actions.onset(live,attempt.id,0,undefined,first)).rejects.toBeInstanceOf(RetiredBeforePut)
    expect(actions.pendingKind()).toBe('append')
    await expect(actions.reconcilePending(settlement,true)).rejects.toBeInstanceOf(RetiredBeforePut)
    expect(actions.pendingKind()).toBe('append')
    const saved=await actions.reconcilePending(new SettlementScope(performance.now()),true)
    expect(saved?.revision).toBe(originalRevision+1)
    expect(saved?.attempts[attempt.id].records.filter(event=>event.kind==='board_onset')).toHaveLength(1)
    expect(actions.pendingKind()).toBeNull()
  })
  it.skipIf(!source)('refuses a captured retry against changed bytes at the same revision', async () => {
    const { TrainingActions } = await import('./transitions')
    const { Unconfirmed, Changed } = await import('./store')
    let live=structuredClone(cases.find(item=>item.id==='intent_without_onset')!.root) as TrainingRoot
    const attempt=Object.values(live.attempts)[0]
    const testStore={read:async()=>({status:'present',root:structuredClone(live)}),
      update:async()=>{throw new Unconfirmed()}} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    await expect(actions.onset(live,attempt.id,0,undefined,operation())).rejects.toBeInstanceOf(Unconfirmed)
    expect(actions.pendingKind()).toBe('append')
    live=structuredClone(live)
    live.attempts[attempt.id].createdWallMs++
    await validateRoot(live)
    await expect(actions.reconcilePending(new SettlementScope(performance.now()),true))
      .rejects.toBeInstanceOf(Changed)
    expect(actions.pendingKind()).toBeNull()
    expect(live.attempts[attempt.id].records).toHaveLength(0)
  })
  it('does not replay an ordinary reserve after a completed native abort', async () => {
    const { TrainingActions } = await import('./transitions')
    const { Aborted } = await import('./store')
    const context={contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide'}
    let live:TrainingRoot={version:'towers-training-root/1',installationId:'known_abort',
      revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
    let abort=true
    const testStore={update:async (_:TrainingRoot,change:(value:TrainingRoot)=>Promise<TrainingRoot>)=>{
      if(abort){abort=false;throw new Aborted()}
      const next=await change(structuredClone(live));await validateRoot(next);live=next;return next
    },read:async()=>({status:'present',root:structuredClone(live)})} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    await expect(actions.reserveBaseline(live,context,operation())).rejects.toBeInstanceOf(Aborted)
    expect(live.revision).toBe(1)
    const recovered=await actions.reconcilePending(operation())
    expect(recovered?.revision).toBe(1)
    expect(Object.keys(recovered!.attempts)).toHaveLength(0)
    expect(Object.keys(recovered!.requests)).toHaveLength(0)
  })
  it('does not duplicate a reserve after committed delivery is lost', async () => {
    const { TrainingActions } = await import('./transitions')
    const { Unconfirmed } = await import('./store')
    const context={contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide'}
    let live:TrainingRoot={version:'towers-training-root/1',installationId:'lost_delivery',
      revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
    let lose=true
    const testStore={update:async (_:TrainingRoot,change:(value:TrainingRoot)=>Promise<TrainingRoot>)=>{
      const next=await change(structuredClone(live));await validateRoot(next);live=next
      if(lose){lose=false;throw new Unconfirmed()}
      return next
    },read:async()=>({status:'present',root:structuredClone(live)})} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    await expect(actions.reserveBaseline(live,context,operation())).rejects.toBeInstanceOf(Unconfirmed)
    const revision=live.revision,receiptIds=Object.keys(live.requests)
    const confirmed=await actions.reconcilePending(operation())
    expect(confirmed?.revision).toBe(revision)
    expect(Object.keys(confirmed!.requests)).toEqual(receiptIds)
    expect(Object.keys(confirmed!.attempts)).toHaveLength(1)
  })
  it('does not let an old delayed write clear a newer pending command', async () => {
    const { TrainingActions } = await import('./transitions')
    const { Changed } = await import('./store')
    const context={contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide'}
    let live:TrainingRoot={version:'towers-training-root/1',installationId:'late_old_write',
      revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
    let releaseOld!:()=>void,releaseNew!:()=>void,enteredOld!:()=>void,enteredNew!:()=>void
    const oldDelivery=new Promise<void>(resolve=>{releaseOld=resolve})
    const newDelivery=new Promise<void>(resolve=>{releaseNew=resolve})
    const oldSubmitted=new Promise<void>(resolve=>{enteredOld=resolve})
    const newSubmitted=new Promise<void>(resolve=>{enteredNew=resolve})
    let updates=0
    const testStore={read:async()=>({status:'present',root:structuredClone(live)}),
      update:async (_:TrainingRoot,change:(value:TrainingRoot)=>Promise<TrainingRoot>)=>{
        const next=await change(structuredClone(live));await validateRoot(next);live=next
        if(++updates===1){enteredOld();await oldDelivery;throw new Changed('Old delivery failed')}
        enteredNew();await newDelivery;return next
      }} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    const firstScope=operation()
    const first=actions.reserveBaseline(live,context,firstScope)
    await oldSubmitted
    firstScope.retire()
    const confirmed=await actions.reconcilePending(operation())
    expect(confirmed?.revision).toBe(2)
    expect(actions.pendingKind()).toBeNull()
    const second=actions.deleteAll(live,operation())
    await newSubmitted
    expect(actions.pendingKind()).toBe('delete_all')
    releaseOld()
    await expect(first).rejects.toBeInstanceOf(Changed)
    expect(actions.pendingKind()).toBe('delete_all')
    releaseNew()
    await second
    expect(actions.pendingKind()).toBeNull()
  })
  it('requires a fresh user reserve after completed absent-effect readback', async () => {
    const { TrainingActions } = await import('./transitions')
    const { Unconfirmed } = await import('./store')
    const context={contextVersion:'towers-training-context/1',inputMode:'keyboard',
      accessibilityMode:'visual-standard',reducedMotion:false,highContrast:false,
      deviceClass:'desktop',viewportClass:'wide'}
    let live:TrainingRoot={version:'towers-training-root/1',installationId:'lost_abort',
      revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
    let lose=true
    const testStore={update:async (_:TrainingRoot,change:(value:TrainingRoot)=>Promise<TrainingRoot>)=>{
      if(lose){lose=false;throw new Unconfirmed()}
      const next=await change(structuredClone(live));await validateRoot(next);live=next;return next
    },read:async()=>({status:'present',root:structuredClone(live)})} as unknown as TrainingStore
    const actions=new TrainingActions(testStore)
    await expect(actions.reserveBaseline(live,context,operation())).rejects.toBeInstanceOf(Unconfirmed)
    expect(live.revision).toBe(1)
    const recovered=await actions.reconcilePending(operation())
    expect(recovered?.revision).toBe(1)
    expect(Object.keys(recovered!.attempts)).toHaveLength(0)
    const fresh=await actions.reserveBaseline(recovered!,context,operation())
    expect(fresh.revision).toBe(2)
    expect(Object.keys(fresh.attempts)).toHaveLength(1)
    expect(Object.keys(fresh.requests)).toHaveLength(1)
  })
})
