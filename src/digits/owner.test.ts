import { afterEach, describe, expect, it } from 'vitest'
import { acquireDigitsOwner } from './owner'

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => {
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

describe('Digits exclusive browser ownership', () => {
  it('holds ownership until release and rejects a second tab', async () => {
    let active = false
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: async (_name: string, _options: unknown, work: (lock: object | null) => Promise<void>) => {
        if (active) return work(null)
        active = true
        try { return await work({}) } finally { active = false }
      },
    } })
    const release = await acquireDigitsOwner()
    expect(active).toBe(true)
    await expect(acquireDigitsOwner()).rejects.toThrow('Another Digits tab')
    release()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(active).toBe(false)
    const second = await acquireDigitsOwner()
    second()
  })

  it('releases a canceled acquisition callback', async () => {
    let deliver!: () => void
    let active = false
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (_name: string, _options: unknown, work: (lock: object) => Promise<void>) =>
        new Promise<void>(resolve => { deliver = () => { active = true
          void work({}).finally(() => { active = false; resolve() }) } }),
    } })
    const controller = new AbortController()
    const pending = acquireDigitsOwner(controller.signal)
    controller.abort()
    deliver()
    await expect(pending).rejects.toThrow()
    await Promise.resolve()
    expect(active).toBe(false)
  })
})
