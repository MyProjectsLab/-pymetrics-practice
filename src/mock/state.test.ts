import { describe, expect, it } from 'vitest'
import { freshRoot, initialPreferences, validateRoot } from './contract'
import { applyMockCommand, claimLaunch, createMock, deleteAllMocks, deleteMock } from './state'
import type { MockCommand } from './state'
import fixtures from './identity-fixtures.json'
import type { NativeReference } from './contract'

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`
const begin = () => createMock(freshRoot(id(1)), { requestId: id(2), expectedRevision: 0, goal: 'early_career_finance', invitation: 'not_available', preferences: initialPreferences(), createdWallMs: 100 })
function apply(root: ReturnType<typeof begin>, kind: MockCommand['kind'], metadata: Record<string, unknown>, request: number, launchId: string | null = null) {
  const mock = root.mocks[0]
  return applyMockCommand(root, mock.id, { kind, canonicalMetadata: metadata, requestId: id(request), expectedRevision: mock.revision, launchId })
}

describe('mock durable state', () => {
  it('settles the original midpoint offer only on an explicit current boundary decline, including older later-cursor histories',()=>{
    let noOffer=apply(begin(),'start',{checkpointWallMs:110},3)
    expect(()=>apply(noOffer,'decline_break',{checkpointWallMs:111},40)).toThrow('Break not offered')
    expect(noOffer.mocks[0].cursor).toBe(1)
    for(let cursor=7;cursor<=12;cursor++){
      let root=noOffer
      for(let slot=1;slot<cursor;slot++)root=apply(root,'omit',{slot,reason:'user_exit',checkpointWallMs:120+slot},3+slot)
      expect(root.mocks[0].scheduledBreak).toBe('offered')
      const saved=structuredClone(root)
      validateRoot(saved)
      root=apply(saved,'decline_break',{checkpointWallMs:200+cursor},40)
      expect(root.mocks[0].cursor).toBe(cursor)
      expect(root.mocks[0].scheduledBreak).toBe('declined')
      expect(root.mocks[0].slots.filter(slot=>slot.resolution==='omitted')).toHaveLength(cursor-1)
      expect(()=>apply(root,'decline_break',{checkpointWallMs:250+cursor},41)).toThrow('Break not offered')
      validateRoot(root)
    }
    for(let slot=1;slot<=6;slot++)noOffer=apply(noOffer,'omit',{slot,reason:'user_exit',checkpointWallMs:120+slot},3+slot)
    const active={id:id(60),kind:'scheduled' as const,afterSlot:6,startWallMs:1000,endWallMs:null,
      clockDocumentId:id(61),startMonoMs:500,endMonoMs:null,elapsedMs:null,durationBasis:'open' as const}
    const breaking=apply(noOffer,'break_start',{breakId:active.id,checkpointWallMs:1000,breakRecord:active},62)
    expect(()=>apply(breaking,'decline_break',{checkpointWallMs:1001},63)).toThrow()
    const terminal=apply(noOffer,'finish_early',{checkpointWallMs:1000},64)
    expect(()=>apply(terminal,'decline_break',{checkpointWallMs:1001},65)).toThrow()
  })
  it('creates a fixed sequence and commits each boundary once', () => {
    const original = begin()
    expect(original.mocks[0].slots.map(slot => slot.game)).toEqual(['keypresses', 'stop', 'digits', 'arrows', 'balloons', 'towers', 'lengths', 'cards', 'easy_hard', 'money_1', 'money_2', 'faces'])
    expect(createMock(original, { requestId: id(2), expectedRevision: 0, goal: 'early_career_finance', invitation: 'not_available', preferences: initialPreferences(), createdWallMs: 100 })).toBe(original)
    let root = apply(original, 'start', { checkpointWallMs: 110 }, 3)
    root = apply(root, 'omit', { slot: 1, reason: 'user_exit', checkpointWallMs: 120 }, 4)
    expect(root.mocks[0].cursor).toBe(2)
    expect(root.mocks[0].slots[0].resolution).toBe('omitted')
    expect(() => applyMockCommand(root, root.mocks[0].id, { kind: 'omit', canonicalMetadata: { slot: 1, reason: 'user_exit', checkpointWallMs: 120 }, requestId: id(4), expectedRevision: 1, launchId: null })).not.toThrow()
    expect(root.mocks[0].cursor).toBe(2)
    validateRoot(root)
  })
  it('binds an arm before any native action and retires a confirmed no-arm launch', () => {
    let root = apply(begin(), 'start', { checkpointWallMs: 110 }, 3)
    root = apply(root, 'launch', { slot: 1, settingsRevision: 1 }, 4, id(5))
    expect(root.mocks[0].phase).toBe('launching')
    root = claimLaunch(root, { mockId: root.mocks[0].id, launchId: id(5), game: 'keypresses', documentId: id(20), expectedRevision: root.mocks[0].revision })
    expect(() => claimLaunch(root, { mockId: root.mocks[0].id, launchId: id(5), game: 'keypresses', documentId: id(21), expectedRevision: root.mocks[0].revision })).toThrow()
    root = apply(root, 'arm_pending', { slot: 1, settingsRevision: 1, nativeArm: {
      requestId: 'session-1', attemptId: 'session-1', originTicketId: null, installationId: 'native-installation', generation: null,
      requestKind: 'start', nativeIdentity: [] } }, 6, id(5))
    expect(root.mocks[0].slots[0].attempts[0].phase).toBe('arm_pending')
    root = apply(root, 'cancel_no_arm', { slot: 1, reason: 'no_arm' }, 7, id(5))
    expect(root.mocks[0].phase).toBe('boundary')
    expect(root.mocks[0].slots[0].attempts[0].classification).toBe('no_arm')
    validateRoot(root)
  })
  it('deletes only mock metadata and rotates installation on mock-only reset', () => {
    const root = begin(), deleted = deleteMock(root, { requestId: id(10), expectedRevision: root.revision, targetMockId: root.mocks[0].id })
    expect(deleted.mocks).toHaveLength(0)
    expect(deleted.nextMockOrdinal).toBe(2)
    const reset = deleteAllMocks(deleted, { requestId: id(11), expectedRevision: deleted.revision, newInstallationId: id(12) })
    expect(reset.installationId).toBe(id(12))
    expect(reset.nextMockOrdinal).toBe(1)
    expect(reset.lastRootCommand?.creationMetadata).toBeNull()
  })
  it('withdraws a deleted accepted source without changing the sequence or retained reference', () => {
    const reference = structuredClone(fixtures.cases.find(item=>item.id==='I01-valid')!.value) as NativeReference
    let root=apply(begin(),'start',{checkpointWallMs:110},3)
    root=apply(root,'launch',{slot:1,settingsRevision:1},4,id(5))
    root=claimLaunch(root,{mockId:root.mocks[0].id,launchId:id(5),game:'keypresses',documentId:id(20),expectedRevision:root.mocks[0].revision})
    const arm={requestId:reference.armRequestId,attemptId:reference.attemptId,originTicketId:null,installationId:reference.installationId,
      generation:null,requestKind:'start' as const,nativeIdentity:[]}
    root=apply(root,'arm_pending',{slot:1,settingsRevision:1,nativeArm:arm},6,id(5))
    root=apply(root,'terminal',{slot:1,reference,classification:'normal_complete',reason:'none'},7,id(5))
    root=apply(root,'accept',{slot:1,reference,classification:'normal_complete',checkpointWallMs:120},8,id(5))
    const accepted=structuredClone(root.mocks[0].slots[0])
    root=apply(root,'source_status',{slot:1,reference,availability:'deleted',reason:'deleted'},9,id(5))
    expect(root.mocks[0].cursor).toBe(2)
    expect(root.mocks[0].slots[0].acceptedLaunchId).toBe(id(5))
    expect(root.mocks[0].slots[0].attempts[0].reference).toEqual(accepted.attempts[0].reference)
    expect(root.mocks[0].slots[0].attempts[0].availability).toBe('deleted')
    expect(()=>apply(root,'source_status',{slot:1,reference:{...reference,attemptId:'another'},availability:'available',reason:'none'},10,id(5))).toThrow()
    validateRoot(root)
  })
  it('applies a changed preference only to later starts and retains an accepted source binding', () => {
    const reference = structuredClone(fixtures.cases.find(item=>item.id==='I01-valid')!.value) as NativeReference
    let root=apply(begin(),'start',{checkpointWallMs:110},3)
    root=apply(root,'launch',{slot:1,settingsRevision:1},4,id(5))
    root=claimLaunch(root,{mockId:root.mocks[0].id,launchId:id(5),game:'keypresses',documentId:id(20),expectedRevision:root.mocks[0].revision})
    const arm={requestId:reference.armRequestId,attemptId:reference.attemptId,originTicketId:null,installationId:reference.installationId,
      generation:null,requestKind:'start' as const,nativeIdentity:[]}
    root=apply(root,'arm_pending',{slot:1,settingsRevision:1,nativeArm:arm},6,id(5))
    root=apply(root,'terminal',{slot:1,reference,classification:'normal_complete',reason:'none'},7,id(5))
    root=apply(root,'accept',{slot:1,reference,classification:'normal_complete',checkpointWallMs:120},8,id(5))
    const prior=structuredClone(root.mocks[0].slots[0]),firstSettings=structuredClone(root.mocks[0].settings[0])
    const preferences={...initialPreferences(),facesMode:'extended-v1' as const}
    root=apply(root,'settings',{settingsRevision:2,preferences,checkpointWallMs:130},9)
    root=apply(root,'launch',{slot:2,settingsRevision:2},10,id(11))
    expect(root.mocks[0].slots[0]).toEqual(prior)
    expect(root.mocks[0].settings[0]).toEqual(firstSettings)
    expect(root.mocks[0].settings[1]).toMatchObject({revision:2,changedKeys:['facesMode'],preferences})
    expect(root.mocks[0].slots[1].attempts[0].settingsRevision).toBe(2)
    validateRoot(root)
  })
  it('retires a completed native result for a deliberate same-slot repeat without accepting it',()=>{
    const reference=structuredClone(fixtures.cases.find(item=>item.id==='I01-valid')!.value) as NativeReference
    let root=apply(begin(),'start',{checkpointWallMs:110},3)
    root=apply(root,'launch',{slot:1,settingsRevision:1},4,id(5))
    root=claimLaunch(root,{mockId:root.mocks[0].id,launchId:id(5),game:'keypresses',documentId:id(20),expectedRevision:root.mocks[0].revision})
    root=apply(root,'arm_pending',{slot:1,settingsRevision:1,nativeArm:{requestId:reference.armRequestId,attemptId:reference.attemptId,
      originTicketId:null,installationId:reference.installationId,generation:null,requestKind:'start',nativeIdentity:[]}},6,id(5))
    root=apply(root,'terminal',{slot:1,reference,classification:'normal_complete',reason:'none'},7,id(5))
    root=apply(root,'review_only',{slot:1,classification:'normal_complete',reason:'user_exit'},8,id(5))
    expect(root.mocks[0].slots[0].attempts[0]).toMatchObject({phase:'review_only',classification:'normal_complete',reference})
    expect(root.mocks[0].slots[0].acceptedLaunchId).toBeNull()
    root=apply(root,'launch',{slot:1,settingsRevision:1},9,id(10))
    expect(root.mocks[0].cursor).toBe(1)
    expect(root.mocks[0].activeLaunchId).toBe(id(10))
    expect(()=>apply(root,'accept',{slot:1,reference,classification:'normal_complete',checkpointWallMs:130},11,id(5))).toThrow()
    validateRoot(root)
  })
  it('uses the frozen inclusive 24-hour continuity boundary and never downgrades it',()=>{
    for(const [resumeWallMs,expected] of [[186399999,'resumed'],[186400000,'resumed'],[186400001,'multi_session'],[99999999,'multi_session_time_uncertain']] as const){
      let root=createMock(freshRoot(id(1)),{requestId:id(2),expectedRevision:0,goal:'early_career_finance',invitation:'not_available',preferences:initialPreferences(),createdWallMs:99999990})
      root=apply(root,'start',{checkpointWallMs:100000000},3)
      root=apply(root,'resume',{checkpointWallMs:resumeWallMs,continuity:expected},4)
      expect(root.mocks[0].continuity).toBe(expected)
      expect(root.mocks[0].activeLaunchId).toBeNull()
      if(expected==='multi_session'){
        root=apply(root,'resume',{checkpointWallMs:resumeWallMs+10,continuity:'multi_session'},5)
        expect(root.mocks[0].continuity).toBe('multi_session')
      }
      validateRoot(root)
    }
  })
  it('keeps scheduled break elapsed time exact at the ten-minute boundary',()=>{
    for(const elapsedMs of [599999,600000,600001]){
      let root=apply(begin(),'start',{checkpointWallMs:110},3)
      for(let slot=1;slot<=6;slot++)root=apply(root,'omit',{slot,reason:'user_exit',checkpointWallMs:120+slot},10+slot)
      expect(root.mocks[0].cursor).toBe(7)
      expect(root.mocks[0].scheduledBreak).toBe('offered')
      const start:import('./contract').BreakRecord={id:id(30),kind:'scheduled',afterSlot:6,startWallMs:1000,endWallMs:null,
        clockDocumentId:id(31),startMonoMs:500,endMonoMs:null,elapsedMs:null,durationBasis:'open'}
      root=apply(root,'break_start',{breakId:start.id,checkpointWallMs:1000,breakRecord:start},32)
      expect(()=>apply(root,'break_start',{breakId:id(33),checkpointWallMs:1001,breakRecord:{...start,id:id(33)}},33)).toThrow()
      const end={...start,endWallMs:1000+elapsedMs,endMonoMs:500+elapsedMs,elapsedMs,durationBasis:'monotonic' as const}
      root=apply(root,'break_end',{breakId:start.id,checkpointWallMs:1000+elapsedMs,breakRecord:end},34)
      expect(root.mocks[0].breaks[0]).toEqual(end)
      expect(root.mocks[0].cursor).toBe(7)
      expect(root.mocks[0].phase).toBe('boundary')
      expect(root.mocks[0].continuity).toBe('uninterrupted')
      validateRoot(root)
    }
  })
  it('records an uncertain break duration when the wall clock moves backward',()=>{
    let root=apply(begin(),'start',{checkpointWallMs:110},3)
    const start:import('./contract').BreakRecord={id:id(30),kind:'accommodation',afterSlot:0,startWallMs:1000,endWallMs:null,
      clockDocumentId:id(31),startMonoMs:500,endMonoMs:null,elapsedMs:null,durationBasis:'open'}
    root=apply(root,'break_start',{breakId:start.id,checkpointWallMs:1000,breakRecord:start},32)
    const end={...start,endWallMs:999,endMonoMs:null,elapsedMs:null,durationBasis:'unknown' as const}
    root=apply(root,'break_end',{breakId:start.id,checkpointWallMs:999,breakRecord:end},34)
    expect(root.mocks[0].breaks[0].durationBasis).toBe('unknown')
    expect(root.mocks[0].breaks[0].elapsedMs).toBeNull()
    expect(root.mocks[0].activeLaunchId).toBeNull()
  })
})
