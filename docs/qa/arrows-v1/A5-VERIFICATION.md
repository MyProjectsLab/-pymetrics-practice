# Arrows A5 — canonical arm handoff and browser entry lifetime

**Base:** `a28f7a15cb81e57522fa16438fff09023f593579`, the focused A4 F1 PASS. This is an entry foundation, not a timed-play adapter or candidate journey.

## Implemented

- `ArrowsStore.start` and `loadArmed` return a replay-verified, recursively frozen arm bound to the canonical fixed form. The IndexedDB clone is never sent directly into the headless engine. This addresses A4 observation N1 without weakening form admission.
- `ArrowsEntry.begin` takes the exclusive Arrows Web Lock before durable Start, requires a visible focused document, and returns only an authoritatively confirmed arm. An active owner blocks a second tab without consuming another form.
- `release` aborts pending storage delivery and releases the lock. A late owner callback after cancellation cannot start; canceled or finished request IDs are retired for this document. Lock contention or a storage error before a confirmed arm may retry with the same request ID, preserving the A4 deduplication/readback contract. This addresses the invocation-lifetime part of A4 observation N2; timed-run cleanup remains future work.

## Developer evidence

- Focused unit cases cover canceled late acquisition, held storage delivery and lock release, repeated entry rejection, lock contention retry, two-tab form rotation, canonical replay after detached storage reads and runtime immutability.
- [Bounded Chromium script](A5-entry-browser.mjs) and [raw result](A5-entry-browser.json) confirm one tab armed `AR1`, another was blocked without allocation, explicit release enabled `AR2`, canceled held delivery released ownership, then another tab armed `AR3`. Reloaded `AR1` was canonically rehydrated, immutable, replay-verifiable and accepted by the headless engine. Chromium `145.0.7632.6` headless; input was scripted.
- Final focused run: **30 tests across four Arrows files passed**; TypeScript, lint, production build, frozen-form regeneration and `git diff --check` passed. Lint reported two inherited warnings in untouched files. The frozen specification, form JSON and generator SHA-256 hashes remain respectively `ae7360d4b81d28b23c12e265e0707934f6659fdf183c65ddac782745ad305836`, `a87abdaa25fbddd9b08b49e97fa0fa2fbc25e2c4bf32bc59be7dca6b46cfef3f` and `5c317a02f5b2c953fcf692ce9467dc506197c64d9ca07900caff16c23cc1df27`.

## Limits and separate audit request

No trial pixels, key/pointer responses, stage timing, lifecycle invalidation, checkpoints, terminal result, report view or history are implemented here. A new page starts with new request IDs; it does not resume an interrupted timed run. A separate exact-SHA read-only audit should challenge the returned canonical identity and mutable-clone boundary, canceled/late acquisition, stalled storage, failure/retry with the same request ID, cross-tab lock release and replacement authority. Physical/browser/device and accessibility qualification remain open.
