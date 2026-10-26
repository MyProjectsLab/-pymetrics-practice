import type { DigitsBackend, DigitsStore } from './storage'
/** Connections belong to the journey; work leases protect captured backends.
 * Delete all's returned alias shares its original backend and never closes a newer
 * active alias or a captured command's pending readback. */
export class DigitsHandles {
  private stores = new Set<DigitsStore>()
  private busy = new Map<DigitsBackend, number>()
  private active: DigitsStore | null = null
  private disposed = false
  add(store: DigitsStore) { this.stores.add(store) }
  adopt(store: DigitsStore) { this.add(store); this.active = store; this.collect() }
  lease(store: DigitsStore) {
    this.add(store); const backend = store.backend
    this.busy.set(backend, (this.busy.get(backend) ?? 0) + 1)
    let released = false
    return () => { if (released) return; released = true
      const remaining = (this.busy.get(backend) ?? 1) - 1
      if (remaining) this.busy.set(backend, remaining); else this.busy.delete(backend)
      this.collect()
    }
  }
  async work<T>(store: DigitsStore, job: () => Promise<T>): Promise<T> {
    const release = this.lease(store)
    try { return await job() } finally { release() }
  }
  discard(store: DigitsStore) { this.add(store); this.collect() }
  dispose() { this.disposed = true; this.active = null; this.collect() }
  private collect() {
    const closed = new Set<DigitsBackend>()
    for (const store of [...this.stores]) {
      const backend = store.backend
      if (this.busy.has(backend) || !this.disposed && this.active?.backend === backend) continue
      // Each wrapper's advisory channel is also closed; IDB close is idempotent.
      if (!closed.has(backend)) { store.close(); closed.add(backend) }
      else store.close()
      this.stores.delete(store)
    }
  }
}
