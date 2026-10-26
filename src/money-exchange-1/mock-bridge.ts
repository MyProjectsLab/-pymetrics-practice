import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { EVENT_VERSION, SPEC_VERSION } from './core'
import { MoneyStore } from './storage'

export type Money1MockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
import { withMoney1MockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withMoney1MockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: Money1MockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withMoney1MockOrder(async sourceSignal => {
    const store = await MoneyStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<Money1MockSource> => {
        const root = await store.read(sourceSignal)
        if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Money Exchange 1 installation changed')
        const run = root.runs[arm.attemptId]
        if (!run) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Money Exchange 1 result deleted');return {classification:'no_arm',reference:null}}
        if (run.id !== arm.attemptId || run.armRequestId !== arm.requestId || root.requests[arm.requestId]?.runId !== run.id) throw new Error('Money Exchange 1 arm request mismatch')
        const reference = sourceReference({ game: 'money_1', arm, attemptId: run.id, settingsRevision,
          formId: run.formId, formHash: run.formPayloadHash,
          recorded: { specification: run.report?.version ?? SPEC_VERSION, scoring: null, event: EVENT_VERSION } })
        const classification = run.status === 'complete' && run.report?.status === 'complete_valid' ? 'normal_complete' :
          run.status === 'incomplete' ? 'invalid' : 'incomplete'
        return { classification, reference }
      }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
