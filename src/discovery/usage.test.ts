import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COLLECTION_ENDPOINT, createMarketingUsage, type UsageContext } from './usage'

const id = '00000000-0000-4000-8000-000000000001' // Intercepted test only; not a live site.
const initial = (): UsageContext => ({ protocol: 'https:', hostname: 'traitgame.com', pathname: '/', search: '', visible: true, dnt: false, gpc: false })
function fixture(patch: Partial<UsageContext> = {}) {
  const ctx = { ...initial(), ...patch }
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
  return { ctx, send, client: createMarketingUsage(id, () => ctx, send) }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('marketing usage admission and minimisation', () => {
  it('sends nothing before startup or while paused; missing configuration stays disabled', () => {
    const { client, send } = fixture()
    client.selection('/practice/stop'); client.pause()
    const missing = createMarketingUsage('', initial, send); missing.start()
    expect(client.active()).toBe(false); expect(missing.available()).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it.each(['/practice', '/practice/stop', '/mock', '/mock/report', '/arrows.html', '/mouth-v13.html', '/faces.html', '/money.html', '/money2.html', '/privacy.html', '/unknown', '/__proto__'])('cannot collect on excluded document %s', pathname => {
    const { client, send } = fixture({ pathname }); client.start(); client.selection('/practice')
    expect(client.available()).toBe(false); expect(send).not.toHaveBeenCalled()
  })
  it.each([{ dnt: true }, { gpc: true }, { visible: false }, { search: '?mockId=secret' }, { hostname: 'traitgame-lexzilla1s-projects.vercel.app' }, { protocol: 'http:' }])('denies privacy or unsafe context %j', patch => {
    const { client, send } = fixture(patch); client.start()
    expect(send).not.toHaveBeenCalled(); expect(client.active()).toBe(false)
  })
  it('only sends the approved neutral page body and restrictive fetch options', () => {
    const { client, send } = fixture({ pathname: '/blackstone-pymetrics.html' }); client.start()
    expect(send).toHaveBeenCalledTimes(1)
    const [endpoint, options] = send.mock.calls[0]
    expect(endpoint).toBe(COLLECTION_ENDPOINT)
    expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' })
    expect(options?.keepalive).toBeUndefined()
    expect(JSON.parse(String(options?.body))).toEqual({ type: 'event', payload: { website: id, hostname: 'traitgame.com', url: '/info/2' } })
    expect(String(options?.body)).not.toMatch(/Blackstone|pymetrics|referrer|id":|title|score|answer|language|screen/i)
  })
  it('supports only fixed selection events after the current flight settles', async () => {
    const { client, send } = fixture(); client.start()
    await vi.runAllTimersAsync()
    client.selection('/practice?email=private'); client.selection('/evil'); client.selection('/__proto__')
    expect(send).toHaveBeenCalledTimes(1)
    client.selection('/practice/stop')
    expect(JSON.parse(String(send.mock.calls[1][1]?.body)).payload).toEqual({ website: id, hostname: 'traitgame.com', url: '/', name: 'stop_selected' })
  })
  it('has one flight, no queue and no retries after a held request is retired', async () => {
    const { client, send } = fixture()
    let finish!: (r: Response) => void
    send.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    client.start(); client.selection('/practice/stop')
    const signal = send.mock.calls[0][1]?.signal
    client.retire(); expect(signal?.aborted).toBe(true)
    finish(new Response('{}')); await vi.runAllTimersAsync()
    client.start(); client.selection('/mock')
    expect(send).toHaveBeenCalledTimes(1); expect(client.active()).toBe(false)
  })
  it('pauses immediately, ignores provider identifiers and resumes without another view', async () => {
    const { client, send } = fixture()
    const text = vi.fn(); const json = vi.fn()
    send.mockResolvedValue({ text, json } as unknown as Response)
    client.start(); client.pause(); await vi.runAllTimersAsync()
    expect(client.active()).toBe(false); expect(text).not.toHaveBeenCalled(); expect(json).not.toHaveBeenCalled()
    client.start(); client.selection('/practice'); expect(send).toHaveBeenCalledTimes(2)
  })
  it('rechecks privacy and location at send time', async () => {
    const { client, ctx, send } = fixture(); client.start(); await vi.runAllTimersAsync()
    ctx.pathname = '/practice'; client.selection('/practice/stop')
    ctx.pathname = '/'; ctx.gpc = true; client.selection('/mock')
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('bounds a hung request and isolates synchronous and async failures', async () => {
    const { client, send } = fixture(); send.mockImplementation(() => new Promise(() => {}))
    client.start(); const signal = send.mock.calls[0][1]?.signal
    await vi.advanceTimersByTimeAsync(2000); expect(signal?.aborted).toBe(true)
    send.mockRejectedValueOnce(new Error('offline')); expect(() => client.selection('/mock')).not.toThrow()
    await vi.runAllTimersAsync()
    send.mockImplementationOnce(() => { throw Error('fetch unavailable') })
    expect(() => client.selection('/practice')).not.toThrow()
    await vi.runAllTimersAsync(); expect(send).toHaveBeenCalledTimes(3)
  })
  it('closes admission and preserves only its submitted selection across teardown; final retirement still aborts', async () => {
    const { client, send } = fixture()
    const finishes: ((r: Response) => void)[] = []
    send.mockImplementation(() => new Promise(resolve => finishes.push(resolve)))
    client.start(); const old = send.mock.calls[0][1]?.signal
    client.navigate('/practice/stop'); const selected = send.mock.calls[1][1]?.signal
    expect(old?.aborted).toBe(true); expect(selected?.aborted).toBe(false)
    expect(client.active()).toBe(false)
    client.selection('/mock'); expect(send).toHaveBeenCalledTimes(2)
    finishes[0](new Response('{}')); await vi.advanceTimersByTimeAsync(0)
    expect(selected?.aborted).toBe(false)
    expect(send.mock.calls[0][1]?.keepalive).toBeUndefined()
    expect(send.mock.calls[1][1]?.keepalive).toBe(true)
    client.leave(); client.pause(); expect(selected?.aborted).toBe(false)
    client.selection('/mock'); expect(send).toHaveBeenCalledTimes(2)
    client.retire(); expect(selected?.aborted).toBe(true)
    finishes[1](new Response('{}')); await vi.runAllTimersAsync()
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('selection navigation never waits and its request times out while the document is active', async () => {
    const { client, send } = fixture(); send.mockImplementation(() => new Promise(() => {}))
    client.start(); expect(client.navigate('/mock')).toBeUndefined()
    const selected = send.mock.calls[1][1]?.signal
    await vi.advanceTimersByTimeAsync(2000)
    expect(selected?.aborted).toBe(true)
  })
  it('never sends at unload and never uses keepalive for ordinary page views or selections', async () => {
    const { client, send } = fixture()
    client.leave(); expect(send).not.toHaveBeenCalled()
    const next = fixture(); next.client.start(); await vi.runAllTimersAsync()
    next.client.selection('/practice/stop'); expect(next.send.mock.calls[1][1]?.keepalive).toBeUndefined()
    next.client.leave(); expect(next.send.mock.calls[1][1]?.signal?.aborted).toBe(true)
  })
  it('cannot admit navigation collection after a browser privacy restriction or on a forbidden destination', () => {
    const { client, ctx, send } = fixture(); client.start()
    ctx.gpc = true; client.navigate('/practice/stop'); expect(send).toHaveBeenCalledTimes(1)
    const next = fixture(); next.client.start(); next.client.navigate('/__proto__')
    expect(next.send).toHaveBeenCalledTimes(1)
  })
})
