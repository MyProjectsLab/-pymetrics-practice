# Stop M5 R1/R2 repair — developer verification

Date: 30 September 2026 (America/New_York).

**Subsequent audit:** the independent audit of `499deb4ee02fb8ec9cd8c90e2ae95673dd0e10c6` returned **FAIL** on cross-tab buffered-journal loss (F1), stale deletion-broken eligibility (F2), and initial scored-fixation input admission (F3). The record below is historical developer evidence. The focused repair is documented in [F1–F3 verification](../repair-f1-f3/VERIFICATION.md); fresh exact-SHA audit and founder acceptance remain pending.

**Implemented and developer-tested; fresh separate exact-SHA independent audit and founder acceptance pending.** The independent FAIL at `88b7ec53228d258f0048b27c1ca98d7cb76bf092` remains attached to that SHA. No audit PASS, founder acceptance, deployment or release is claimed here.

## Starting state and authority

Starting HEAD: `88b7ec53228d258f0048b27c1ca98d7cb76bf092`; immediate parent: `bcf319f05f8f371e39688ee51fc2fa8b7b6c1caa`. Index and working tree were clean before evidence creation. Read the complete [independent audit](/private/tmp/stop-m5-audit-88b7ec5/AUDIT.md), AGENTS.md, both governing specifications, tracker and previous M5 repair verification. No agents were delegated and this report is implementation-agent evidence.

[Integrity record](integrity.json) compares working bytes, HEAD, parent and founder-verified continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Governing document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

The [adversarial acceptance matrix](ACCEPTANCE.md) was written before production edits. Both failures were reproduced through production paths before fixing them:

- **R1:** actual Start retest → Back → history deletion → save retry, with a transient fault at `saveChain` and real IndexedDB. The deleted 522-event drill journal returned, and retest was unlocked after reload. [Full before/after store evidence](before-deletion-ui.json); original driver copied to `/private/tmp/stop-m5-r1-r2-before/deletion-ui.mjs` from the independent audit and directed to port 5217.
- **R2:** hidden-page, freeze and visual-setting events inserted before completion, without `session_invalidated`, each admitted one result and an active chain. [Before evidence](before-lifecycle-compare.json); production `inspectLocalState` driver at `/private/tmp/stop-m5-r1-r2-before/lifecycle-compare.mjs`.

## What changed

### R1 — deletion is authoritative at both boundaries

The IndexedDB readwrite transaction refuses snapshots of retired chains, deleted dependencies, or missing saved retest attempts. Load admission also refuses a chain that already has a retirement record, including stores containing both copies from the old bug. No new storage schema, tombstone collection or reclamation policy was introduced.

Individual deletion includes buffered same-tab attempts in its atomic retirement. The requested journal is removed; other attempts remain in retired history for review. Only affected queued snapshots and the affected active chain are canceled. A generation check stops the old worker before automatic retry, even when its promise rejects after deletion. A typed retirement rejection also cancels that chain when detected by a save from a stale tab. Unrelated queued work retains its pending/failure disclosure and can still save. Ordinary missing writes remain recoverable failures; they are not labeled intentional deletion.

### R2 — admission reconciles evidence during protection

Completed standard results now reconcile hidden-page, lifecycle, settings, viewport, measured focus-duration and warm-up anomaly evidence through completion. The same check applies to baselines and retests. Response acceptance is also checked against held/repeated/unfocused input evidence across protection. Existing input count thresholds remain in force.

Standard scored batches reuse the existing interval-evidence validator: confirmed onset/offset/deadline/fixation observations must agree with timing anomalies and the final interval. A false non-severe label cannot hide a severe observation. A legitimate single timing note and the permitted single warm-up restart remain valid. No live-engine timing, mechanics, forms, scoring, router, profile grouping, or candidate claims changed. Admission is read-only: rejected source records, original summaries and exposure markers are preserved.

## R1 case-by-case results

[Driver](deletion-races.mjs) · [raw output](deletion-races.json). All rows use real UI confirmation and real IndexedDB. `pending` holds a save before its transaction; `pending-reject` holds and later rejects it. The before/after order refers to explicit retry relative to deletion. Every row also attempts a direct stale transaction after deletion and checks reload/UI. All 36 rows passed.

| Save condition | Deletion | Retry order | Active chain after reload | Retained drill rows | Direct stale write |
|---|---|---|---:|---:|---|
| failed | drill | retry-before-delete | 0 | 1 | DeletedChainError |
| failed | drill | retry-after-delete | 0 | 1 | DeletedChainError |
| failed | retest | retry-before-delete | 0 | 2 | DeletedChainError |
| failed | retest | retry-after-delete | 0 | 2 | DeletedChainError |
| failed | completed-retest | retry-before-delete | 0 | 2 | DeletedChainError |
| failed | completed-retest | retry-after-delete | 0 | 2 | DeletedChainError |
| failed | baseline | retry-before-delete | 0 | 2 | DeletedChainError |
| failed | baseline | retry-after-delete | 0 | 2 | DeletedChainError |
| failed | all | retry-before-delete | 0 | 0 | Error |
| failed | all | retry-after-delete | 0 | 0 | Error |
| failed | unrelated | retry-before-delete | 1 | 2 | accepted |
| failed | unrelated | retry-after-delete | 1 | 2 | accepted |
| pending | drill | retry-before-delete | 0 | 1 | DeletedChainError |
| pending | drill | retry-after-delete | 0 | 1 | DeletedChainError |
| pending | retest | retry-before-delete | 0 | 2 | DeletedChainError |
| pending | retest | retry-after-delete | 0 | 2 | DeletedChainError |
| pending | completed-retest | retry-before-delete | 0 | 2 | DeletedChainError |
| pending | completed-retest | retry-after-delete | 0 | 2 | DeletedChainError |
| pending | baseline | retry-before-delete | 0 | 2 | DeletedChainError |
| pending | baseline | retry-after-delete | 0 | 2 | DeletedChainError |
| pending | all | retry-before-delete | 0 | 0 | Error |
| pending | all | retry-after-delete | 0 | 0 | Error |
| pending | unrelated | retry-before-delete | 1 | 2 | accepted |
| pending | unrelated | retry-after-delete | 1 | 2 | accepted |
| pending-reject | drill | retry-before-delete | 0 | 1 | DeletedChainError |
| pending-reject | drill | retry-after-delete | 0 | 1 | DeletedChainError |
| pending-reject | retest | retry-before-delete | 0 | 2 | DeletedChainError |
| pending-reject | retest | retry-after-delete | 0 | 2 | DeletedChainError |
| pending-reject | completed-retest | retry-before-delete | 0 | 2 | DeletedChainError |
| pending-reject | completed-retest | retry-after-delete | 0 | 2 | DeletedChainError |
| pending-reject | baseline | retry-before-delete | 0 | 2 | DeletedChainError |
| pending-reject | baseline | retry-after-delete | 0 | 2 | DeletedChainError |
| pending-reject | all | retry-before-delete | 0 | 0 | Error |
| pending-reject | all | retry-after-delete | 0 | 0 | Error |
| pending-reject | unrelated | retry-before-delete | 1 | 2 | accepted |
| pending-reject | unrelated | retry-after-delete | 1 | 2 | accepted |

For affected individual deletions, memory is cleared and no automatic or explicit retry restores the removed journal. Another unsaved drill is saved to retired history. Unrelated result and exposure hashes match. For delete-all, all history, chains and markers remain absent; a fresh installation ID is expected on reopen. For unrelated deletion, both drill attempts remain in the active chain and the queue later drains successfully. Queue cancellation is checked behaviorally through recorded write calls and retry attempts, without adding a product debugging API.

[Edge driver](deletion-edges.mjs) · [raw edge output](deletion-edges.json):

| Edge | Result |
|---|---|
| Delete a pre-onset retest draft whose link exists only in the failed queue | Draft removed, chain retired, memory cleared, other 522-event drill retained, retry cannot restore eligibility |
| Delete a remaining drill from an already retired chain | Journal removed, direct stale snapshot rejected |
| Load legacy data containing both retired and active copies | No active chain admitted |
| Failed queue contains a retired old chain and unrelated new chain | Unit fixture rejects old snapshot once and saves the newer chain; no unrelated loss |
| Held write rejects after deletion | Unit fixture records one call, no automatic retry and no active chain |

## R2 case-by-case results

[Driver](reload-evidence.mjs) · [raw output](reload-evidence.json). Every case reloads actual IndexedDB, checks production admission and active memory, and renders history. Invalid baselines have no original-report action or progress series. Invalid retests leave only the independent valid baseline report/progress; their chain is unavailable. Every row records equal before/after source hashes, exposure hashes, and absence of the derived invalidation event. All 76 cases passed.

“Valid” is the required positive control, not an unqualified release certification.

| Evidence / control | Baseline admission | Retest admission | Outcome |
|---|---|---|---|
| intact | Valid | Valid | PASS; bytes preserved |
| timing-note | Valid | Valid | PASS; bytes preserved |
| hidden | Rejected | Rejected | PASS; bytes preserved |
| pagehide | Rejected | Rejected | PASS; bytes preserved |
| freeze | Rejected | Rejected | PASS; bytes preserved |
| resume | Rejected | Rejected | PASS; bytes preserved |
| pageshow | Rejected | Rejected | PASS; bytes preserved |
| response_key | Rejected | Rejected | PASS; bytes preserved |
| visual_profile | Rejected | Rejected | PASS; bytes preserved |
| timing_profile | Rejected | Rejected | PASS; bytes preserved |
| input_device_class | Rejected | Rejected | PASS; bytes preserved |
| accessibility | Rejected | Rejected | PASS; bytes preserved |
| width-767 | Rejected | Rejected | PASS; bytes preserved |
| height-599 | Rejected | Rejected | PASS; bytes preserved |
| viewport-boundary | Valid | Valid | PASS; bytes preserved |
| blur-999 | Valid | Valid | PASS; bytes preserved |
| blur-1000 | Valid | Valid | PASS; bytes preserved |
| blur-1001 | Rejected | Rejected | PASS; bytes preserved |
| unmatched-blur-1000 | Valid | Valid | PASS; bytes preserved |
| unmatched-blur-1001 | Rejected | Rejected | PASS; bytes preserved |
| lying-blur-duration | Rejected | Rejected | PASS; bytes preserved |
| repeated-brief-blur | Valid | Valid | PASS; bytes preserved |
| severe-tail | Rejected | Rejected | PASS; bytes preserved |
| false-nonsevere-tail | Rejected | Rejected | PASS; bytes preserved |
| two-nonsevere | Rejected | Rejected | PASS; bytes preserved |
| second-warmup-anomaly | Rejected | Rejected | PASS; bytes preserved |
| fixation-2 | Valid | Valid | PASS; bytes preserved |
| fixation-3 | Rejected | Rejected | PASS; bytes preserved |
| wrong_key-4 | Valid | Valid | PASS; bytes preserved |
| wrong_key-5 | Rejected | Rejected | PASS; bytes preserved |
| extra-9 | Valid | Valid | PASS; bytes preserved |
| extra-10 | Rejected | Rejected | PASS; bytes preserved |
| repeat-20 | Valid | Valid | PASS; bytes preserved |
| pre-start-setting | Valid | Valid | PASS; bytes preserved |
| hidden-during-warmup | Rejected | Rejected | PASS; bytes preserved |
| negative-time | Rejected | Rejected | PASS; bytes preserved |
| missing-stimulus | Rejected | Rejected | PASS; bytes preserved |
| held-outcome | No accepted responses in baseline fixture | Rejected | PASS; bytes preserved |
| repeat-outcome | No accepted responses in baseline fixture | Rejected | PASS; bytes preserved |

Additional production-run unit controls exercise one real warm-up timing restart followed by a real single scored timing note. The [verbose threshold/run/queue log](thresholds.txt) records the existing deterministic engine suite’s below/at/above timing and input cases, including three anticipatory responses and held/repeated-key protection. The browser journal probes cover the specified lifecycle contradictions and representative data-integrity conditions; they do not claim exhaustive corrupt-record enumeration.

## Original B1–B5 and N1 regressions

[Original audit probes adapted to this repair](regressions.mjs) · [raw results](regressions.json) · [supplement](supplement.mjs) · [supplement results](supplement.json) · [fixture generator](fixtures.mjs) · [generation summary](fixtures.txt).

| Finding | Retained case-level evidence | Result |
|---|---|---|
| B1 | Six baseline/replay/retest exposed/unexposed cases; 4/6/4 versus 3/5/3 claims; deletion preserves later reused-form marker; actual guide/warm-up/Back plus reload in [pre-onset evidence](pre-onset-browser.json) | PASS in tested scope |
| B2 | Binding, visual, keyboard, exposure form/profile/session, protection key, device timing, missing presentation, changed summary, unsupported scorer; intact zero-response control | Reject contradictions; preserve bytes |
| B3 | All five complete production-engine drills; invalid completion, severe tail, missing/short final fixation, missing offset, hidden page, fabricated note; genuine timing and five-extra-input notes | Only intact/legitimate-note controls admitted |
| B4 | Actual history renders KeyA/A and KeyQ/A separately and joins KeyA with another label; canonical comparison tests also pass | PASS |
| B5 | One failure auto-retries; two failures show exact warning; unsaved attempts survive history refresh; reload before success restores earlier state; explicit retry recovers; held writes serialize in order | PASS; deletion separately covered above |
| N1 | Intro emits zero starts; actual Start/Back/Restart yields two distinct IDs, each linked to protection; reload adds none | PASS |
| N2 | Two real browser pages claim distinct forms; abandoned unarmed claim remains after 20-year wall-clock shift; armed uncertain exposure remains withheld | **Open availability limitation confirmed; no liveness PASS** |

## Repository checks and bounded journey

[check.txt](check.txt): lint passed; **429 tests / 27 files** passed; **14 standard manifests and five drills** match regeneration; TypeScript and production Vite build passed. `git diff --check` and final governing hashes checked separately. [Tested production source and build hashes](tested-source.json) identify the final artifacts. Test count alone is not the acceptance evidence; the matrices above record observed behavior.

[Production journey driver](completion-browser.mjs), [journey output](completion-browser.json), and [complete raw result](completion-result.json): real guide/examples/comprehension/keyboard preflight, eight warm-up trials and all 80 scored trials, report, reload of the byte-identical result, and deletion with its minimal exposure marker retained. The fresh no-response result is `stop-baseline-04`, 644 events, 0 hits / 60 misses / 20 correct withholds / 0 false alarms (25% accuracy). No scored timing anomalies occurred. Measured visibility was **200.6–210.6 ms** and the final fixation was **1,202.8 ms**. This is one bounded browser observation, not physical timing certification.

The separate [pre-onset driver](pre-onset-browser.mjs) traversed guide and warm-up, used native Back before first scored onset, then reloaded the reviewable draft with zero scored presentations and all four baseline forms available.

## Limitations and status

- Chromium 145.0.7632.6, headless macOS, 1200 × 800 CSS pixels. Passing final runs have no page errors. Browser probes inject deterministic completed records, contradictory events, promise delays and rejected writes. They exercise real storage transactions and UI but do not simulate natural disk/quota failure or native OS suspension/power loss.
- The bounded completion and native Back journeys use the real browser engine, guide, keyboard preflight and frames. They do not certify physical keyboard/display latency, the supported-browser/minimum-version/device matrix, full accessibility, visual review or screen-reader use.
- This is consistency validation of retained evidence, not cryptographic protection against coordinated rewriting of an entire record.
- **N2 remains open.** An abandoned unarmed baseline/replay owner can strand finite inventory indefinitely. Delete-all may recover availability while removing useful history. No lease, expiry or reclamation rule was added.
- **S46 precision remains open.** No threshold, tie rule or routing change was made.
- Initial-frame recovery, pre-start screen-reader disclosure, M6, privacy/rights/claims release gates and the wider twelve-game scope remain open. No other game, push or deployment was started.
- Implemented and developer-tested are separate from independent audit, founder acceptance, deployment and release. Hand off the exact local repair commit for a fresh separate audit.

Harness corrections, excluded from passing evidence: the initial pre-repair UI run required a fresh dev server after the SSR fixture loader changed Vite optimization; it then reproduced R1. The deletion driver initially compared fresh installation IDs across delete-all, which intentionally creates a new installation; it now compares retained data. The timing-note control initially kept the clean baseline's recommendation, so its chain correctly failed reconciliation; the driver now derives the note baseline's actual recommendation. These preliminary outputs are retained. A later dev hot-reload created distinct module instances for direct probe imports; a fresh server resolved this. Screenshot URL paths were decoded and moved into this evidence directory. None of these harness corrections changed product acceptance requirements.

## Reproduce

Run from the repository root. The fixture generator loads production modules and writes complete journals to `/private/tmp/stop-m5-r1-r2-fixtures.json` (override with `M5_FIXTURES`). It uses an independent deterministic scheduler; it does not import unit test helpers. Start a fresh dev server **after** fixture generation and production edits so direct module imports share the application's module identity.

```sh
npm run check
node docs/qa/m5/repair-r1-r2/fixtures.mjs
npm run dev -- --host 127.0.0.1 --port 5217 --strictPort
# Another terminal:
node docs/qa/m5/repair-r1-r2/deletion-races.mjs
node docs/qa/m5/repair-r1-r2/deletion-edges.mjs
node docs/qa/m5/repair-r1-r2/reload-evidence.mjs
node docs/qa/m5/repair-r1-r2/regressions.mjs
node docs/qa/m5/repair-r1-r2/supplement.mjs
M5_PREVIEW_URL=http://127.0.0.1:5217/ node docs/qa/m5/repair-r1-r2/pre-onset-browser.mjs
npm run preview -- --host 127.0.0.1 --port 5218 --strictPort
# Another terminal:
M5_PREVIEW_URL=http://127.0.0.1:5218/ node docs/qa/m5/repair-r1-r2/completion-browser.mjs
```

Drivers record their installed Playwright/Chromium paths, use isolated contexts and close them. Reruns overwrite outputs. Raw before-repair reproductions and original audit archives remain under `/private/tmp/stop-m5-r1-r2-before/` and `/private/tmp/stop-m5-audit-88b7ec5/` respectively.

## Changed-file inventory

Production: `src/App.tsx`, `src/stop/History.tsx`, `src/stop/training.ts`, `src/stop/storage.ts`, `src/stop/run.ts`, new `src/stop/protected-integrity.ts`.

Tests: `src/stop/run.test.ts`, `src/stop/training.test.ts`.

Status/evidence: `IMPLEMENTATION_TRACKER.md`, continuation note in `docs/qa/m5/repair/VERIFICATION.md`, and this directory's acceptance matrix, integrity record, reproduction drivers, raw outputs and screenshots. Governing specifications and manifests are unchanged.
