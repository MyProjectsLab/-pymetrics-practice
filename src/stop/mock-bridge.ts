import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { inspectLocalState, StopLocalStore } from './storage'

export type StopMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
/** Source deletion and bridge publication share the native presentation order. */
import { STOP_PRESENTATION_LOCK } from './presentation-order'
import { withNativeObservation } from '../mock/authority'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withStopMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: StopMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withNativeObservation(STOP_PRESENTATION_LOCK, async sourceSignal => {
    const store = await StopLocalStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<StopMockSource> => {
          const root = await store.readRetained(sourceSignal)
          if (root.installationId !== arm.installationId) throw new NativePresenceError('replaced','Stop installation changed')
          if (arm.attemptId !== arm.requestId) throw new Error('Stop arm reservation changed')
          const checked = inspectLocalState(root)
          const result = checked.valid.find(item => item.sessionId === arm.attemptId)
          if (result) {
            if (result.specificationVersion !== '1.3' || result.mode !== 'baseline') throw new Error('Stop mock requires V1.3 baseline')
            const event = result.events.find(item => item.schemaVersion === 'stop_engine_event_v1')
            if (!event) throw new Error('Stop scored event witness missing')
            return { classification: 'normal_complete', reference: sourceReference({ game: 'stop', arm, attemptId: result.sessionId,
              settingsRevision, formId: result.form.id, formHash: result.form.checksum.replace(/^sha256:/, ''),
              recorded: { specification: result.specificationVersion, scoring: result.scoringVersion,
                event: event.schemaVersion, formVersion: result.form.formVersion, report: result.reportVersion ?? null } }) }
          }
          const draft = checked.invalid.find(item => item.sessionId === arm.attemptId)
          if (draft?.form && draft.specificationVersion === '1.3' && draft.mode === 'baseline') {
            return { classification: 'invalid', reference: sourceReference({ game: 'stop', arm, attemptId: draft.sessionId,
              settingsRevision, formId: draft.form.id, formHash: draft.form.checksum.replace(/^sha256:/, ''),
              recorded: { specification: draft.specificationVersion, scoring: null,
                formVersion: draft.form.formVersion, report: null }, allowReviewOnly: true }) }
          }
          if (root.deletedSessions?.[arm.attemptId]) throw new NativePresenceError('deleted','Stop result deleted')
          // A reservation is preparation, not a scored arm. The native arm persists
          // both its armed flag and its exposure marker in the source transaction.
          const reservation = root.reservations[arm.attemptId]
          const exposed = Object.values(root.exposures).some(item => item.sessionId === arm.attemptId)
          if (!reservation?.armed && !exposed) return { classification: 'no_arm', reference: null }
          return { classification: 'incomplete', reference: null }
        }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
