import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MarketingUsage } from './MarketingUsage'
import { createMarketingUsage } from './usage'
import { StrictMode } from 'react'

afterEach(cleanup)
function fixture(patch = {}) {
  const send = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))
  const ctx = { protocol: 'https:', hostname: 'traitgame.com', pathname: '/', search: '', visible: true, dnt: false, gpc: false, ...patch }
  const client = createMarketingUsage('00000000-0000-4000-8000-000000000001', () => ctx, send)
  return { send, ctx, client }
}
const settle = async () => { await act(async () => { await Promise.resolve() }) }
it('automatically attempts one visit and shows a short notice with no choice controls', async () => {
  const { send, client } = fixture()
  render(<><a href="/practice">Practise</a><MarketingUsage makeClient={() => client} /></>)
  await settle()
  expect(send).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('region', { name: 'Usage information' })).toHaveTextContent('We collect visit counts, practice-link clicks and limited assessment result totals to improve TraitGame. We do not collect individual answers.')
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy.html')
  expect(screen.getByRole('link', { name: 'Practise' })).toHaveAttribute('href', '/practice')
})
it('retires before navigation and a late delivery cannot revive collection', async () => {
  const { send, client } = fixture()
  render(<><a href="/practice" onClick={e => e.preventDefault()}>Practise</a><MarketingUsage makeClient={() => client} /></>)
  await settle(); fireEvent.click(screen.getByRole('link', { name: 'Practise' }))
  expect(send.mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(client.active()).toBe(false)
  expect(JSON.parse(String(send.mock.calls[1][1]?.body)).payload.name).toBe('library_selected')
  act(() => client.start()); expect(send).toHaveBeenCalledTimes(2)
})
it('pagehide without a BFCache restore cannot restart a retired client', async () => {
  const { send, client } = fixture(); render(<MarketingUsage makeClient={() => client} />)
  await settle(); fireEvent(window, new Event('pagehide')); fireEvent(window, new Event('pageshow'))
  expect(client.active()).toBe(false); expect(send).toHaveBeenCalledTimes(1)
})
it('hidden/show resumes link counting without a second visit attempt', async () => {
  const { send, client, ctx } = fixture(); render(<MarketingUsage makeClient={() => client} />)
  await settle()
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  ctx.visible = false; fireEvent(document, new Event('visibilitychange'))
  expect(client.active()).toBe(false); expect(send.mock.calls[0][1]?.signal?.aborted).toBe(true)
  ctx.visible = true; spy.mockRestore(); fireEvent(document, new Event('visibilitychange'))
  expect(client.active()).toBe(true); expect(send).toHaveBeenCalledTimes(1)
  client.selection('/practice/stop'); expect(send).toHaveBeenCalledTimes(2)
})
it('an initially hidden page waits until visible for its first visit attempt', async () => {
  const { send, client, ctx } = fixture({ visible: false }); render(<MarketingUsage makeClient={() => client} />)
  await settle(); expect(send).not.toHaveBeenCalled()
  ctx.visible = true; fireEvent(document, new Event('visibilitychange'))
  expect(send).toHaveBeenCalledTimes(1)
})
it.each([true, false])('freeze resumes selection admission without recounting; resume-first=%s', async resumeFirst => {
  const { send, client, ctx } = fixture(); render(<MarketingUsage makeClient={() => client} />)
  await settle()
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  ctx.visible = false; fireEvent(document, new Event('visibilitychange')); fireEvent(document, new Event('freeze'))
  expect(client.active()).toBe(false)
  if (resumeFirst) fireEvent(document, new Event('resume'))
  expect(send).toHaveBeenCalledTimes(1)
  ctx.visible = true; spy.mockRestore(); fireEvent(document, new Event('visibilitychange'))
  if (!resumeFirst) fireEvent(document, new Event('resume'))
  expect(client.active()).toBe(true); expect(send).toHaveBeenCalledTimes(1)
  client.selection('/practice/towers'); expect(send).toHaveBeenCalledTimes(2)
  fireEvent(window, new Event('pagehide')); fireEvent(document, new Event('resume'))
  expect(client.active()).toBe(false); expect(send).toHaveBeenCalledTimes(2)
})
it('a visible freeze/resume also resumes without a visibility transition or duplicate view', async () => {
  const { send, client } = fixture(); render(<MarketingUsage makeClient={() => client} />)
  await settle(); fireEvent(document, new Event('freeze')); expect(client.active()).toBe(false)
  fireEvent(document, new Event('resume')); expect(client.active()).toBe(true)
  expect(send).toHaveBeenCalledTimes(1)
  client.selection('/practice/towers'); expect(send).toHaveBeenCalledTimes(2)
})
it('BFCache replaces the retired client but does not count the document again', async () => {
  const first = fixture(), second = fixture()
  const makeClient = vi.fn().mockReturnValueOnce(first.client).mockReturnValue(second.client)
  render(<><a href="/practice" onClick={e => e.preventDefault()}>Practise</a><MarketingUsage makeClient={makeClient} /></>)
  await settle(); fireEvent(window, new Event('pagehide'))
  const show = new Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
  fireEvent(window, show); await settle()
  expect(first.send.mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(second.send).not.toHaveBeenCalled(); expect(first.client.active()).toBe(false)
  fireEvent.click(screen.getByRole('link', { name: 'Practise' }))
  expect(second.send).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(second.send.mock.calls[0][1]?.body)).payload.name).toBe('library_selected')
})
it('StrictMode replay submits only the surviving setup visit', async () => {
  const { client, send } = fixture()
  render(<StrictMode><MarketingUsage makeClient={() => client} /></StrictMode>)
  await settle(); expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][1]?.signal?.aborted).toBe(false)
})
it('unmount before startup sends nothing', async () => {
  const { client, send } = fixture()
  const page = render(<MarketingUsage makeClient={() => client} />); page.unmount()
  await settle(); expect(send).not.toHaveBeenCalled()
})
it.each([{ dnt: true }, { gpc: true }, { search: '?mockId=private' }, { hostname: 'other.example' }, { pathname: '/practice/stop' }])('automatic startup still excludes %j', async patch => {
  const { client, send } = fixture(patch); render(<MarketingUsage makeClient={() => client} />)
  await settle(); expect(send).not.toHaveBeenCalled(); expect(screen.queryByRole('region')).not.toBeInTheDocument()
})
it('only an already-submitted navigation selection survives teardown', async () => {
  const { client, send } = fixture()
  const rendered = render(<><a href="/practice/stop" onClick={e => e.preventDefault()}>Stop</a><MarketingUsage makeClient={() => client} /></>)
  await settle(); fireEvent.click(screen.getByRole('link', { name: 'Stop' }))
  const signal = send.mock.calls[1][1]?.signal
  expect(send.mock.calls[1][1]?.keepalive).toBe(true)
  fireEvent(window, new Event('pagehide')); fireEvent(document, new Event('freeze')); rendered.unmount()
  expect(signal?.aborted).toBe(false); expect(send).toHaveBeenCalledTimes(2)
  client.retire(); expect(signal?.aborted).toBe(true)
})
