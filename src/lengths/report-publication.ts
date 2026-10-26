import { orderLengthsPublication } from './order'

export const LENGTHS_REPORT_PUBLICATION_TIMEOUT_MS = 2_000

/** One cancellable, ordered publication at a time for a candidate surface.
 * Reading under the lock is insufficient: `publish` must synchronously commit
 * the visible state (React callers use flushSync) before this work returns. */
export class LengthsReportPublication {
  private generation = 0
  private active: { key: string; controller: AbortController; task: Promise<boolean> } | null = null

  cancel(): void {
    this.generation++
    const active = this.active
    this.active = null
    active?.controller.abort(Error('Lengths report publication canceled'))
  }

  cancelKey(key: string): void {
    if (this.active?.key === key) this.cancel()
  }

  run<T>(key: string, read: (signal: AbortSignal) => Promise<T>,
    publish: (value: T) => void, withdraw: (error: unknown) => void,
    coalesce = false): Promise<boolean> {
    if (coalesce && this.active?.key === key) return this.active.task
    this.cancel()
    const generation = this.generation
    const controller = new AbortController()
    const deadlineMs = performance.now() + LENGTHS_REPORT_PUBLICATION_TIMEOUT_MS
    const current = () => this.generation === generation &&
      this.active?.controller === controller && !controller.signal.aborted
    let withdrew = false
    const fail = (error: unknown, beganPublishing = false) => {
      // A synchronous publish may itself trigger a React effect that starts a
      // newer poll on this gate. Its own DOM assertion must still withdraw the
      // surface it just changed; the caller fences navigation/ownership.
      if ((!current() && !beganPublishing) || withdrew) return
      withdrew = true
      withdraw(error)
    }
    const timeout = setTimeout(() => {
      fail(Error('Lengths report verification timed out'))
      controller.abort(Error('Lengths report verification timed out'))
    }, LENGTHS_REPORT_PUBLICATION_TIMEOUT_MS)
    const task = Promise.resolve().then(() => orderLengthsPublication(async signal => {
      try {
        const value = await read(signal)
        if (!current()) return false
        if (performance.now() >= deadlineMs) {
          const error = Error('Lengths report verification timed out')
          fail(error)
          controller.abort(error)
          return false
        }
        try { publish(value) }
        catch (error) { fail(error, true); throw error }
        return true
      } catch (error) {
        fail(error)
        throw error
      }
    }, controller.signal)).catch(() => false).finally(() => {
      clearTimeout(timeout)
      if (this.active?.controller === controller) this.active = null
    })
    this.active = { key, controller, task }
    return task
  }
}
