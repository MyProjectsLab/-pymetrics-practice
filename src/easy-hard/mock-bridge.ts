import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { EasyHardStore } from './storage'

export type EasyHardMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
import { withEasyHardMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withEasyHardMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: EasyHardMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withEasyHardMockOrder(async sourceSignal => {
    const store = await EasyHardStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<EasyHardMockSource> => {
          const root = await store.read(sourceSignal)
          if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Easy or Hard installation changed')
          const run = root.runs[arm.attemptId]
          if (!run) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Easy or Hard result deleted');return {classification:'no_arm',reference:null}}
          if (run.id !== arm.attemptId || root.requests[arm.requestId]?.runId !== run.id || root.requests[arm.requestId]?.kind !== 'start') throw new Error('Easy or Hard start request mismatch')
          const first = run.events[0]
          if (!first) return { classification: 'incomplete', reference: null }
          const reference = sourceReference({ game: 'easy_hard', arm, attemptId: run.id, settingsRevision,
            formId: run.formId, formHash: run.formHash, recorded: { event: first.eventVersion } })
          const { report } = await store.inspect(run.id, sourceSignal)
          const classification = run.status === 'complete' && report?.status === 'complete' && !!run.snapshot ? 'normal_complete' :
            run.status === 'invalid' || run.status === 'interrupted' ? 'invalid' : 'incomplete'
          return { classification, reference }
        }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
