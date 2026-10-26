import { authorityEqual } from './authority'
import type { LengthsAuthorityHandle } from './authority'
import type { LengthsRecovery } from './recovery'
import type { ArmedAttempt, LengthsReportSurface, LengthsStore } from './storage'

/** A report opening outlives execution and attachment. Its immutable target,
 * recovery owner and genuine view ID never come from a later BrowserRun. */
export class LengthsReportSession {
  readonly id = crypto.randomUUID()
  readonly viewId = crypto.randomUUID()
  readonly observedWallMs = Date.now()
  readonly store: LengthsStore
  readonly handle: LengthsAuthorityHandle
  readonly controller: LengthsRecovery | null
  readonly source: LengthsReportSurface
  constructor(store: LengthsStore, handle: LengthsAuthorityHandle, controller: LengthsRecovery | null, source: LengthsReportSurface) {
    store.authority.assertHandle(handle)
    if (controller && controller.authority !== handle) throw Error('Lengths report recovery owner changed')
    if (!controller && !handle.snapshot() && !handle.armedOnly) throw Error('Lengths report requires an exact result target')
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
    if (!this.handle.matches(record)) throw Error('Lengths report original arm changed')
    if (this.handle.armedOnly) {
      if (record.snapshot) throw Error('Lengths armed-only report cannot publish a result')
    } else {
      if (!this.handle.snapshot()) throw Error('Lengths published result binding unavailable')
      if (!authorityEqual(record.snapshot, this.handle.confirmed())) throw Error('Lengths published result changed')
    }
  }
}
