// Minimal structural subset of Cloudflare's D1 binding API. No SDK or account required.
export interface Statement {
  bind(...values: (string | number | null)[]): Statement
  first<T>(): Promise<T | null>
  run(): Promise<{ success: boolean }>
}
export interface Database {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<{ success: boolean }[]>
}
export const RETENTION_MS = 55 * 24 * 60 * 60 * 1000
export const PURGE_FRESH_MS = 2 * 60 * 60 * 1000
export interface PurgeEnv { ANALYTICS_DB?: Database; ANALYTICS_ACTIVATION_REVISION?: string }
export interface CollectionEnv extends PurgeEnv {
  STOP_ANALYTICS_ENABLED?: string
  ANALYTICS_ORIGIN?: string
  CONSENT_PRIVACY_APPROVED?: string
  PROVIDER_LOGGING_VERIFIED?: string
  BACKUP_EXPORT_VERIFIED?: string
  RATE_LIMITING_VERIFIED?: string
  RETENTION_MONITORING_VERIFIED?: string
}
export const activationGates = ['CONSENT_PRIVACY_APPROVED', 'PROVIDER_LOGGING_VERIFIED', 'BACKUP_EXPORT_VERIFIED',
  'RATE_LIMITING_VERIFIED', 'RETENTION_MONITORING_VERIFIED'] as const
export function enabled(env: CollectionEnv) {
  return env.STOP_ANALYTICS_ENABLED === 'true' && activationGates.every(key => env[key] === 'verified') &&
    typeof env.ANALYTICS_ACTIVATION_REVISION === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(env.ANALYTICS_ACTIVATION_REVISION) && !!env.ANALYTICS_DB
}
