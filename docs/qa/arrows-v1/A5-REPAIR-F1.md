# Arrows A5 F1 — request snapshot repair

**Parent:** `1bf4620e7e3d171886c38e9cb1d52957bdd8f61e`, whose [independent A5 audit](/private/tmp/arrows-a5-audit-1bf4620-lg1djezz/AUDIT.md) failed on F1. This record is developer verification of a focused repair, not an independent verdict.

## Failure and change

The audit reproduced a mutable request changed between `ArrowsEntry.begin()` admission and Web Lock delivery. Replacing the request ID with an already retired one re-admitted that arm; mutating the nested keyboard profile changed the binding ultimately passed to durable Start. The existing storage clone occurs after lock acquisition and cannot protect the earlier entry boundary.

`begin()` now takes an owned `structuredClone` synchronously. Its retirement check, tracked request ID and storage dispatch all use that same snapshot. No form, timing, engine, report, storage transaction or candidate claim changed. The two new unit regressions exercise retired-ID substitution and nested profile mutation while ownership delivery is held.

## Checks

- **43 Arrows tests across five files passed**; TypeScript, lint, production build and frozen-form regeneration passed. Lint retained two inherited warnings in untouched files.
- The auditor's **11 Chromium scenarios passed** against the repaired local source, including both former F1 failures, two-tab ownership, canceled late delivery, committed-but-undelivered readback, replacement identity, canonical form reload and tamper rejection. Chromium was headless `145.0.7632.6`; the mutated inputs and held deliveries were scripted/injected. The repaired run is retained at `/private/tmp/arrows-a5-f1-repair-evidence/browser-after.json`.
- The three frozen Arrows SHA-256 values and canonical form digest remain those in [FREEZE.md](FREEZE.md). No qualification, deployment or analytics activation follows from these checks.

**Evidence handling:** The first developer rerun used the auditor's external harness, which overwrote its `browser-results.json` file. I copied that repaired output to the path above, then reconstructed the audit's original JSON from its retained `browser-run-elevated.log` and recorded browser version. The audit report and original execution log were not changed. A fresh independent auditor should treat the restored JSON as reconstructed and use the original log for parent evidence.

## Scope still open

A separate read-only exact-SHA audit must verify this repair. A5 remains an entry foundation: no trial pixels, timed candidate input, checkpoints, terminal result, report/history, native device behavior or full Arrows acceptance is claimed.
