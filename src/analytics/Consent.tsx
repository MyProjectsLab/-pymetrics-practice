import { useSyncExternalStore } from 'react'
import { candidateAnalyticsAvailable, stopAnalytics } from './client'
import type { createAnalyticsClient } from './client'
export const CONSENT_NOTICE = 'May we collect optional Stop usage analytics to understand which preparation steps are used and identify broad technical problems? We collect only guide, device-check, session, report, training, drill and retest events, broad technical outcomes, a random identifier for this page session, and the time the server receives each event. We do not collect answers, scores, response times, keys, accommodation choices, drill identities, local-history identifiers, names, contact details or employer information. Your task records stay in this browser. We use no analytics cookies or cross-site identifiers. Live analytics rows become eligible for deletion after 55 days and are purged hourly; verified backup and export expiry must keep total retention within 90 days of collection. You can decline or withdraw without losing any Stop feature. Your choice starts off on each page load.'
export const WITHDRAWAL_NOTICE = 'Withdraw to stop new analytics requests, discard unsent events and forget this page’s analytics identifier. A request already received cannot be recalled. Previously received rows remain subject to the retention policy; withdrawal and deleting local history do not delete those rows. After this page’s identifier is forgotten, we cannot use it to locate earlier rows. You can change your choice from the library. Closing or refreshing this page also turns consent off.'
export function AnalyticsConsent({ client = stopAnalytics, available = candidateAnalyticsAvailable }: {
  client?: ReturnType<typeof createAnalyticsClient>; available?: boolean
}) {
  const consent = useSyncExternalStore(client.subscribe, client.consented)
  function choose(value: boolean) { client.setConsent(value) }
  return <section className="panel" aria-label="Optional Stop analytics">
    <h2>Optional Stop analytics</h2>
    <p>Development candidate — proposed notice for founder and privacy review. Collection is disabled in the default build.</p>
    <p>{CONSENT_NOTICE}</p><p>{WITHDRAWAL_NOTICE}</p>
    <p role="status">{consent ? 'Analytics consent is on for this page.' : 'Analytics consent is off.'}</p>
    <button disabled={!available || consent} onClick={() => choose(true)}>Allow optional analytics</button>
    <button className="secondary" onClick={() => choose(false)}>{consent ? 'Withdraw analytics consent' : 'Decline analytics'}</button>
  </section>
}
