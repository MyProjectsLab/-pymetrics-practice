# Stop M5 local verification

Historical implementation record for `bcf319f05f8f371e39688ee51fc2fa8b7b6c1caa`: **independent audit FAIL** on B1–B5, with N1 also requiring correction. The focused repair and current developer evidence are in [repair/VERIFICATION.md](repair/VERIFICATION.md). A new exact-SHA independent audit and founder acceptance remain pending. This record covers Stop-only browser-local persistence and history built on founder-accepted same-tab M4 commit `0c5f984048721a8dfd25a6a75e67bf594c83b206`. It does not certify deployment, release, a browser/device matrix, or other games.

## Scope and recorded decisions

- Versioned IndexedDB installation (`stop_local_v1`) and separate versioned local activity (`stop_local_activity_v1`). Unknown/future installation schemas fail closed with existing bytes preserved; the known additive retired-chain field is initialized without clearing records. No M4 durable records are assumed.
- Completed results keep their immutable event journal, original summary, form and specification/scoring versions. On load, event order, form provenance, outcome reconciliation, exposure, summary, router recommendation, drill journal, and comparison compatibility are checked before a result or chain becomes eligible. Unsupported/corrupt records remain stored and excluded rather than being converted into valid history.
- A single IndexedDB readwrite installation transaction serializes form claims across tabs. An `uncertain` exposure marker is written before the scored start; a crash in the first-onset window leaves that form unavailable. A confirmed scored onset upgrades the marker. An ordinary exit before onset releases the claim; reloading the same tab also releases its own unarmed baseline/replay claim. Retest reservations retain their 30-minute expiry and owner-tab identity; an unexposed same-tab explanation can be restored after reload.
- Completed reports and between-screen chains can be restored. An interrupted timed run cannot resume. Timed input and resolution do not await IndexedDB; completion writes occur after protection closes and get one retry. A second failure retains the result in this tab with `temporary_memory` status and the exact §21.5 warning.
- Individual deletion uses exact §21.2 confirmation copy, removes the selected result/events, preserves a minimal marked exposure, and retires dependent chains while retaining unrelated attempt journals. Delete-all uses exact §21.2 copy and clears installation, exposure, activity, settings represented by stored setup, and training records. Invalid attempts are reviewable and excluded from routing/progress.
- The six M4 local lifecycle activities (`drill_recommended`, `drill_started`, `drill_completed`, `retest_reserved`, `retest_exposed`, `retest_completed`) and `report_viewed` are recorded in a separate idempotent activity journal when their real transitions occur. Earlier missing events are not fabricated. No external analytics or identifiers are sent.
- History shows original reports and invalid attempts, and plots valid saved results by compatible visual/input/version profile only. Comparisons use the accepted M4 classifier only for compatible valid baseline/retest pairs. Candidate-facing M4 mechanics, forms, timing, scoring, routing, and claims were not changed.

## Reproducible checks

`npm run check` output is in [check.txt](check.txt): lint, **414 tests across 27 files**, deterministic regeneration checks for **14** standard forms and **five** drill manifests, TypeScript, and production build pass. The test suite includes completion-write first/second failure, restoration, unsupported/corrupt result and invalid-attempt rejection, lifecycle activity, and compatible-profile history separation. A pre-existing asynchronous drill test was made to wait for manifest validation after it intermittently read the intermediate live screen; drill behavior was not changed.

Bounded Chromium `145.0.7632.6` checks and scripts:

| Evidence | Result |
|---|---|
| [storage-browser.json](storage-browser.json) / [script](storage-browser.mjs) | Two tabs atomically claimed different baseline forms; an armed first-onset crash state remained `uncertain` after reload and was not reissued, while an unarmed same-tab baseline claim was released; local activity was ordered/idempotent; delete-all cleared markers and activity; blocked IndexedDB showed exact temporary preflight copy; future schema bytes survived reload. |
| [chain-browser.json](chain-browser.json) / [script](chain-browser.mjs) | A verified parent M3 baseline and complete deterministic drill journal seeded a chain. A reload restored an unexposed retest explanation; exit released the reservation. Deleting the baseline retired the chain while retaining its other drill attempt and exposure marker. Adversarial missing drill events and changed recommendation were excluded on load. |
| [completion-browser.json](completion-browser.json) / [script](completion-browser.mjs) | A production-bundle Chromium journey completed 8 warm-up and 80 scored trials. It persisted the original report and confirmed exposure, emitted `report_viewed`, restored the report through history after reload, and preserved the exposure marker after individual deletion. |

These are scripted headless-browser checks. Synthetic responses and injected failures do not establish native OS suspension, physical keyboard/display latency, other browsers, or device certification. The chain reload fixture uses a previously verified M3 baseline and a deterministic complete drill journal; it does not replace a full physical-input baseline-to-retest qualification. Storage eviction, abrupt power loss at every transaction boundary, and multi-device synchronization are not certified. An abandoned unarmed claim belonging to another tab is kept conservatively until that tab releases it or local data are cleared; no liveness-based cross-tab reclamation is claimed.

## Acceptance mapping and open gates

| Check | M5 result |
|---|---|
| S25–S26 | Persistent reservation/consumption markers and exhaustion constraints covered by storage/browser and inherited M4 tests; cross-tab claim and uncertain-crash cases added. |
| S53 | Browser-local side-by-side history and compatible comparisons present; incompatible profiles remain separate. Full release acceptance awaits matrix/accessibility QA. |
| S55–S60 | Versioned local retention, exact deletion warnings, temporary-memory fallback, individual exposure-marker retention, and delete-all covered. Browser eviction remains an explicit limitation. |
| S68, S72 | Immutable event reconciliation and recorded-version report recovery across reload covered; unsupported/corrupt records are excluded. |
| S73 | Valid/invalid and standard/accommodated profile separation covered by unit and browser checks. |

S46’s near-boundary precision issue remains open for a separate approved correction. Initial-frame recovery, pre-start screen-reader disclosure, accessibility, browser/device certification, M6, all twelve Practice games/full mock/basic reports, deployment, and release remain open. This M5 record cannot supply an independent audit or founder acceptance.

## Changed-file inventory

Product and tests: `src/App.tsx`, `src/App.test.tsx`, `src/stop/History.tsx`, `src/stop/History.test.tsx`, `src/stop/storage.ts`, `src/stop/storage.test.ts`, `src/stop/Journey.tsx`, `src/stop/LiveRun.tsx`, `src/stop/Preflight.tsx`, `src/stop/Report.tsx`, `src/stop/TrainingFlow.tsx`, `src/stop/exposure.ts`, `src/stop/preparation.ts`, `src/stop/run.ts`, `src/stop/run.test.ts`, `src/stop/training.ts`, `src/stop/training.test.ts`, and `src/stop/drill-run.test.ts`.

Tracker and evidence: `IMPLEMENTATION_TRACKER.md`; this verification file; `storage-browser.mjs/.json`, `chain-browser.mjs/.json`, `completion-browser.mjs/.json`, and `check.txt` under `docs/qa/m5/`.
