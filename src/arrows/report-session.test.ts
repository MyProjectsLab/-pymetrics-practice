import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsReportSession } from './report-session'
import { registerFixture, installTestLocks } from './register-test-support'
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.restoreAllMocks(); if (locks) Object.defineProperty(navigator, 'locks', locks); else Reflect.deleteProperty(navigator, 'locks') })
it('an arm-only handle cannot publish a retained result or pass activity scope', async () => {
  installTestLocks(); const x = await registerFixture()
  expect(() => new ArrowsReportSession(x.store, x.store.authority.handle(x.arm), null, 'live')).toThrow('exact result')
  const session = new ArrowsReportSession(x.store, x.store.authority.published(x.arm), null, 'history')
  expect(session.variant()).toBe('unavailable')
  expect(() => session.assertRecord(x.backend.root.attempts.session)).toThrow()
})
it('armed-only history is explicit and cannot silently upgrade to a new snapshot', async () => {
  installTestLocks(); const x = await registerFixture(1, false)
  const session = new ArrowsReportSession(x.store, x.store.authority.published(x.arm), null, 'history')
  session.assertRecord(x.arm); expect(session.variant()).toBe('armed-only')
  await x.store.saveSnapshot(x.arm, x.prefix, 0)
  expect(() => session.assertRecord(x.backend.root.attempts.session)).toThrow()
  expect(session.variant()).toBe('unavailable')
})
it('published report identity requires the complete snapshot and each new opening has one distinct view ID', async () => {
  installTestLocks(); const x = await registerFixture(), record = x.backend.root.attempts.session
  const first = new ArrowsReportSession(x.store, x.handle, null, 'history')
  first.assertRecord(record)
  expect(() => first.assertRecord({ ...record, snapshot: { ...record.snapshot!, revision: 9 } })).toThrow('result changed')
  const second = new ArrowsReportSession(x.store, x.handle, null, 'history')
  expect(first.viewId).not.toBe(second.viewId)
})
