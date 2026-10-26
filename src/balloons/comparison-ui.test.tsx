import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsJourney } from './Journey'
import { BalloonsStore } from './storage'
import type { Root } from './storage'
import { advance } from './durable'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests } from './drill-manifests'
import { closeRetest, reserveRetest } from './retest'
import { eligibleRoot } from './retest-test-support'

beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests(); await loadDrillManifests() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function savedPair() {
  const root = eligibleRoot('BL1')
  let tick = 0
  const time = () => ({ wallTimeMs: 1000000 + ++tick, monotonicMs: tick, clockEpochId: 'ui' })
  const reservation = reserveRetest(root, 'owner', 'base', time(), 'fixture')
  let rt = reservation.record
  const present = () => { rt = advance(advance(rt, { kind: 'arm' }, time()), { kind: 'confirm' }, time()) }
  present()
  while (rt.snapshot.phase !== 'completed') {
    const c = rt.snapshot.core, now = time()
    const action = { kind: c.status === 'resolved' ? 'next' as const : 'collect' as const, actionId: c.nextActionId,
      expectedRound: c.round, expectedRevision: c.revision, source: 'keyboard' as const, time: now }
    rt = advance(advance(rt, { kind: 'action_pending', action }, now), { kind: 'action', action }, now)
    if (action.kind === 'next') present()
  }
  root.records[reservation.token.sessionId] = rt
  closeRetest(root, rt)
  return { root, id: reservation.token.sessionId }
}

class Channel {
  static instances: Channel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor() { Channel.instances.push(this) }
  postMessage() {}
  close() {}
  static send(phase: 'begin' | 'end') { for (const channel of Channel.instances) channel.onmessage?.({ data: { phase, id: 'cross-tab-delete' } } as MessageEvent) }
}

it.each(['baseline', 'retest', 'replacement'])('history and reload access withdraw %s comparison during a delayed cross-tab read', async fault => {
  Channel.instances = []
  let { root, id } = savedPair()
  let deliver: ((root: Root) => void) | undefined
  const read = vi.fn(async () => structuredClone(root))
  const store = { read, installationId: root.installationId } as unknown as BalloonsStore
  vi.spyOn(BalloonsStore, 'open').mockResolvedValue(store)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_n: string, _o: unknown, callback: () => unknown) => Promise.resolve(callback()) } })
  vi.stubGlobal('BroadcastChannel', Channel)
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Balloons history' })) })
  const open = screen.getByRole('button', { name: 'Open saved comparison' })
  open.focus(); expect(open).toHaveFocus(); expect(open.tagName).toBe('BUTTON')
  await act(async () => { open.click() })
  expect(screen.getByRole('heading', { name: 'Baseline and retest' })).toHaveFocus()
  expect(document.querySelector('.balloons-comparison')).not.toBeNull()
  expect(screen.getByText(/Saved BL BL1 and RT RT1/)).toBeInTheDocument()
  read.mockImplementationOnce(() => new Promise<Root>(resolve => { deliver = resolve }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recheck saved comparison' })) })
  expect(document.querySelector('.balloons-comparison')).toBeNull()
  await act(async () => { Channel.send('begin') })
  const stale = structuredClone(root)
  if (fault === 'baseline') { root.tombstones.base = { sessionId: 'base', chainId: 'chain', formId: 'BL1', exposure: 'form_exposed', deletedAtMs: 1 }; delete root.records.base }
  if (fault === 'retest') { root.tombstones[id] = { sessionId: id, chainId: 'chain', formId: 'RT1', exposure: 'form_exposed', deletedAtMs: 1 }; delete root.records[id] }
  if (fault === 'replacement') root = { ...root, installationId: 'replacement', records: {}, training: undefined }
  await act(async () => { deliver!(stale); Channel.send('end') })
  expect(document.querySelector('.balloons-comparison')).toBeNull()
  expect(screen.getByRole('alert')).toHaveTextContent(fault === 'baseline' ? 'baseline was deleted' : fault === 'retest' ? 'retest was deleted' : 'missing or unsaved')
  cleanup()
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Balloons history' })) })
  expect(document.querySelector('.balloons-comparison')).toBeNull()
}, 30000)
