# Stop M5 C2–C4 acceptance matrix

Prepared before product edits, from clean `4c0929cbae702672d3373f76e936a11d1b16cc42` (parent `555288d6d19916d4092fa093498aa849ed142391`). Fresh raw evidence: `/private/tmp/stop-m5-c234-repair-20261001/`. Historical audit files remain unchanged.

| Class | Boundary / action | Required outcome |
|---|---|---|
| Ordinary storage failure | First completion write rejects | Exactly one retry; immediate keyboard-accessible immutable report; no held presentation lock. |
| Ordinary storage failure | Retry rejects | Valid active-tab result, exact §21.5 warning, temporary same-tab chain; no durable history promise. |
| Ordinary delayed success | Hold before transaction or after commit | Pending disclosure until current durability is checked; no duplicate retest admission. Report stays open when delivery settles. |
| Intentional deletion | Required drill or baseline deleted before completion transaction | Typed rejection receives no retry or temporary-mode fallback. Chain retired authoritatively; undeleted immutable result retained for review only; no training/retest/comparison. |
| Intentional deletion | Individual result deleted | Result/journal removed from active review and durable history; minimal consumed exposure retained. Pending unsaved-session deletion is a separately labeled API boundary; after-commit deletion uses the actual history row. |
| Intentional deletion | Delete all, then replacement work | Old result/chain cannot become saved or eligible. Old callbacks cannot write into replacement installation. Replacement state and activity byte-identical after late release. |
| Delayed success after deletion | Commit, delete, deliver success | Recheck current result, installation and dependency deletion before promotion. Later observed deletion is irreversible by older callbacks. Visible report, history and comparison agree with retained storage. |
| Overlapping callbacks | Two completed attempts, newer delivery first | Pending completion blocks an ordinary second retest. Constructed already-overlapping callbacks are fenced by session and chain generation; old completion cannot replace newer selected relationship or remove attempt history. Both journals and exposure records retained. Newer comparison works. |
| Unrelated deletion | Delete unrelated result while pending | No retirement of this chain, no lost journal, ordinary save/comparison remains available. |

Exercise real IndexedDB and full candidate 8+80 journeys at before-transaction and after-commit delivery boundaries with delayed/unavailable BroadcastChannel. Capture visible copy, navigation, current/durable chains, storage envelope, actual Web Locks, reservations, exposure markers, full event journals, late state/activity. Inspect captured state rather than accepting driver flags.

Regress C1 keyboard report/deletion liveness; F2-C cancellation; all 45 deletion/onset cases; D1/F1/F3; affected B1–B5/N1; ordinary baseline/retest completion and byte-identical reload. Run lint, tests, both manifest checks, build, diff and frozen-spec hashes. Keep injections separate from ordinary evidence.

N2, S46, initial-frame handling, screen-reader disclosure, browser/device/accessibility qualification, M6, founder M5 acceptance, deployment and release remain open. No independent audit PASS. Changed SHA requires a new read-only audit.
