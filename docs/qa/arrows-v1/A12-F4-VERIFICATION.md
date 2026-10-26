# Arrows A12 F4 report-authority repair — developer verification

**Scope:** repair the independently reproduced stale-positive report publication at the standalone Arrows closure audit. The product change does not revise frozen forms, timing, scoring, or candidate claims. This is developer evidence, not an independent PASS or founder acceptance.

## Failure and design

The read-only [whole-game closure audit](/private/tmp/arrows-closure-audit-70be42f/AUDIT.md) reproduced F4 at `70be42f`: with BroadcastChannel unavailable, a report read captured before individual deletion returned after deletion and restored both “Saved in this browser” and numerical results. The [separate architecture challenge](/private/tmp/arrows-f4-design/REVIEW.md) recommended a shared read-to-DOM publication gate rather than another stale-prone reread.

Saved report and history publication now acquire the same stable Web Lock as individual deletion, Delete all, first scored onset, and snapshot replacement. The authoritative read starts under that lock; a current operation must synchronously commit its verified data and saved status to the DOM before releasing it. The publication has a bounded deadline, cancellation token, and late-callback fence. Healthy equal report checks do not hide or replace the table. Navigation, lifecycle withdrawal, replacement and deletion cancel outstanding publication. Report-view activity follows a genuine saved publication and cannot authorize it.

## Bounded checks

- F4 native IndexedDB/Chromium cases: individual deletion and Delete all, each with read held until timeout and read delivered first. All four show deletion queued until the read-to-DOM gate ends; after deletion, late callbacks show zero result tables and no saved claim. BroadcastChannel was unavailable. See `/private/tmp/arrows-f4-evidence/f4-*.json`.
- Delayed initial history-list and history-report opening: both deletion types, four cases. No deleted report or newly installed history row appeared from late delivery. See `/private/tmp/arrows-f4-evidence/history-list-*.json` and `open-report-*.json`.
- Healthy production report checks over 3.2 seconds retained the same table node, with zero hidden transitions and zero “Verifying” insertions. Navigation during a held poll reached history; the late poll did not restore the report. See `healthy.json` and `navigation.json` beside the other external evidence.
- Ordered-publication unit tests cover publish-before-delete, canceled read-before-delete, and coalesced healthy reads. The affected Arrows component/storage tests pass. Two storage-order tests additionally force snapshot-first and deletion-first schedules. The final production bundle passed all four F4 order cases and the history/opening checks.

The prior independently reconciled 120-trial fixture supplied numerical expected values; this repair does not recompute them from current implementation. The browser cases use injected callback delays on native IndexedDB and native Web Locks; they are bounded headless Chromium checks, not physical device or native lifecycle qualification.

## Final checks and status

`npm run check` passed once on the final source: **65 test files and 1,281 tests**, lint with two inherited warnings, all form/drill/Arrows/Lengths manifest checks, TypeScript and production build. The final client bundle `index-CeLQKrnr.js` has SHA-256 `71d683a222a0a92d1514b6909c213c921e431aa872e959560fa3d9d36cd144ca`. The final bundle passed the four F4 cases, four delayed history/opening cases, healthy-refresh stability, navigation cancellation and an explicit Delete all readback (`replaced=true`, zero counters/attempts/activity/tombstones). No console error was recorded in those cases.

One complete native-timer browser run on the earlier repair build reached four confirmed checkpoints, 120 closed trials, a saved terminal snapshot, and byte-identical recovery after reload with activity advancing from one to two report views. Its final Delete all assertion read IndexedDB immediately after the click, before the asynchronous UI completion; the driver therefore reported failure at that last assertion. The corrected bounded Delete all probe waits for the visible confirmed deletion before reading the root and passes on the final build. The full run is **not** represented as a complete final-bundle journey.

A separate read-only exact-SHA audit remains required. A11 N1, personal founder acceptance, browser/device/accessibility qualification, full mock, deployment and release remain open.
