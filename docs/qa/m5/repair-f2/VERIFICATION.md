# Stop M5 F2 / D1 repair — developer verification

**Subsequent audit:** independent audit at `53286f778bfc3deaad43e1beeff51ef4daa0c791` returned **FAIL solely on F2-C**, acquired presentation-lock liveness when canceled admission/confirmation delivery remains pending. The ordering and D1 checks passed in that audit. The record below is historical developer evidence; see [F2-C repair](../repair-f2-c/VERIFICATION.md) for the focused continuation. Fresh exact-SHA audit and founder M5 acceptance remain pending.

30 September 2026. Local implementation and developer verification only. The independent FAIL remains attached to `881b60f04b0c4633eec3f797610bbb07ddd22c14`. This changed implementation needs a new separate read-only audit and founder M5 acceptance. No push or deployment.

## Authority and starting state

Started at clean HEAD `881b60f04b0c4633eec3f797610bbb07ddd22c14`, parent `499deb4ee02fb8ec9cd8c90e2ae95673dd0e10c6`. Read AGENTS.md, the complete Master Strategy and Stop V1.1, the complete tracker, all four M5 verification records, and the complete [independent audit](/private/tmp/stop-m5-audit-881b60f/AUDIT.md) before production edits. No agents were delegated. The repair's parent is the starting HEAD; its exact commit is supplied in the handoff.

[Governing integrity](governing-integrity.json) compares working bytes, starting HEAD, its parent and founder-verified continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

Both frozen specifications, forms, drills, scoring, routing, timing thresholds, claims, other games and the mock are unchanged.

## Pre-edit reproduction and acceptance

The [adversarial matrix and ordering proposal](ACCEPTANCE.md) were written before production edits. The auditor's driver was copied to `/private/tmp/stop-m5-f2-before/` and run against the unchanged checkout. All four requested failures reproduced before editing:

| BroadcastChannel | Deletion during armed initial fixation | Confirmed onsets before deletion | Confirmed onsets after deletion |
|---|---|---:|---:|
| Unavailable | Required drill | 0 | 1 — FAIL |
| Unavailable | Delete all | 0 | 1 — FAIL |
| Delayed | Required drill | 0 | 1 — FAIL |
| Delayed | Delete all | 0 | 1 — FAIL |

[Before summary](before-onset.json), [log](before-onset.log), and the `before/` entries in the raw archive retain the observations. Normal delivery blocked both pre-onset deletions; unrelated deletion and confirmed-onset controls retained one real onset. The original audit's D1 report was also read in full.

## Authoritative ordering

The ordering point is the existing synchronous eligible-rAF DOM presentation and engine confirmation, protected by a shared exclusive Web Lock. Web Locks serialize cooperating contexts in the same storage bucket and can remain held through asynchronous work. [W3C API specification](https://www.w3.org/TR/web-locks/).

1. `deleteResult` and `deleteAll` obtain the stable `assessment-practice-stop-presentation-v1` lock **before creating their deletion transaction**, and release it after commit. The name does not change when the installation is replaced.
2. At the first scored retest frame request, admission obtains the same lock. It reads IndexedDB, verifies the bound installation, chain/deletion evidence and armed reservation, then keeps the lock through the actual frame callback, synchronous stimulus event and exposure confirmation write.
3. If deletion commits first, admission sees its durable evidence and cannot request a scored paint. The invalid draft remains reviewable; its known-unexposed reservation and uncertain marker are released. Delete-all prevents old-tab writes into the replacement installation.
4. If presentation wins, deletion cannot commit in the check-to-frame gap. The actual event and consumed form are retained before deletion can proceed. Individual deletion retains consumption; delete-all removes the durable marker as specified and leaves any old-tab invalid journal temporary.
5. A queued or admitted frame canceled by the engine cannot paint later. Cancellation aborts a pending lock request and cancels an installed frame callback. The lock is not held throughout initial fixation.

The original eligible timestamp, 1,000 ms initial fixation, onset quality bands and watchdog are unchanged. Admission latency is measured against that original timestamp; it is never hidden by resetting the clock. Excess delay invokes the existing timing invalidation. Inputs, outcome resolution, stimulus offset and subsequent frame requests do not await storage or locks. M2B-02's outcome/offset transition anchor and confirmation-before-quality-rejection behavior remain unchanged.

A separate observer reads a small random deletion revision once per available observation frame. The revision is written in the deletion transaction, contains no task record or identity, and avoids copying all journals every frame. On a change, the observer reconciles durable state and stops an already exposed affected run. BroadcastChannel only accelerates this observation. The authoritative first-onset lock also passes with the revision observer deliberately disabled. Ordinary observer read failure does not itself alter task validity; a successful first-onset admission still requires authoritative storage.

Persistent retest preflight fails closed, using the existing §23.1 unsupported-feature copy, if Web Locks is unavailable. The ordering operation itself also fails closed. Coordinated deletion requires that API as well; there is no unsafe fallback. Temporary same-tab behavior is unchanged. This does not certify a supported browser/minimum-version matrix.

`deleteAll` now checks the caller's installation under the ordering lock before clearing it. A stale store cannot clear work created by a replacement installation.

## D1: per-attempt save evidence

History compares each buffered drill journal with its exact durable counterpart. A durable attempt remains saved even when a retirement snapshot containing other unsaved attempts is pending or failed. Only a genuinely buffered journal receives “Not yet saved” and “retained only in this tab.” The list and detail view use the same per-attempt status.

The component regression covers both labels. The [seven real-IndexedDB F1 cases](audit-f1.json) create two distinct five-event invalid journals through actual Start/Back/Restart navigation, retain them through injected failures, and verify successful retry/reload. In the baseline-deletion case, the saved 522-event drill has no tab-only warning and exactly two unsaved sibling warnings remain. [Saved-journal screenshot](already-saved-journal-disclosure.png). The original journals and retirement/retry states are in the raw archive's `after/f1-*` entries.

## Case-level browser evidence

The [45-row matrix](CASES.md) reports every combination of:

- Before arming, armed initial fixation, deletion-first at the presentation boundary, presentation-first at that boundary, and after confirmed onset.
- Required-drill deletion, Delete all local data, and unrelated deletion.
- Normal, delayed and unavailable BroadcastChannel delivery.

All 45 passed. [Normal delivery](matrix-delivered.json), [delayed delivery](matrix-delayed.json), [unavailable delivery](matrix-unavailable.json) retain the exact case identity, common-clock observations, onset count, marker, reservation, invalid-draft status, chain eligibility and replacement-installation checks. The claim object is captured before arming; the driver separately waits for an actual armed durable claim in all after-arming cases.

The forced deletion-first case holds deletion's lock until the first frame admission is requested. The forced presentation-first case holds successful admission before allowing the frame and verifies that the competing deletion has not committed. Both sides use actual product deletion methods and real IndexedDB. Every delete-all case creates replacement work and verifies that old-store arm, reserve, saveChain, saveDraft **and deleteAll** reject without changing its bytes.

[Five additional admission cases](admission-edges.json) pass: required-drill/delete-all with both BroadcastChannel and the revision observer unavailable; cancellation while waiting for the lock; cancellation after admission but before the frame; and unsupported Web Locks preflight. Delayed release after the existing watchdog produces no later onset, marker or reservation. These are injected scheduling/storage-observer faults, separate from ordinary use.

The [original eight-case onset rerun](audit-onset.json) now passes, including all four formerly failing cases. [Six draft/installation boundary cases](audit-boundaries.json) also pass.

## Regressions and checks

| Evidence | Observed outcome |
|---|---|
| [F1 / D1](audit-f1.json) | Seven cross-tab failure/delay/late-rejection cases preserve all nondeleted journals, truthful per-attempt labels, explicit retry and durable reload. Deliberately deleted journals stay absent; unrelated work survives. |
| [Same-tab deletion](deletion-races.json), [edges](deletion-edges.json) | 36 save/deletion/retry-order cases plus two relationship/retired-history edges pass. No stale queue resurrection. |
| [F3 admission](initial-fixation-load.json) | 24 baseline/retest scored/warm-up initial-fixation cases: three premature/five wrong scored inputs reject; two/four and warm-up controls admit. Source/exposure preserved. |
| [Protected-interval reload](reload-evidence.json) | All 76 R2 evidence/control cases retain their expected outcomes; original bytes and exposure remain unchanged. |
| [B1–B5/N1](regressions.json), [supplement](supplement.json) | Form availability/reuse, setup/exposure contradictions, all five drills and legitimate notes, canonical profiles, actual attempt starts, ordered save failure/retry and durable-only reload pass. N2 remains observable and open. |
| [Ordinary pre-onset exit](pre-onset-browser.json) | Real guide, input check, warm-up, native Back and reload; zero scored onset, reviewable draft, absent marker/claim, four available baseline forms. |
| [Repository check](check.txt) | Lint, 439 tests / 28 files, 14 standard forms, five drill manifests, TypeScript and production build pass. Two inherited lint warnings remain in App.tsx and the prior repair's cross-tab driver. |

The test count is not an acceptance verdict. The tables and raw journals establish the bounded observed behavior.

## Ordinary completion evidence

The production-build baseline journey traverses guide/examples/comprehension, physical-keyboard preflight, eight warm-up and 80 scored trials, original report, reload and individual deletion. [Result](completion-browser.json), [immutable journal](completion-result.json).

A second production-build journey seeds only the prior valid baseline/drill, then completes the real candidate retest guide, input check, warm-up, 80 scored trials, report and reload. [Result](retest-completion.json), [immutable retest journal](retest-completion-result.json). This checks the new admission and revision observer across a complete retest. It is not a full physically performed baseline→drill→retest study.

The retest retained 643 events and 0 hits / 60 misses / 20 correct withholds / 0 false alarms. Its first scored onset was 7.8 ms after the original eligible timestamp; measured scored visibility was 200.8–209.3 ms, with zero timing anomalies. The complete chain and byte-identical original report restored after reload. The final baseline rerun passed with 644 events, the same 0/60/20/0 counts, zero scored timing anomalies, visibility 200.5–209.9 ms and final fixation 1,201.1 ms. Its original report reloaded byte-identically and individual deletion retained the minimal marker. No trial responses, timing failures or storage failures are injected into either completion run.

## Raw evidence and reproduction

[Raw archive](raw-evidence.tar.gz) contains 71 complete before/after store and journal observations, including every ordering case. [SHA-256 index](raw-evidence-index.json) identifies each uncompressed entry. Extract with `tar -xzf docs/qa/m5/repair-f2/raw-evidence.tar.gz -C <evidence-directory>`. Compact results and screenshots remain directly readable alongside this report.

Drivers record the installed Playwright/Chromium paths and use isolated contexts. Current verification uses Chromium 145.0.7632.6 headless on macOS, 1200 × 800 CSS pixels. Passing final outputs report zero page errors. The retained audit fixture was generated by the independent audit; the earlier B1–B5/R2 regression drivers use `/private/tmp/stop-m5-r1-r2-fixtures.json`. Both contain complete production-engine journals rather than summary stubs. Fixture inputs can be supplied with `M5_FIXTURES`; the existing `docs/qa/m5/repair-r1-r2/fixtures.mjs` recreates the same fixture shape under the unchanged mechanics.

```sh
npm run check
# Generate fixtures before starting a fresh dev server:
node docs/qa/m5/repair-r1-r2/fixtures.mjs
export M5_FIXTURES=/private/tmp/stop-m5-r1-r2-fixtures.json
npm run dev -- --host 127.0.0.1 --port 5337 --strictPort
# Separate terminal; M5_FIXTURES can point all drivers at the generated fixture:
node docs/qa/m5/repair-f2/onset.mjs
DELIVERY=delivered node docs/qa/m5/repair-f2/matrix.mjs
DELIVERY=delayed node docs/qa/m5/repair-f2/matrix.mjs
DELIVERY=unavailable node docs/qa/m5/repair-f2/matrix.mjs
node docs/qa/m5/repair-f2/admission-edges.mjs
node docs/qa/m5/repair-f2/audit-f1.mjs
node docs/qa/m5/repair-f2/audit-boundaries.mjs
# Also run deletion-races, deletion-edges, initial-fixation-load,
# reload-evidence, regressions and supplement from this directory.
M5_PREVIEW_URL=http://127.0.0.1:5337/ node docs/qa/m5/repair-f2/pre-onset-browser.mjs
npm run preview -- --host 127.0.0.1 --port 5338 --strictPort
# Separate terminal:
M5_PREVIEW_URL=http://127.0.0.1:5338/ node docs/qa/m5/repair-f2/completion-browser.mjs
node docs/qa/m5/repair-f2/retest-completion.mjs
```

Reruns overwrite their outputs. Matrix/edge drivers also write full observations under `/private/tmp/stop-m5-f2-*`. Seeded records, suppressed/delayed messages, held admission/deletion callbacks and rejected saves are explicitly injected evidence. Candidate guide/warm-up/frames/navigation and the completion journeys use the real browser paths.

One preliminary run exposed a missing statement separator in the new deletion-revision write; TypeScript and the browser deletion probe caught it. It was corrected before all retained passing runs. The [preliminary baseline journey](completion-preliminary.json) completed and reached report reload but failed a later `1 !== 0` assertion without line-specific failure evidence. Its driver did not await deletion completion; the final driver now waits for the dialog to close and retains the full result before later assertions. That preliminary run is not counted as passing. No expected product outcome was relaxed. The final production source/build identity is recorded in [tested-source.json](tested-source.json).

## Acceptance mapping and limits

| Checks | Bounded disposition |
|---|---|
| S16/S25/S26/S50/S51 | Initial-fixation deletion ordering, known-unexposed release, actual-onset retention/consumption, cancellation and ordinary pre-onset exit covered. Original engine/M2B-02 tests remain passing. |
| S49/S53/S54 | Required deletion removes eligibility; unrelated deletion preserves it; valid drill notes, canonical profiles and completed retest reload regress. |
| S55/S56/S59 | Immutable journal retention, individual deletion, per-attempt save disclosure, failed writes and retry/reload covered. |
| S57/S60 | Delete-all and replacement-installation protection covered, including an old tab's attempted second delete-all. |
| S35–S43/S66/S68/S72/S73 | Protected-evidence, F3 input admission, immutable reload/report and history progress regress. |
| B1–B5/N1 | Case-level original regressions pass in the scope described above. |

Limitations: Web Locks and IndexedDB must be available for persistent cross-tab ordering. Lock acquisition/read latency can invoke the existing onset watchdog; no additional timing allowance is introduced. Browser task delivery still bounds when an already exposed run observes deletion. Simultaneous loss of both deletion notifications and all subsequent storage reads is not certified as immediate post-onset invalidation; the first-onset gate remains fail-closed. Physical display scanout and native keyboard latency cannot be established by DOM/rAF evidence. Crashes, power loss, native eviction, mixed application-version tabs, other browsers and the supported device/minimum-version matrix are not certified. This protocol coordinates tabs running this implementation; it does not control browser-level site-data clearing or arbitrary external database rewrites.

**N2 abandoned-tab claims and S46 precision remain open.** Initial-frame handling, screen-reader disclosure, accessibility/device certification, M6, deployment and release remain open. No reclamation rule was added. No independent audit PASS or founder M5 acceptance is claimed.

## Changed files

Product: `src/stop/presentation-order.ts`, `src/stop/run.ts`, `src/stop/storage.ts`, `src/stop/History.tsx`, `src/stop/Preflight.tsx`.

Tests: `src/stop/presentation-order.test.ts`, `src/stop/History.test.tsx`, `src/stop/Preflight.test.tsx`.

Status/evidence: `IMPLEMENTATION_TRACKER.md`, the historical status note in `docs/qa/m5/repair-f1-f3/VERIFICATION.md`, and this evidence directory. [Complete inventory](FILES.txt).
