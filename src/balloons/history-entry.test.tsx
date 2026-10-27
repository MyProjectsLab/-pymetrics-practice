import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { BalloonsJourney } from './Journey'
import { BalloonsStore, freshRoot } from './storage'
import type { Root } from './storage'
import { advance, createRecord, DURABLE_VERSION, mappingFor } from './durable'
import { loadScoredManifests } from './manifests'
import type { RunView } from './controller'
const boundary = vi.hoisted(() => ({ dispose: vi.fn() }))
vi.mock('./controller', async original => {
  const actual = await original<typeof import('./controller')>()
  return { ...actual, BalloonsController: class {
    view: RunView = { mode: 'idle', record: null, message: '' }
    store: BalloonsStore
    emit: (view: RunView) => void
    constructor(store: BalloonsStore, emit: (view: RunView) => void) { this.store = store; this.emit = emit }
    async start() {
      const time = (tick: number) => ({ wallTimeMs: tick, monotonicMs: tick, clockEpochId: 'history-ui-fixture' })
      let record = createRecord({ version: DURABLE_VERSION, formId: 'RP1', repeat: false, device: 'fixture', created: time(1),
        settings: { verbose: false, reducedMotion: false, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' },
        identity: { installationId: this.store.installationId, sessionId: 'active-history-round', chainId: null, stage: 'replay',
          mapping: mappingFor('RP1'), ownershipGeneration: 1, exposureGeneration: 1 } })
      record = advance(advance(record, { kind: 'arm' }, time(2)), { kind: 'confirm' }, time(3))
      this.view = { mode: 'playing', record, message: '' }; this.emit(this.view)
    }
    dispose() { boundary.dispose(); return Promise.resolve() }
    checkAuthority() {}
  } }
})
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
afterEach(() => { cleanup(); boundary.dispose.mockClear(); vi.restoreAllMocks() })
it('keeps the actual History control reachable during a playing round, outside guide disclosures', async () => {
  const root: Root = freshRoot()
  const store = { installationId: root.installationId, read: async () => structuredClone(root) } as BalloonsStore
  vi.spyOn(BalloonsStore, 'open').mockResolvedValue(store)
  await act(async () => { render(<BalloonsJourney onLibrary={vi.fn()} />) })
  expect(screen.getByText('Pump to add 5 cents, or Collect to keep this balloon’s amount.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByLabelText(/Only this balloon’s 10 cents/))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pump' }))
  fireEvent.click(screen.getByRole('button', { name: 'Collect' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })) })
  expect(document.querySelector('.balloons-play')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Pump' })).toBeEnabled()
  const history = screen.getByRole('button', { name: 'History' })
  expect(history).toBeVisible(); expect(history.closest('details')).toBeNull()
  await act(async () => { fireEvent.click(history) })
  expect(screen.getByRole('heading', { name: 'Balloons history' })).toBeVisible()
  expect(boundary.dispose).toHaveBeenCalledOnce()
  expect(document.querySelector('.balloons-play')).toBeNull()
})
