# Arrows A3 — headless report reconciliation

**Base:** `9c5a810788af954ef1216ac2accdab14945d8497`. The separate focused F1–F3 read-only audit passed at this base. This A3 record covers a new bounded change; it does not claim browser or storage qualification.

## Implemented

- `src/arrows/report.ts` replays the complete headless command/event state before deriving a report. Changed events, profiles, versions and terminal markers reject reconciliation. Installation authority is checked by the later storage layer; changing only the installation ID in a self-consistent headless state does not prove tampering.
- Every state conserves presented, closed, unresolved-presented and unpresented trials. Invalid and incomplete states expose only those factual prefix counts and reason, with all aggregate scores suppressed.
- A complete 120-trial state derives correct, wrong and omitted classifications from first-response/omission evidence and the fixed form. It reports actual denominators for overall, rule, condition, cell, within-block switch and stay cohorts.
- Correct-response timing uses confirmed onset, the 100–<1,500 ms window and absence of a trial timing note. Five responses permit a median; eight permit median-of-halves IQR; each two-cohort contrast needs ten clean responses per side. Display rounding is half away from zero, with no negative zero. The result is recursively frozen.
- The output status and validity remain explicitly **headless and unconfirmed**. It is not a browser-valid or saved candidate result.

## Developer checks

- Focused Arrows report and engine tests: **18 passed** across two files. Tests include a 120-trial complete trace, all condition/cell denominators, wrong/omitted/early inputs, partial invalidation, tamper rejection, sample boundaries, quartiles and contrast rounding.
- TypeScript and production build passed. Lint passed with two inherited warnings in untouched files. Arrows form regeneration passed. `git diff --check` passed.
- Frozen Arrows packet and form/constructor hashes remain those in `FREEZE.md`. No browser adapter, IndexedDB integration, report UI, history, full mock or other game was changed.

## Limits and next action

The headless engine does not prove that pixels were displayed, that input came from a supported physical device, or that an arm/completion was durable. A separate exact-SHA read-only A3 audit should challenge complete and partial journals, every denominator and timing boundary, stage-note exclusion, rounding, version/tamper rejection and the absence of valid/saved claims. Browser adaptation and persistent result/history remain subsequent stages.
