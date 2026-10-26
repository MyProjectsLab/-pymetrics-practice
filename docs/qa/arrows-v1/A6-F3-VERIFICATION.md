# Arrows A6 F3 painted-occlusion repair

**Parent:** `8db993ea938c93c1fbd2ef29ca208b6518aeb70d`. The [independent focused audit](/private/tmp/arrows-a6-repair-audit-8db993e-q6qfvn_i/AUDIT.md) passed F1, F2 and the N1 lock-release challenge but failed F3: `elementFromPoint` could not see a painted overlay using `pointer-events: none`, and one center sample missed a partially covered cue.

The admission and protected-frame predicate now treats an overlapping non-adapter app element as an obstruction if it is hit-testable above the display **or** has `pointer-events: none`. It checks the complete reserved host footprint, including overlays inserted inside the stimulus stage. Only the adapter's tagged cue, row, symbols and controls are exempt. This is conservative: an overlapping transparent, non-interactive element may disable Start or invalidate a run until the layout is corrected. No timing, form, response or scoring rule changed.

## Developer checks

- [Focused Chromium harness](A6-F3-browser.mjs) and [raw results](A6-F3-browser.json): **6/6 pass** in headless Chromium `145.0.7632.6`. Cases cover a Start publication failure, full cue overlay, fully painted cue overlay with `pointer-events: none`, partial cue-word overlay, partial overlay inside the stimulus stage, and a zero-opacity host ancestor. Each obstruction made `layoutReady()` false, invalidated the protected run as `viewport`, and released the Web Lock.
- [Original A6 browser regression results](A6-F3-regression.json): **6/6 pass** against this source. The six-case driver was copied outside the repository so its historical result was not overwritten.
- Focused Arrows suite: **51 tests across six files pass**. Lint, TypeScript/production build, frozen-form regeneration and diff hygiene pass. Two lint warnings remain in untouched files. The three frozen Arrows document/form/generator hashes are unchanged.

The Chromium cases are scripted source-adapter checks, not a candidate-facing 120-trial production journey or physical-device qualification. The adapter still needs authoritative checkpoints/completion, candidate guide/setup/report/history, `report_viewed`, deletion integration and full mock work. A new separate exact-SHA audit is required before A6 development PASS. Founder personal acceptance, qualification, deployment and release remain open.
