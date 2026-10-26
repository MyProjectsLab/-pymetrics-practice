import { beforeEach, expect, it } from 'vitest'
import { loadArrowsForms, projectTrial } from './manifests'
import { advance, armHeadless, verifyHeadless } from './engine'
import { reconcileHeadless, summarizeTimes, contrastTimes } from './report'
import type { State } from './engine'
import type { Color, Condition, Direction, Form } from './contracts'
import { ArrowsStore, inspectArrowsRoot } from '../storage'
import type { ArrowsRoot, ArrowsBackend, ArmedAttempt } from '../storage'
import { installTestLocks, testProfile } from '../register-test-support'
import * as oldEngine from '../engine'
import * as oldReport from '../report'
import { loadArrowsForms as oldForms } from '../manifests'
import { authorityEqual } from '../authority'

beforeEach(() => { installTestLocks() })
const forms = await loadArrowsForms()
const identity = { installationId: 'install', sessionId: 'session', clockDomainId: 'clock' }
function complete(form: Form, response: (index: number) => number | null): State {
  let state = armHeadless(form, identity, testProfile, 0)
  for (let index = 1; index <= 135; index++) {
    if (index % 27 === 1) state = advance(state, { kind: index === 1 ? 'start' : 'continue', atMs: (state.commands.at(-1)?.atMs ?? 0) + 100, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
    const elapsed = response(index)
    if (elapsed !== null) {
      const code = form.trials[index - 1].direction === 'left' ? 'ArrowLeft' : 'ArrowRight'
      state = advance(state, { kind: 'keydown', atMs: state.onsetMs! + elapsed, code, repeat: false, modified: false })
      state = advance(state, { kind: 'keyup', atMs: state.onsetMs! + elapsed, code })
    }
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
  }
  return state
}
it('projects all ten legal rows, including four red side arrows and horizontal black bars', () => {
  for (const color of ['red', 'blue', 'black'] as Color[]) for (const direction of ['left', 'right'] as Direction[]) {
    const other = direction === 'left' ? 'right' : 'left'
    for (const condition of (color === 'black' ? ['neutral'] : ['aligned', 'opposed']) as Condition[]) {
      const trial = { color, condition, direction, rule: color === 'red' ? 'sides' as const : 'middle' as const, block: 1, index: 1 }
      const expected = color === 'black' ? ['bar', 'bar', direction, 'bar', 'bar'] : condition === 'aligned' ? [direction, direction, direction, direction, direction] : color === 'red' ? [direction, direction, other, direction, direction] : [other, other, direction, other, other]
      expect(projectTrial(trial).symbols).toEqual(expected)
      expect(projectTrial(trial).targetPositions).toEqual(color === 'red' ? [1, 2, 4, 5] : [3])
      expect(() => projectTrial({ ...trial, rule: color === 'red' ? 'middle' : 'sides' })).toThrow()
    }
  }
})
it('reconciles 135/135, 62/54/19 and exactly four breaks with final 135 terminal', () => {
  const state = complete(forms.get('AR11-1')!, () => 300), review = reconcileHeadless(state)
  expect(review.status).toBe('complete_headless')
  expect(review.metrics?.overall).toMatchObject({ correct: 135, wrong: 0, omitted: 0, denominator: 135, time: { cleanCount: 135, medianMs: 300, iqrMs: 0 } })
  expect(Object.values(review.metrics!.byCondition).map(row => [row.correct, row.denominator])).toEqual([[62, 62], [54, 54], [19, 19]])
  expect(Object.values(review.metrics!.byColor).map(row => row.denominator)).toEqual([58, 58, 19])
  expect(review.metrics!.switch.denominator + review.metrics!.stay.denominator).toBe(130)
  expect(state.events.filter(e => e.type === 'block_summary_ready').map(e => e.trialIndex)).toEqual([27, 54, 81, 108])
  expect(state.events.filter(e => e.type === 'session_completed').map(e => e.trialIndex)).toEqual([135])
  for (const index of [1, 28, 55, 82, 109]) {
    const fixation = state.events.find(e => e.type === 'fixation_confirmed' && e.trialIndex === index)!
    const onset = state.events.find(e => e.type === 'stimulus_presented' && e.trialIndex === index)!
    expect(onset.atMs - fixation.atMs).toBe(800)
  }
  expect(() => advance(state, { kind: 'continue', atMs: state.commands.at(-1)!.atMs, responseHeld: false })).toThrow()
  const changed = structuredClone(state); (changed.events.find(e => e.type === 'stimulus_presented')!.detail as Record<string, unknown>).symbols = '["left"]'
  expect(verifyHeadless(changed)).toBe(false)
  expect(() => reconcileHeadless(changed)).toThrow()
})
it('reports exactly four aligned clean responses and 131 actual omissions without fabricated timing', () => {
  const form = forms.get('AR11-1')!, selected = new Set(form.trials.filter(t => t.condition === 'aligned').slice(0, 4).map(t => t.index))
  const metrics = reconcileHeadless(complete(form, index => selected.has(index) ? 300 : null)).metrics!
  expect(metrics.overall).toMatchObject({ correct: 4, wrong: 0, omitted: 131, denominator: 135, time: { cleanCount: 4, medianMs: null, iqrMs: null } })
  expect(Object.values(metrics.byCondition).map(row => [row.correct, row.denominator])).toEqual([[4, 62], [0, 54], [0, 19]])
  expect(metrics.switchMinusStayMs).toBeNull(); expect(metrics.opposedMinusAlignedMs).toBeNull()
})
it('excludes exact final deadline input and retains onset evidence before invalidation', () => {
  const state = complete(forms.get('AR11-1')!, index => index === 135 ? 1500 : 300)
  expect(reconcileHeadless(state).metrics!.overall).toMatchObject({ correct: 134, omitted: 1 })
  expect(state.events.filter(e => e.type === 'boundary_extra' && e.trialIndex === 135)).toHaveLength(1)
  let partial = armHeadless(forms.get('AR11-1')!, identity, testProfile, 0)
  partial = advance(partial, { kind: 'start', atMs: 0, responseHeld: false }); partial = advance(partial, { kind: 'fixation', atMs: 0 })
  partial = advance(partial, { kind: 'onset', atMs: 1051 })
  expect(partial.phase).toBe('invalid'); expect(reconcileHeadless(partial)).toMatchObject({ presented: 1, closed: 0, unresolvedPresented: 1, unpresented: 134, metrics: null })
})
it('retains n=5/7/8 and 9/10 contrast thresholds and raw rounding', () => {
  expect(summarizeTimes([100, 200, 300, 400, 500])).toMatchObject({ medianMs: 300, iqrMs: null })
  expect(summarizeTimes([100, 200, 300, 400, 500, 600, 700])).toMatchObject({ medianMs: 400, iqrMs: null })
  expect(summarizeTimes([100, 200, 300, 400, 500, 600, 700, 800])).toMatchObject({ medianMs: 450, iqrMs: 400 })
  expect(contrastTimes(summarizeTimes(Array(9).fill(300.49)), summarizeTimes(Array(10).fill(299.51)))).toBeNull()
  expect(contrastTimes(summarizeTimes(Array(10).fill(300.49)), summarizeTimes(Array(10).fill(299.51)))).toBe(1)
})
class Backend implements ArrowsBackend {
  root: ArrowsRoot
  constructor(root: ArrowsRoot) { this.root = root }
  failure = false; lost = false
  async read() { return structuredClone(this.root) }
  async change<T>(work: (root: ArrowsRoot) => T) { if (this.failure) throw Error('failure'); const next = structuredClone(this.root), value = work(next); this.root = next; if (this.lost) throw Error('lost'); return value }
}
async function historical(): Promise<ArrowsRoot> {
  const inventory = await oldForms(), attempts: Record<string, ArmedAttempt> = {}
  for (let ordinal = 1; ordinal <= 4; ordinal++) {
    const id = `old-${ordinal}`, form = inventory.get(`AR${ordinal}` as oldEngine.State['form']['id'])!
    const armed = oldEngine.armHeadless(form, { installationId: 'install', sessionId: id, clockDomainId: `clock-${id}` }, testProfile, 0)
    let state = armed
    const attempt: ArmedAttempt = { requestId: `request-${id}`, sessionId: id, clockDomainId: `clock-${id}`, profile: testProfile, ordinal, createdAtWallMs: ordinal, state: armed }
    if (ordinal > 1) {
      for (let index = 1; index <= (ordinal === 3 ? 120 : 24); index++) {
        if (index % 24 === 1) state = oldEngine.advance(state, { kind: index === 1 ? 'start' : 'continue', atMs: (state.commands.at(-1)?.atMs ?? 0) + 100, responseHeld: false })
        state = oldEngine.advance(state, { kind: 'fixation', atMs: state.fixationDueMs! }); state = oldEngine.advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
        state = oldEngine.advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! }); state = oldEngine.advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
      }
      if (ordinal === 4) state = oldEngine.advance(state, { kind: 'invalidate', atMs: state.commands.at(-1)!.atMs, reason: 'settings' })
      attempts[id] = { ...attempt, snapshot: { revision: ordinal, kind: ordinal === 2 ? 'checkpoint' : 'terminal', closedTrials: ordinal === 3 ? 120 : 24, state, review: oldReport.reconcileHeadless(state) } }
    } else attempts[id] = attempt
  }
  return { version: 'arrows_storage_v1', installationId: 'install', revision: 7, scoredStartCount: 5, attempts, tombstones: { 'old-deleted': 2000 } }
}
const start = { requestId: 'new-request', sessionId: 'new-session', clockDomainId: 'new-clock', profile: testProfile, atMs: 0, wallMs: 9000 }
for (const withActivity of [false, true]) it(`migrates all V1 snapshot kinds, ${withActivity ? 'present' : 'absent'} activity, and numeric tombstones without rebuilding any old byte`, async () => {
  const root = await historical()
  if (withActivity) root.activity = { 'old-3': { version: 'arrows_activity_v1', installationId: 'install', sessionId: 'old-3', resultRevision: 3, events: [{ version: 'arrows_activity_v1', type: 'report_viewed', sequenceNumber: 1, installationId: 'install', sessionId: 'old-3', viewId: 'old-view', sourceSurface: 'history', observedWallMs: 8000 }] } }
  const before = structuredClone(root), backend = new Backend(root), store = new ArrowsStore(backend, 'install')
  await inspectArrowsRoot(root)
  const old = await store.listAttempts()
  const arm = await store.start(start)
  expect(arm.state.form.id).toBe('AR11-1'); expect(arm.ordinal).toBe(1)
  expect(backend.root).toMatchObject({ version: 'arrows_storage_v2', revision: 9, scoredStartCount: 5, scoredStartCountV11: 1 })
  expect(backend.root.tombstones).toEqual(before.tombstones); expect(Object.hasOwn(backend.root, 'activity')).toBe(withActivity)
  for (const [id, attempt] of Object.entries(before.attempts)) expect(JSON.stringify(backend.root.attempts[id])).toBe(JSON.stringify(attempt))
  expect(authorityEqual(backend.root.activity, before.activity)).toBe(true)
  expect((await store.listAttempts()).filter(a => a.state.specificationVersion === 'arrows_spec_v1_0')).toEqual(old)
  await store.start(start); expect(backend.root.scoredStartCountV11).toBe(1)
  await expect(store.start({ ...start, requestId: 'request-old-1', sessionId: 'old-1' })).rejects.toThrow('start request identity changed')
  await store.deleteAttempt('old-1'); await store.deleteAttempt('new-session')
  expect(typeof backend.root.tombstones['old-1']).toBe('number')
  expect(backend.root.tombstones['new-session']).toMatchObject({ version: 'arrows_spec_v1_1', ordinal: 1, requestId: start.requestId })
  await inspectArrowsRoot(backend.root)
})
for (const fault of ['corrupt', 'exhausted', 'failed', 'lost'] as const) it(`migration ${fault} preserves bytes or confirms exact committed readback`, async () => {
  const root = await historical(), backend = new Backend(root), store = new ArrowsStore(backend, 'install')
  if (fault === 'corrupt') root.attempts['old-1'] = { ...root.attempts['old-1'], ordinal: 6 }
  if (fault === 'exhausted') root.revision = Number.MAX_SAFE_INTEGER
  backend.failure = fault === 'failed'; backend.lost = fault === 'lost'
  const before = structuredClone(root)
  if (fault === 'lost') { const arm = await store.start(start); expect(arm.state.form.id).toBe('AR11-1'); expect(backend.root.revision).toBe(9) }
  else { await expect(store.start(start)).rejects.toThrow(); expect(authorityEqual(backend.root, before)).toBe(true) }
})
it('migrates an empty V1 installation once and starts the independent six-form rotation', async () => {
  const backend = new Backend({ version: 'arrows_storage_v1', installationId: 'install', revision: 0, scoredStartCount: 0, attempts: {}, tombstones: {} })
  const store = new ArrowsStore(backend, 'install')
  for (let index = 0; index < 7; index++) {
    const arm = await store.start({ ...start, requestId: `new-${index}`, sessionId: `session-${index}`, clockDomainId: `clock-${index}` })
    expect(arm.state.form.id).toBe(`AR11-${index % 6 + 1}`)
    expect(backend.root.revision).toBe(index + 2)
    expect(backend.root.scoredStartCount).toBe(0)
  }
  const malformed = structuredClone(backend.root)
  malformed.attempts['session-1'] = { ...malformed.attempts['session-1'], ordinal: 1 }
  await expect(inspectArrowsRoot(malformed)).rejects.toThrow()
  const downgrade = structuredClone(backend.root); downgrade.version = 'arrows_storage_v1'; delete downgrade.scoredStartCountV11
  await expect(inspectArrowsRoot(downgrade)).rejects.toThrow()
})
it('does not migrate while the same live ownership domain holds a V1 run', async () => {
  const { ArrowsEntry, ARROWS_LIVE_LOCK } = await import('../entry')
  const { vi } = await import('vitest')
  const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  let release!: () => void, acquired!: () => void
  const ready = new Promise<void>(resolve => { acquired = resolve })
  const holding = navigator.locks.request(ARROWS_LIVE_LOCK, {}, async () => { acquired(); await new Promise<void>(resolve => { release = resolve }) })
  await ready
  const root = await historical(), before = structuredClone(root), backend = new Backend(root), entry = new ArrowsEntry(new ArrowsStore(backend, 'install'))
  await expect(entry.begin(start)).rejects.toThrow('active in another tab')
  expect(authorityEqual(backend.root, before)).toBe(true)
  release(); await holding
  const arm = await entry.begin(start); expect(arm.state.form.id).toBe('AR11-1'); entry.release(); focus.mockRestore()
})
it('canceled migration delivery cannot arm a late result and retry never migrates twice', async () => {
  const root = await historical(), backend = new Backend(root), store = new ArrowsStore(backend, 'install'), controller = new AbortController()
  let release!: () => void, committed!: () => void
  const ready = new Promise<void>(resolve => { committed = resolve })
  const original = backend.change.bind(backend)
  backend.change = async function<T>(work: (root: ArrowsRoot) => T) { const value = await original(work); committed(); await new Promise<void>(resolve => { release = resolve }); return value }
  const pending = store.start(start, controller.signal); const rejected = expect(pending).rejects.toThrow()
  await ready; controller.abort(); await rejected
  expect(backend.root.version).toBe('arrows_storage_v2'); expect(backend.root.revision).toBe(8); expect(backend.root.scoredStartCountV11).toBe(0)
  backend.change = original; release()
  const arm = await store.start(start); expect(arm.ordinal).toBe(1); expect(backend.root.revision).toBe(9)
})
it('keeps the first wrong action final and suppresses held/repeated actions across onset', () => {
  const form = forms.get('AR11-1')!, target = form.trials[0].direction === 'left' ? 'ArrowLeft' : 'ArrowRight', opposite = target === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'
  let state = armHeadless(form, identity, testProfile, 0)
  state = advance(state, { kind: 'start', atMs: 0, responseHeld: false }); state = advance(state, { kind: 'fixation', atMs: 0 })
  state = advance(state, { kind: 'keydown', atMs: 100, code: target, repeat: false, modified: false })
  state = advance(state, { kind: 'onset', atMs: 800 })
  state = advance(state, { kind: 'keydown', atMs: 900, code: target, repeat: false, modified: false })
  state = advance(state, { kind: 'keydown', atMs: 950, code: target, repeat: true, modified: false })
  expect(state.firstResponse).toBeNull()
  state = advance(state, { kind: 'keyup', atMs: 1000, code: target })
  state = advance(state, { kind: 'keydown', atMs: 1020, code: opposite, repeat: false, modified: false })
  state = advance(state, { kind: 'keyup', atMs: 1100, code: opposite })
  state = advance(state, { kind: 'keydown', atMs: 1210, code: target, repeat: false, modified: false })
  expect(state.firstResponse?.direction).toBe(form.trials[0].direction === 'left' ? 'right' : 'left')
  expect(state.events.filter(e => e.type === 'response')).toHaveLength(1); expect(state.events.filter(e => e.type === 'response_extra')).toHaveLength(1)
})
it('serializes primary pointer press/release, rejects a second pointer, and treats click as no command', () => {
  const form = forms.get('AR11-1')!, profile = { kind: 'pointer' as const, pointerSource: 'mouse' as const, alternative: false, accommodation: 'default', reducedMotion: false }
  let state = armHeadless(form, identity, profile, 0)
  state = advance(state, { kind: 'start', atMs: 0, responseHeld: false }); state = advance(state, { kind: 'fixation', atMs: 0 }); state = advance(state, { kind: 'onset', atMs: 800 })
  state = advance(state, { kind: 'pointerdown', atMs: 1000, direction: form.trials[0].direction, pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true })
  state = advance(state, { kind: 'pointerdown', atMs: 1100, direction: 'left', pointerId: 2, pointerType: 'mouse', button: 0, isPrimary: true })
  expect(state.events.filter(e => e.type === 'response')).toHaveLength(1); expect(state.events.at(-1)?.detail.reason).toBe('multiple_or_held')
  expect(() => advance(state, { kind: 'click', atMs: 1200 } as never)).toThrow()
})
it('rejects mixed version state, missing onset, duplicate onset and changed color or answer evidence', () => {
  const state = complete(forms.get('AR11-1')!, () => 300)
  for (const changed of ['version', 'missing', 'duplicate', 'color', 'answer']) {
    const copy = structuredClone(state), onset = copy.events.find(e => e.type === 'stimulus_presented')!
    if (changed === 'version') (copy as unknown as { eventVersion: string }).eventVersion = 'arrows_event_v1'
    if (changed === 'missing') (copy as unknown as { events: unknown[] }).events = copy.events.filter(e => e !== onset)
    if (changed === 'duplicate') (copy as unknown as { events: unknown[] }).events = [...copy.events, onset]
    if (changed === 'color' || changed === 'answer') (onset.detail as Record<string, unknown>)[changed === 'color' ? 'color' : 'direction'] = 'invalid'
    expect(verifyHeadless(copy)).toBe(false)
  }
})
it('a V1 observer may first receive the legal V2 root after migration plus later arming', async () => {
  const root = await historical(), lateBackend = new Backend(structuredClone(root)), migratedBackend = new Backend(structuredClone(root))
  const late = new ArrowsStore(lateBackend, 'install'), current = new ArrowsStore(migratedBackend, 'install')
  await late.read(); const historicalArm = (await late.listAttempts()).find(a => a.sessionId === 'old-3')!, handle = late.authority.published(historicalArm)
  await current.start(start)
  lateBackend.root = structuredClone(migratedBackend.root)
  await late.read(); expect(late.authority.register().integrity).toBe('verified'); expect(handle.status().kind).toBe('current')
})
