# Stop M4 focused repair audit — exact SHA 0c5f984048721a8dfd25a6a75e67bf594c83b206

**Verdict: PASS for the focused M4 repair at this SHA.** The two prior blocking defects, B1 and B2, did not reproduce. N1's three requested nominal boundary cases pass, but its new 15-decimal normalization leaves a narrower numerical edge described below. N2 and all previously named release and persistence gates remain open. A changed SHA requires another audit.

## Integrity and authority

- HEAD: `0c5f984048721a8dfd25a6a75e67bf594c83b206`; immediate parent: failed M4 `4943051ff57d03add56b50d9a7a3bc40522304f1`; founder-accepted M3 remains `d386d5b54ed5873a43f515080b81f728ffc6a1c1`.
- Working tree and index clean before and after; `git diff --check` passes. The complete 14-file parent-to-target diff and inventory were inspected and saved as `parent-to-target.diff` and `changed-files.txt` here. No tracked file was edited.
- Master Strategy SHA-256: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`; Stop V1.1 SHA-256: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`. Working tree and exact-SHA archive match the prior approved values.
- Read the complete `AGENTS.md`, both governing specifications, `IMPLEMENTATION_TRACKER.md`, both M4 verification records, and the prior independent audit and browser-results report at `/private/tmp/stop-m4-audit-4943051/`. Reviewed its reproduction drivers and authority records. The founder's internal M4 build-order exception and temporary same-tab decision do not change the twelve-game Public Beta scope.

## Blocking findings

**None in the focused repaired paths.**

### B1 — drill retention: repaired in the tested production path

Starting from a fixture-seeded valid baseline, I used the production React view, real Chromium DOM canvas/timers, and keyboard input. After the first live drill presentation, `Shift+Tab` focused **Back to library** and `Enter` left the drill. The same chain retained one invalid attempt with 22 sequential, frozen events, two confirmed presentations, and one invalidation. It had no retest attempt or form exposure. Immediate resume returned to the assigned drill intro; a second exit before beginning did not add or lose an attempt. A new run began at Block 1, showed all three summaries, resolved 72 trials, and completed once. Leaving before **Continue to retest** retained that valid attempt exactly once. Resume restored **Try a new Stop sequence**. A further library/resume cycle retained the same two attempt IDs and original invalid journal.

Production causes: [`drill-run.ts:52,130-137`] returns a retained immutable attempt after invalidation or completion; [`TrainingFlow.tsx:76-87,152-158,188`] forwards it during cleanup; [`training.ts:129-134`] deduplicates by ID and assigns the correct chain status. Independent browser evidence: `audit-browser.mjs`, `browser-independent.json`. This is a fixture-seeded UI run, not a fresh baseline-creation run.

Two preliminary versions of my browser driver timed out because I expected the same button after every resume. The observed UI alternated between the drill intro and recommendation according to the current chain/view transition. I corrected the driver's navigation and reran the entire path from a fresh page; only the uninterrupted final run is counted as a pass.

### B2 — reservation race: repaired in the tested engine and canvas paths

My clock-controlled production-run fixture and separate real Chromium canvas probe crossed expiry from 1,799,999 to 1,800,001 ms after the canvas guard returned true but before confirmation. The first scored `stimulus_presented` event retained the assigned `stop-retest-01` identity and actual onset. The exposure marker used that onset. One invalidation followed; there was no valid result or completion, and the next reservation could not reuse the consumed form. Before confirmed onset, expiry left zero scored presentations and zero exposure; a new reservation could use the same form. After a timely first onset, later expiry preserved exposure and the full 80-trial run completed as a verified valid result.

Production cause: [`run.ts:166-178`] checks reservation at the first confirmed scored event and queues invalidation after the non-reentrant sink; [`run.ts:260-265`] continues guarding unexposed presentations. Evidence: `audit-reservation.mjs`, `reservation-independent.json`, `audit-canvas-race.mjs`, `canvas-race-independent.json`. Wall-clock expiry was injected; a spontaneous 30-minute race was not observed.

## Non-blocking findings and limits

### N1 [P3] — residual near-boundary rounding band under the strict tie rule

[`training.ts:70-74`] applies `Number((maximum - severity).toFixed(15)) < 0.001`. Independent production-router fixtures where fixed priority (detection) conflicts with maximum severity (stability) select detection at 0.0009 and stability at exactly 0.001 and 0.0011, as requested. An adjacent represented gap of `0.0009999999999998899`, induced by IQR `150.14999999999998` ms against detection severity 1, rounds to `0.001` and selects stability. A gap represented as `0.0009999999999990017` still ties. Thus the normalization creates a narrow interval below the strict threshold that does not tie. The decimal value `150.15` and an immediately adjacent lower IQR can map to the same binary value, so an executable precision policy would be needed to resolve the indistinguishable case. This is a synthetic, vanishingly small numerical boundary, not an observed candidate browser misroute; retain S46 as qualified rather than claiming full exact-boundary proof. Evidence: `audit-router.mjs`, `router-independent.json`.

### N2 [P3] — local M4 lifecycle events remain missing

The six event types are declared in `src/stop/contracts.ts:92-97`, but no production emitter uses them: `drill_recommended`, `drill_started`, `drill_completed`, `retest_reserved`, `retest_exposed`, `retest_completed`. This is unchanged from the parent and remains a local event-completeness gate. It does not authorize analytics. `report_viewed` is also still open from M3.

## Regression and acceptance disposition

`npm run check` passed in a `git archive` of the exact target: lint; **25 files / 408 tests**; deterministic regeneration checks for all **14 standard forms and five drills**; TypeScript and production build. The prior tests were rerun as regression, not treated as independent proof. Independent browser checks used headless Chromium 145.0.7632.6 on macOS at 1200 × 800. No browser page errors occurred. Independent simulated-clock runs covered the complete standard retest after timely onset. The accepted M2B-2/M3 paths were regressed by the full suite and by standard-run event/result verification; their prior founder acceptance remains separate.

| Acceptance | Focused disposition |
|---|---|
| S45, S47 | Existing tests and prior independent routing evidence regressed; no routing mechanics besides tie normalization changed. |
| S46 | Requested 0.0009 / 0.001 / 0.0011 cases pass; qualified by N1 near-boundary rounding. |
| S48 | Full suite and one production-browser detection drill passed; five-manifest checks passed. |
| S49 | B1 live keyboard exit, immutable invalid record, Block-1 restart, completed-attempt exit/resume, no retest/exposure, and duplicate prevention passed. |
| S50-S51 | B2 pre-onset release, late-confirmed consumption plus invalidation, post-onset completion, and next-unused reservation passed. |
| S52, S54 | Existing suite rerun; no changed production code in exhaustion or comparison. Prior audit's bounded evidence remains historical. |
| S53 | Compatibility regression remains bounded; durable side-by-side history stays partial for M5. |

A new full guide → baseline → drill → retest → comparison browser journey was **not** run. The parent audit already exercised that broad journey; this repair changes only drill cleanup, first-onset expiry handling, and tie subtraction, so the focused browser paths plus full automated regression were proportionate. This audit does not certify human response times, physical input/display latency, native OS lifecycle, the supported browser/device matrix, screen readers, full accessibility, or deployment.

## Open gates

N1's precision edge and N2's six local lifecycle events; S53 durable history; S68 refresh recovery; `report_viewed`; initial-frame handling; pre-start screen-reader disclosure; supported browser/device and accessibility certification; founder M4 acceptance; remaining game and mock scope; deployment and release. The parent M4 FAIL remains attached to `4943051ff57d03add56b50d9a7a3bc40522304f1`.
