import { afterEach, describe, expect, it, vi } from 'vitest'
import { LengthsBrowserRun } from './browser'
import { advance, armHeadless } from './engine'
import type { InputProfile } from './engine'
import type { LengthsEntry } from './entry'
import { loadLengthsForms } from './manifests'

const form = (await loadLengthsForms()).get('LS1')!
const profile: InputProfile = { kind: 'keyboard', variant: 'standard', deviceClass: 'desktop_or_laptop',
  leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  contrast: 'dark_on_light', magnification: 'none', reducedMotion: false }

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('Lengths browser stage watchdog', () => {
  it('retires a visible stimulus when resolution delivery is missing and ignores its late callback', () => {
    vi.useFakeTimers()
    vi.setSystemTime(600)
    let state = armHeadless(form, { installationId: 'installation', sessionId: 'session',
      clockDomainId: 'clock', route: 'standalone' }, profile, 0)
    state = advance(state, { kind: 'start', atMs: 0, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: 0 })
    state = advance(state, { kind: 'onset', atMs: 600 })
    expect(state.resolutionDueMs).toBe(2000)

    const host = document.createElement('div')
    host.innerHTML = '<svg><rect data-lengths-bar></rect><rect data-lengths-bar></rect></svg>'
    document.body.append(host)
    const release = vi.fn()
    const run = new LengthsBrowserRun({ release } as unknown as LengthsEntry, host, () => {}, () => Date.now())
    Object.assign(run, { state, protectedBlock: true })
    const scheduled = vi.spyOn(window, 'setTimeout')
    ;(run as unknown as { resolve(): void }).resolve()
    const resolution = scheduled.mock.calls.findIndex(([, delay]) => delay === 1400)
    expect(resolution).toBeGreaterThanOrEqual(0)
    const lateCallback = scheduled.mock.calls[resolution][0] as () => void
    clearTimeout(scheduled.mock.results[resolution].value as number)

    vi.advanceTimersByTime(3400)
    expect(run.snapshot()).toMatchObject({ phase: 'invalid', invalidReason: 'watchdog' })
    expect(run.snapshot()?.events.at(-1)).toMatchObject({ type: 'invalidated', atMs: 4000 })
    expect(host.querySelectorAll('[data-lengths-bar]')).toHaveLength(0)
    expect(release).toHaveBeenCalledTimes(1)
    const events = JSON.stringify(run.snapshot()?.events)
    lateCallback()
    expect(JSON.stringify(run.snapshot()?.events)).toBe(events)
    expect(release).toHaveBeenCalledTimes(1)
    run.dispose(); host.remove()
  })
})
