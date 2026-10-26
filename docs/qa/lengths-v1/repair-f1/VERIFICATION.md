# Lengths F1 missing-resolution watchdog repair — developer verification

Base: `bdaf29e2b1532c126c70c62ffaf5de496e0a3330`. The [independent whole-standalone audit](/private/tmp/lengths-independent-bdaf29e/AUDIT.md) found one blocker: the resolution timer had no independent 2,000-ms missing-stage watchdog. This is the first failed audited submission for this milestone.

The audited production build reproduced F1 before editing: one held resolution callback, two bars still visible after the watchdog boundary, no durable terminal. The repair schedules the existing stage-token watchdog at original `resolutionDueMs + 2,000` while the response window is active. The watchdog invalidates, removes the bars and releases the live owner. A late resolution callback cannot mutate the terminal journal. Fixation, onset and offset already use the same watchdog helper; their logic is unchanged.

## Focused checks

- Repaired production Chromium, held resolution with regular animation frames: onset 1,168 ms, resolution due 2,568 ms, watchdog due and invalidation at 4,568 ms. Bars absent, durable terminal Invalid with reason `watchdog`. Releasing the late callback left all seven timed events byte-identical. [Summary and raw-file hashes](evidence.json); full production captures and the reproduction script are under `/private/tmp/lengths-watchdog-repair/`.
- Healthy production Chromium: 24 presented, resolved, offset and closed trials; confirmed checkpoint, zero invalidations or page errors. [Summary](evidence.json).
- New automated browser-adapter regression holds the resolution timer, advances to the watchdog boundary, checks Invalid state, bar removal and one owner release, then invokes the late callback and verifies no second event or release.
- Focused Lengths tests: **38/38**. App TypeScript check, changed-file lint, Lengths form/fixture regeneration and production build pass. Frozen packet and manifest files are unchanged.

This is developer evidence for a focused repair, not an independent PASS. The original audit's passing observations for the unchanged standalone paths remain bounded evidence. Browser injection is not natural timer-loss, physical timing, native lifecycle or device qualification. Founder acceptance, mock integration, qualification, deployment and release remain open.
