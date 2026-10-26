# Arrows A4 — durable arm foundation

**Base:** `d8c3d8ded13307194d5abf28b8b42c9516605712`, whose bounded A3 headless report audit passed. This stage adds durable form rotation and arming only. It does not start a timed browser run.

## Implemented

- Arrows-only IndexedDB installation root `arrows_storage_v1` holds installation ID, revision, committed scored-start count, arm attempts and tombstones. Unsupported/corrupt versions reject non-destructively.
- Each `start` uses one read-write transaction over the authoritative root. It validates the frozen form and arm state, assigns `AR1`–`AR6` by committed count, retains the versioned `prepared`/`form_assigned`/`armed` prefix, then requires authoritative readback before returning an arm. Repeating the same request ID does not advance rotation. A committed write with lost callback is recovered only by readback.
- Captured installation ID and per-arm session, clock-domain, profile, request ID and ordinal are checked on load. Replacement installation and changed form/event/version bytes reject; detached authentic IndexedDB clones are rehydrated against the canonical form authority before headless replay.
- Abort/cancellation rejects entry even if a previously dispatched write later commits. Such a committed arm conservatively consumes the count but cannot start a canceled run. Browser ownership and live protection are subsequent stages.

## Developer checks

- Focused storage tests: **7 passed**. They cover concurrent two-store rotation through seven arms, idempotent requests, pre-commit failure, committed-but-undelivered callback, unavailable readback, pending cancellation, a profile changed while the transaction is held, replacement identity, corrupted form/ordinal/installation, unsupported root and detached authentic replay.
- TypeScript passed. A bounded real Chromium `145.0.7632.6` run used two tabs on one origin, concurrently armed `AR1` and `AR2`, retried both IDs without count changes, reloaded one tab, and read two three-event records at count/revision two. [Script](A4-browser-arm.mjs) and [raw result](A4-browser-arm.json) are retained.
- Focused storage/report/engine tests: **25 passed** across three files. Lint passed with two inherited warnings in untouched files; production build, Arrows form regeneration and `git diff --check` passed. The three frozen Arrows hashes remain those in `FREEZE.md`.

## Limits and audit request

The browser run verifies IndexedDB arming and reload only. It does not confirm visible stimuli, real input, browser-owner lock, checkpoint writes, completed results, report views, deletion UI or cross-browser/device support. A separate exact-SHA read-only audit should independently challenge transaction/readback semantics, two-tab rotation, cancellation after possible commit, replacement, malformed roots and whether the API can falsely return an unverified arm. No founder acceptance, qualification, deployment or release is claimed.
