# Keypresses V1 browser journey — developer verification

**Scope:** guide, untimed three-press example, understanding check, hand/key/input setup, readiness, protected GO–END run, descriptive report, local history, individual/Delete all controls and cross-tab live ownership. The implementation uses the [frozen V1.0 packet](../../specifications/ASSESSMENT_PRACTICE_KEYPRESSES_SPECIFICATION_V1_0.md) and [V1.0.1 addendum](../../specifications/ASSESSMENT_PRACTICE_KEYPRESSES_SCHEMA_ADDENDUM_V1_0_1.md). Existing Stop and Balloons mechanics and stored forms are unchanged.

The browser controller writes the armed identity before scheduling GO, admits selected-key events without awaiting storage, confirms GO and END on a visible connected element in animation-frame callbacks, records invalidation on tested lifecycle/timing failures, and waits one second after confirmed END. Failed completion writes leave a reviewable in-tab report, with a single retry and durable readback before a saved claim. A Web Lock excludes a concurrent live Keypresses run; another tab's Delete all withdraws an open report through a change notification and periodic authority reads. Incomplete armed attempts do not resume after reload.

`browser-development.mjs` exercises the production build in headless Chromium **145.0.7632.6**. Its [JSON record](browser-development.json) retains nine passing results; the [report screenshot](browser-report.png) shows the scripted 40-press result:

1. Forty scripted Space presses → valid saved report → identical count after reload → individual deletion.
2. Modified F key, two accepted presses, natural 15-second deadline → sparse and modified-key report.
3. Injected blur → invalid review-only attempt retained.
4. A held browser owner lock blocks another tab's scored start.
5. Canceling preparation before a delayed lock acquisition releases the lock.
6. Another tab's Delete all withdraws an open report and its numbers.
7. Withheld GO confirmation → invalid draft with no confirmed onset.
8. 350-ms delayed END confirmation after forty presses → invalid status with factual target preserved.
9. Injected IndexedDB completion-write rejection → truthful unsaved review → one successful retry.

`npm run check` passed: **1,111 tests across 55 files**, 14 Stop scored forms, five Stop drill forms, lint and TypeScript/production builds. Lint retains two warnings in untouched files. The Balloons manifest check passed for nine scored forms and seven drill inventories. `git diff --check` passed. The screenshot's very high rate is an artifact of scripted browser input, not a human performance result.

These are **bounded development checks**, not physical input/display timing or native lifecycle certification. Browser input was Playwright-dispatched. Blur, withheld/delayed frames, write failure and held ownership were deliberately injected. Native screen-reader speech, alternative-input devices, full zoom/reflow, Safari/Firefox/mobile, repeated browser/device support, crash recovery and full-mock integration remain open. The post-completion `report_viewed` journal event and exhaustive cross-tab notification-unavailable cases are also open for the next acceptance pass. Do not use this record to claim whole Keypresses completion, public release or deployment.

A separate read-only exact-SHA audit must follow the commit.
