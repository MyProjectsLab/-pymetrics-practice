# Stop M5 C6 repair — developer verification

## Scope and starting identity

Started from clean `5e6b3720e19b7545c11cb42349fe283a19e52554`. The independent whole-M5 audit at `/private/tmp/stop-m5-full-audit-5e6b372-20261001/AUDIT.md` found C6. This repair addresses only an already-open numerical comparison during an unresolved periodic authority read. It does not convert that audit's FAIL into a PASS or close founder acceptance.

Both frozen specifications were read and left untouched. Their SHA-256 hashes match the approved source: Master Strategy `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`; Stop V1.1 `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.

## Pre-edit reproduction

Against the clean starting checkout, the audit's full Chromium probe completed a real eight-trial warm-up and 80 scored retest trials. Both completion writes failed. The candidate opened comparison, returned to the library, resumed training, and another tab deleted the baseline. A periodic original-store `read()` had already captured a snapshot but its promise delivery was held. After 3.5 seconds the deleted chain's 25% numerical comparison was still visible; only one read was pending. The durable baseline was absent and the durable chain retired. Releasing the read removed comparison, while the original immutable temporary report remained reviewable; reload discarded the unsaved retest. Raw capture: `/private/tmp/stop-c6-repair-5e6b372/full-open-authority/unavailable-before-none-report-fail.json`; screenshot `stale-open-comparison.png` in that directory. This capture precedes every product edit.

## Comparison authority transitions

| State | Entry and display rule | Exit |
|---|---|---|
| Verified | A successful check of the current chain against its original installation and dependencies permits its numerical comparison. | Any initial, periodic, focus, or visibility recheck immediately enters checking. |
| Checking | The read is unresolved; numerical comparison is hidden while report review and exit controls remain available. Repeated interval callbacks cannot regrant eligibility while the read is held. | The same request's successful check returns to verified; a false/rejected check enters unavailable. |
| Revoked or unavailable | Deleted dependencies, cleared/replaced installation, missing durable evidence, or an unavailable/rejected read keep numbers hidden. | Only a fresh successful check for the same current chain can verify it. |
| Replacement ownership | A chain change or unmount invalidates the old display and its in-flight request. The old callback cannot verify or clear the replacement chain. | The replacement must pass its own check. |

The implementation stores the display state in `TrainingFlow` and clears verified display at the start of every check, including periodic checks. It keeps the existing original-store read, deletion revision, chain identity, request generation, and unmount fences. No notification is required to withdraw display. No storage, timed run, reservation, expiry, scoring, form, or specification behavior changed.

## Developer checks and browser evidence

`npm run check` passed on the changed product source: lint (two inherited warnings), 483 tests in 31 files, 14 standard-form and five drill regeneration checks, TypeScript, and production build. Two focused component cases were added for a held periodic read and a pre-focus late success; the existing authority and completion tests remain passing. The local browser was Chromium headless shell 145.0.7632.6 at 1200 × 800 on macOS, using real IndexedDB and Web Locks. Fault injection and seeded boundaries are identified below.

- Full repaired C6 journey: `/private/tmp/stop-c6-repair-5e6b372/full-after/unavailable-before-none-report-fail.json`. A new complete 643-event 8+80 retest, two failed saves, held periodic read, actual history deletion, report review and reload. The held read issued once; no numerical comparison appeared during or after the hold. The source screenshot was reopened and inspected.
- Already-open comparison matrix: `/private/tmp/stop-c6-repair-5e6b372/open-stalled-matrix-after.json`. Twelve seeded post-fallback cases: baseline, required drill, Delete all, and unrelated deletion across delivered, delayed, and unavailable notifications. All withhold numbers during the held read; only unrelated deletion regains comparison after a fresh check. Delayed messages were delivered later and did not restore a revoked comparison.
- Resume matrix: `/private/tmp/stop-c6-repair-5e6b372/resume-matrix-after.json`. The same 12 deletion/notification combinations use actual history and Resume controls, retain the original temporary report, and reload durable-only records.
- Read and ownership probes: `/private/tmp/stop-c6-repair-5e6b372/open-authority-after.json`, `authority-probes-after.json`, and `open-authority-keyboard-visibility.json`. Rejected/recovered read, focus-, visibility-, and periodic-stalled display, late pre-deletion read, replacement chain, original-store ownership, missing baseline/drill, and navigation during a held Resume all pass. Keyboard Tab/Enter exited the stalled comparison and opened the retained original report; a late read did not reopen comparison.
- C2 full regression: `/private/tmp/stop-c6-repair-5e6b372/c2/delayed-before-drill-exit-ordinary.json`. A new 8+80 retest, one pending completion save, actual required-drill deletion, delayed notification and candidate exit. The immutable journal remains reviewable, without a comparison action or reload resurrection.
- C3 full regression: `/private/tmp/stop-c6-repair-5e6b372/overlap/two-retests-late-first.json`. Ordinary second admission is blocked. An already-overlapping ownership state is then constructed; two separate real 8+80 retest journals are completed. Late first delivery preserves both journals/exposures and the newer selected retest and comparison.
- C4 full regression: `/private/tmp/stop-c6-repair-5e6b372/c4/delayed-after-all-report-ordinary.json`. After a new full retest commits, Delete all creates a replacement installation. Delayed old success neither restores the old result/chain nor alters replacement reservation/activity.
- Successful retry: `/private/tmp/stop-c6-repair-5e6b372/retry/unavailable-before-unrelated-report-retry.json`. A new full retest has exactly two completion-save calls: the first fails and the second commits. The valid report, comparison, and byte-identical durable reload remain available despite unrelated deletion and unavailable notifications.

The seeded matrix uses a verified immutable full retest journal captured by the independent audit at this starting SHA; its twelve cases are state-transition tests, not twelve more timed completions. The full C6 journey above is a separate new real-timer completion. Browser timing evidence is development evidence, not physical input/display measurement or device qualification.

`EVIDENCE-SHA256.json` binds 13 raw captures/screenshots and records a separate journal reconciliation of the six new full runs against canonical form manifests, event order, timing bands, outcomes, summaries and byte identity across the relevant snapshots. All six have 643 events. Its `sourceSHA256` is the tested `TrainingFlow.tsx` content hash, `bf7b9db5bd5e69221b5b42c4810f230954a4e4d7fd7995573f7f981cd15261d4`. The raw files and adapted browser drivers are retained under `/private/tmp/stop-c6-repair-5e6b372/`; the drivers' seeded state and explicit fault injection are not ordinary candidate completions.

## Open gates and limits

Fresh independent whole-M5 audit of the new commit and founder M5 acceptance remain open. N2 abandoned unarmed cross-tab claim availability, S46 router precision, initial-frame handling, pre-start screen-reader disclosure, supported browser/device and native lifecycle qualification, full accessibility and visual review, M6, deployment, and release remain separate. No reservation-expiry rule was added, and no push or deployment was performed.
