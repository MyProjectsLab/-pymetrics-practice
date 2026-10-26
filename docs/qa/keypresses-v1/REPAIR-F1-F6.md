# Keypresses browser journey F1–F6 repair — developer verification

**Parent:** `1d9009e1b1a4dd73a56b64d79fe54c25cfc07c3b`. The separate [browser audit](/private/tmp/keypresses-browser-audit-6i1I5r/AUDIT.md) failed that SHA on six findings. This repair addresses those findings; it is not an independent audit or whole-game acceptance.

| Finding | Repair | Bounded development evidence |
|---|---|---|
| F1 — END callback withheld | A 250 ms epoch-fenced END watchdog invalidates, retains the factual target and releases the live lock. | Withheld END frame reaches invalid report with 40/40 and lock available. Delayed 350 ms callback remains invalid. |
| F2 — completion delivery lost | Completion and readback each have a bounded wait. A lost callback triggers an authoritative read before any saved claim; retry uses the same path. | Real IndexedDB commit with withheld `oncomplete` becomes a verified saved report. Rejected write remains unsaved until one successful retry. |
| F3 — key capture traps navigation | Tab keeps native focus movement; Escape cancels and returns focus to its launching control. | Tab and Escape production-browser cases pass. |
| F4 — held selected key starts | Capture-phase key tracking requires release before Start. | Held F blocks; keyup permits Start and GO. |
| F5 — report focus lost | The completion heading receives focus once on valid or invalid transition. | The saved 40-press browser result has the completion heading as active element. |
| F6 — report context incomplete | Report shows response duration, logical-end-to-END boundary meaning, specification/scoring versions and modified-key history label. | Browser report and saved modified-key history checks pass. |

The expanded [production-browser driver](browser-development.mjs) and [raw results](browser-development.json) cover **13/13 passing scenarios** in headless Chromium **145.0.7632.6**. Input is scripted; blur, frame loss/delay, transaction callback loss, write rejection and lock delay are injected. The [report screenshot](browser-report.png) is a scripted-input example and its calculated press rate is not human performance evidence.

`npm run check` passed: **1,111 tests across 55 files**, lint with two inherited warnings, 14 Stop scored manifests, five Stop drill manifests, TypeScript and both production builds. Focused Keypresses tests passed separately. `git diff --check` is required again on the final staged change before commit.

Frozen Keypresses V1.0 and V1.0.1 files, Stop and Balloons mechanics, and optional analytics activation are unchanged. `report_viewed`, complete cross-tab/lifecycle and accessibility/device qualification, mock integration and whole-game acceptance remain open. A separate read-only audit of the committed repair SHA is required.
