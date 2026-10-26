import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsStore, freshArrowsRoot } from './storage'
import type { ArrowsBackend } from './storage'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

/** Event-driven native-adapter double. It deliberately throws on repeated or
 * post-commit abort; actual native execution is a separate browser gate. */
async function adapter(fault?: 'request' | 'put', held = false) {
  let aborts = 0, puts = 0, complete!: () => void
  const root = freshArrowsRoot()
  const db = { close() {}, transaction() {
    let finished = false
    const request: { result: unknown; error: Error | null; onsuccess?: () => void; onerror?: () => void } = { result: structuredClone(root), error: null }
    const tx: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; error: Error | null; abort: () => void; objectStore: () => unknown } = {
      error: null,
      abort() { aborts++; if (finished) throw Error('native transaction finished'); finished = true; queueMicrotask(() => tx.onabort?.()) },
      objectStore: () => ({ get: () => request, put: () => { puts++; if (fault === 'put') throw Error('put failed') } }),
    }
    queueMicrotask(() => {
      if (fault === 'request') { request.error = Error('request failed'); request.onerror?.(); return }
      request.onsuccess?.()
      if (!finished) { finished = true; complete = () => tx.oncomplete?.(); if (!held) complete() }
    })
    return tx
  } }
  vi.stubGlobal('indexedDB', { open() { const request: { result: unknown; onsuccess?: () => void } = { result: db }; queueMicrotask(() => request.onsuccess?.()); return request } })
  const backend = await (ArrowsStore as unknown as { openBackend: () => Promise<ArrowsBackend> }).openBackend()
  return { backend, root, complete: () => complete(), counts: () => ({ aborts, puts }) }
}
it('synchronous preimage cancellation aborts once, skips put, settles once and removes listeners', async () => {
  const x = await adapter(), controller = new AbortController(), remove = vi.spyOn(controller.signal, 'removeEventListener')
  const task = x.backend.change(() => { controller.abort(Error('original retirement')); throw Error('later authority check') }, controller.signal)
  await expect(task).rejects.toThrow('canceled')
  await Promise.resolve()
  expect(x.counts()).toEqual({ aborts: 1, puts: 0 })
  expect(remove.mock.calls.some(([event]) => event === 'abort')).toBe(true)
})
for (const fault of ['request', 'put'] as const) it(`${fault} failure stays in its own operation`, async () => {
  const x = await adapter(fault)
  await expect(x.backend.change(() => {})).rejects.toThrow(`${fault} failed`)
  expect(x.counts().aborts).toBe(1)
})
for (const mode of ['read', 'change'] as const) it(`${mode}: abort after native commit before callback cannot escape or double settle`, async () => {
  const x = await adapter(undefined, true), controller = new AbortController()
  const task = mode === 'read' ? x.backend.read(controller.signal) : x.backend.change(() => 123, controller.signal)
  void task.catch(() => {})
  await Promise.resolve(); controller.abort(Error('delivery canceled'))
  expect(x.counts().aborts).toBe(1)
  x.complete(); x.complete()
  if (mode === 'read') await expect(task).resolves.toEqual(x.root)
  else await expect(task).rejects.toThrow('canceled')
})
it('a signal already canceled creates no native transaction', async () => {
  const x = await adapter(), controller = new AbortController(); controller.abort(Error('before request'))
  expect(() => x.backend.read(controller.signal)).toThrow('canceled')
  expect(x.counts()).toEqual({ aborts: 0, puts: 0 })
})
