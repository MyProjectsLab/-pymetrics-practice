import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { BalloonsJourney } from './Journey'
import { BalloonsStore, freshRoot } from './storage'
import { createRecord, DURABLE_VERSION, mappingFor } from './durable'
import { loadScoredManifests } from './manifests'
import type { RunView } from './controller'

const controllers = vi.hoisted(() => [] as { authorityChanged: ReturnType<typeof vi.fn> }[])
vi.mock('./controller', async importOriginal => {
  const original = await importOriginal<typeof import('./controller')>()
  return { ...original, BalloonsController: class {
    view: RunView = { mode: 'idle', record: null, message: '' }
    store: BalloonsStore
    emit: (view: RunView) => void
    constructor(store: BalloonsStore, emit: (view: RunView) => void) { this.store = store; this.emit = emit; controllers.push(this) }
    async start() {
      const record = createRecord({ version: DURABLE_VERSION, formId: 'RP1', repeat: false, device: 'fixture',
        created: { wallTimeMs: 1, monotonicMs: 1, clockEpochId: 'fixture' }, settings: { verbose: false, reducedMotion: false, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' },
        identity: { installationId: this.store.installationId, sessionId: `session-${controllers.length}`, chainId: null, stage: 'replay', mapping: mappingFor('RP1'), ownershipGeneration: 1, exposureGeneration: 1 } })
      this.view = { mode: 'paused', record, message: 'Fixture saved session' }; this.emit(this.view)
    }
    resume() { return this.start() }
    dispose() { return Promise.resolve() }
    checkAuthority() {}
    authorityChanged = vi.fn(() => { this.view = { mode: 'paused', record: null, message: 'Current deletion withdrawn' }; this.emit(this.view) })
  } }
})
class Channel {
  static instances: Channel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor() { Channel.instances.push(this) }
  postMessage() {}
  close() {}
}
const notice = (phase: string) => ({ data: { phase, id: 'held-delete' } }) as MessageEvent
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
afterEach(() => { cleanup(); controllers.length = 0; Channel.instances = []; vi.restoreAllMocks(); vi.unstubAllGlobals() })
it.each(['navigation', 'controller', 'unmount'])('old notification lifetime cannot mutate the replacement after %s', async boundary => {
  const root = freshRoot(), store = { installationId: root.installationId, read: async () => structuredClone(root) } as BalloonsStore
  vi.spyOn(BalloonsStore, 'open').mockResolvedValue(store); vi.stubGlobal('BroadcastChannel', Channel)
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  const fromGuide = Channel.instances.at(-1)!.onmessage!
  for (const name of ['Try the worked example', 'Pump example', 'Pump example', 'Collect example', 'Check my understanding']) await click(name)
  fireEvent.click(screen.getByLabelText(/Only this balloon’s 10 cents/))
  for (const name of ['Check answer', 'Test Pump', 'Test Collect', 'Start']) await click(name)
  const fromFirstController = Channel.instances.at(-1)!.onmessage!
  if (boundary === 'controller') await click('Check and resume saved session')
  if (boundary === 'unmount') {
    cleanup(); await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  }
  const stale = boundary === 'navigation' ? fromGuide : fromFirstController
  const before = document.querySelector('main')!.textContent
  await act(async () => { stale(notice('begin')); stale(notice('end')) })
  expect(document.querySelector('main')!.textContent).toBe(before)
  for (const c of controllers) expect(c.authorityChanged).not.toHaveBeenCalled()
  if (boundary !== 'unmount') {
    // A live registration still withdraws synchronously, without waiting for a poll/read.
    await act(async () => { Channel.instances.at(-1)!.onmessage!(notice('begin')) })
    expect(controllers.at(-1)!.authorityChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Current deletion withdrawn')).toBeInTheDocument()
  }
})
