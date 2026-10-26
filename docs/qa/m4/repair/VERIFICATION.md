# Stop M4 focused audit repair — developer verification

**Base:** clean `4943051ff57d03add56b50d9a7a3bc40522304f1`

**Authority:** founder-authorized B1/B2/N1 repair; independent audit `/private/tmp/stop-m4-audit-4943051/AUDIT.md` and its reproduction evidence
**Status:** local repair and developer checks; a fresh independent exact-SHA audit and founder M4 acceptance remain open.

The full `AGENTS.md`, Master Strategy, Stop V1.1, tracker, M4 QA record, and independent audit were read before editing. The two specification files are unchanged. SHA-256 remains:

- Master Strategy: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`
- Stop V1.1: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`

## Repair and focused regressions

| Finding | Change | Evidence |
|---|---|---|
| B1 | Drill `leave()` returns a synchronously retained attempt after lifecycle invalidation, or the existing valid completed attempt. The training view forwards that attempt to the same-tab chain on cleanup; the chain deduplicates by attempt ID. Invalid attempts restore the assigned state, and completed valid attempts restore the retest step. | `drill-run.test.ts` covers repeated leave and preserved immutable journals; `training.test.ts` covers exactly-once chain retention, statuses and absence of retest consumption. `browser-regression.mjs` exercises the production keyboard route and completed-drill exit/resume. |
| B2 | The first scored `stimulus_presented` event checks the reservation at confirmed onset before consuming the form. If it expired after the canvas guard, exposure is still recorded from the actual event, then the engine invalidates immediately after its non-reentrant sink completes. | `run.test.ts` tests expiry at 1,800,000 and 1,800,001 ms after a successful 1,799,999 ms guard, plus pre-confirmation rejection and later expiry after valid onset. `browser-race.mjs` crosses expiry between the production canvas guard and paint/confirmation. |
| N1 | The router normalizes binary subtraction noise at the exact decimal comparison boundary before applying §17.3's strict less-than rule. | `training.test.ts` tests 0.0009, exactly 0.001, and 0.0011 severity gaps, with detection taking priority only for the genuine tie and stability taking the greater severity at and above the boundary. |

The deterministic fixtures and browser probes assert that a late confirmed onset retains its form ID, actual onset and consumed exposure, followed by one invalidation with no valid result or completion. Before any confirmed onset, the existing reservation-expiry path releases the form. After a timely confirmed onset, later expiry does not undo exposure or completion eligibility.

## Browser evidence and limits

The two bounded scripts use headless Chromium 145.0.7632.6 at 1200 × 800 CSS pixels, the localhost Vite server, production browser canvas, `performance.now`, rAF, scheduler, DOM, and keyboard adapters. `browser-regression.mjs` seeds a synthetic valid-summary baseline only to enter the existing training UI without replaying the full baseline; it makes no claim about baseline creation. It presses Shift+Tab from the live canvas, confirms focus on Back to library, presses Enter, and resumes. It then completes the assigned drill through the browser, exits before Continue to retest, and resumes at the retest step. The scripts are development checks, not physical input/display timing, supported browser/device matrix, accessibility, or native lifecycle certification.

`browser-race.json` records the successful guard at wall-clock 1,799,999 ms, expiry at 1,800,001 ms before confirmed paint, retained `stop-retest-01` identity and onset, one consumed exposure, one invalidation, zero completion, null result, and no page errors. The wall clock is injected at the adapter boundary; a natural 30-minute race was not observed.

`browser-regression.json` records one live-drill departure by Shift+Tab/Enter, then an invalid attempt with 22 frozen events, two confirmed drill presentations and one invalidation. Resume kept that single attempt, returned to the assigned drill, and retained zero retest attempts and exposures. The next browser-run detection drill completed all 72 presentations and three blocks with one completion event. Leaving before Continue retained a second, valid attempt once; resume displayed the retest action. The browser reported no page errors.

Preliminary browser-regression runs were interrupted by a development hot reload and then a fixture-route matcher that missed a Vite query suffix. Neither was counted as a pass. The final `browser-regression.json` comes from one uninterrupted run on the settled source.

## Repository checks and inventory

`npm run check` runs Oxlint, Vitest, deterministic regeneration checks for all 14 standard forms and five drill manifests, TypeScript, and the Vite production build. Raw output is in `check.txt`. Focused regressions are the three Stop test files named above. `git diff --check` and final governing SHA-256 comparison are part of handoff verification.

Final check passed with **25 test files / 408 tests**, no lint warnings, regenerated-form/drill checks, and a successful production build. The focused three-file run passed **66 tests** before the final full run.

Changed files: `src/stop/TrainingFlow.tsx`, `src/stop/drill-run.ts`, `src/stop/run.ts`, `src/stop/training.ts`, their three focused test files, `IMPLEMENTATION_TRACKER.md`, and this repair evidence directory (`VERIFICATION.md`, browser scripts/results, `check.txt`). The exact new commit SHA is reported in the handoff after local commit.

## Open gates

N2's six missing local M4 lifecycle events remain open and non-blocking for this focused repair; analytics is not authorized. S53 durable side-by-side history and S68 refresh recovery remain M5 gates. N3 `report_viewed`, initial-frame handling, pre-start screen-reader disclosure, supported browser/device matrix, native lifecycle, full accessibility/visual review, other eleven games, full mock, Public Beta scope, independent M4 audit, founder acceptance, deployment, and release remain open. The original audit FAIL stays bound to `4943051ff57d03add56b50d9a7a3bc40522304f1`; developer evidence does not replace a fresh independent audit.
