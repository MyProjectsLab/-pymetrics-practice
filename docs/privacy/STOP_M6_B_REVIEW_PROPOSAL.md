# Stop M6-B privacy review proposal

Date: 2026-10-01 (America/New_York). **Candidate only. Not approved copy, privacy approval, permission to collect, or release.**

The founder authorized local implementation of the provisional same-origin Cloudflare Pages Function + D1 + separate scheduled deletion Worker. Both specifications remain frozen. The founder specifically requested a 55-day live-row purge. Stop §23.5 retains its proposed 90-day retention ceiling; the shorter live window leaves room to verify backup expiry. This does not establish total deletion.

## Exact proposed consent notice

Heading: **Optional Stop analytics**

May we collect optional Stop usage analytics to understand which preparation steps are used and identify broad technical problems? We collect only guide, device-check, session, report, training, drill and retest events, broad technical outcomes, a random identifier for this page session, and the time the server receives each event. We do not collect answers, scores, response times, keys, accommodation choices, drill identities, local-history identifiers, names, contact details or employer information. Your task records stay in this browser. We use no analytics cookies or cross-site identifiers. Live analytics rows become eligible for deletion after 55 days and are purged hourly; verified backup and export expiry must keep total retention within 90 days of collection. You can decline or withdraw without losing any Stop feature. Your choice starts off on each page load.

Actions: **Allow optional analytics** / **Decline analytics**. Neither is preselected. The initial status is **Analytics consent is off.** Once consented, the status is **Analytics consent is on for this page.**, and the second action becomes **Withdraw analytics consent**.

The development UI also says: **Development candidate — proposed notice for founder and privacy review. Collection is disabled in the default build.** Allow is disabled in that default build. A local test build can expose Allow via `VITE_STOP_ANALYTICS_CANDIDATE=true`; this does not enable the server.

## Exact proposed withdrawal notice

Withdraw to stop new analytics requests, discard unsent events and forget this page’s analytics identifier. A request already received cannot be recalled. Previously received rows remain subject to the retention policy; withdrawal and deleting local history do not delete those rows. After this page’s identifier is forgotten, we cannot use it to locate earlier rows. You can change your choice from the library. Closing or refreshing this page also turns consent off.

The preference and random UUIDv4 live only in module memory. Reload, close, `pagehide` (including back/forward cache), withdrawal, or Delete all local data revoke consent and discard queued events. Reconsent creates a new UUID. No persistence or sharing across tabs. Withdrawal sends no withdrawal event. Pending fetches are aborted best-effort; already received requests cannot be recalled. No client deletion request or persistent lookup token is introduced. Review whether this treatment and the library location of the controls are suitable before approval. Existing server rows are not claimed to be anonymous or individually erased on withdrawal.

## Exact wire contract and proposed technical enums

One flat JSON object per POST. Common required fields: `event` (exact string enum) and `session_id` (lowercase UUIDv4). No client timestamps, batch, free text, optional metadata, task/session IDs, or other fields. Extra and missing fields reject the entire request. SQL adds its own row key and `received_at_ms` from the server clock. This storage key is not returned or reused as a client identifier.

| Event | Additional required fields |
|---|---|
| `stop_guide_opened` | None |
| `stop_device_check_completed` | `passed`: boolean; `reason`: below |
| `stop_session_started` | `mode`: `baseline`, `replay`, `retest` only |
| `stop_session_ended` | `status`: `completed`, `invalid`, `technical_failure` |
| `stop_report_viewed` | None |
| `stop_training_recommendation_shown` | None |
| `stop_drill_started`, `stop_drill_completed` | None; no drill identity |
| `stop_retest_started`, `stop_retest_completed` | None |
| `stop_storage_failure` | `error_class`: `unavailable`, `write_failed` |
| `stop_technical_error` | `error_class`: `record_integrity`, `report_render_failed` |

Technical spellings and their meanings are **proposals for founder/privacy approval**:

- Device pass requires `reason=none`. Failure requires `input_check_failed`, `viewport_unsupported`, or `browser_unsupported`. The integrated input-check failure uses only the broad failed-check enum; no key or input method is sent. Viewport/browser enums are reserved for a completed coarse check; no accommodation selection is instrumented.
- Session `completed` means the immutable completed result exists; it does not certify successful disk storage or good performance. An interrupted session is `invalid`; engine integrity failure is `technical_failure`. Start is the warm-up/readiness handoff, not the first scored stimulus. Retests also emit the dedicated retest milestones. Drills emit only dedicated drill events; there is no drill mode on `stop_session_started`, drill-ended invalidity event, or mock event.
- Storage `unavailable` means preflight could not open local persistence. `write_failed` means the UI discloses failed result/training storage. It carries no exception, record key or local identifier.
- `record_integrity` groups the existing generic technical recovery path, including its presentation failures. `report_render_failed` means the report error boundary rendered its recovery UI. Neither includes raw error/stack data.

## Observation and data-loss semantics

UI effects observe committed screens. Timed entry registers a transport hold before starting the run and aborts any current fetch. Queueing/sending is separate from engine input, resolution, scoring, local activity recording and local-store transactions. Standard runs hold transport through their protected interval and pending completion save; drills hold across all blocks and resets. Network completion/failure does not update gameplay, validity, local storage or navigation.

The memory queue holds at most 64 events. Each request times out after three seconds; failures/status errors are dropped without retry, beacon, unload delivery, console logging, or durable queue. Events generated before consent are discarded and never backfilled. The guide event counts committed guide entries (including revisits); report counts committed views; start/end are deduplicated within a mounted live attempt, including React StrictMode. Page closure, voluntary navigation while saving, queue overflow, and offline use can lose observations. Receipt time is not task time. These events cannot establish exact task duration, reliable seven-day conversion, unique people, performance distributions, or normative scores.

## Required activation gates — all OPEN

Every gate below needs dated evidence, a named reviewer and an explicit approval record. No test result in this candidate changes these statuses. Settings are deployment attestations, not automated proof of provider behavior.

| Gate | Required evidence before setting `verified` |
|---|---|
| `CONSENT_PRIVACY_APPROVED` | Founder and privacy approval of exact notice, withdrawal treatment, schema, enums, observation meanings and retention; separate permission to activate |
| `PROVIDER_LOGGING_VERIFIED` | Account/project review of Pages/Worker invocation logs, traces, exception reporting, tail consumers, Logpush, CDN/access/security/WAF logs, D1 query/audit logs and any third-party destinations. Verify prohibited bodies/fields and full IPs are not persisted; verify no geo/identity enrichment. If provider behavior cannot meet this, collection stays off. |
| `BACKUP_EXPORT_VERIFIED` | Verify the actual plan's Time Travel window, restore behavior, replicas, snapshots, exports, R2 copies, manual copies and destinations. Demonstrate a receipt-based total retention bound of at most 90 days including purge lag; disable exports unless verified. No raw-record aggregates may extend it. |
| `RATE_LIMITING_VERIFIED` | Configure and load-test actual edge admission limits for this exact endpoint, including bursts, slow bodies, distributed traffic and spoofed Origin/session IDs. Verify no IP or personal data persists in resulting logs. Establish aggregate quotas/cost bounds and observable rejections. The 512-byte/body-time limits and client queue are not a server rate limiter. |
| `RETENTION_MONITORING_VERIFIED` | Verify separate hourly trigger, D1 binding, missing-run and failure alarms, oldest live row, deletion outcomes and account-level backup/export expiry. Alerts must contain only fixed operational status/aggregate counts. Demonstrate incident response and restore rehearsal. |

Additionally require `STOP_ANALYTICS_ENABLED` exactly `true`, exact `ANALYTICS_ORIGIN`, a separately managed activation revision (16–80 ASCII letters/digits/underscore/hyphen), and a successful matching-revision purge in the preceding two hours. Missing, stale, future or failed purge state rejects admission. This is an availability cutoff, not proof of retention compliance. Close the gates immediately if their evidence lapses. Current template settings are false/unverified/empty; no production configuration exists.

## Deletion and restore operating proposal

The separate Worker uses actual execution time and deletes rows with `received_at_ms <= now - 55 days`, inclusive. Proposed schedule: hourly. Ordinary successful live-row retention is therefore 55 days plus at most one schedule interval and execution lag; a failed/missed purge can leave older rows, so this is not a guarantee of deletion at exactly 55 days. There is no request-triggered purge. The Worker still purges when collection is off. The retention table holds only operational status/revision/time, no session record or counts.

Before deletion, it marks admission pending. Deletion and ready-state update are one D1 batch transaction. A failed purge keeps/re-marks admission failed and rejects with a fixed error. A complete D1 outage may prevent writing failure status; requests cannot insert during that outage, and the freshness cutoff applies when it recovers. The monitor must detect and escalate both failures and missing runs, independently of successful invocations.

Before **any restore/import**: disable collection outside the database; rotate the activation revision in both server environments; verify the restored schema; keep the restored database quarantined; run the purge using current execution time and original receipt timestamps; verify no expired rows remain; verify the new matching watermark and all account gates before separate approval to re-enable. Never rewrite receipt timestamps or reset a row's age. Restore snapshots may contain a formerly ready watermark; rotating the external revision is mandatory. The code cannot detect an operator restoring the same-revision snapshot without following this procedure.

## Provider references checked for this candidate

- [Pages Function bindings](https://developers.cloudflare.com/pages/functions/bindings/) and [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/): same-origin function and D1 binding shape.
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) and [binding API](https://developers.cloudflare.com/d1/worker-api/): parameter binding and transactional batch. Local SQL tests use SQLite, not a provider account.
- [Scheduled handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/): separate Worker entry point. The template has an hourly trigger; no trigger was registered.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): invocation logging can include enriched request context; source code without console calls is insufficient evidence.
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): documented plan-dependent windows are 7 days on Free and 30 days on Paid. This is not verification of this project's settings, exports, purge timing or total deletion.

S70–S71 remain open for independent audit, founder/privacy acceptance and actual operational evidence. M6-C, other games, production project creation, deployment, collection, push and release are outside this work.
