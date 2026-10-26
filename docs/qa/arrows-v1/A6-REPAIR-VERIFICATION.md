# Arrows A6 F1–F3 focused repair

**Parent:** `502ecca6cc502758f7d9191d69f0f524a9814d28`. The [independent A6 audit](/private/tmp/arrows-a6-audit-502ecca-CRCpD8/AUDIT.md) reproduced three source-adapter blockers. This record covers their local repair; it is developer evidence, not an independent PASS or a complete Arrows game.

## Corrections

- **F1, block publication:** protection now begins immediately after the engine accepts Start or Continue and before publication. A throwing or reentrant-canceling callback produces a terminal invalid journal and cannot schedule a new fixation after the Web Lock is released. A held control that prevents Continue remains at the untimed break and can be retried after release. Cleanup releases ownership even if DOM removal throws.
- **F2, changed settings at a break:** `settingsChanged()` invalidates an accepted attempt, including an untimed break. A change while the original entry is still pending cancels that entry. Ordinary untimed blur/hide and permitted layout-preserving zoom retain their existing exception.
- **F3, visible rule:** the cue is included in the per-element viewport and occlusion check. The admission and protected-frame predicate rejects zero-opacity ancestors of the host or any tested cue, symbol or control.

## Checks

- Focused Arrows suite: **51 tests across six files pass**, including Start callback throw/cancel, Continue callback throw, settings at a real 24-trial break, held-key retry boundary and technical cleanup release.
- [Repair Chromium harness](A6-repair-browser.mjs) and [raw results](A6-repair-browser.json): **3/3 pass** in headless Chromium `145.0.7632.6`. A Start callback failure leaves no onset and releases the lock; a cue overlay and a transparent host ancestor both invalidate as viewport failures and release ownership. The browser cases use scripted faults and input.
- All [six original A6 Chromium scenarios](A6-repair-regression.json) passed again against the repaired source. The original A6 evidence file was not overwritten.
- Lint passes with two inherited warnings in untouched files. TypeScript, production build, frozen-form regeneration and `git diff --check` pass. The frozen Arrows specification, forms and generator were not edited.

## Limits

This is a source adapter repair. The timing adapter remains outside the candidate journey, durable checkpoint/completion storage, report/history UI, full mock and browser/device/accessibility qualification. The Chromium checks do not measure physical input/display latency or native assistive technology. A separate read-only audit of the exact repair SHA is required before calling A6 independently passed. Founder personal acceptance, deployment and release remain open.
