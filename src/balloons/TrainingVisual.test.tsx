import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests, verifiedDrillManifest } from './drill-manifests'
import { baseline, ref } from './training-test-support'
import { routeBaseline } from './router'
import { createTrainingChain } from './training-eligibility'
import { createDrillAttempt, transitionDrill } from './drills'
import { TrainingJourney } from './TrainingJourney'
import { assignTraining } from './training-storage'
import type { BalloonsStore } from './storage'

vi.mock('./training-storage', async original => ({
  ...await original<typeof import('./training-storage')>(),
  acquireTrainingOwner: async () => ({ id: 'visual-owner', token: null, live: true, release() {} }),
  assignTraining: vi.fn(),
}))
beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  await loadScoredManifests(); await loadDrillManifests()
})
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => Promise.resolve(callback({})) } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

it.each([6, 12, 18])('retains the actual committed balloon at drill feedback boundary %i without adding an extra Next action', async boundary => {
  const root = baseline('BL1', () => 0), rec = routeBaseline(root, ref, [])
  if (rec.status !== 'recommended') throw Error('No fixture recommendation')
  const chain = createTrainingChain(rec)
  let tick = 10000
  const time = () => ({ wallTimeMs: tick, monotonicMs: tick++, clockEpochId: 'visual-drill' })
  let attempt = createDrillAttempt(rec, verifiedDrillManifest('D-maintenance')!, 'visual-drill', [], time())
  while (attempt.snapshot.results.length < boundary) {
    const s = attempt.snapshot
    const kind = s.phase === 'ready' ? 'start' : s.phase === 'active' ? s.successfulPumps < 1 ? 'pump' : 'collect' : 'next'
    const next = transitionDrill(attempt, { kind, actionId: s.nextActionId, expectedRevision: s.revision, expectedRound: s.round, source: 'mouse', time: time() })
    if (!next.accepted) throw Error('Illegal fixture transition')
    attempt = next.state
  }
  expect(attempt.snapshot.phase).toBe(boundary === 18 ? 'completed' : 'feedback')
  vi.mocked(assignTraining).mockResolvedValue({ chain, attempt, retest: null, eligible: false, firstCompleted: false })
  let container!: HTMLElement
  await act(async () => { container = render(<TrainingJourney store={{} as BalloonsStore} baselineSessionId="base" onHistory={() => {}} />).container })
  const last = attempt.snapshot.results.at(-1)!
  expect(container.querySelector('[data-balloon-type]')?.textContent).toBe(last.visibleType)
  expect(container.querySelector('.balloon-art')?.getAttribute('data-successful-pumps')).toBe(String(last.successfulPumps))
  expect(container.querySelector('.balloon-art')?.getAttribute('data-outcome')).toBe(last.outcome)
  expect(screen.queryByRole('button', { name: 'Next balloon' })).toBeNull()
  if (boundary === 18) expect(screen.queryByRole('button', { name: 'Continue exercise' })).toBeNull()
  else expect(screen.getByRole('button', { name: 'Continue exercise' })).toBeEnabled()
})
