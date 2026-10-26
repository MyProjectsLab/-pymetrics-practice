import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { ArrowsStore } from './storage'
import type { ArmedAttempt } from './storage'
import type { ReportTarget } from '../mock/report-route'
import { isV11 } from './versions'
import { ARROWS_CANONICAL_SHA256 } from './v11/manifests'
import { ARROWS_FORM_VERSION } from './v11/contracts'

export type ArrowsMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
export function assertArrowsMockReport(attempt:ArmedAttempt,target:ReportTarget,installationId:string){
 const state=attempt.snapshot?.state??attempt.state
 if(target.game!=='arrows'||installationId!==target.reference.installationId||attempt.sessionId!==target.attemptId||
   attempt.requestId!==target.arm.requestId||!isV11(state))throw Error('Arrows mock report identity changed')
 const reference=sourceReference({game:'arrows',arm:target.arm,attemptId:attempt.sessionId,settingsRevision:target.reference.settingsRevision,
   formId:state.form.id,formHash:ARROWS_CANONICAL_SHA256,recorded:{specification:state.specificationVersion,
   scoring:state.scoringVersion,event:state.eventVersion,formVersion:ARROWS_FORM_VERSION,presentation:state.presentationVersion}})
 if(JSON.stringify(reference)!==JSON.stringify(target.reference))throw Error('Arrows mock report reference changed')
}
import { ARROWS_PRESENTATION_LOCK } from './presentation-order'
import { withNativeObservation } from '../mock/authority'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withArrowsMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: ArrowsMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withNativeObservation(ARROWS_PRESENTATION_LOCK, async sourceSignal => {
    const store = await ArrowsStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<ArrowsMockSource> => {
          const root = await store.read(sourceSignal)
          if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Arrows installation changed')
          const attempt = root.attempts[arm.attemptId]
          if (!attempt) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Arrows result deleted');return {classification:'no_arm',reference:null}}
          const state = attempt.snapshot?.state ?? attempt.state
          if (!isV11(state) || attempt.requestId !== arm.requestId || attempt.sessionId !== arm.attemptId || state.identity.sessionId !== arm.attemptId) throw new Error('Arrows V1.1 arm mismatch')
          const reference = sourceReference({ game: 'arrows', arm, attemptId: attempt.sessionId, settingsRevision,
            formId: state.form.id, formHash: ARROWS_CANONICAL_SHA256,
            recorded: { specification: state.specificationVersion, scoring: state.scoringVersion, event: state.eventVersion,
              formVersion: ARROWS_FORM_VERSION, presentation: state.presentationVersion } })
          const classification = attempt.snapshot?.kind === 'terminal' && attempt.snapshot.review.status === 'complete_headless' ? 'normal_complete' :
            attempt.snapshot?.kind === 'terminal' && attempt.snapshot.review.status === 'invalid_headless' ? 'invalid' : 'incomplete'
          return { classification, reference }
        }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
