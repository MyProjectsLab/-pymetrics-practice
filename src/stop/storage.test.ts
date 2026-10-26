import { describe, expect, it, vi } from 'vitest'
import { inspectLocalState, StopLocalStore, FormClaimExpiredError, STOP_CLAIM_LEASE_MS } from './storage'
import type { StopLocalState } from './storage'
import { createPreparationRecorder, createUnderstandingEvidence, questions } from './preparation'

describe('M5 load-time review boundaries', () => {
  it('quarantines malformed invalid attempts and retired drill journals before history rendering', () => {
    const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: {},
      drafts: { broken: { sessionId: 'broken', schemaVersion: 'stop_development_draft_v1', status: 'invalid',
        retainedAtWall: '2026-09-29T00:00:00Z', mode: 'baseline', events: [], form: { id: { bad: true } } } },
      chains: {}, retiredChains: { retired: { reason: 'individual_delete', drillAttempts: [{ id: 'drill', events: [null] }], retestAttempts: [] } },
      activeChainId: null, exposures: {}, reservations: {} } as unknown as StopLocalState
    const checked = inspectLocalState(state)
    expect(checked.invalid).toEqual([])
    expect(checked.retiredChains).toEqual([])
    expect(checked.rejected).toEqual([{ sessionId: 'broken', formId: null,
      reason: 'Stored attempt has an unsupported or incomplete record.' }])
  })
})

// Execute production transaction callbacks against a deterministic durable-state
// stand-in. Actual IDB serialization is separately exercised in lease-matrix.mjs.
describe('M6-A unarmed claim lease boundaries', () => {
  it('offers no V1.3 mock baseline after all four baseline forms are exposed', async () => {
    const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: {}, drafts: {}, chains: {}, retiredChains: {},
      activeChainId: null, exposures: {}, reservations: {} } as StopLocalState
    const store = Object.create(StopLocalStore.prototype) as StopLocalStore
    store.mutate = async change => change(state, {} as IDBObjectStore)
    const forms: string[] = []
    for (let index = 1; index <= 4; index++) {
      const sessionId = `mock_${index}`
      const reserved = await store.reserve(sessionId, 'baseline', 0, null, null, undefined, '1.3')
      expect(reserved).not.toBeNull()
      forms.push(reserved!.formId)
      await store.arm(sessionId, reserved!.formId, 'standard')
    }
    expect(new Set(forms).size).toBe(4)
    const before = structuredClone(state)
    expect(await store.reserve('mock_5', 'baseline', 0, null, null, undefined, '1.3')).toBeNull()
    expect(state).toEqual(before)
  })
  it.each(['baseline', 'replay'] as const)('leases only unarmed unexposed %s claims', async family => {
    const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: {}, drafts: {}, chains: {}, retiredChains: {},
      activeChainId: null, exposures: {}, reservations: {} } as StopLocalState
    const store = Object.create(StopLocalStore.prototype) as StopLocalStore
    store.mutate = async change => change(state, {} as IDBObjectStore)
    const date = vi.spyOn(Date, 'now').mockReturnValue(100)
    try {
      const old = (await store.reserve('old', family, 0))!
      expect(old.expiresAtMs).toBe(100 + STOP_CLAIM_LEASE_MS)
      date.mockReturnValue(old.expiresAtMs! - 1)
      expect((await store.reserve('early', family, 0))!.formId).not.toBe(old.formId)
      date.mockReturnValue(old.expiresAtMs!)
      await expect(store.arm('old', old.formId, 'standard')).rejects.toBeInstanceOf(FormClaimExpiredError)
      await expect(store.reserve('old', family, 0)).rejects.toBeInstanceOf(FormClaimExpiredError)
      expect((await store.reserve('new', family, 0))!.formId).toBe(old.formId)
      await expect(store.arm('old', old.formId, 'standard')).rejects.toBeInstanceOf(FormClaimExpiredError)
      await store.arm('new', old.formId, 'standard')
      date.mockReturnValue(Date.now() + STOP_CLAIM_LEASE_MS * 2)
      expect((await store.reserve('later', family, 0))!.formId).not.toBe(old.formId)
      expect(state.exposures[old.formId].certainty).toBe('uncertain')
      expect(state.reservations.new.armed).toBe(true)
    } finally { date.mockRestore() }
  })
})

it('removes shortcut eligibility when the retained understanding evidence is deleted', async () => {
  const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: {}, drafts: {}, chains: {}, retiredChains: {},
    activeChainId: null, exposures: {}, reservations: {}, preparationEvidence: null } as StopLocalState
  const store = Object.create(StopLocalStore.prototype) as StopLocalStore
  store.read = async () => state
  store.mutate = async change => change(state, {} as IDBObjectStore)
  const recorder = createPreparationRecorder('understanding-source')
  recorder.record('guide_opened', { source: 'library' })
  for (const question of questions) recorder.record('comprehension_answered', {
    itemId: question.id, answerId: question.answer, correct: true, attempt: 1,
  })
  const evidence = await createUnderstandingEvidence(recorder)
  await store.saveUnderstandingEvidence(evidence, 'fixture')
  expect(await store.currentUnderstandingEvidence()).toEqual(evidence)
  await store.deleteUnderstandingEvidence()
  expect(await store.currentUnderstandingEvidence()).toBeNull()
  state.installationId = 'replacement'
  await expect(store.saveUnderstandingEvidence(evidence, 'fixture')).rejects.toThrow('installation changed')
  expect(await store.currentUnderstandingEvidence()).toBeNull()
  state.installationId = 'fixture'
  state.deletedSessions = { [recorder.sessionId]: true }
  await expect(store.saveUnderstandingEvidence(evidence, 'fixture')).rejects.toThrow('source was deleted')
  expect(await store.currentUnderstandingEvidence()).toBeNull()
})

it('keeps the legacy and variable-mix understanding shortcuts separate', async () => {
  const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: {}, drafts: {}, chains: {}, retiredChains: {},
    activeChainId: null, exposures: {}, reservations: {}, preparationEvidence: null, preparationEvidenceV13: null } as StopLocalState
  const store = Object.create(StopLocalStore.prototype) as StopLocalStore
  store.read = async () => state
  store.mutate = async change => change(state, {} as IDBObjectStore)
  const passed = (id: string) => {
    const recorder = createPreparationRecorder(id)
    recorder.record('guide_opened', { source: 'library' })
    for (const question of questions) recorder.record('comprehension_answered', {
      itemId: question.id, answerId: question.answer, correct: true, attempt: 1,
    })
    return recorder
  }
  const legacy = await createUnderstandingEvidence(passed('old'), '1.1')
  const variable = await createUnderstandingEvidence(passed('new'), '1.3')
  await store.saveUnderstandingEvidence(legacy, 'fixture')
  expect(await store.currentUnderstandingEvidence('1.3')).toBeNull()
  await store.saveUnderstandingEvidence(variable, 'fixture')
  expect(await store.currentUnderstandingEvidence('1.1')).toEqual(legacy)
  expect(await store.currentUnderstandingEvidence('1.3')).toEqual(variable)
  await store.deleteUnderstandingEvidence()
  expect(await store.currentUnderstandingEvidence('1.1')).toBeNull()
  expect(await store.currentUnderstandingEvidence('1.3')).toBeNull()
})
