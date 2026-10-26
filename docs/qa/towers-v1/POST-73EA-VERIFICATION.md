# Towers V1 grouped controller repair: developer verification

Date: 2026-10-10. Base product: `73ea7bcebbd87414f3b649485103bf65014e783d`. This is developer evidence, not an independent PASS or qualification. The separate whole-game audit of the base failed on C1–C4; the read-only design amendment is `/private/tmp/towers-v1-architecture/POST-73EA-REVIEW.md`.

The grouped change gives a Start attempt an immutable revocation lifetime before asynchronous ownership or storage work, uses the same owner-loss path after retry, settles a committed but undelivered onset to one durable terminal, polls published history even without a current run, and consumes protected DOM-removal records before input and on observer delivery. Frozen Towers forms, journal definitions, move rules and report arithmetic are unchanged.

## Precommit evidence

All production-browser checks below used the built bundle, native headless Chromium, IndexedDB and Web Locks at `http://127.0.0.1:43928/index.html`. Scripts and complete-root captures are in `/private/tmp/towers-v1-post73ea/`; copies of unchanged prior controller checks are in its `regression/` directory. C1–C4 were reproduced on the parent before the grouped edit.

| Design rows | Developer observation |
| --- | --- |
| A1, A4–A5 | `start-lifecycle.cjs`, `intent-lifecycle.cjs`, `intent-lifecycle-after-watchdog.cjs`, `retried-intent-owner.cjs`, `intent-delivery.cjs`: pending Start fences unseen reservation after lifecycle loss; committed intent never reveals after loss, remains review-only, and ordinary recovery with retained ownership can start. Recovered active owner loss creates one interrupted terminal. |
| A2–A3 | `held-onset-invalid.cjs`, `adjacent-four.cjs`, `held-onset-reinsert.cjs`: held committed onset plus invalid display, owner loss or same-turn protected removal withdraws immediately; durable root settles once to interruption at 2,000 ms or expiry at 120,000/120,001 ms; late callback cannot resume. |
| A6 | `held-onset-delete.cjs`, `regression/controller-intent-delete.cjs`, `healthy-race.cjs`: individual and Delete all during held onset/intent/Start leave no recreated run, activity or board after delayed delivery. |
| A7–A9 | `history-stale.cjs`, `history-late-read.cjs`, `history-fail-restore.cjs`: a history-only tab without notices withdraws deleted rows under fallback polling; a late history callback after deletion/replacement cannot republish rows. An aborted root read clears the old row; after storage is restored, a fresh read republishes the still-current row without a focus change. |
| A10–A11 | `adjacent-four.cjs`, `held-onset-reinsert.cjs`, `regression/controller-display-matrix.cjs`: live, target, panel and section removed/reinserted in one turn are latched; held onset and held nonfinal move settle without renewed play. |
| A12–A14 | `healthy-race.cjs`, `regression/controller-boundaries.cjs`, `regression/controller-held-move.cjs`, `regression/controller-failed-move-invalid.cjs`, `regression/controller-deadline.cjs`, `regression/controller-report-delete.cjs`: normal nine-move solve, report/reload/Try Again/familiar Restart, Undo/Clear All, pointer/keyboard, valid geometry, failed/held move retry, deletion and 119,999/120,000/120,001 deadline precedence retain old behavior. |

Focused Towers controller/storage/engine tests: 16 passed. TypeScript production build and lint passed; lint reported three preexisting warnings outside Towers. `git diff --check` passed. No redundant full repository suite was run for this repair. The parent whole-game audit remains FAIL until a separate read-only exact-SHA audit passes this candidate.

Founder personal acceptance, physical/browser/device/accessibility qualification, Towers Advanced Training, full mock, deployment and release remain open.
