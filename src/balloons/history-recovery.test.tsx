import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsJourney } from './Journey'
import { BalloonsStore, freshRoot } from './storage'
import type { Root } from './storage'
import { advance, createRecord, DURABLE_VERSION, mappingFor } from './durable'
import { loadScoredManifests } from './manifests'
let tick = 0
const time = () => ({ clockEpochId: 'fixture', wallTimeMs: ++tick, monotonicMs: tick })
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function savedRoot(sessionId = 'selected', root = freshRoot()) {
  let r = createRecord({ version: DURABLE_VERSION, formId: 'BL1', repeat: false, device: 'fixture', created: time(), settings: { verbose: false, reducedMotion: false, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' }, identity: { installationId: root.installationId, sessionId, chainId: 'chain', stage: 'baseline', mapping: mappingFor('BL1'), ownershipGeneration: 1, exposureGeneration: 1 } })
  while (r.snapshot.phase !== 'completed') {
    if (['pending_exposure', 'awaiting_presentation'].includes(r.snapshot.phase)) { r = advance(r, { kind: 'arm' }, time()); r = advance(r, { kind: 'confirm' }, time()) }
    const c = r.snapshot.core, t = time(), action = { kind: c.status === 'resolved' ? 'next' as const : 'collect' as const, actionId: c.nextActionId, expectedRound: c.round, expectedRevision: c.revision, source: 'mouse' as const, time: t }
    r = advance(advance(r, { kind: 'action_pending', action }, t), { kind: 'action', action }, t)
  }
  root.records[sessionId] = r; return root
}
async function openGuideHistory() {
  await act(async () => {
    const summary = screen.getByText('Examples and saved results')
    if (!summary.closest('details')?.open) fireEvent.click(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Saved results' }))
  })
}

it.each(['healthy', 'deleted', 'replaced', 'navigation', 'fast', 'timeout'])('selected report authority: %s read preserves only the current selection', async kind => {
  let root = savedRoot(), frames: FrameRequestCallback[] = [], deliver: ((r: Root) => void) | undefined
  const read = vi.fn(async () => structuredClone(root))
  const store = { read, viewReport: async () => root.records.selected } as unknown as BalloonsStore
  vi.spyOn(BalloonsStore, 'open').mockResolvedValue(store)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_n: string, _o: unknown, cb: () => unknown) => Promise.resolve(cb()) } })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  await openGuideHistory()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open saved report' })) })
  const report = document.querySelector('.balloons-report'), bytes = JSON.stringify(root)
  expect(report).not.toBeNull()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  // Re-enter history to install its interval with the test clock.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Practise again' })) })
  await openGuideHistory()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open saved report' })) })
  const visible = document.querySelector('.balloons-report')
  if (kind !== 'fast') read.mockImplementationOnce(() => new Promise<Root>(r => { deliver = r }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  await act(async () => { for (let i = 0; i < 2; i++) { const f = frames.splice(0); for (const cb of f) cb(performance.now()) } })
  if (kind === 'fast') { expect(document.querySelector('.balloons-report')).toBe(visible); expect(JSON.stringify(root)).toBe(bytes); return }
  expect(document.querySelector('.balloons-report')).toBeNull()
  expect(screen.getByText('Checking saved history…')).toBeInTheDocument()
  if (kind === 'timeout') {
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    await act(async () => { deliver!(structuredClone(root)) })
    expect(document.querySelector('.balloons-report')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(document.querySelector('.balloons-report')).not.toBeNull()
    expect(JSON.stringify(root)).toBe(bytes); return
  }
  if (kind === 'deleted') delete root.records.selected
  if (kind === 'replaced') { root = freshRoot(); read.mockRejectedValue(new Error('installation replaced')) }
  if (kind === 'navigation') await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Practise again' })) })
  await act(async () => { deliver!(structuredClone(root)) })
  expect(!!document.querySelector('.balloons-report')).toBe(kind === 'healthy')
  if (kind === 'healthy') { expect(screen.getByText(/Form BL1/)).toBeInTheDocument(); expect(JSON.stringify(root)).toBe(bytes) }
  // Late navigation response cannot re-open a report on returning to history.
  if (kind === 'navigation') { await openGuideHistory(); expect(document.querySelector('.balloons-report')).toBeNull() }
})

it.each(['remaining', 'empty', 'all', 'failed-one', 'failed-all', 'leave'])('deletion focus waits for committed replacement history: %s', async kind => {
  let root = savedRoot()
  if (kind === 'remaining') savedRoot('other', root)
  let commit!: () => void, publish!: () => void
  const read = vi.fn(async () => structuredClone(root))
  const remove = vi.fn(() => new Promise<void>((resolve, reject) => { commit = () => {
    if (kind.startsWith('failed')) { reject(new Error('Injected deletion failure')); return }
    if (kind === 'all') root = freshRoot()
    else delete root.records.selected
    resolve()
  } }))
  const store = { read, delete: remove, deleteAll: remove } as unknown as BalloonsStore
  vi.spyOn(BalloonsStore, 'open').mockResolvedValue(store)
  vi.stubGlobal('BroadcastChannel', undefined)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_n: string, _o: unknown, cb: () => unknown) => Promise.resolve(cb()) } })
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  await openGuideHistory()
  const heading = screen.getByRole('heading', { name: 'Balloons history' })
  const control = kind.endsWith('all') ? screen.getByRole('button', { name: 'Delete all Balloons data' }) : screen.getAllByRole('button', { name: 'Delete this result' })[0]
  control.focus()
  await act(async () => { fireEvent.click(control) })
  expect(heading).not.toHaveFocus()
  expect(remove).toHaveBeenCalledTimes(1)
  read.mockImplementationOnce(() => new Promise<Root>(resolve => { publish = () => resolve(structuredClone(root)) }))
  await act(async () => { commit() })
  expect(heading).not.toHaveFocus()
  expect(screen.getByText('Checking saved history…')).toBeInTheDocument()
  if (kind === 'leave') await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Practise again' })) })
  await act(async () => { publish() })
  if (kind === 'leave') { expect(screen.getByRole('heading', { name: 'Balloons' })).toHaveFocus(); return }
  expect(heading).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent(kind.startsWith('failed') ? 'Deletion could not be confirmed' : kind === 'all' ? 'All Balloons data deleted' : 'Result deleted')
  expect(screen.getAllByRole('button', { name: 'Delete all Balloons data' })).toHaveLength(1)
  expect(document.querySelectorAll('.balloons-history-item')).toHaveLength(kind.startsWith('failed') || kind === 'remaining' ? 1 : 0)
  // Background history publication must not repeatedly restore focus.
  screen.getByRole('button', { name: 'Practise again' }).focus()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)) })
  expect(heading).not.toHaveFocus()
})
