# Keypresses F7 timer-boundary repair — developer verification

**Parent:** `7dc6ca4d37d1cfad339d82d6a28dfb3e093a5448`. The separate [F1–F6 repair audit](/private/tmp/keypresses-repair-audit-tbIBdB/AUDIT.md) verified those six repairs but **FAILED** this parent on F7: native callbacks sometimes ran 0.2–0.4 ms before the scored deadline, causing `technical_failure` rather than a normal sparse result. Its source probes also found the same early-timer risk at the late-close and END-watchdog boundaries.

The browser adapter now schedules GO, GO timeout, scored deadline, END watchdog and late close through one monotonic not-before helper. If a relative timer runs early, the helper waits the remaining real clock duration. It does not change the frozen 15,000 ms, 1,000 ms or 250 ms thresholds, forge timestamps, loosen core validation or alter in-memory key admission.

The expanded [production-browser driver](browser-development.mjs) and [raw results](browser-development.json) pass **15/15 scenarios** on headless Chromium **145.0.7632.6**. New cases deliver relative timers up to 2 ms early through a sparse 15-second deadline and late close, and deliver the END watchdog timer 20 ms early while a real timer confirms the END frame at 240 ms. Both remain valid. The normal sparse deadline, delayed/withheld END, GO timeout, save recovery, keyboard and deletion controls also pass. Timer shifts and frame delays are injected; normal browser results are labeled separately.

Focused Keypresses tests pass (**12/12**), lint passes with two inherited warnings, and TypeScript/production builds pass. The last full repository check at the parent passed **1,111 tests**; it was not redundantly rerun for this adapter-only repair. Frozen Keypresses specifications, core scoring and storage contracts remain unchanged.

This is developer evidence only. A separate read-only exact-SHA audit is required. `report_viewed`, complete browser/device/accessibility qualification, full mock, whole-game founder acceptance, deployment and release remain open.
