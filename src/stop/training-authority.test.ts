// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStopLocalStore } from './storage'
import type { StopLocalState, StopLocalStore } from './storage'
import { checkTrainingChain, currentTrainingChain, restoreTrainingChain, updateTrainingChain } from './training'
import type { TrainingChain } from './training'

// These fixtures isolate dependency authority; full journal validity is exercised
// by the run tests and native IndexedDB/browser captures.
function fixture() {
  const chain = { id: 'chain', baseline: { sessionId: 'baseline', storageMode: 'persistent_local' },
    drillAttempts: [{ id: 'drill', valid: true, events: [{ original: true }] }], retestAttempts: [], retest: null,
    recommendation: { drillId: 'detection' }, status: 'drill_complete' } as unknown as TrainingChain
  let identity = 'original', revision = '0'
  const state = { installationId: identity, results: { baseline: chain.baseline }, chains: { chain },
    retiredChains: {}, deletedSessions: {} } as unknown as StopLocalState
  const store = { installationIdentity: () => identity, sameInstallation: (s: StopLocalState) => s.installationId === identity,
    chainAvailable: () => true, read: vi.fn(async () => structuredClone(state)), deletionRevision: vi.fn(async () => revision),
    saveChain: vi.fn(async () => { throw Error('Writes unavailable') }), activity: vi.fn(async () => {}) } as unknown as StopLocalStore
  setStopLocalStore(store); restoreTrainingChain(chain)
  // This is the application's second-write-failure transition. The complete
  // journal is retained while the active writer is removed.
  setStopLocalStore(null)
  const result = { sessionId: 'retest', form: { id: 'retest-form' }, storageMode: 'temporary_memory', events: [{ original: true }], summarySnapshot: { original: true } } as unknown as TrainingChain['baseline']
  updateTrainingChain({ retest: result, status: 'complete' })
  const complete = currentTrainingChain()!
  return { state, store, complete, result, replace: () => { identity = 'replacement'; state.installationId = identity }, revise: () => { revision = '1' } }
}
afterEach(() => { setStopLocalStore(null); restoreTrainingChain(null, true) })

describe('C5 resumed comparison authority after write fallback', () => {
  it.each(['baseline', 'drill', 'all'])('rejects persisted %s deletion with no notification or active writer', async target => {
    const f = fixture(), original = JSON.stringify(f.result)
    expect(await checkTrainingChain(f.complete)).toBe(true)
    if (target === 'all') f.replace()
    else { f.state.deletedSessions![target] = true; delete f.state.chains.chain }
    expect(await checkTrainingChain(f.complete)).toBe(false)
    expect(currentTrainingChain()).toBeNull()
    expect(JSON.stringify(f.result)).toBe(original)
    expect(f.store.saveChain).not.toHaveBeenCalled()
  })
  it.each(['baseline', 'drill'])('fails closed when a previously persisted %s is missing without a notification/tombstone', async target => {
    const f = fixture()
    if (target === 'baseline') delete f.state.results.baseline
    else f.state.chains.chain = { ...f.state.chains.chain, drillAttempts: [] }
    expect(await checkTrainingChain(f.complete)).toBe(false)
    expect(currentTrainingChain()).toBe(f.complete)
  })
  it('preserves unrelated deletion and unsaved completed journals without requiring another write', async () => {
    const f = fixture()
    f.state.deletedSessions!.unrelated = true; f.revise()
    expect(await checkTrainingChain(f.complete)).toBe(true)
    expect(f.state.results.retest).toBeUndefined()
    expect(currentTrainingChain()!.retest).toBe(f.result)
    expect(f.store.saveChain).not.toHaveBeenCalled()
  })
  it('fails closed on unavailable reads and permits retry when the original authority returns', async () => {
    const f = fixture()
    vi.mocked(f.store.read).mockRejectedValueOnce(Error('Read unavailable'))
    expect(await checkTrainingChain(f.complete)).toBe(false)
    expect(currentTrainingChain()).toBe(f.complete)
    expect(await checkTrainingChain(f.complete)).toBe(true)
  })
  it('does not admit a delayed pre-deletion read when notifications are unavailable', async () => {
    const f = fixture()
    let deliver!: (state: StopLocalState) => void
    const old = structuredClone(f.state)
    vi.mocked(f.store.read).mockImplementationOnce(() => new Promise(resolve => { deliver = resolve }))
    const checking = checkTrainingChain(f.complete)
    await vi.waitFor(() => expect(deliver).toBeDefined())
    f.state.deletedSessions!.baseline = true; f.revise(); deliver(old)
    expect(await checking).toBe(false)
    expect(await checkTrainingChain(f.complete)).toBe(false)
  })
  it.each([false, true])('a late eligibility read cannot select or clear a replacement chain; old deletion=%s', async deleted => {
    const f = fixture()
    let deliver!: (state: StopLocalState) => void
    const old = structuredClone(f.state)
    if (deleted) old.deletedSessions!.baseline = true
    vi.mocked(f.store.read).mockImplementationOnce(() => new Promise(resolve => { deliver = resolve }))
    const checking = checkTrainingChain(f.complete)
    await vi.waitFor(() => expect(deliver).toBeDefined())
    f.replace(); setStopLocalStore(f.store)
    const replacement = { ...f.complete, id: 'new-chain' }
    restoreTrainingChain(replacement)
    deliver(old)
    expect(await checking).toBe(false)
    expect(currentTrainingChain()).toBe(replacement)
  })
  it('captures installation identity rather than trusting a rebound store object', async () => {
    const f = fixture(); f.replace()
    // Simulate the same store reused by same-tab Delete all. Even identical IDs
    // copied into replacement data cannot grant the old chain authority.
    expect(await checkTrainingChain(f.complete)).toBe(false)
    expect(currentTrainingChain()).toBeNull()
  })
  it('does not require durable presence for a genuinely buffered drill', async () => {
    const f = fixture()
    updateTrainingChain({ drillAttempts: [...f.complete.drillAttempts, { ...f.complete.drillAttempts[0], id: 'buffered' }] })
    expect(await checkTrainingChain(currentTrainingChain()!)).toBe(true)
  })
  it('keeps a genuinely temporary same-tab chain eligible, but rejects an unbound saved baseline', async () => {
    const f = fixture(); restoreTrainingChain(null, true)
    const temporary = { ...f.complete, baseline: { ...f.complete.baseline, storageMode: 'temporary_memory' as const } }
    restoreTrainingChain(temporary)
    expect(await checkTrainingChain(temporary)).toBe(true)
    restoreTrainingChain(null, true); restoreTrainingChain(f.complete)
    expect(await checkTrainingChain(f.complete)).toBe(false)
  })
})
