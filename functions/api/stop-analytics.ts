import { collect } from '../../server/analytics/collect'
import type { CollectionEnv } from '../../server/analytics/platform'
export function onRequest(context: { request: Request; env: CollectionEnv }) {
  return collect(context.request, context.env)
}
