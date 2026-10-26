import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { MouthStore } from './storage'
import type { ArmedAttempt } from './storage'
import type { ReportTarget } from '../mock/report-route'
import { MOUTH_FORM_VERSION } from './contracts'

export type MouthMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
export function assertMouthMockReport(attempt:ArmedAttempt,target:ReportTarget,installationId:string){
 const state=attempt.snapshot?.state??attempt.state
 if(target.game!=='lengths'||installationId!==target.reference.installationId||attempt.sessionId!==target.attemptId||
   attempt.requestId!==target.arm.requestId||!attempt.snapshot)throw Error('Lengths mock report identity changed')
 const reference=sourceReference({game:'lengths',arm:target.arm,attemptId:attempt.sessionId,settingsRevision:target.reference.settingsRevision,
   formId:state.form.id,formHash:state.form.sha256,resultRevision:attempt.snapshot.revision,
   recorded:{specification:state.specificationVersion,scoring:state.scoringVersion,event:state.eventVersion,
     formVersion:MOUTH_FORM_VERSION,presentation:state.profile.presentationVersion,report:attempt.snapshot.review.reportVersion}})
 if(JSON.stringify(reference)!==JSON.stringify(target.reference))throw Error('Lengths selected snapshot changed')
}
import { MOUTH_PRESENTATION_LOCK } from './order'
import { withNativeObservation } from '../mock/authority'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withMouthMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: MouthMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withNativeObservation(MOUTH_PRESENTATION_LOCK, async sourceSignal => {
    const store = await MouthStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<MouthMockSource> => {
          const root = await store.read(sourceSignal)
          if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Lengths installation changed')
          const attempt = root.attempts[arm.attemptId]
          if (!attempt) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Lengths result deleted');return {classification:'no_arm',reference:null}}
          const state = attempt.snapshot?.state ?? attempt.state
          if (attempt.requestId !== arm.requestId || attempt.sessionId !== arm.attemptId || state.identity.sessionId !== arm.attemptId) throw new Error('Lengths V1.3 arm mismatch')
          const reference = attempt.snapshot ? sourceReference({ game: 'lengths', arm, attemptId: attempt.sessionId, settingsRevision,
            formId: state.form.id, formHash: state.form.sha256, resultRevision: attempt.snapshot?.revision ?? null,
            recorded: { specification: state.specificationVersion, scoring: state.scoringVersion,
              event: state.eventVersion, formVersion: MOUTH_FORM_VERSION,
              presentation: state.profile.presentationVersion,
              report: attempt.snapshot.review.reportVersion } }) : null
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
