import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { report } from './report'
import { KeypressesStore } from './storage'

export type KeypressesMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
/** Call only after the outer mock metadata gate. The callback may commit metadata before final source readback. */
import { withKeypressesMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withKeypressesMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: KeypressesMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withKeypressesMockOrder(async sourceSignal => {
    const store = await KeypressesStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<KeypressesMockSource> => {
        const root = await store.read(sourceSignal)
        if (root.installationId !== arm.installationId) throw new NativePresenceError('replaced','Keypresses installation replaced')
        if (!arm.attemptId || arm.requestId !== arm.attemptId) throw new Error('Keypresses arm identity mismatch')
        const entry = root.records[arm.attemptId]
        if (!entry) {if(root.tombstones[arm.attemptId]!==undefined)throw new NativePresenceError('deleted','Keypresses attempt deleted');return {classification:'no_arm',reference:null}}
        const outcome = report(entry.state)
        if (!outcome) throw new Error('Keypresses source report did not verify')
        const reference = sourceReference({ game: 'keypresses', arm, attemptId: entry.sessionId, settingsRevision, formId: null, formHash: null,
          recorded: { specification: entry.state.specificationVersion, scoring: entry.state.scoringVersion,
            event: entry.state.eventVersion, presentation: entry.state.presentationPlanVersion },
          allowReviewOnly: entry.state.specificationVersion === 'keypresses_spec_v1_0_1' })
        const classification = entry.completedAtMs === null ? 'incomplete' : outcome.status === 'valid' ? 'normal_complete' : 'invalid'
        return { classification, reference }
      }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
