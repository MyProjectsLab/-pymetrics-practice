import { describe, expect, it, vi } from 'vitest'
import { DigitsNavigation, digitsTarget } from './navigation'
import { DigitsHandles } from './handles'
import type { DigitsStore, DigitsAttempt, DigitsBackend } from './storage'
import { loadDigitsForms } from './forms'
import { armDigits } from './engine'
import { visual } from './test-support'
const handle = (installationId: string, backend = {} as DigitsBackend) => ({ installationId, backend, close: vi.fn() }) as unknown as DigitsStore
async function attempt(installationId = 'installation', sessionId = 'session', requestId = 'request') {
  return { requestId, sessionId, mode: 'visual', ordinal: 1, createdAtWallMs: 1,
    arm: armDigits((await loadDigitsForms()).get('DV1')!, { installationId, sessionId, requestId, clockDomainId: 'clock', route: 'standalone' }, visual, 0) } as DigitsAttempt
}
describe('Digits navigation and absorbing target authority', () => {
  it.each(['initial open','history','open review','report view','subscription','poll','delete one','delete all','replay','sample','runner','save'])('fences both late success/error of %s after a newer destination', producer => {
    const nav = new DigitsNavigation(), store = handle('installation')
    nav.begin('history', store)
    const old = nav.capture(producer)
    const newer = nav.begin('prepare', store)
    expect(nav.admits(old)).toBe(false)
    expect(nav.admits(newer)).toBe(true)
    expect(nav.currentDestination).toBe('prepare')
  })
  it('retirement cannot be cleared by navigation, handle adoption or reselecting the same target', async () => {
    const nav = new DigitsNavigation(), store = handle('installation'), record = await attempt()
    const live = nav.select(nav.begin('run',store),record)!
    expect(nav.admits(live)).toBe(true)
    const removed = nav.retire(digitsTarget(record))!
    expect(nav.admits(live)).toBe(false); expect(nav.admits(removed)).toBe(true)
    const history = nav.begin('history', store)
    const fresh = nav.adopt(history,handle('installation'))!
    expect(nav.isRetired(digitsTarget(record))).toBe(true)
    expect(nav.select(fresh,record)).toBeNull()
    const other = await attempt('installation','other_session','other_request')
    expect(nav.select(fresh,other)).not.toBeNull()
  })
  it('an old target retirement does not redirect or retire a newer target', async () => {
    const nav = new DigitsNavigation(), store = handle('installation')
    const old = await attempt(), next = await attempt('installation','next','next_request')
    nav.select(nav.begin('run',store),old)
    const active = nav.select(nav.begin('review',store),next)!
    expect(nav.retire(digitsTarget(old))).toBeNull()
    expect(nav.admits(active)).toBe(true)
    expect(nav.isRetired(digitsTarget(next))).toBe(false)
  })
  it('same-view channels fence reverse delivery and different handle/target identities', async () => {
    const nav = new DigitsNavigation(), store = handle('installation')
    const old = nav.begin('history',store)
    const read1 = nav.capture('history'), read2 = nav.capture('history')
    expect(nav.admits(read1)).toBe(false); expect(nav.admits(read2)).toBe(true)
    const newHandle = handle('installation')
    const adopted = nav.adopt(read2,newHandle)!
    expect(nav.admits(old)).toBe(false); expect(nav.admits(read2)).toBe(false); expect(nav.admits(adopted)).toBe(true)
    const wrong = await attempt('replacement')
    expect(nav.select(adopted,wrong)).toBeNull()
  })
  it('dispose fences callbacks; strict mount activation cannot admit prior mount work', () => {
    const nav = new DigitsNavigation(), old = nav.activate()
    nav.dispose(); expect(nav.admits(old)).toBe(false)
    const current = nav.activate(); expect(nav.admits(old)).toBe(false); expect(nav.admits(current)).toBe(true)
  })
})
describe('Digits captured connection ownership', () => {
  it('does not close a Delete all alias while its backend is active or leased', () => {
    const pool = new DigitsHandles(), old = handle('old'), alias = handle('replacement',old.backend), fresh = handle('replacement')
    pool.adopt(old); const release = pool.lease(old)
    pool.discard(alias); pool.adopt(fresh)
    expect(old.close).not.toHaveBeenCalled(); expect(alias.close).not.toHaveBeenCalled()
    release(); expect(old.close).toHaveBeenCalledOnce(); expect(alias.close).toHaveBeenCalledOnce()
    expect(fresh.close).not.toHaveBeenCalled()
  })
  it('stale fresh open disposal and old success/failure release cannot close the active backend', async () => {
    const pool = new DigitsHandles(), active = handle('current'), stale = handle('current')
    pool.adopt(active); pool.discard(stale)
    expect(stale.close).toHaveBeenCalledOnce(); expect(active.close).not.toHaveBeenCalled()
    await expect(pool.work(stale,async () => { throw Error('late failure') })).rejects.toThrow('late failure')
    expect(active.close).not.toHaveBeenCalled()
  })
  it('unmount defers closing a captured reconciliation connection until its lease ends', () => {
    const pool = new DigitsHandles(), store = handle('installation')
    pool.adopt(store); const release = pool.lease(store); pool.dispose()
    expect(store.close).not.toHaveBeenCalled()
    release(); release(); expect(store.close).toHaveBeenCalledOnce()
  })
})
