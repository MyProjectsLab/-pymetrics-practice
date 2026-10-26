import { validPayload } from '../../src/analytics/contract'
import type { AnalyticsRowInput } from '../../src/analytics/contract'
import { enabled, PURGE_FRESH_MS } from './platform'
import type { CollectionEnv } from './platform'
export const MAX_REQUEST_BYTES = 512
const response = (status: number) => new Response(null, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
} })
async function readLimited(request: Request): Promise<string | null> {
  if (!request.body) return null
  const reader = request.body.getReader()
  let size = 0
  const chunks: Uint8Array[] = []
  // Also bound slow or unfinished request bodies; never read request.text() unbounded.
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_REQUEST_BYTES) { void reader.cancel().catch(() => undefined); return null }
          chunks.push(value)
        }
        const bytes = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      })(),
      new Promise<null>(resolve => { timeout = setTimeout(() => { void reader.cancel().catch(() => undefined); resolve(null) }, 2000) }),
    ])
  } finally { clearTimeout(timeout) }
}
export async function collect(request: Request, env: CollectionEnv, now = Date.now): Promise<Response> {
  // Disabled requests are rejected before reading any body or accessing D1.
  if (!enabled(env)) return response(503)
  const url = new URL(request.url)
  if (request.method !== 'POST') return response(405)
  if (url.pathname !== '/api/stop-analytics' || url.search || url.origin !== env.ANALYTICS_ORIGIN ||
    request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') !== 'same-origin') return response(403)
  if (request.headers.has('Cookie') || request.headers.has('Authorization') || request.headers.has('Content-Encoding')) return response(400)
  if (request.headers.get('Content-Type') !== 'application/json') return response(415)
  const length = request.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) return response(413)
  let payload: AnalyticsRowInput
  try {
    const raw = await readLimited(request)
    if (raw === null) return response(413)
    const parsed: unknown = JSON.parse(raw)
    if (!validPayload(parsed)) return response(400)
    // Valid envelopes are flat and have only enum/UUID/boolean values. Count
    // decoded member names as well, so duplicate JSON keys cannot be hidden by
    // JSON.parse's last-value-wins behavior (including escaped key spellings).
    const members = [...raw.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g)].map(match => JSON.parse(match[1]) as string)
    if (members.length !== Object.keys(parsed).length || new Set(members).size !== members.length) return response(400)
    payload = parsed
  } catch { return response(400) }
  try {
    const received = now()
    if (!Number.isSafeInteger(received) || received < 0) return response(503)
    // Gate and insert are one SQL statement: a concurrent purge failure cannot
    // race a separate admission check. Only explicit columns, never request JSON.
    const inserted = await env.ANALYTICS_DB!.prepare(`INSERT INTO stop_analytics
      (session_id, event, mode, status, passed, reason, error_class, received_at_ms)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM analytics_retention
      WHERE singleton = 1 AND state = 'ready' AND activation_revision = ?
      AND purged_at_ms > ? AND purged_at_ms <= ? RETURNING received_at_ms`)
      .bind(payload.session_id, payload.event, 'mode' in payload ? payload.mode : null, 'status' in payload ? payload.status : null,
        'passed' in payload ? Number(payload.passed) : null, 'reason' in payload ? payload.reason : null,
        'error_class' in payload ? payload.error_class : null, received, env.ANALYTICS_ACTIVATION_REVISION!, received - PURGE_FRESH_MS, received)
      .first<{ received_at_ms: number }>()
    return response(inserted ? 204 : 503)
  } catch { return response(503) } // No request, D1 error, stack, headers or IP logging.
}
