import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { onRequest } from '../../../../dist-analytics/collector.js'

const at = Date.now()
const db = new DatabaseSync(':memory:')
db.exec(readFileSync('migrations/stop-analytics/0001.sql', 'utf8'))
db.prepare("UPDATE analytics_retention SET state='ready', purged_at_ms=?, activation_revision=? WHERE singleton=1")
  .run(at, 'local-f1-revision-0001')
const statement = (sql, values = []) => ({
  bind(...bound) { return statement(sql, bound) },
  async first() { return db.prepare(sql).get(...values) ?? null },
  async run() { db.prepare(sql).run(...values); return { success: true } },
})
const database = { prepare: statement }
const env = {
  ANALYTICS_DB: database, STOP_ANALYTICS_ENABLED: 'true', ANALYTICS_ORIGIN: 'https://practice.example',
  ANALYTICS_ACTIVATION_REVISION: 'local-f1-revision-0001',
  CONSENT_PRIVACY_APPROVED: 'verified', PROVIDER_LOGGING_VERIFIED: 'verified',
  BACKUP_EXPORT_VERIFIED: 'verified', RATE_LIMITING_VERIFIED: 'verified',
  RETENTION_MONITORING_VERIFIED: 'verified',
}
const valid = JSON.stringify({ session_id: 'ac759a7e-9e32-4d13-8d77-9410e497b68c', event: 'stop_guide_opened' })
function request(body = valid) {
  return new Request('https://practice.example/api/stop-analytics', { method: 'POST',
    headers: { Origin: 'https://practice.example', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body })
}
const results = []
async function check(label, settings, body, status) {
  const result = await onRequest({ request: request(body), env: settings })
  const text = await result.text()
  assert.equal(result.status, status, label)
  assert.equal(text, '', `${label}: response body`)
  results.push({ case: label, status: result.status, emptyBody: true })
}
await check('default-disabled', {}, valid, 503)
await check('valid request', env, valid, 204)
await check('malformed JSON', env, '{', 400)
await check('prohibited field', env, valid.slice(0, -1) + ',"score":9}', 400)
await check('prepare failure', { ...env, ANALYTICS_DB: { prepare() { throw Error('private prepare detail') } } }, valid, 503)
await check('bind failure', { ...env, ANALYTICS_DB: { prepare: sql => ({ ...statement(sql), bind() { throw Error('private bind detail') } }) } }, valid, 503)
await check('execution failure', { ...env, ANALYTICS_DB: { prepare: sql => ({ ...statement(sql), bind: (...values) => ({ ...statement(sql, values), first: async () => { throw Error('private execution detail') } }) }) } }, valid, 503)
db.exec('DROP TABLE stop_analytics')
await check('missing table', env, valid, 503)
db.close()
writeFileSync('docs/qa/m6-b/repair-f1/built-pages-entry.json', JSON.stringify({ compiledEntry: 'dist-analytics/collector.js', results }, null, 2) + '\n')
