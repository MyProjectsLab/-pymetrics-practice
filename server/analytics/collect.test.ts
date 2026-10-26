/// <reference types="node" />
// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../functions/api/stop-analytics'
import worker, { purge } from '../../workers/stop-analytics-purge'
import { collect, MAX_REQUEST_BYTES } from './collect'
import { activationGates, PURGE_FRESH_MS, RETENTION_MS } from './platform'
import type { CollectionEnv, Database, Statement } from './platform'
import { emptyEvents, validPayload } from '../../src/analytics/contract'
const now = Date.UTC(2026, 9, 1)
const session_id = 'ac759a7e-9e32-4d13-8d77-9410e497b68c'
const minimal = { session_id, event: 'stop_guide_opened' }
let sqlite: DatabaseSync, env: CollectionEnv, failDelete = false
function statement(sql: string, values: (string | number | null)[] = []): Statement {
  return {
    bind: (...v) => statement(sql, v),
    async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null },
    async run() { if (failDelete && sql.startsWith('DELETE')) throw new Error('sensitive database failure must never leave application')
      sqlite.prepare(sql).run(...values); return { success: true } },
  }
}
const db: Database = {
  prepare: sql => statement(sql),
  async batch(statements) {
    sqlite.exec('BEGIN')
    try { const results = []; for (const item of statements) results.push(await item.run()); sqlite.exec('COMMIT'); return results }
    catch (error) { sqlite.exec('ROLLBACK'); throw error }
  },
}
function request(payload: unknown = minimal, headers: Record<string, string | undefined> = {}, method = 'POST', path = '/api/stop-analytics') {
  return new Request(`https://practice.example${path}`, { method, headers: Object.fromEntries(Object.entries({ Origin: 'https://practice.example',
    'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', ...headers }).filter((item): item is [string, string] => item[1] !== undefined)),
    ...(method === 'POST' ? { body: typeof payload === 'string' ? payload : JSON.stringify(payload) } : {}) })
}
function rows() { return sqlite.prepare('SELECT * FROM stop_analytics').all() }
beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:'); failDelete = false
  sqlite.exec(readFileSync('migrations/stop-analytics/0001.sql', 'utf8'))
  env = { ANALYTICS_DB: db, STOP_ANALYTICS_ENABLED: 'true', ANALYTICS_ORIGIN: 'https://practice.example',
    ANALYTICS_ACTIVATION_REVISION: 'local-test-revision-0001', ...Object.fromEntries(activationGates.map(key => [key, 'verified'])) }
  await purge(env, () => now)
})
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); vi.useRealTimers() })
describe('disabled admission and operational gates', () => {
  it('Pages entry rejects every method with empty settings before reading a body', async () => {
    for (const method of ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']) {
      const req = request(undefined, {}, method)
      const response = await onRequest({ request: req, env: {} })
      expect(response.status).toBe(503); expect(req.bodyUsed).toBe(false)
      expect([...response.headers.keys()]).not.toContain('set-cookie')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    }
    expect(rows()).toEqual([])
  })
  it.each(['STOP_ANALYTICS_ENABLED', ...activationGates, 'ANALYTICS_DB', 'ANALYTICS_ACTIVATION_REVISION'] as const)('missing %s fails closed', async key => {
    delete env[key]; expect((await collect(request(), env, () => now)).status).toBe(503); expect(rows()).toEqual([])
  })
  it.each(['TRUE', '1', 'false', ''])('rejects non-explicit enablement %s', async value => {
    env.STOP_ANALYTICS_ENABLED = value; expect((await collect(request(), env)).status).toBe(503)
  })
  it('rejects stale, future, failed and different-revision purge state', async () => {
    for (const [state, at, revision] of [['ready', now - PURGE_FRESH_MS, env.ANALYTICS_ACTIVATION_REVISION],
      ['ready', now + 1, env.ANALYTICS_ACTIVATION_REVISION], ['failed', now, env.ANALYTICS_ACTIVATION_REVISION], ['ready', now, 'old-restore-revision']]) {
      sqlite.prepare('UPDATE analytics_retention SET state=?, purged_at_ms=?, activation_revision=?').run(state!, at!, revision!)
      expect((await collect(request(), env, () => now)).status).toBe(503)
    }
  })
})
describe('exact §23.5 allowlist', () => {
  const allowed = [...emptyEvents.map(event => ({ event })),
    ...['baseline', 'replay', 'retest'].map(mode => ({ event: 'stop_session_started', mode })),
    ...['completed', 'invalid', 'technical_failure'].map(status => ({ event: 'stop_session_ended', status })),
    { event: 'stop_device_check_completed', passed: true, reason: 'none' },
    ...['input_check_failed', 'viewport_unsupported', 'browser_unsupported'].map(reason => ({ event: 'stop_device_check_completed', passed: false, reason })),
    ...['unavailable', 'write_failed'].map(error_class => ({ event: 'stop_storage_failure', error_class })),
    ...['record_integrity', 'report_render_failed'].map(error_class => ({ event: 'stop_technical_error', error_class })),
  ]
  it.each(allowed)('stores permitted event $event with fixed columns and server time', async event => {
    const result = await collect(request({ ...event, session_id }), env, () => now)
    expect(result.status).toBe(204)
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({ session_id, event: event.event, received_at_ms: now })
    expect(Object.keys(rows()[0])).toEqual(['id', 'session_id', 'event', 'mode', 'status', 'passed', 'reason', 'error_class', 'received_at_ms'])
  })
  it.each(['sequence', 'realized_sequence', 'trial_id', 'reaction_time', 'accuracy', 'scores', 'answers', 'counts', 'keys', 'input_binding',
    'accommodation', 'drill_id', 'history_id', 'name', 'email', 'employer', 'invitation', 'ip', 'user_agent', 'stack', 'timestamp', 'received_at_ms', '__proto__', 'unknown'])('rejects entire payload containing %s', async field => {
    const payload = JSON.parse(JSON.stringify(minimal).slice(0, -1) + `,"${field}":"prohibited"}`)
    expect((await collect(request(payload), env, () => now)).status).toBe(400); expect(rows()).toEqual([])
  })
  it.each([null, [], true, 1, '"string"', '{', {}, { ...minimal, session_id: 'local-history-id' },
    { ...minimal, event: 'mock_started' }, { ...minimal, event: 'trial_resolved' },
    { ...minimal, event: 'stop_session_started', mode: 'drill' }, { ...minimal, event: 'stop_session_started', mode: 'mock' },
    { ...minimal, event: 'stop_device_check_completed', passed: 1, reason: 'none' },
    { ...minimal, event: 'stop_device_check_completed', passed: true, reason: 'input_check_failed' },
    { ...minimal, event: 'stop_device_check_completed', passed: false, reason: 'none' },
    { ...minimal, event: 'stop_technical_error', error_class: 'raw free text' },
    { ...minimal, event: 'stop_storage_failure', error_class: { name: 'secret' } },
    { ...minimal, extra: null }])('rejects malformed, wrong-type, unknown and prohibited payload %#', async payload => {
    expect((await collect(request(payload), env, () => now)).status).toBe(400); expect(rows()).toEqual([])
  })
  it('rejects duplicate member names, including escaped spellings', async () => {
    for (const duplicate of ['"event":"stop_report_viewed"', '"e\\u0076ent":"stop_report_viewed"']) {
      const raw = JSON.stringify(minimal).slice(0, -1) + ',' + duplicate + '}'
      expect((await collect(request(raw), env, () => now)).status).toBe(400)
    }
    expect(rows()).toEqual([])
  })
  it('every allowed event rejects every unexpected field and every missing required field', () => {
    for (const event of allowed) {
      const payload = { ...event, session_id }
      expect(validPayload(payload)).toBe(true)
      expect(validPayload({ ...payload, score: 100 })).toBe(false)
      for (const key of Object.keys(payload)) { const missing = { ...payload }; delete (missing as Record<string, unknown>)[key]; expect(validPayload(missing)).toBe(false) }
    }
  })
})
describe('endpoint abuse boundaries', () => {
  it.each([
    [{ Origin: 'https://evil.example' }, 403], [{ Origin: 'null' }, 403], [{ Origin: '' }, 403],
    [{ 'Sec-Fetch-Site': 'cross-site' }, 403], [{ 'Sec-Fetch-Site': 'same-site' }, 403], [{ 'Sec-Fetch-Site': '' }, 403],
    [{ Cookie: 'identifier=secret' }, 400], [{ Authorization: 'secret' }, 400], [{ 'Content-Encoding': 'gzip' }, 400],
    [{ 'Content-Type': 'text/plain' }, 415], [{ 'Content-Type': 'application/json; charset=utf-8' }, 415],
    [{ 'Content-Length': String(MAX_REQUEST_BYTES + 1) }, 413], [{ 'Content-Length': '-1' }, 413],
  ] as const)('rejects headers %# without insertion', async (headers, status) => {
    expect((await collect(request(minimal, headers), env, () => now)).status).toBe(status)
    expect(rows()).toEqual([])
  })
  it('rejects GET/preflight, wrong paths, query strings and wrong configured origin', async () => {
    for (const method of ['GET', 'OPTIONS', 'PUT']) expect((await collect(request(undefined, {}, method), env)).status).toBe(405)
    for (const path of ['/api/stop-analytics?email=secret', '/api/other']) expect((await collect(request(minimal, {}, 'POST', path), env)).status).toBe(403)
    env.ANALYTICS_ORIGIN = 'https://other.example'; expect((await collect(request(), env)).status).toBe(403)
  })
  it('bounds actual bytes even with absent/lying content-length, including UTF-8', async () => {
    for (const headers of [{}, { 'Content-Length': '1' }]) {
      expect((await collect(request(' '.repeat(513), headers), env)).status).toBe(413)
      expect((await collect(request('é'.repeat(257), headers), env)).status).toBe(413)
    }
    const exact = JSON.stringify(minimal).padEnd(512, ' ')
    expect((await collect(request(exact), env, () => now)).status).toBe(204)
  })
  it('bounds a slow unfinished stream and cancels it', async () => {
    vi.useFakeTimers(); const cancel = vi.fn()
    const req = new Request('https://practice.example/api/stop-analytics', { method: 'POST',
      headers: { Origin: 'https://practice.example', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
      body: new ReadableStream({ cancel }), duplex: 'half' } as RequestInit)
    const pending = collect(req, env, () => now)
    await vi.advanceTimersByTimeAsync(2001)
    expect((await pending).status).toBe(413); expect(cancel).toHaveBeenCalled(); expect(rows()).toEqual([])
  })
  it('never logs headers, IPs, payloads or underlying database errors', async () => {
    const log = vi.spyOn(console, 'log'), error = vi.spyOn(console, 'error'), warn = vi.spyOn(console, 'warn')
    await collect(request(minimal, { 'CF-Connecting-IP': '192.0.2.1', 'X-Forwarded-For': '192.0.2.1' }), env, () => now)
    expect(JSON.stringify(rows())).not.toContain('192.0.2.1')
    env.ANALYTICS_DB = { ...db, prepare: () => { throw new Error('secret payload') } }
    const response = await collect(request(), env)
    expect(response.status).toBe(503); expect(await response.text()).toBe('')
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled()
  })
})
describe('F1: malformed requests and D1 failures have distinct statuses', () => {
  it.each([
    ['prepare', () => { env.ANALYTICS_DB = { ...db, prepare: () => { throw new Error('private prepare detail') } } }],
    ['bind', () => { env.ANALYTICS_DB = { ...db, prepare: sql => ({ ...statement(sql), bind: () => { throw new Error('private bind detail') } }) } }],
    ['execution', () => { env.ANALYTICS_DB = { ...db, prepare: sql => ({ ...statement(sql), bind: (...values) => ({ ...statement(sql, values), first: async () => { throw new Error('private execution detail') } }) }) } }],
    ['missing table', () => { sqlite.exec('DROP TABLE stop_analytics') }],
  ] as const)('returns an empty generic 503 when D1 %s fails for a valid request', async (_path, inject) => {
    inject()
    const log = vi.spyOn(console, 'log'), error = vi.spyOn(console, 'error'), warn = vi.spyOn(console, 'warn')
    const result = await collect(request(), env, () => now)
    expect(result.status).toBe(503)
    expect(await result.text()).toBe('')
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled()
  })
  it.each(['{', JSON.stringify({ ...minimal, mode: 'mock' }), JSON.stringify({ ...minimal, event: 'stop_session_started', mode: 'mock' })])
    ('keeps malformed input at an empty 400: %#', async payload => {
      const result = await collect(request(payload), env, () => now)
      expect(result.status).toBe(400); expect(await result.text()).toBe(''); expect(rows()).toEqual([])
    })
})
describe('55-day expiry and separate scheduler', () => {
  function seed(at: number) { sqlite.prepare('INSERT INTO stop_analytics(session_id,event,received_at_ms) VALUES(?,?,?)').run(session_id, 'stop_guide_opened', at) }
  it('deletes at and before exact expiry; retains 1ms younger; repeat is idempotent', async () => {
    const cutoff = now - RETENTION_MS
    for (const at of [cutoff - 1, cutoff, cutoff + 1, now]) seed(at)
    await purge(env, () => now); await purge(env, () => now)
    expect(rows().map(row => row.received_at_ms)).toEqual([cutoff + 1, now])
    await purge(env, () => now + 1); expect(rows().map(row => row.received_at_ms)).toEqual([now])
  })
  it('failed purge rolls back deletion, blocks collection, and succeeds on retry', async () => {
    seed(now - RETENTION_MS); failDelete = true
    await expect(purge(env, () => now)).rejects.toThrow('Analytics purge failed')
    expect(rows()).toHaveLength(1)
    expect((await collect(request(), env, () => now)).status).toBe(503)
    failDelete = false; await purge(env, () => now)
    expect(rows()).toEqual([]); expect((await collect(request(), env, () => now)).status).toBe(204)
  })
  it('restored rows use original receipt time and collection waits for the rotated revision purge', async () => {
    seed(now - RETENTION_MS - 1000); seed(now - RETENTION_MS + 1)
    env.ANALYTICS_ACTIVATION_REVISION = 'post-restore-revision-0002'
    expect((await collect(request(), env, () => now)).status).toBe(503)
    failDelete = true; await expect(purge(env, () => now)).rejects.toThrow()
    expect(rows()).toHaveLength(2)
    failDelete = false; await purge(env, () => now)
    expect(rows().map(row => row.received_at_ms)).toEqual([now - RETENTION_MS + 1])
    expect((await collect(request(), env, () => now)).status).toBe(204)
  })
  it('scheduler runs deletion independently of collection enablement; has no HTTP trigger', async () => {
    seed(Date.now() - RETENTION_MS)
    env.STOP_ANALYTICS_ENABLED = 'false'
    await worker.scheduled({}, env); expect(rows()).toEqual([])
    expect(worker.fetch().status).toBe(404)
  })
  it('D1 outage fails closed and the fixed error reveals no database details', async () => {
    env.ANALYTICS_DB = { ...db, prepare: () => { throw new Error('database credentials and rows') } }
    await expect(purge(env, () => now)).rejects.toThrow(/^Analytics purge failed$/)
    expect((await collect(request(), env, () => now)).status).toBe(503)
  })
})
