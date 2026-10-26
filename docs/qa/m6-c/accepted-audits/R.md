# Stop M3 B2-R independent audit — PASS

**Target:** `d386d5b54ed5873a43f515080b81f728ffc6a1c1`  
**Parent:** `0cf2f9f04fadc34bb530342af49b6dd4a6eeca50`  
**Repository:** `/Users/renzo/Documents/Assessment Practice/App`  
**Date:** 2026-09-29 (America/New_York)

## Verdict

**PASS for the focused B2-R correction at the exact target SHA.** No blocking finding or new non-blocking finding was identified. The unapproved five-point condition is removed, the approved opposite-sign rule runs before concentration and primary-observation selection, and the repaired complete-block priority behavior is preserved.

This is a focused correction audit, not a new end-to-end certification of all M3 behavior. The parent's FAIL remains attached to its SHA. **M3 founder acceptance remains pending regardless of this PASS.** A changed target requires another audit.

## Authority reviewed

Read AGENTS.md, the complete Master Strategy and Stop V1.1, IMPLEMENTATION_TRACKER.md, `docs/qa/m3/repair/VERIFICATION.md`, the parent audit at `/private/tmp/stop-m3-repair-audit-0cf2f9f/AUDIT.md`, and the complete six-file parent-to-target diff.

Freshly retrieved the approved M3-03 decision from **Revise M3-03 and M3-04 decisions**, thread `01a0eb1d-92e3-78f0-8c4c-d4d0c7cd921a`. The founder's approval is in turn `01a0eb27-9804-7931-b8c2-643248418a9b`. The rule states:

> If ΔG and ΔN have opposite signs, report both category changes and timing numerically. Do not combine them into a favorable label.

This precedes category concentration. The founder's binding clarification also makes the 5–<10-point numbers-only exception override a standalone 75 ms timing observation.

Freshly retrieved the explicit B2-R correction authorization from **Audit Stop M3 repairs B1–B3**, turn `01a0ee7c-aa54-71e3-8e80-fc22086eb4f8`. It confirms opposite-sign reporting regardless of magnitude and preservation of B1/B3 and §13.2 priority. These messages are retained in `m3-authority.json` and `repair-authority.json`.

## Independent reproduction

The external `probe.mjs` loads production scorer modules from separate Git archives of the exact target and parent. It does not import repository test helpers or the submitted sweep. Expected output strings and count arithmetic were written separately for this audit. Raw results are in `probes.json`; the final execution result is in `probes.log`.

### Opposite-sign correction

All requested cases pass with the complete numeric sentence, including both category changes and the signed timing difference:

| ΔGO / ΔNO-GO correct withholds | Δmedian | Target display: GO / NO-GO / timing | Result |
|---|---:|---|---|
| +10 / −4.999 pp | 0 ms | +10 pp / −5 pp / 0 ms | PASS; parent incorrectly selected GO increase |
| +10 / −4.999 pp | +50 ms | +10 pp / −5 pp / +50 ms | PASS; parent incorrectly selected slower/more accurate |
| −10 / +4.999 pp | −50 ms | −10 pp / +5 pp / −50 ms | PASS; parent incorrectly selected faster/lower accuracy |
| +10 / −5 pp | 0 and +50 ms | +10 pp / −5 pp / corresponding timing | PASS |
| −10 / +5 pp | 0 and −50 ms | −10 pp / +5 pp / corresponding timing | PASS |

For example, +10/−4.999/+50 returns exactly:

> From the first to the final block, GO hit rate changed by 10 percentage points, NO-GO correct-withhold rate by -5 points, and median correct-GO response time by 50 ms.

The −4.999→−5 display is required whole-point rounding; the decision uses unrounded changes. These fractional category changes are **synthetic classifier fixtures**, not realized complete 15-GO/5-NO-GO blocks.

The independent harness runs **24 synthetic cases**: the requested failures and exact boundaries; the reverse zero-timing case; swapped category concentration; ±0.000001-point opposite changes; both categories at ±5; and zero-axis controls showing that zero is not treated as an opposite sign. It separately runs **10 sufficiency probes**, changing each block in turn: nine timing hits, fifteen eligible outcomes, eleven GO outcomes, three NO-GO outcomes, or a missing median. All preserve the exact insufficient-data message before numeric or directional reporting.

Source inspection confirms the order at archived `src/stop/scoring.ts:57–76`: sufficiency → unrounded changes → unconditional opposite-sign numeric return → concentration → 5–<10-point exception → trade-off → false-alarm priority → hit-rate priority. The change is confined to this function.

### Complete-block priority and scorer composition

All **nine independently specified complete-block cases** pass. These use integer counts and adequate timing denominators:

| Case | Independent expected result |
|---|---|
| Original GO 12/15→15/15, NO-GO 4/5→5/5, unchanged 400 ms | False-alarm rate decreased by 20 percentage points |
| Same counts, final median +50 ms | Slower and more accurate; trade-off outranks false alarms and hits |
| Reversed counts, final median −50 ms | Faster with lower accuracy; trade-off outranks false alarms and hits |
| Original counts, final median +49 ms | False-alarm decrease remains primary |
| GO 14/15→15/15, NO-GO unchanged, −75 ms | Numbers only: +7 displayed GO points, 0 NO-GO points, −75 ms |
| GO 15/15→14/15, NO-GO unchanged, +75 ms | Numbers only: −7 displayed GO points, 0 NO-GO points, +75 ms |
| GO 13/15→14/15 and NO-GO 4/5→5/5, −75 ms | Overall gain is exactly 10 pp: false-alarm decrease remains primary |
| Reverse of that exact-10-point case, +75 ms | False-alarm increase remains primary |
| GO 12/15→15/15 and NO-GO 5/5→4/5, +50 ms | Opposite signs: both category changes and timing numerically |

These nine cases also pass through production `scoreStop` using freshly constructed **80-trial scoring-event fixtures on committed `stop-baseline-01`**. All four blocks reconcile to 15 GO/5 NO-GO; first/final counts and exact narrative match independent expectations. Target and parent produce deeply equal whole summaries for every case. These are scorer-composition fixtures, not fresh live-engine or browser journeys.

The audit additionally enumerates **11,664 complete-block combinations**: 10–15 correct GO hits and 0–5 correct NO-GO withholds in each compared block, across −75, −74, −50, −49, 0, +49, +50, +74 and +75 ms. An independent oracle works in integer thirds of a percentage point and compares **exact output strings**, including signs, rounding and category names. Results: **zero expected-output mismatches and zero parent/target differences**. The submitted implementation sweep was treated as a claim; this audit's separate execution supplies independent evidence.

### B1 recovery and B3 disclosure regression protection

Git confirms byte-identical parent/target source for `src/stop/run.ts`, `src/stop/Report.tsx`, exposure, engine, browser adapters, live run, forms, and B1/B3 test files. Dependencies are unchanged. In particular, the correction does not edit `verifyCompletedResult`, `recoverReport`, rejected-record retention, form consumption, or the recorded extra-input note rendering. The unchanged scorer body outside `speedAccuracy` continues to supply their summaries.

Fresh focused execution of the existing B1/B3 regressions passes **19 tests**:

- Ten corrupt-record cases reject actual same-tab recovery while retaining evidence and exposure: the five original corruptions plus missing offset, duplicate resolution, missing quality note, summary mismatch and completion-count mismatch.
- Extra-input boundaries 0, 4, 5, 9 and 10 preserve the expected outcomes, quality note, validity/invalidation and recovery behavior.
- An intact record with both timing and input notes recovers.
- Three report-component checks verify exact input-note copy, unchanged Valid/Valid-with-timing-note status, coexistence with the timing note, and omission when absent.

These are fresh executions of submitted repository regression tests, not newly authored independent B1 corruption or browser probes. The broader 29-corruption audit and real-browser disclosure/retry observations belong to **parent `0cf2f9f04fadc34bb530342af49b6dd4a6eeca50`** and are not relabeled as fresh target evidence.

## Checks and repository integrity

- Initial and final HEAD equal the exact target; its immediate parent equals the supplied parent.
- Working tree and index are clean at both checks.
- All **121 tracked-file SHA-256 hashes** are unchanged across the audit.
- All 121 target archive files and 120 parent archive files byte-match their respective Git blobs after testing.
- `git diff --check PARENT TARGET` passes.
- Fresh `npm run check` passes: lint, **20 test files / 381 tests**, deterministic regeneration of **14 forms**, TypeScript and Vite production build. Node 24.13.1; npm 11.8.0.
- Focused B1/B3 run passes 19 tests; its 36 nonmatching tests were skipped in that targeted command and were covered by the complete suite.

The exact six changed files are:

1. `src/stop/scoring.ts`
2. `src/stop/scoring.test.ts`
3. `IMPLEMENTATION_TRACKER.md`
4. `docs/qa/m3/VERIFICATION.md`
5. `docs/qa/m3/repair/VERIFICATION.md`
6. `docs/qa/m3/repair/b2r-check.txt`

Governing-document SHA-256 values match the working tree, target, parent, accepted M2B-2 base `9127249f49ab51f84c5e59cd560cecdcfc7ede31`, and founder-verified repository continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

This is verification against the approved repository continuation, not a fresh external-source approval. No tracked files were edited, fixes implemented, commits made, pushes performed or deployments initiated. All audit artifacts and build outputs are outside the repository. Existing installed dependencies were reused.

## Browser decision and acceptance limits

**No full browser rerun was needed or performed.** The only product diff is a pure narrative-selection branch; browser, rendering, input, timing and recovery paths are unchanged. The complete-block oracle finds no target/parent output difference for the realizable cases, and component/regression checks pass. No concrete new browser risk was identified. Earlier browser journeys remain **parent-SHA evidence**, not target browser certification.

- **M3 founder acceptance: pending.** This focused PASS does not accept the milestone on the founder's behalf.
- **S32/S44:** B2-R approval mismatch is closed at this SHA within the tested scope. This does not certify every report behavior or environment.
- **S68: partial.** Same-tab regression checks pass; browser-refresh recovery remains unimplemented/open.
- **`report_viewed`: open.** No implementation or independent resolution is claimed.
- **Initial-frame handling/watchdog: open.** No new timeout policy or certification.
- **Pre-start screen-reader disclosure: open.** No assistive-technology testing or acceptance.
- **Browser/device certification: open.** No fresh native lifecycle, physical-input/display timing or support-matrix validation.
- **Accessibility/visual acceptance: open.** Component tests do not establish full keyboard, screen-reader, contrast, zoom or responsive certification.
- **Deployment and release: not performed; remain separate open states.**
- M2B-2 remains founder-accepted at its recorded SHA. M4/M5, analytics and further product scope are unchanged.

## Artifacts and reproduction

All files are under `/private/tmp/stop-m3-b2r-audit-d386d5b/`:

- `AUDIT.md` — this verdict.
- `initial-state.json`, `final-state.json`, `tracked-before.json`, `exact.diff`, `source.diff` — integrity and scope evidence.
- `m3-authority.json`, `repair-authority.json` — freshly retrieved authority.
- `probe.mjs`, `probes.json`, `probes.log` — independent boundary, count-oracle and scorer-composition evidence.
- `check.txt`, `focused-regressions.txt` — fresh repository command results.
- `source/`, `parent/` — immutable tracked-file snapshots used for execution.

Reproduce from this directory with `node probe.mjs`. From `source/`, run `npm run check` and `npm test -- src/stop/run.test.ts src/stop/Report.test.tsx -t 'B1|B3' --reporter=verbose`.

Audit harness corrections: the host Python version does not support `tarfile.extractall(filter=...)`, so trusted local Git archives were extracted using its supported signature. An initial expected-value fixture mislabeled two additional correct outcomes in a 20-trial block as an intermediate accuracy change; it is exactly 10 percentage points. That audit expectation was corrected to false-alarm priority in both directions. `preliminary-probe.log` retains the initial assertion. Final evidence uses the corrected independent arithmetic and unchanged product source; neither harness correction is a product finding.
