import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ARROWS_PRESENTATION_LOCK } from './presentation-order'
import { ArrowsReportPublication } from './report-publication'

class SerialLocks {
  active = false
  waiting: Array<() => void> = []
  request<T>(name: string, options: { signal?: AbortSignal },
    callback: (lock: object) => Promise<T>): Promise<T> {
    expect(name).toBe(ARROWS_PRESENTATION_LOCK)
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        this.waiting = this.waiting.filter(waiter => waiter !== acquire)
        reject(options.signal?.reason ?? Error('canceled'))
      }
      const acquire = () => {
        options.signal?.removeEventListener('abort', abort)
        if (options.signal?.aborted) { abort(); this.next(); return }
        this.active = true
        void Promise.resolve().then(() => callback({})).then(resolve, reject).finally(() => {
          this.active = false
          this.next()
        })
      }
      options.signal?.addEventListener('abort', abort, { once: true })
      if (options.signal?.aborted) abort()
      else { this.waiting.push(acquire); this.next() }
    })
  }
  private next() { if (!this.active) this.waiting.shift()?.() }
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
let locks: SerialLocks
beforeEach(() => {
  locks = new SerialLocks()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
})
afterEach(() => {
  vi.restoreAllMocks()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

it('serializes report publication before a queued deletion', async () => {
  const gate = new ArrowsReportPublication()
  let deliver!: (value: string) => void
  const read = new Promise<string>(resolve => { deliver = resolve })
  const order: string[] = []
  const result = gate.run('report', () => read, value => order.push(`publish:${value}`),
    () => order.push('withdraw'))
  await vi.waitFor(() => expect(locks.active).toBe(true))
  const deletion = locks.request(ARROWS_PRESENTATION_LOCK, {}, async () => { order.push('delete') })
  expect(order).toEqual([])
  deliver('saved')
  expect(await result).toBe(true)
  await deletion
  expect(order).toEqual(['publish:saved', 'delete'])
})

it('cancels a held positive read before deletion and never publishes its late result', async () => {
  const gate = new ArrowsReportPublication()
  let deliver!: (value: string) => void
  const read = new Promise<string>(resolve => { deliver = resolve })
  const order: string[] = []
  const result = gate.run('report', () => read, () => order.push('publish'),
    () => order.push('withdraw'))
  await vi.waitFor(() => expect(locks.active).toBe(true))
  const deletion = locks.request(ARROWS_PRESENTATION_LOCK, {}, async () => { order.push('delete') })
  gate.cancel()
  await deletion
  deliver('old positive')
  expect(await result).toBe(false)
  expect(order).toEqual(['delete'])
})

it('coalesces routine checks while one read remains pending', async () => {
  const gate = new ArrowsReportPublication()
  let deliver!: (value: string) => void
  const read = vi.fn(() => new Promise<string>(resolve => { deliver = resolve }))
  const published: string[] = []
  const first = gate.run('report', read, value => published.push(value), () => {}, true)
  const second = gate.run('report', read, value => published.push(value), () => {}, true)
  expect(first).toBe(second)
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  deliver('same')
  expect(await first).toBe(true)
  expect(published).toEqual(['same'])
})

it('withdraws a failed visible publication even when it starts a newer check', async () => {
  const gate = new ArrowsReportPublication()
  const order: string[] = []
  let newer!: Promise<boolean>
  const first = gate.run('opening', async () => 'verified', () => {
    order.push('visible')
    newer = gate.run('poll', async () => 'verified', () => order.push('poll'), () => order.push('poll withdrawal'))
    throw Error('DOM publication rejected')
  }, () => order.push('opening withdrawal'))
  expect(await first).toBe(false)
  expect(await newer).toBe(true)
  expect(order).toEqual(['visible', 'opening withdrawal', 'poll'])
})
