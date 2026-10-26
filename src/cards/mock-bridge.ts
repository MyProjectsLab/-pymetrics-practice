import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { CardsStore } from './storage'

export type CardsMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
import { withCardsMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withCardsMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: CardsMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withCardsMockOrder(async sourceSignal => {
    const store = await CardsStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<CardsMockSource> => {
          const root = await store.read(sourceSignal)
          if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Cards installation changed')
          const run = root.runs[arm.attemptId]
          if (!run) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Cards result deleted');return {classification:'no_arm',reference:null}}
          if (run.id !== arm.attemptId || root.requests[arm.requestId]?.runId !== run.id || root.requests[arm.requestId]?.kind !== 'start') throw new Error('Cards start request mismatch')
          const first = run.events[0]
          if (!first) throw new Error('Cards event witness missing')
          const reference = sourceReference({ game: 'cards', arm, attemptId: run.id, settingsRevision,
            formId: run.formId, formHash: run.formSha256, recorded: { specification: first.ruleVersion, event: first.version } })
          const { report } = await store.inspect(run.id, sourceSignal)
          const classification = run.status === 'complete' && report.status === 'complete_valid' &&
            report.committedDrawCount === 80 && report.feedbackSeenCount === 80 && !!run.snapshot ? 'normal_complete' :
            run.status === 'invalid' || run.status === 'interrupted' || run.status === 'exited' ? 'invalid' : 'incomplete'
          return { classification, reference }
        }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
