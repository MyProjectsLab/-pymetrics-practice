import { describe, expect, it } from 'vitest'
import { InFlightLaunchAction, ReturnIntent } from './journey-context'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('one launch action in flight', () => {
  it('shares a held terminal check, rejects a different launch, and rechecks after settlement', async () => {
    const action = new InFlightLaunchAction<'ready' | 'review_only'>()
    const held = deferred<'ready' | 'review_only'>()
    let calls = 0
    const first = action.run('mock:launch-a', () => { calls++; return held.promise })
    const joined = action.run('mock:launch-a', () => { calls++; return Promise.resolve('review_only') })
    expect(joined).toBe(first)
    await expect(action.run('mock:launch-b', () => Promise.resolve('ready'))).rejects.toThrow('previous game action')
    await Promise.resolve()
    expect(calls).toBe(1)
    held.resolve('ready')
    await expect(joined).resolves.toBe('ready')
    await Promise.resolve()
    await expect(action.run('mock:launch-a', () => { calls++; return Promise.resolve('review_only') })).resolves.toBe('review_only')
    expect(calls).toBe(2)
  })

  it('shares one continuation and does not cache a failed or retired result', async () => {
    const action = new InFlightLaunchAction<void>()
    const held = deferred<void>()
    let accepts = 0, retired = false
    const continueOnce = () => action.run('mock:launch-a', async () => {
      if (retired) throw Error('Mock launch retired')
      accepts++
      await held.promise
      if (retired) throw Error('Mock launch retired')
    })
    const first = continueOnce(), joined = continueOnce()
    expect(joined).toBe(first)
    await Promise.resolve()
    expect(accepts).toBe(1)
    retired = true
    held.resolve()
    await expect(first).rejects.toThrow('Mock launch retired')
    await Promise.resolve()
    await expect(continueOnce()).rejects.toThrow('Mock launch retired')
    expect(accepts).toBe(1)
  })

  it('joins only the live intent and lets a later intent recheck after settlement', async () => {
    const intent = new ReturnIntent(), action = new InFlightLaunchAction<void>(), held = deferred<void>()
    const firstSignal = intent.begin()
    const first = action.run('launch', () => held.promise, firstSignal)
    expect(action.pendingFor('launch', firstSignal)).toBe(first)
    expect(action.run('launch', () => Promise.resolve(), intent.begin())).toBe(first)
    await Promise.resolve()
    intent.retire()
    const laterSignal = intent.begin()
    expect(firstSignal.aborted).toBe(true)
    expect(action.pendingFor('launch', laterSignal)).toBe(null)
    await expect(action.run('launch', () => Promise.resolve(), laterSignal)).rejects.toThrow('previous game action')
    held.resolve()
    await first
    await Promise.resolve()
    await expect(action.run('launch', () => Promise.resolve(), laterSignal)).resolves.toBeUndefined()
    intent.finish(laterSignal)
    expect(laterSignal.aborted).toBe(true)
  })
})
