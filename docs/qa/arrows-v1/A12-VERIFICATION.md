# Arrows A12 standalone Practice candidate — developer verification

## Scope and status

A12 connects the frozen Arrows V1.0 engine to candidate preparation, five scored blocks, untimed breaks, truthful reports, local history and deletion. The separate versioned `report_viewed` journal is described in [ACTIVITY-VERIFICATION.md](ACTIVITY-VERIFICATION.md). This is a developer-tested candidate, not an independent audit PASS, founder personal acceptance, browser/device/accessibility qualification, full-mock integration, deployment or release.

The browser-entry and activity foundation preceded this integration. This A12 change follows local base `185a00ae81a199567a55dad327d0718a19e839ba`; its exact audit SHA is the commit containing this record. The independently passed A11 F1 repair was `c8a8bd21697951cca953a010bdfba5e0124972e5`.

## Implemented behavior

- Guide, two worked examples, two retryable rule questions, frozen keyboard/pointer setup and physical input checks, readiness disclosure, five live blocks and between-block summaries.
- A break checkpoint must be verified before continuing. A stalled delivery has an explicit authority read/retry. Exiting at a break releases live ownership, retains the exact known prefix, tries an out-of-timing checkpoint save and offers a same-prefix retry without claiming a completed run.
- A terminal report is claimed saved only after exact durable readback. Valid reports show descriptive accuracy and supported browser-observed timing; invalid/incomplete reports suppress aggregate metrics. Reports state input context, versions and limitations.
- Verified checkpoint and terminal report openings append idempotent `report_viewed` events in a separate journal. Deletion retires attempt, activity and saved result; Delete all replaces only the Arrows installation. A corrupted identifiable Arrows root offers an explicit Delete all recovery path without admitting its reports.
- History distinguishes valid, invalid, incomplete, modified-key, alternative-input and repeated-form attempts. No timed run resumes after reload.

## Developer checks

- Final checks passed: 62 test files and 1,226 tests, application TypeScript, lint, all 14 Stop form and five Stop drill checks, Balloons manifest/drill checks, Arrows form regeneration, production client build and analytics bundle build. Lint retained two warnings in untouched files. The final production client asset is `dist/assets/index-COz3Mrrq.js`; collection remains disabled.
- A production-browser 24-trial break checkpoint was saved, reviewed as Incomplete, reopened after reload with identical snapshot bytes and two separate activity openings. Individual deletion removed the attempt and activity, left a tombstone and preserved the arm count.
- A production-build Chromium run at 1512 × 827 completed all five blocks (24/48/72/96 verified checkpoint closures, then 120 terminal closures) on AR1. The saved report was `complete_headless` with zero correct because the automated control intentionally sent no scored responses. The saved terminal snapshot remained byte-identical after reload and history reopening; a separate second `report_viewed` activity event was recorded. Delete all then produced a new empty Arrows installation with zero attempts, activity records, tombstones and scored starts. The browser reported no page errors. Raw output: [A12-BROWSER.jsonl](A12-BROWSER.jsonl). The exact driver is retained as [A12-BROWSER.mjs](A12-BROWSER.mjs). This long journey used the build immediately before the final async UI race guards. After those guards, the final bundle rebuilt, all tests passed and a fresh production-browser guide → history → Delete all → clean guide smoke passed without page errors.
- A focused UI regression test holds Delete all, changes navigation, then resolves deletion. It requires the confirmed replacement store, cleared Arrows state and a new history read from the replacement. Confirmation callbacks are token-fenced so older failures cannot overwrite a newer verified saved state.
- Two attempted five-block browser drivers were **excluded as full-completion evidence**: their Playwright Continue action reported a detached/missing button after the application had already advanced. The driver now waits for the scored-block heading before requesting the next break. Neither interrupted run establishes a completed report.

## Limits and open gates

Browser execution is headless Chromium with automated input on this Mac. Fault injection and unit fixtures are identified separately; they do not certify a physical keyboard, display latency, native lifecycle, screen reader speech, 200% zoom on all supported environments or the full device matrix. The A11 N1 case of an indefinitely withheld deletion delivery remains an explicit recovery/availability limit. The original frozen packet and other games' mechanics remain unchanged. No mock run or Public Beta claim follows from A12.
