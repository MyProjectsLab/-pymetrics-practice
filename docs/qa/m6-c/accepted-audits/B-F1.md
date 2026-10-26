# Stop M6-B F1 — focused independent audit

## PASS — F1 repair at the exact target only

**Target:** `702a0fb956de2d76113f3a58c3474c9b24af3946`  
**Immediate parent:** `f85018ce9c06d98a8813110a4079a0034bfc25b4`  
**Audit date:** 2026-10-02 (America/New_York)

F1 is corrected: valid requests encountering the tested D1 prepare, bind, execution and missing-table failures receive empty generic HTTP 503 responses. Malformed requests retain empty HTTP 400 responses. No new blocking finding was identified within this focused scope. This verdict does not grant whole-M6-B acceptance or activation approval.

The parent audit at `/private/tmp/stop-m6b-independent-f85018c/AUDIT.md` was read before the delta. Its FAIL remains the historical verdict for its SHA. `docs/qa/m6-b/repair-f1/VERIFICATION.md`, its harness and JSON were inspected as developer claims. The results below come from a separately written audit harness and fresh execution.

## Identity and governing-document integrity

HEAD and immediate parent matched the requested commits. Repository status, including untracked files, was clean at entry and handoff. All 443 tracked files in both the repository and isolated audit snapshot matched target Git bytes after testing. The target-to-parent whitespace check passed.

Exactly six files changed:

- `server/analytics/collect.ts`
- `server/analytics/collect.test.ts`
- `IMPLEMENTATION_TRACKER.md`
- `docs/qa/m6-b/repair-f1/VERIFICATION.md`
- `docs/qa/m6-b/repair-f1/built-pages-entry.mjs`
- `docs/qa/m6-b/repair-f1/built-pages-entry.json`

The complete delta was inspected. The collector now ends its parsing/validation catch with 400 at line 58 and catches receipt-time/database failures separately with 503 at line 74. Its parameterized insert and admission predicate are unchanged. No logging was added. The Pages wrapper and build wiring are unchanged.

Both frozen documents match the working checkout, target, parent and approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

## Independent reproductions

`probe.mjs` exercises the source collector loaded through Vite and the freshly built `dist-analytics/collector.js` Pages `onRequest` export. Each case uses a new in-memory SQLite database initialized from the actual migration and a fresh, matching retention watermark. Activation flags exist only in local test objects.

| Check | Cases across both entry paths | Result |
|---|---:|---|
| Healthy controls: all 21 permitted event/value combinations | 42 | Empty 204; exactly one inserted row each |
| Prepare throws | 42 | Empty 503; zero writes or rows |
| Bind throws | 42 | Empty 503; zero writes or rows |
| Execution rejects before SQL executes | 42 | Empty 503; zero writes or rows |
| Actual SQLite insert after dropping `stop_analytics` | 42 | Empty 503; table remains absent; zero writes |
| Malformed JSON/top-level values and duplicate keys, including escaped spelling | 12 | Empty 400; no database call or write |
| Prohibited fields, 24 names including performance, personal, employer, local-history, timestamp and prototype keys | 48 | Empty 400; no database call or write |
| Empty settings, unset enablement and explicit false | 6 | Empty 503; request body unread; no database call or write |

**276 cases passed.** Every response was checked for an empty body and exactly the fixed `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` headers. All console functions plus stdout/stderr were captured during each invocation: zero calls. Injected exceptions included synthetic private detail; requests included synthetic IP headers. No detail appeared in responses or invocation logs. Reached-stage assertions confirm failures occurred at the intended layer. SQLite `total_changes()` and row counts independently verify no insertion on rejected requests; missing-table cases also verify table absence. Healthy controls demonstrate the request envelopes and adapter can reach a real insertion.

The submitted F1 tests do not themselves assert row counts for every new failure case; the independent harness supplies that evidence. The developer built-entry script was not run because it writes its submitted JSON, and its claims were not counted as independent evidence.

## Tests, build and evidence reuse

- Relevant test file run once: `./node_modules/.bin/vitest run server/analytics/collect.test.ts` — **108/108 passed**, including exact 400/403/405/413/415/503 statuses, all four F1 failures and default-off admission.
- `npm run build` run once — **passed**: TypeScript, application build, Pages collector and purge Worker bundles.
- Node 24.13.1; Vitest 4.1.11; Vite 8.3.1. No dependency installation. No full-suite or fresh lint result is claimed.

All 99 tracked files under `src/`, `functions/`, `workers/`, `migrations/`, `scripts/` and `docs/specifications/` are byte-identical to the parent. Dependency/build configuration is also unchanged. Parent evidence is reused for unchanged client, gameplay, purge and browser paths, with its original limitations. No full browser journey was repeated. The focused suite incidentally reruns its existing purge unit cases; no broader purge or browser audit was restarted.

The first independent harness run passed all assertions but Vite's unnecessary development WebSocket listener hit sandbox EPERM before invocation capture. The harness was configured with WebSockets/HMR disabled, and its 276 probes reran successfully. The original output is retained as `probe-preliminary.txt`. This was an audit-harness issue; product files, tests and build were not changed or rerun. Node's SQLite experimental warning is runtime startup output, not collector logging.

## Limits and open gates

These are local source/bundle executions with a D1-shaped adapter and SQLite, not Cloudflare Pages routing or actual D1/provider-failure evidence. No provider account, logs, retention settings or production traffic were inspected. Execution rejection is injected before SQL executes; post-commit response loss and provider transaction ambiguity are outside this audit.

All of the following remain open:

- The interpretation of “browser session” versus the implemented consented page/document epoch.
- Consent and withdrawal copy, withdrawal treatment, and technical-event enums; founder/privacy review.
- Retention limitation **L1**: when both purge-status writes fail, an old fresh ready watermark can still admit requests after recovery. F1 does not repair or close L1; no total deletion guarantee is granted.
- Provider activation, logging, backup/export expiry, rate limiting, retention monitoring, restore rehearsal and operational disablement.
- **S70–S71**, broader browser/device/accessibility acceptance, M6-B founder acceptance, deployment and release.

Collection remains default-disabled. No repository, submitted evidence, specification, tracker or Git-state edits; no push, deployment, provider configuration or collection enablement. Only new temporary audit evidence and an isolated source/dependency copy were created.

## Reproduce and evidence

From `/private/tmp/stop-m6b-independent-702a0fb`:

1. In `source/`: `./node_modules/.bin/vitest run server/analytics/collect.test.ts`.
2. In `source/`: `npm run build`.
3. From the audit directory: `node probe.mjs`.

The probe overwrites its own `probe-results.json`; preserve the existing evidence before rerunning. The audit needs the copied dependencies and Node SQLite support, with no provider access.

Evidence: `identity.json`, `final-identity.json`, `exact-status-tests.txt`, `build.txt`, `probe.mjs`, `probe-results.json`, `probe.txt`, `probe-preliminary.txt`, and `EVIDENCE-SHA256.json`. The final identity record includes rebuilt output hashes and the hash of the reused parent audit.
