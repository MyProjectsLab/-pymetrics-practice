import { authorityEqual } from './authority'
import type { MouthAuthorityHandle } from './authority'
import type { MouthRecovery } from './recovery'
import type { ArmedAttempt, MouthReportSurface, MouthStore } from './storage'

/** A report opening outlives execution and attachment. Its immutable target,
 * recovery owner and genuine view ID never come from a later BrowserRun. */
export class MouthReportSession {
  readonly id = crypto.randomUUID()
  readonly viewId = crypto.randomUUID()
  readonly observedWallMs = Date.now()
  readonly store: MouthStore
  readonly handle: MouthAuthorityHandle
  readonly controller: MouthRecovery | null
  readonly source: MouthReportSurface
  constructor(store: MouthStore, handle: MouthAuthorityHandle, controller: MouthRecovery | null, source: MouthReportSurface) {
    store.authority.assertHandle(handle)
    if (controller && controller.authority !== handle) throw Error('Mouth report recovery owner changed')
    if (!controller && !handle.snapshot() && !handle.armedOnly) throw Error('Mouth report requires an exact result target')
    this.store = store; this.handle = handle; this.controller = controller; this.source = source
    Object.freeze(this)
  }
  variant(): 'desired' | 'published' | 'armed-only' | 'unavailable' {
    if (this.handle.status().kind === 'retired') return 'unavailable'
    if (this.handle.armedOnly) return 'armed-only'
    return this.handle.snapshot() ? 'published' : 'desired'
  }
  assertRecord(record: ArmedAttempt): void {
    this.handle.assertCurrent()
    if (!this.handle.matches(record)) throw Error('Mouth report original arm changed')
    if (this.handle.armedOnly) {
      if (record.snapshot) throw Error('Mouth armed-only report cannot publish a result')
    } else {
      if (!this.handle.snapshot()) throw Error('Mouth published result binding unavailable')
      if (!authorityEqual(record.snapshot, this.handle.confirmed())) throw Error('Mouth published result changed')
    }
  }
}
