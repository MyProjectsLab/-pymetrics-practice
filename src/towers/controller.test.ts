import { describe, expect, it, vi } from 'vitest'
import { TowersAttempt } from './controller'

describe('Towers attempt lifetime', () => {
  it('latches lifecycle loss before a run or clock anchor exists', () => {
    const onRevoke = vi.fn()
    const attempt = new TowersAttempt('run', 'doc', 1, onRevoke)
    window.dispatchEvent(new Event('pagehide'))
    expect(attempt.revoked).toMatchObject({ reason: 'Page left during play', elapsedMs: null })
    expect(attempt.active).toBe(false)
    attempt.revoke('late owner loss')
    expect(onRevoke).toHaveBeenCalledTimes(1)
    attempt.stop()
  })

  it('preserves the first captured revocation across later signals', () => {
    const onRevoke = vi.fn()
    const attempt = new TowersAttempt('run', 'doc', 1, onRevoke)
    attempt.setAnchor(performance.now() - 2000)
    const first = attempt.revoke('board removed')
    expect(first?.elapsedMs).toBeGreaterThanOrEqual(2000)
    expect(attempt.revoke('page hidden')).toEqual(first)
    expect(onRevoke).toHaveBeenCalledTimes(1)
    attempt.stop()
  })
})
