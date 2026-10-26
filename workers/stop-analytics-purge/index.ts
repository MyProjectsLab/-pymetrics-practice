import { RETENTION_MS } from '../../server/analytics/platform'
import type { PurgeEnv } from '../../server/analytics/platform'
export async function purge(env: PurgeEnv, now = Date.now): Promise<void> {
  const db = env.ANALYTICS_DB
  if (!db) throw new Error('Analytics purge unavailable')
  // Fail closed before deletion. Even a failed batch leaves admission blocked.
  try {
    const blocked = await db.prepare("UPDATE analytics_retention SET state = 'pending' WHERE singleton = 1").run()
    if (!blocked.success) throw new Error('purge')
    const at = now()
    if (!Number.isSafeInteger(at) || at < RETENTION_MS || !env.ANALYTICS_ACTIVATION_REVISION) throw new Error('purge')
    const results = await db.batch([
      db.prepare('DELETE FROM stop_analytics WHERE received_at_ms <= ?').bind(at - RETENTION_MS),
      db.prepare("UPDATE analytics_retention SET state = 'ready', purged_at_ms = ?, activation_revision = ? WHERE singleton = 1")
        .bind(at, env.ANALYTICS_ACTIVATION_REVISION),
    ])
    if (results.length !== 2 || results.some(result => !result.success)) throw new Error('purge')
  } catch {
    // This rejection reaches the scheduler as a fixed error, without row data.
    try { await db.prepare("UPDATE analytics_retention SET state = 'failed' WHERE singleton = 1").run() } catch { /* outage: freshness gate also expires */ }
    throw new Error('Analytics purge failed')
  }
}
export default {
  async scheduled(_controller: unknown, env: PurgeEnv) { await purge(env) },
  fetch() { return new Response(null, { status: 404 }) },
}
