# Stop M3 — focused audit repairs B1–B3

Date: 2026-09-29. Target repaired: `a81b76fbfcb459a6bee5d12f86cb0ea2029123eb` (independent **FAIL**). Starting HEAD matched that SHA and the working tree/index were clean. The founder explicitly authorized B1–B3 repairs, regressions, and a local commit. **The independent audit of this repair at `0cf2f9f04fadc34bb530342af49b6dd4a6eeca50` later failed solely on B2-R; the focused correction is recorded below. M3 is not founder-accepted. A fresh independent audit of the correction is required.** This is implementation-agent verification, not that audit. The final correction commit SHA is supplied in the handoff to avoid a self-referential identifier.

The complete repository instructions, Master Strategy, Stop V1.1 and tracker were read. The audit at `/private/tmp/stop-m3-audit-a81b76f/AUDIT.md`, its deterministic probes and browser recovery reproduction were inspected. The original audit artifacts were preserved unchanged; adapted drivers and new evidence live here.

## Repairs and focused evidence

### B1 — reject corrupted same-tab recovery

`verifyCompletedResult` compares all actual form content/provenance with the approved registry, reconciles schedules with the form, uses the existing engine trial-integrity checker for presentations/removals/input-response-resolution links, rejects invalidation/failed integrity evidence, checks completion ordering and final interval, reconciles timing/extra-input notes and thresholds, and reproduces the immutable summary. Retry additionally compares the entire retained journal and setup with the still-retained canonical same-tab engine/preparation evidence.

Failure removes the record from valid results, stores an invalid draft with the rejected events/form and full rejected record for local diagnosis, and preserves the engine journal. Repeated failed retry preserves that same draft. No missing evidence is estimated; no form is reserved, exposed again, or released by retry. Existing consumed-form markers remain unchanged.

The audit's five mutations were reapplied to separate complete 57-hit/3-miss/17-withhold/3-false-alarm production-engine fixtures. Envelope sequence numbers and completion counts were reconciled as in the audit:

| Corruption | Record verifier | Actual `recoverReport()` | Result |
|---|---|---|---|
| Changed scored presentation identity | Rejected | false | Invalid recovery |
| Removed all presentations | Rejected | false | Invalid recovery |
| Accepted response time changed to 999 ms | Rejected | false | Invalid recovery |
| Seed changed while checksum string retained | Rejected | false | Invalid recovery |
| Inserted session invalidation | Rejected | false | Invalid recovery |

For each case, raw rejected evidence and exposure were checked. Additional repository fixtures cover missing offsets, duplicate resolutions, omitted quality note, altered summary and completion count. Intact records, including records with both timing and extra-input notes, recover successfully with the same result/form and exposure count.

### B2 — select the approved primary observation

After sufficiency and the approved category/opposite-sign and 5–<10-point numbers-only exceptions, select a qualifying speed–accuracy trade-off, then a false-alarm-rate change of at least 15 pp, then a GO hit-rate change of at least 10 pp. Without a higher-priority observation, preserve the approved timing classifications, including the founder's 50–74 ms clarification and the 75 ms standalone timing boundary. Secondary numerical evidence remains visible.

The audit fixture has GO 12/15 → 15/15, NO-GO correct withholds 4/5 → 5/5, and unchanged 400 ms median. It now selects: **“From the first to the final block, false-alarm rate decreased by 20 percentage points.”**

Regression coverage includes both directions at 14.999/15/15.001 pp false-alarm change, 9.999/10/10.001 pp hit-rate change, 49/50/74/75 ms timing, trade-off priority, category concentration at the 5-point boundary, opposing material category changes, the 5–<10 pp override even at 75 ms, and insufficient outcome/timing denominators. M3-01–04 decisions and quartile/rounding/cohort rules remain unchanged.

### B3 — disclose the recorded extra-input note

The report reads the recorded `five_extra_inputs` quality event and shows exactly:

> Five or more extra response-key presses were recorded after trials had resolved. They did not change the recorded trial outcomes.

The note does not change `valid` into `valid_with_note`. A timing note and this note can both appear. Engine-backed fixtures cover 0, 4, 5, 9 and 10 extra inputs: five/nine retain outcomes and a valid result; ten still invalidate. A separate fixture covers both notes, and component tests verify both exact disclosures and unchanged status.

## Checks

- `npm run check`: **PASS** — lint, 20 test files / **373 tests**, deterministic regeneration of all **14** forms, TypeScript and production build. See `check.txt`.
- Adapted audit probes: **71 recorded cases completed**, including the five corruption rejections and priority/note assertions. See `probes.mjs`, `probes.log`, `probes.json`. This is a fixture-case count, not 71 acceptance tests or an independent audit.
- `git diff --check`: passed.
- Both governing documents byte-match the approved repository continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0` and repair target. Master SHA-256: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`; Stop V1.1: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.
- No changes to frozen specifications, stored forms, timing-engine implementation, dependencies, or M2B-2 behavior.

## Browser evidence

**PASS:** final-source guide → preparation → eight-trial warm-up → 80 scored trials → completion → injected report-render failure → same-tab retry → recovered report. Chromium/HeadlessChrome **145.0.7632.6**, macOS, **1200 × 800 CSS pixels**, real performance clock/timers/rAF and production DOM/input adapters. Automated DOM keyboard events followed observed stimulus changes; this is not human latency, physical-keyboard latency, or browser/device certification.

The recovered `stop-baseline-01` result remained **Valid**, with 57 hits, 3 misses, 17 correct withholds, 3 false alarms and 57 eligible timing values. Median 371.400000095 ms displays **371 ms**; IQR 20.600000143 ms displays **21 ms**. The 792-event journal has one completion, one five-extra-input note (trigger sequence 113), no timing anomalies, and one unchanged exposure marker. The exact founder copy appears in Data quality; the primary block observation is the 20 pp false-alarm reduction. No unexpected page errors occurred; React logged the deliberately injected rendering failure.

The adapted independent arithmetic oracle reconstructed form checksum, event order, presentations, accepted inputs, outcomes, timing, post-error cohorts, final interval and exposure directly from the raw browser journal and passed. `browser-recovery-verified.json` records visibility 200.3–208.5 ms, onset delay 0.6–10.8 ms, and transition intervals 1200.6–1210.8 ms for this run only.

The report heading received focus. The full report screenshot was reopened and visually inspected. At 320 CSS pixels the document remained 320 pixels wide, with the block table in its own scroll region. Ordinary replay navigation worked, and refresh cleared the result as disclosed. These checks do not certify screen-reader use, zoom/contrast, native lifecycle, or the supported-device matrix.

Evidence: `browser-recovery.mjs`, `browser-recovery.log`, `browser-recovery.json`, `verify-browser.py`, `browser-recovery-verified.json`, `recovered-report.png`, `recovered-report-320.png`, and `recovered-narrow.json`.

## Reproduction

From the repository root, run `npm run check` and `node docs/qa/m3/repair/probes.mjs`. For browser reproduction, start `npm run dev -- --host 127.0.0.1 --port 5192 --strictPort`, then run `node docs/qa/m3/repair/browser-recovery.mjs` followed by `python3 docs/qa/m3/repair/verify-browser.py browser-recovery.json`. The driver uses the pre-existing Playwright/Chromium paths recorded in its source. Evidence is written beside each driver; copy the directory first to preserve this run's files.

Harness corrections during this repair: a TypeScript discriminated-union error in the new corruption fixtures was fixed before the passing build. The adapted driver initially retained URL-escaped spaces in its output path; this was corrected and the preliminary browser run stopped before completion. A subsequent complete browser journey rendered the correct note and recovered successfully, but the driver imported an empty second Vite module instance when collecting the journal. Its text/error/log are preserved as `preliminary-browser-recovery-error.json` and `preliminary-browser-recovery.log`. The final driver uses the exact module URL already loaded by the application, and the server was restarted before the retained run. Local server/Chromium startup required sandbox permission. These are harness/environment issues, not product findings or certification evidence.

## Changed-file inventory

- `src/stop/run.ts`: recovery integrity and rejected-record retention.
- `src/stop/scoring.ts`: primary-observation priority and approved category/sufficiency handling.
- `src/stop/Report.tsx`: exact recorded input-quality disclosure.
- Their three test files: focused corruption, priority and disclosure regressions.
- `IMPLEMENTATION_TRACKER.md` and `docs/qa/m3/VERIFICATION.md`: failed-target status, repair status, and retained gates.
- `docs/qa/m3/repair/`: this record, adapted reproduction drivers, raw fixture/browser evidence, screenshots, and command results.

## Status and remaining limits

Implemented and locally tested: B1–B3 only. Independent audit: the original SHA and the `0cf2f9f` repair are both **FAIL** at their respective commits; the B2-R correction needs a fresh independent exact-SHA audit. Founder acceptance: **pending, M3 not accepted**. Commit: local handoff only. Push, deployment and release: not performed.

S43 and the implemented same-tab portion of S68 have focused repair evidence; **S68 remains partial** because refresh recovery is absent. S32/S44 and the S41 disclosure have local repair evidence, not general device certification. Non-blocking local `report_viewed` recording stays open. Initial-frame watchdog, pre-start screen-reader disclosure, supported browser/device matrix, native lifecycle/physical-display timing, full accessibility/visual approval and release gates remain open. M2B-2 stays founder-accepted at `9127249f49ab51f84c5e59cd560cecdcfc7ede31`. M4/M5, analytics, durable storage and further product work were not started.


## B2-R correction after the repair audit FAIL

The independent audit at `/private/tmp/stop-m3-repair-audit-0cf2f9f/AUDIT.md` found one approval mismatch: `0cf2f9f` added an unapproved five-point minimum before treating opposite GO and NO-GO category changes as a numbers-only observation. Its `category-probe.mjs/json` reproduced GO +10 / NO-GO −4.999 points at 0 and +50 ms, GO −10 / NO-GO +4.999 points at −50 ms, and exact five-point boundaries. The complete-block and B1/B3 audit checks passed within their stated limits. That FAIL remains bound to `0cf2f9f04fadc34bb530342af49b6dd4a6eeca50`.

The founder authorized this minimal correction. The scorer now returns both category changes and timing numerically whenever the unrounded category changes have opposite signs, **before** category concentration, the 5–<10-point exception, or §13.2 primary-observation selection. There is no magnitude threshold for opposite signs. The original audit's 20-point false-alarm example and the repaired priority order remain in place.

The contradictory +10/−4.999/+50 ms test expectation was replaced. New synthetic fixtures cover +10/−4.999 at 0 and +50 ms, −10/+4.999 at −50 ms, and exact ±5-point boundaries in both directions. An independently expected count-based test checks all **11,664 sufficient complete 15/5 block pairs** across −75, −74, −50, −49, 0, +49, +50, +74, and +75 ms timing changes. These are classifier fixtures; the fractional changes are not represented as realized standard forms. The existing 80-trial original-audit fixture still selects the 20-point false-alarm reduction.

Changed scope for this correction: `src/stop/scoring.ts`, `src/stop/scoring.test.ts`, this verification record, `docs/qa/m3/VERIFICATION.md`, and `IMPLEMENTATION_TRACKER.md`, plus the new command evidence `b2r-check.txt`. The governing specifications, stored forms, engine, B1 recovery, B3 disclosure, and M2B-2 remain untouched.

**Verification:** see `b2r-check.txt` for the final `npm run check` result. Implementation-agent tests are evidence for handoff, not independent acceptance. M3 founder acceptance, refresh recovery (S68), `report_viewed`, initial-frame watchdog, pre-start screen-reader disclosure, browser/device matrix, native lifecycle, full accessibility/visual review, deployment, and release remain open. No push or deployment was performed.
