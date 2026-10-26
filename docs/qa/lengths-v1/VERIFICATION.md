# Lengths V1 standalone playable candidate — developer verification

Base: `845086fbbd3169253d464914e366c547379a7faa`. This candidate adds the standalone candidate journey, verified local persistence, reports and history to the independently audited L1 headless foundation. The frozen Lengths specification, forms and fixtures are unchanged. Full mock integration and browser/device/accessibility qualification are outside this milestone.

## Implemented

- Guide, two examples, two-question check, standard/visual-accommodation selection, input checks, readiness and measured 520 CSS-pixel admission.
- Browser-confirmed four-block timing, first-response capture, protected interruption, exclusive live-tab ownership, authoritative block checkpoint and terminal readback.
- Reconciled saved, invalid and incomplete review; local history, report-view activity, individual deletion, Delete all and same-family replay. Start and Continue retain measured display context and the declared input/device profile.
- Verified-root authority and ordered Start/Continue/deletion fences. Visible saved copy is withdrawn when current durable authority is not confirmed.

## Checks and raw captures

- Production Chromium full journey: 96 closed trials, three saved block checkpoints, one correct response and 95 omissions, valid saved report, history/reload/reopened report; no page errors. [Raw screen text](production-journey.json). This uses automated input and a controlled clock.
- Development browser full journey independently reached the same counts and retained the saved report on reload. [Capture](development-journey.json).
- Cross-tab individual deletion withdrew the original tab's report; [capture](cross-tab-deletion.json). Keyboard deletion returned focus to the history heading; [capture](deletion-focus.json).
- 550-pixel viewport left the measured task content below 520 CSS pixels and disabled Start without consuming a form; [capture](narrow-layout.json). A 320-pixel preview also disabled Start.
- Injected first checkpoint transaction failure kept Continue unavailable; a same-attempt retry confirmed the exact prefix and admitted Block 2. Lost terminal delivery/readback, activity idempotence, form counter rotation, late deleted writes and Delete all replacement have deterministic storage tests. Two real browser report openings wrote ordered `report_viewed` activity without changing timed event bytes; Delete all reset attempts, counters and activity.
- Production build, Lengths manifest regeneration, app TypeScript check, changed-file lint and `git diff --check` passed. The full repository test run initially had one stale App library-card count assertion (five cards now, not four); that assertion was updated. The final full suite passed **1,419/1,419 tests across 78 files**. Lint retained one inherited `App.tsx` hook-dependency warning.

## Evidence limits and open gates

The browser cases are bounded headless Chromium observations; faults are injected and input is automated. They do not certify physical latency, native lifecycle delivery, screen-reader speech, browser/device coverage or timed mobile support. This record is developer evidence, not an independent audit. Founder acceptance, full mock integration, qualification, deployment and release remain open. Analytics stays disabled.

The production journey used the final built application. The source-only fault injections and shorter browser controls used the development server; they are not claims about a deployed environment.
