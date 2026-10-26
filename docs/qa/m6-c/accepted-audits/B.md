# Stop M6-B independent audit

## Verdict: FAIL — disabled code candidate

**Target:** `f85018ce9c06d98a8813110a4079a0034bfc25b4`  
**Immediate parent:** `1c716a544520309cc814062baf83078870fc2d98`

One reproducible code defect prevents a PASS: the collector returns HTTP 400 for operational D1 failures. Default-off enforcement passed. This finding does not mean that collection is active or that the default build leaked data.

This audit does not approve the proposed notice, withdrawal policy, technical enums, provider settings, retention guarantee, S70–S71 completion, collection activation, deployment, release, or M6-B founder acceptance. The verification record and privacy proposal were inspected as claims, not approval records.

## Finding F1 — P2: database failures are reported as client errors

**Location:** `server/analytics/collect.ts:45–70`, especially line 70.

The same `try/catch` covers JSON decoding/validation and the D1 prepare, bind, and execution path. Its catch always returns an empty HTTP 400. With a valid same-origin request and every activation gate satisfied, each of these independent injections returned 400:

1. `ANALYTICS_DB.prepare()` throws.
2. The returned statement's `bind()` throws.
3. The bound statement's `first()` rejects.
4. The actual local SQLite adapter executes the insert after `stop_analytics` has been dropped.

All response bodies were empty, as intended for privacy. The status classification is incorrect: these are server/database failures, not malformed candidate requests. The handler consumes the exception, emits no sanitized operational signal, and the client drops responses without retry or status handling. Monitoring that classifies 5xx or uncaught invocation exceptions as operational failures would miss these errors or count them as bad client payloads. Separate provider database monitoring could still detect them; this is not a claim that all possible monitoring is blind.

**Required correction:** keep malformed input as 400, but isolate the database operation and return a generic 500/503 for operational failure. Preserve empty bodies and avoid request content, IPs, SQL values or underlying errors in diagnostics. Any additional operational signal should be fixed/aggregate and reviewed separately. No fix was made during this audit.

**Reproduction:** from this audit directory, `node server-audit.mjs`. See `server-results.json`, group `REPRODUCTION database outages are mislabeled HTTP 400`. Its assertions confirm the defective behavior; a passing reproduction is not a passing candidate verdict.

## Identity, integrity and scope

- HEAD and immediate parent exactly match the requested commits. Checkout status was clean at entry and final verification, including untracked files.
- The delta was inspected before test selection: 45 changed files. It adds analytics client/contract/consent/observation code, the Pages collector, D1 migration, scheduled purge Worker, example configuration, tests and build wiring, plus tracker/proposal/evidence files. Existing UI changes are limited to App, Journey, LiveRun, Preflight, Report and TrainingFlow.
- No source under `docs/specifications/` changed. No changes to the engine, run orchestration, scoring formulas, training router, local-store implementation, standard/drill manifests or other games were present.
- Fresh tests ran from a `git archive` snapshot under `/private/tmp/stop-m6b-independent-f85018c/source`, with a separate copy of installed dependencies. Audit scripts/results and one extra test file were written only in that temporary audit directory. No repository, Git-state, submitted evidence, tracker or specification edits; no push or deployment.
- After testing, every tracked snapshot file still matched the target commit. All 110 submitted source hashes, 18 evidence hashes and 12 independently rebuilt output hashes matched. This verifies artifact identity, not the truth of every submitted claim.

Both frozen documents match the working files, candidate, parent and approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

**Whitespace check does not pass:** `git diff --check parent target` exits 2, flagging new blank lines at EOF in `docs/qa/m6-b/PREVIOUS_STATUS_SUMMARY.md:99` and `docs/qa/m6-b/preliminary-tests.txt:15`. These are non-blocking evidence-format issues, retained unchanged. The verification table's bare `git diff --check` entry must not be read as a clean result.

### Accepted M6-A evidence reuse

Read the SHA-bound parent audit at `/private/tmp/stop-m6a-independent-1c716a5/AUDIT.md`. Seventy-eight pre-existing `src/` files remain unchanged. Prior accepted evidence is reused only for unchanged engine rules, scoring, router v1/v2 behavior, leases, watchdogs, storage and form validation. Changed consent/observation/transport composition received fresh checks below. Parent acceptance is not substituted for testing the new UI hooks, and the submitted M6-B five-journey logs are not counted as independent browser runs.

## Server, payload and SQL probes

The independently written built-entry fixture completed 13 groups, including the defect reproduction and a retention limitation. It uses the freshly rebuilt Pages/Worker modules and the real migration SQL through Node's local SQLite adapter.

- **Default off:** empty/disabled settings return 503 before reading the request body or accessing the database.
- **Activation:** each missing or incorrectly spelled consent/privacy, provider logging, backup/export, rate-limiting, and retention-monitoring attestation rejects admission. Enablement must be exactly `true`; every attestation exactly `verified`. Missing database/revision rejects; revision lengths 16 and 80 are accepted with matching watermark, lengths 15 and 81 and prohibited characters reject. These strings are operator attestations, not automated evidence that a gate is satisfied.
- **Origin/request:** method, endpoint path, nonempty query, configured origin, Origin header and Sec-Fetch-Site constraints were tested. Cookies, Authorization and Content-Encoding reject. Exact JSON content type is enforced. Origin is not authentication against a non-browser caller; actual rate limiting remains an external activation gate.
- **Payload:** independently enumerated all 21 allowed event/value combinations across the 12 event names. All accepted. A further 705 malformed/type/field/enum/duplicate-member cases rejected with 400. This includes missing fields, prohibited extras, literal and escaped duplicate names, and invalid top-level JSON. Database rows contain only fixed schema columns plus server receipt time; no raw payload blob.
- **Body:** 512 actual bytes accepted; 513 bytes and 514 UTF-8 bytes rejected even with a false Content-Length. Invalid UTF-8 rejects. An unfinished stream is canceled at the two-second limit. Oversized/malformed Content-Length rejects.
- **Admission watermark:** ready/current revision at freshness limit minus 1 ms admits; exactly two hours old rejects. Future, pending, failed, wrong-revision and missing singleton state reject.
- **Purge boundary:** rows at `now − 55 days − 1 ms` and exactly `now − 55 days` are deleted. The row 1 ms younger remains. Repeating the purge is idempotent.
- **Purge failures:** injected deletion and ready-update failures roll back the batch, preserve undeleted rows, mark failed and block admission. A later successful purge restores admission. Scheduler deletion works with collection disabled; Worker HTTP entry returns 404.
- **Concurrent admission:** an admission paused before executing its SQL, then released after the purge writes pending, returns 503 with no insert. Failed purge state also rejects. An insertion completed before pending is legitimate and retained. Twenty simultaneously initiated admitted requests each produce one fixed-column row. The gate and insertion are a single SQL statement, avoiding a separate check/insert race in this simulation.
- **Restore:** changing the external revision rejects a formerly ready watermark until a successful purge writes the matching new revision. Original receipt times determine expiry. Same-revision restores are not detectable by this code; external disable/rotation/quarantine remains necessary.

### Retention limit L1 — old ready state can survive failed status writes

Inject failure of both the initial pending update and the catch-path failed update. The purge rejects. Restore database availability while the old watermark is still fresh: collection returns 204. This is reproduced in `server-results.json`.

The code cannot durably latch failure when the database cannot accept either write. A completed failed-state write blocks admission; a thrown purge invocation alone does not guarantee that it will remain blocked after recovery. The old watermark eventually expires at two hours. The candidate documentation acknowledges this outage case. It needs independent failure/missing-run monitoring and operational disablement before activation; this audit does not grant a retention guarantee. Admission cutoff also does not delete overdue rows. Ordinary scheduled deletion may lag 55 days, and missed runs/backups/exports remain separate risks.

## Client and bounded browser probes

Fresh `npm run check` passed: **633 tests across 35 files**, lint with the two inherited warnings, all 14 standard/five drill manifest checks, TypeScript, application build and collector/Worker builds. Installed runtime: Node 24.13.1, Vitest 4.1.11, Vite 8.3.1. No dependencies were installed.

Five additional independent client fixtures passed. They cover late completion of an old aborted request after reconsent, replacement-flight ownership, multiple pending-save holds, withdrawal while protected with no later backfill, and a realistic three-second abort rejection followed by queued-event processing without retry. A synchronous transport failure remains contained.

Independent browser checks used Chromium headless shell 145.0.7632.6, actual React/DOM/IndexedDB, and intercepted analytics requests. Candidate UI testing used the explicit local Vite flag; no server collection was enabled.

- Default production build: Allow disabled, decline/guide navigation functional, zero analytics requests.
- An additional short lifecycle probe held a real fetch in flight: withdrawal aborted its signal and suppressed subsequent guide requests. Another tab began with consent off and received a distinct ID on opt-in. No tested ID appeared in localStorage, sessionStorage or cookies. Delete all local data revoked consent and aborted its in-flight request.
- Candidate build: decline and withdrawal followed by guide navigation stayed silent. Keyboard Allow/Withdraw worked. Synthetic persisted `pagehide` revoked consent and suppressed a subsequent event. Reconsent and reload generated different IDs, and reload began with consent off.
- **One complete baseline only**, with every attempted analytics request failed by the browser route. An observational wrapper recorded actual hold predicates at fetch invocation, rather than relying only on canvas visibility. Warm-up, its untimed transition, scored play, and a deliberately delayed result save all prevented sends. A sentinel coarse event at the warm-up transition did not escape the hold.
- The pending result was opened, then its component was unmounted by returning to the library while its save remained delayed. Queued analytics stayed blocked. After releasing the save and issuing a safe ordinary event, transport resumed. All recorded fetches occurred with the inspected hold predicates false.
- The saved result's summary and event bytes matched the immutable pre-save result despite network failure. The result remained available in history after reload. Its analytics UUID was absent from the serialized local database.
- A previously accepted historical local training fixture was seeded solely to reach a drill quickly. One detection block ran to its summary. The summary remained protected even with the live canvas absent, and a queued coarse event did not send. This is a seeded partial drill check, not a new baseline/drill/retest qualification.

Browser scope deliberately avoids repeating the submitted five full journeys. The baseline was rerun once after correcting an audit-harness assertion that checked history before asynchronous rendering completed; the preliminary failure is retained in `browser-preliminary-history-wait.json`. No product code changed. The final run awaited the committed history button and passed. Two preliminary short lifecycle probes also had harness-only errors: checking the second tab before its initial render, and looking for the library consent status while still on the history screen. Their outputs are retained; the corrected probe waits for rendering and returns to the library, then passes all three checks.

## §23.5: page memory versus “browser session”

The implementation's identifier unit is a **consented page/document epoch**: consent, ID and queue live in module memory. Withdrawal resets them, a later opt-in creates a new UUID, reload starts off, and even a `pagehide` with `persisted: true` resets consent. The same browser/tab remaining open across reload does not retain one identifier. Navigation within the live React page does retain it until withdrawal/pagehide.

This satisfies the tested constraints against persistent storage, cross-site sharing and identifier reuse after a page epoch. It is shorter-lived than a browser session understood to survive document reloads, and can split one tab visit into multiple analytics sessions. The frozen specification does not define that boundary precisely enough to certify the candidate's page-session interpretation as an approved meaning of “browser session.” This is an unresolved specification interpretation, not evidence of persistent tracking and not permission to introduce persistent/session storage. Obtain an explicit founder interpretation before treating S71/session-level counting as complete. No notice or specification revision is approved here.

## Provider and evidence limits

The database probes are **local SQLite simulation**, not Cloudflare runtime evidence. Official [D1 database documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) describes batch transactions, and [prepared-statement documentation](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) describes the binding interface. Those references support the intended API model; this audit did not execute actual D1 bindings, Pages routing, Worker scheduling, provider failures or global concurrency.

No provider account, logs, WAF, rate limits, backup/export/replica expiry, restore operation, monitoring or retention setting was inspected or changed. No 55-day or 90-day total deletion guarantee follows from these tests. No production traffic or candidate data was collected.

Browser timed checks use a Playwright-controlled clock; pagehide is synthetic, not a native bfcache/OS suspension qualification. No Safari/Firefox, supported device matrix, physical input/display latency, native assistive-technology, complete accessibility or full S01–S75 certification is claimed. An already-transmitted request cannot be recalled by client abort. Network transport is held, but this does not prove zero JavaScript/GC overhead or zero physical timing impact.

## Reproduce

All paths below are relative to `/private/tmp/stop-m6b-independent-f85018c`. Scripts overwrite their own audit output, so preserve it first.

1. From `source/`, run `npm run check` (the original fresh run was before adding the independent test, so it reports 633). For the extra fixtures, run `npx vitest run src/analytics/independent-audit.test.ts`.
2. Run `node server-audit.mjs` against the freshly built collector/Worker modules.
3. From `source/`, serve the default build on 5587: `npm run preview -- --host 127.0.0.1 --port 5587 --strictPort`.
4. Serve the explicit local candidate UI on 5586: `VITE_STOP_ANALYTICS_CANDIDATE=true npm run dev -- --host 127.0.0.1 --port 5586 --strictPort`.
5. Run `node browser-audit.mjs` and `node lifecycle-audit.mjs`. They use the installed local Playwright/Chromium paths named in their source. Analytics requests are intercepted, never delivered to a provider.

Evidence: `identity.json`, `check.txt`, `server-results.json`, `independent-client.txt`, `browser-results.json`, the corresponding scripts/test source, and the lifecycle results. `EVIDENCE-SHA256.json` binds the audit outputs. Repository status is independently rechecked at handoff.

Final handoff: both local audit servers stopped; repository HEAD and clean status rechecked.
