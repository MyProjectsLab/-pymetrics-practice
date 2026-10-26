# Stop M6-B — disabled analytics candidate verification

Date: 2026-10-01 (America/New_York).

**Status:** implemented and developer-tested locally. Collection disabled. Separate read-only exact-SHA audit, founder acceptance of M6-B, and founder/privacy review remain pending. S70–S71 are not marked complete. No production project, deployment, push, collection enablement, M6-C, other game or release.

## Starting authority and integrity

Started from clean HEAD `1c716a544520309cc814062baf83078870fc2d98`. Read AGENTS.md, the complete master strategy, complete Stop V1.1 and complete tracker before edits. The founder's current instruction confirms M5 and M6-A founder acceptance as development milestones. The tracker summary now records that confirmation; prior detailed handoffs remain history. `PREVIOUS_STATUS_SUMMARY.md` preserves the superseded summary verbatim.

Both specifications still match approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0` and the starting HEAD:

| Frozen document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

The founder explicitly requested 55-day live-row deletion. The frozen specification's proposed 90-day retention is preserved; the proposal distinguishes the shorter live window from unverified backup/export expiry and the total retention ceiling. No new specification approval is claimed.

## Candidate implementation

### Collection boundary

`functions/api/stop-analytics.ts` is the same-origin Pages Function entry. `server/analytics/collect.ts` validates every request before its parameterized D1 insert. It rejects all requests by default before reading a body or using D1. Explicit enablement alone is insufficient: every review/operational gate, exact origin, configured activation revision and a matching recent successful purge are also required.

The contract accepts exactly the §23.5 events. Standard start modes are baseline/replay/retest; drills have dedicated events and no identity; there is no mock event. All fields are mandatory for their event. Unknown fields, wrong types, invalid enum combinations, duplicate JSON members (including escaped key names), local identifiers, arrays and malformed JSON reject the entire payload. UUIDv4 is the only client identifier shape. The database has fixed columns and additional constraints; it never stores a raw request/payload blob.

Other controls: POST only; exact configured/request/Origin equality; `Sec-Fetch-Site: same-origin`; no CORS permission, cookies or Authorization; no query string or content encoding; exact JSON content type; 512-byte actual streamed-body limit even with absent/false Content-Length; two-second body timeout; generic empty error responses; no application request/error/IP logging. Origin checks are not authentication against a non-browser caller. Real rate limiting is an open activation gate.

Only the server supplies `received_at_ms`. No task timestamps, answers, scoring, sequences, response times, key/input values, accommodations, drill identities, history IDs, personal/employer data, IP or geo enrichment enters analytics rows. The browser sends with credentials omitted, no referrer, same-origin mode and redirects rejected.

### Consent and observation

`src/analytics/Consent.tsx` holds the exact proposed notices. The [privacy review proposal](../../privacy/STOP_M6_B_REVIEW_PROPOSAL.md) reproduces them and lists every enum, meaning, withdrawal limitation and gate. Both are clearly labeled proposals. Client consent starts off on every page. The default build also disables Allow; only an explicit local test-build flag exposes it. The server remains independently disabled.

A newly consented page receives a random UUID kept only in memory. It is not joined to task IDs, persisted, shared across tabs or reused after reload/reconsent. Withdrawal discards queued events, aborts fetch best-effort and forgets the ID. Pagehide, including a bfcache-style transition, revokes consent. Delete all local data also revokes it. Received rows are not retroactively erased by withdrawal; this proposed treatment requires review.

Small UI effects observe coarse milestones, independently of task recording. No modifications were made to the timing engine, run orchestration, scoring, router, local-store transaction implementation, form data, drill mechanics or local journal schemas. A hold registered before timed entry aborts pending sends and blocks new sends through the protected interval and pending completion saves. A pending-save hold survives component exit; a later ordinary UI transition may drain once safe. Transport neither awaits nor changes gameplay or local-record writes. Untimed background storage reads/writes can otherwise overlap network work; there is no analytics call inside those writes or dependency on their success.

The queue is bounded at 64 events; fetch times out after three seconds. No durable retry, unload beacon, error log, or response-driven product state. Event loss is intentional on failure, queue overflow and page exit. No retroactive collection of pre-consent events. Receipt timestamps must not be treated as task times. See the proposal for exact observation and counting semantics.

### Separate deletion Worker

`workers/stop-analytics-purge/index.ts` has a scheduled handler and a rejecting HTTP handler. It marks admission pending, then atomically deletes rows received at or before `execution time - 55 days` and updates the ready watermark. It runs independently of collection enablement. On failure it marks admission failed where D1 remains writable and returns a fixed error without row/error contents. The collector checks revision/freshness in the same SQL statement as insertion.

The review-only Worker template proposes an hourly cron. Ordinary deletion can lag the 55-day eligibility time by a schedule interval and execution lag; failure can leave older rows. Two-hour freshness admission rejection and an operational failure state do not prove deletion. Monitor failures and absent runs. Before restore/import, disable collection outside D1, rotate the revision in both environments, quarantine the restored database, purge using original receipt times/current execution time, verify expiry and all gates, then seek separate re-enable approval. Same-revision restores without that procedure cannot be detected reliably by this code.

## Checks and evidence

Node 24.13.1; dependencies remain those of the starting lockfile. No package installed or provider account accessed.

| Check | Result / evidence |
|---|---|
| `npm run check` | PASS: lint, **633 tests / 35 files**, 14 standard manifests, five drill manifests, TypeScript, Vite app build and separate ES-module collector/Worker builds; `check.txt` |
| Lint | Two inherited warnings only: `cross-tab.mjs` unused parameter and App effect dependency; no new warning |
| Server/SQL tests | **101 tests**: default rejection, each missing gate, strict payload/type/enum allowlist and prohibited fields, duplicate fields, origin/method/credentials/content/query/byte/stream-time boundaries, no logging/enrichment, stale/future/failed/revision admission, exact expiry, failed purge, post-restore purge and independent scheduler |
| Client/component tests | **22 tests**: default off, pre-consent silence/no backfill, decline, withdrawal/abort/rotation, storage non-use, holds through timing and saves including unmount, queue cap, network rejection/throw/status/hang, StrictMode deduplication and mode/dedicated-event integration |
| Existing regression | All **510** prior tests pass, including timing, input, local persistence/deletion, recovery, scoring, training and retest behavior |
| Built-entry smoke | `bundle-check.json`: compiled Pages handler with empty environment returns 503; compiled purge HTTP entry returns 404 |
| Browser journeys | Five complete baseline → report → recommended detection drill → retest → comparison → saved history → reload journeys; see matrix below |
| Consent access | `consent-ui.json`: keyboard Allow/Withdraw, 320px reflow, reload consent off/new ID and bfcache-style pagehide reset |
| Integrity | `git diff --check`; frozen hashes and all source/build hashes in `TESTED-SOURCE.json`; evidence hashes in `EVIDENCE-SHA256.json` |

### Browser matrix

Chromium 145.0.7632.6 with a **Playwright-controlled browser clock**. Real DOM, React, network interception, Web Locks and IndexedDB; synthetic time and no scored key responses. These are browser integration tests, not physical timing/native-lifecycle or supported-device certification. Both baseline and retest reports remain valid or valid with an allowed timing note. The prescribed drill completes and the compatible comparison is available. Each final run asserts two saved standard reports, one saved drill, reload recovery, no analytics ID in local/session storage, cookies or IndexedDB, and consent off after reload.

| Evidence | Consent/network condition | Analytics attempts |
|---|---|---:|
| `browser-default.json` | Default production build; Allow disabled, decline | 0 |
| `browser-decline.json` | Candidate test build; decline | 0 |
| `browser-withdraw.json` | Candidate test build; opt in then withdraw before use | 0 |
| `browser-consent.json` | Candidate test build; opt in; endpoint returns disabled 503 | 15 |
| `browser-network-failure.json` | Candidate test build; opt in; all network requests aborted | 15 |

The 15 attempts include every integrated funnel event. No request occurs while the timed task/drill canvas is visible; requests omit cookies/referrer and use only the allowed fields and one page ID. No actual external collector received these browser events. Server acceptance/rejection and exact SQL contents are tested independently using synthetic rows in an in-memory SQLite database.

### Reproduction and limits

1. `npm run check` builds the default-disabled app and collector/Worker modules. The test suite uses Node's experimental built-in SQLite API to execute the real migration/SQL through a minimal D1-shaped adapter.
2. Serve the default build locally with `npm run preview -- --host 127.0.0.1 --port 5567 --strictPort`.
3. For the explicit consent-test UI only, serve `VITE_STOP_ANALYTICS_CANDIDATE=true npm run dev -- --host 127.0.0.1 --port 5568 --strictPort`. This does not enable a server or collect data.
4. Run `CASE=default node docs/qa/m6-b/browser.mjs`, then the decline/withdraw/consent/network-failure cases. `node docs/qa/m6-b/consent-ui.mjs` checks the consent controls. The drivers name the installed local Playwright/Chromium paths and overwrite their evidence files; copy this directory before reproducing if retaining the handoff evidence.

Cloudflare's actual Worker runtime, bindings, scheduler, WAF, logs, retention settings, Time Travel and exports were not exercised. Review-only `.jsonc.example` files are not active deployment configuration and have no real database ID. Account-level verification, provider-runtime qualification and review remain required before any activation.

Preliminary evidence is retained honestly: `preliminary-clock-driver.json` shows an initial controlled-clock driver that advanced before native IndexedDB work settled; the corrected driver yields between 100ms clock steps. `preliminary-comparison-wait.json` shows an assertion made before asynchronous comparison authority completed; the final driver waits for the committed heading and saved history. Earlier runs checked history too early; final runs assert saved reports and reload recovery. `preliminary-tests.txt` is the earlier 631-test run, superseded by the final 633-test `check.txt`. Sandbox restrictions on localhost/browser launch were resolved with approved local execution; there was no deployment. No preliminary harness failure is counted as a product PASS.

## Open activation gates and audit handoff

All remain OPEN: exact consent/withdrawal/enum founder and privacy approval; provider logging/full-IP avoidance; actual backup/export/replica verification and total retention; actual endpoint rate limiting/abuse load testing; independent retention monitoring, hourly trigger, failure/missing-run alerts and restore rehearsal. Explicit activation approval and reviewed settings are also absent. Default server rejects all collection requests.

S70 has local candidate coverage for refusal/withdrawal without lost features. S71 has local payload, ID and deterministic deletion coverage. Neither is operationally complete. Independent exact-SHA audit, founder acceptance of this candidate, complete Stop acceptance, M6-C, supported browser/device/accessibility/rights/claims certification, deployment and release are separate.

Changed files: `FILES.txt`. This record plus the exact local commit SHA supplied in the handoff is the audit target; this implementation record grants no independent PASS.
