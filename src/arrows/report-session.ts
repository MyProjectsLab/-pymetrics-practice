import { authorityEqual } from './authority'
import type { ArrowsAuthorityHandle } from './authority'
import type { ArrowsRecovery } from './recovery'
import type { ArmedAttempt, ArrowsReportSurface, ArrowsStore } from './storage'

/** A report opening outlives execution and attachment. Its immutable target,
 * recovery owner and genuine view ID never come from a later BrowserRun. */
export class ArrowsReportSession {
  readonly id = crypto.randomUUID()
  readonly viewId = crypto.randomUUID()
  readonly observedWallMs = Date.now()
  readonly store: ArrowsStore
  readonly handle: ArrowsAuthorityHandle
  readonly controller: ArrowsRecovery | null
  readonly source: ArrowsReportSurface
  constructor(store: ArrowsStore, handle: ArrowsAuthorityHandle, controller: ArrowsRecovery | null, source: ArrowsReportSurface) {
    store.authority.assertHandle(handle)
    if (controller && controller.authority !== handle) throw Error('Arrows report recovery owner changed')
    if (!controller && !handle.snapshot() && !handle.armedOnly) throw Error('Arrows report requires an exact result target')
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
    if (!this.handle.matches(record)) throw Error('Arrows report original arm changed')
    if (this.handle.armedOnly) {
      if (record.snapshot) throw Error('Arrows armed-only report cannot publish a result')
    } else {
      if (!this.handle.snapshot()) throw Error('Arrows published result binding unavailable')
      if (!authorityEqual(record.snapshot, this.handle.confirmed())) throw Error('Arrows published result changed')
    }
  }
}
