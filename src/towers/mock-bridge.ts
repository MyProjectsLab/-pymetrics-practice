import { NativePresenceError } from '../mock/native-presence'
import type { NativeArm, NativeReference } from '../mock/contract'
import { sourceReference } from '../mock/reference'
import { TowersStore } from './storage'

export type TowersMockSource = { classification: 'normal_complete' | 'task_limit' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
import { withTowersMockOrder } from './storage'
import { assertAuthority, onAuthorityClose } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
export async function withTowersMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: TowersMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withTowersMockOrder(async sourceSignal => {
    const store = await TowersStore.openRetained(sourceSignal)
    let remove = () => {}
    try {
      remove = onAuthorityClose(sourceSignal, () => store.close())
      const inspect = async (): Promise<TowersMockSource> => {
        const root = await store.read(sourceSignal)
        if (root.installationId !== arm.installationId || !arm.attemptId) throw new NativePresenceError('replaced','Towers installation changed')
        const run = root.runs[arm.attemptId]
        if (!run) {if(root.tombstones[arm.attemptId])throw new NativePresenceError('deleted','Towers result deleted');return {classification:'no_arm',reference:null}}
        if (run.id !== arm.attemptId || root.requests[arm.requestId]?.runId !== run.id || root.requests[arm.requestId]?.kind !== 'start') throw new Error('Towers request mismatch')
        const { form, report } = await store.inspect(run.id, sourceSignal)
        const eventVersion = run.events[0]?.eventVersion ?? null
        const reference = eventVersion ? sourceReference({ game: 'towers', arm, attemptId: run.id, settingsRevision,
          formId: run.formId, formHash: run.formHash,
          recorded: { event: eventVersion, formVersion: form.formVersion } }) : null
        const classification = report?.status === 'solved' && run.status === 'complete' && run.snapshot ? 'normal_complete' :
          report?.status === 'incomplete timeout' && run.events.at(-1)?.kind === 'expired' && run.snapshot ? 'task_limit' : 'incomplete'
        return { classification, reference }
      }

      const before = await inspect()
      assertAuthority(sourceSignal)
      return await commit(before, sourceSignal)
    } finally { remove(); store.close() }
  }, parent, loss)
}
