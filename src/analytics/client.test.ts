import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsClient } from './client'
import { emptyEvents } from './contract'
const firstId = 'ac759a7e-9e32-4d13-8d77-9410e497b68c'
const secondId = 'f2fcbe11-54bf-466d-a291-dbe6cffae311'
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
const tick = () => vi.advanceTimersByTimeAsync(100)
describe('page-memory consent and independent transport', () => {
  it('default build remains disabled even if consent is requested', async () => {
    const send = vi.fn(), randomId = vi.fn(() => firstId), client = createAnalyticsClient({ send, randomId })
    client.setConsent(true); for (const event of emptyEvents) client.emit({ event }); await tick()
    expect(client.consented()).toBe(false); expect(send).not.toHaveBeenCalled(); expect(randomId).not.toHaveBeenCalled()
  })
  it('pre-consent silence and decline discard events without retroactive collection', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 })), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.emit({ event: 'stop_guide_opened' }); client.setConsent(false); client.emit({ event: 'stop_drill_started' }); await tick()
    client.setConsent(true); await tick(); expect(send).not.toHaveBeenCalled()
    client.emit({ event: 'stop_report_viewed' }); await tick(); expect(send).toHaveBeenCalledOnce()
  })
  it('uses only a relative endpoint, omit credentials, no referrer, no redirects and no local task ids or clocks', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 })), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    const local = vi.spyOn(Storage.prototype, 'setItem'), cookie = vi.spyOn(document, 'cookie', 'set')
    client.setConsent(true); client.emit({ event: 'stop_session_started', mode: 'baseline' }); await tick()
    expect(send).toHaveBeenCalledWith('/api/stop-analytics', expect.objectContaining({ credentials: 'omit', mode: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' }))
    expect(JSON.parse(send.mock.calls[0][1]!.body as string)).toEqual({ event: 'stop_session_started', mode: 'baseline', session_id: firstId })
    expect(local).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled()
  })
  it('withdrawal aborts in-flight requests, discards queued events, and reconsent rotates the id', async () => {
    const send = vi.fn<typeof fetch>(() => new Promise(() => {})), randomId = vi.fn().mockReturnValueOnce(firstId).mockReturnValueOnce(secondId)
    const client = createAnalyticsClient({ available: true, send, randomId })
    client.setConsent(true); client.emit({ event: 'stop_guide_opened' }); await tick()
    const signal = send.mock.calls[0][1]!.signal!
    client.emit({ event: 'stop_report_viewed' }); client.setConsent(false); await tick()
    expect(signal.aborted).toBe(true); expect(send).toHaveBeenCalledOnce()
    client.setConsent(true); await tick(); expect(send).toHaveBeenCalledOnce()
    client.emit({ event: 'stop_drill_started' }); await tick()
    expect(JSON.parse(send.mock.calls[1][1]!.body as string).session_id).toBe(secondId)
    client.setConsent(false)
  })
  it('holds sending through timed work and pending local save; resumes only when kicked after safe transition', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 })), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.setConsent(true); let timed = true, saving = false
    const release = client.hold(() => timed || saving)
    client.emit({ event: 'stop_session_started', mode: 'retest' }); await tick(); expect(send).not.toHaveBeenCalled()
    timed = false; saving = true; client.emit({ event: 'stop_session_ended', status: 'completed' }); await tick(); expect(send).not.toHaveBeenCalled()
    saving = false; client.kick(); await tick(); expect(send).toHaveBeenCalledTimes(2); release()
  })
  it('unmounting keeps a pending-save hold until a later safe UI transition', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    const client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.setConsent(true); let pending = true
    const release = client.hold(() => pending)
    client.emit({ event: 'stop_session_ended', status: 'completed' }); release(); await tick()
    expect(send).not.toHaveBeenCalled()
    pending = false; client.kick(); await tick(); expect(send).toHaveBeenCalledOnce()
  })
  it('entering timed work cancels an already scheduled or in-flight send', async () => {
    const send = vi.fn<typeof fetch>(() => new Promise(() => {})), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.setConsent(true); client.emit({ event: 'stop_guide_opened' }); let busy = true; const release = client.hold(() => busy)
    await tick(); expect(send).not.toHaveBeenCalled(); busy = false; release(); await tick(); expect(send).toHaveBeenCalledOnce()
    const done = client.hold(() => true); expect(send.mock.calls[0][1]!.signal!.aborted).toBe(true)
    done(); client.setConsent(false)
  })
  it.each(['reject', 'throw', '500', '403', 'hang'])('network %s cannot affect product state, retry or log', async kind => {
    const send = vi.fn<typeof fetch>(() => {
      if (kind === 'throw') throw new Error('private network error')
      if (kind === 'reject') return Promise.reject(new Error('private network error'))
      if (kind === 'hang') return new Promise(() => {})
      return Promise.resolve(new Response(null, { status: Number(kind) }))
    })
    const log = vi.spyOn(console, 'error'), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.setConsent(true); client.emit({ event: 'stop_report_viewed' }); await vi.advanceTimersByTimeAsync(10000)
    expect(send).toHaveBeenCalledOnce(); expect(log).not.toHaveBeenCalled(); expect(client.consented()).toBe(true)
    if (kind === 'hang') expect(send.mock.calls[0][1]!.signal!.aborted).toBe(true)
    client.setConsent(false)
  })
  it('caps the ephemeral queue and rejects prohibited fields even through an untyped caller', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 })), client = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    client.setConsent(true); let busy = true; const release = client.hold(() => busy)
    client.emit({ event: 'stop_guide_opened', score: 90 } as never)
    for (let i = 0; i < 100; i++) client.emit({ event: 'stop_report_viewed' })
    busy = false; release(); await tick(); expect(send).toHaveBeenCalledTimes(64)
  })
  it('a new page client starts off and gets a different id, without previous events', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    const a = createAnalyticsClient({ available: true, send, randomId: () => firstId })
    a.setConsent(true); a.emit({ event: 'stop_guide_opened' }); await tick()
    const b = createAnalyticsClient({ available: true, send, randomId: () => secondId })
    expect(b.consented()).toBe(false); b.emit({ event: 'stop_report_viewed' }); await tick(); expect(send).toHaveBeenCalledOnce()
    b.setConsent(true); b.emit({ event: 'stop_guide_opened' }); await tick()
    expect(JSON.parse(send.mock.calls[1][1]!.body as string).session_id).not.toBe(firstId)
  })
})
