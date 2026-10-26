import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsBrowserRun } from './browser'
import { advance, armHeadless, loadArrowsForms } from './versions'
import type { InputProfile, State } from './versions'
import type { ArrowsEntry } from './entry'

const forms = await loadArrowsForms()
const keyboard: InputProfile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false, accommodation: 'default', reducedMotion: false }
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function fixture(pointer = false) {
  const profile: InputProfile = pointer ? { kind: 'pointer', pointerSource: 'mouse', alternative: false, accommodation: 'default', reducedMotion: false } : keyboard
  let state = armHeadless(forms.get('AR11-1')!, { installationId: 'i', sessionId: 's', clockDomainId: 'c' }, profile, 0)
  state = advance(state, { kind: 'start', atMs: 0, responseHeld: false })
  state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
  state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
  let now = state.onsetMs! + 100
  const host = document.createElement('div')
  const run = new ArrowsBrowserRun({ release() {} } as ArrowsEntry, host, () => {}, () => now)
  const internal = run as unknown as { state: State; protectedBlock: boolean; displayMatches(stage: string): boolean; resolve(): void; monitor(): void; pointerdown(event: PointerEvent): void }
  internal.state = state; internal.protectedBlock = true
  vi.spyOn(run, 'layoutReady').mockReturnValue(true)
  const presentation = vi.spyOn(internal, 'displayMatches').mockReturnValue(false)
  const verify = () => {
    expect(run.snapshot()?.phase).toBe('invalid')
    expect(run.snapshot()?.invalidReason).toBe('viewport')
    expect(run.snapshot()?.events.filter(e => e.type === 'stimulus_presented')).toHaveLength(1)
    expect(run.snapshot()?.events.filter(e => e.type === 'trial_closed')).toHaveLength(0)
    expect(run.snapshot()?.commands.some(c => c.kind === 'keydown' || c.kind === 'pointerdown' || c.kind === 'resolve')).toBe(false)
    run.dispose()
  }
  return { run, internal, host, state, presentation, verify, setNow: (value: number) => { now = value } }
}
it('rejects an altered admitted row before keyboard input even before another frame', () => {
  const f = fixture()
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))
  f.verify()
})
it('rejects an altered admitted row before pointer input', () => {
  const f = fixture(true), button = document.createElement('button')
  button.dataset.direction = 'right'; f.host.append(button)
  f.internal.pointerdown({ target: button, pointerType: 'mouse', button: 0, pointerId: 1, isPrimary: true, preventDefault() {} } as unknown as PointerEvent)
  f.verify()
})
it('cannot close an altered admitted row if the resolution timer wins the next-frame race', () => {
  vi.useFakeTimers()
  const f = fixture(); f.internal.resolve(); f.setNow(f.state.resolutionDueMs!)
  vi.advanceTimersByTime(1500)
  f.verify()
})
it('checks active presentation on a protected frame and retains its truthful onset', () => {
  let frame: FrameRequestCallback | undefined
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
  const f = fixture(); f.internal.monitor(); frame!(0)
  f.verify()
})

it('samples the input handler time before presentation work can cross the deadline', () => {
  const f = fixture(), at = f.state.resolutionDueMs! - 1
  f.setNow(at)
  f.presentation.mockImplementation(() => { f.setNow(at + 5); return true })
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))
  expect(f.run.snapshot()?.events.find(e => e.type === 'response')?.atMs).toBe(at)
  expect(f.run.snapshot()?.phase).toBe('stimulus')
  f.run.dispose()
})
