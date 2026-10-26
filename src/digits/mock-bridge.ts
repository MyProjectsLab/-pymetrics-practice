import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { DigitsStore } from './storage'

export type DigitsMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
import { withDigitsMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withDigitsMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: DigitsMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withDigitsMockOrder(async sourceSignal => {
    const store = await DigitsStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<DigitsMockSource> => {
          const root = await store.read(sourceSignal)
          if (root.installationId !== arm.installationId) throw new NativePresenceError('replaced','Digits installation changed')
          if (!arm.attemptId) throw new Error('Digits arm identity missing')
          const attempt = root.attempts[arm.attemptId]
          if (!attempt) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Digits result deleted');return {classification:'no_arm',reference:null}}
          if (attempt.requestId !== arm.requestId || attempt.sessionId !== arm.attemptId || attempt.arm.identity.installationId !== arm.installationId) throw new Error('Digits request mismatch')
          const state = attempt.snapshot?.state ?? attempt.arm
          const reference = sourceReference({ game: 'digits', arm, attemptId: attempt.sessionId, settingsRevision,
            formId: state.form.id, formHash: state.form.manifestDigest,
            recorded: { specification: state.specificationVersion, scoring: state.scoringVersion,
              event: state.events[0]?.schemaVersion ?? null, formVersion: state.form.version } })
          const classification = attempt.snapshot?.kind === 'terminal' && attempt.snapshot.review.status === 'valid' ? 'normal_complete' :
            attempt.snapshot?.kind === 'terminal' && attempt.snapshot.review.status === 'invalid' ? 'invalid' : 'incomplete'
          return { classification, reference }
        }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
