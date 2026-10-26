import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { BALLOONS_EVENT_VERSION, BALLOONS_FORM_VERSION, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION } from './contracts'
import { BalloonsStore, acquireOwner, withMutationGate } from './storage'
import { reconcileDurable } from './durable'
import { NativePresenceError } from '../mock/native-presence'

export type BalloonsMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
/** Recovery-only: require the old native browser owner to be gone before
 * settling the exact mock RP. The native store owns the pause transition. */
export async function settleBalloonsMock(arm:NativeArm,parent:AbortSignal):Promise<void>{
  if(!arm.attemptId||arm.attemptId!==arm.requestId)throw Error('Balloons mock assignment identity changed')
  const release=await acquireOwner(parent)
  try{await withMutationGate(async signal=>{
    const store=await BalloonsStore.openRetained(signal)
    try{if(store.installationId!==arm.installationId)throw Error('Balloons installation changed')
      const root=await store.read(),record=root.records[arm.attemptId!]
      if(root.tombstones[arm.attemptId!])throw Error('Balloons result deleted')
      if(!record)throw new NativePresenceError('missing_key','Balloons assigned RP is absent')
      if(record.header.identity.stage!=='mock')throw Error('Balloons mock identity changed')
      if(['completed','paused','released'].includes(record.snapshot.phase))return
      await store.settleMock(arm.attemptId!,{clockEpochId:crypto.randomUUID(),monotonicMs:performance.now(),wallTimeMs:Date.now()},signal)
    }finally{store.close()}
  },parent)}finally{await release()}
}
import { withBalloonsMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withBalloonsMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: BalloonsMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withBalloonsMockOrder(async sourceSignal => {
    const store = await BalloonsStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<BalloonsMockSource> => {
        const root = await store.read()
        if (root.installationId !== arm.installationId) throw new NativePresenceError('replaced','Balloons installation changed')
        if (!arm.attemptId || arm.attemptId !== arm.requestId) throw new Error('Balloons mock assignment identity changed')
        const record = root.records[arm.attemptId]
        if (!record) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Balloons result deleted');return {classification:'no_arm',reference:null}}
        reconcileDurable(record)
        if (record.header.identity.stage !== 'mock' || record.header.identity.sessionId !== arm.attemptId || !record.header.formId.startsWith('RP'))
          throw new Error('Balloons mock RP authority missing')
        const first = record.journal[0]
        const reference = sourceReference({ game: 'balloons', arm, attemptId: arm.attemptId, settingsRevision,
          formId: record.header.formId, formHash: first.manifestSha256,
          recorded: { specification: BALLOONS_SPEC_VERSION, scoring: BALLOONS_SCORING_VERSION,
            event: BALLOONS_EVENT_VERSION, formVersion: BALLOONS_FORM_VERSION } })
        const classification = record.snapshot.phase === 'completed' && record.snapshot.confirmedRounds.length === 39 && record.snapshot.core.status === 'completed' ? 'normal_complete' :
          ['paused', 'released'].includes(record.snapshot.phase) ? 'invalid' : 'incomplete'
        return { classification, reference }
      }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
