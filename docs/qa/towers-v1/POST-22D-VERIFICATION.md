# Towers post-22d grouped correction — developer verification (draft)

**Status:** developer-verified isolated candidate; not independently audited. Main product `22d997a138d7d87926286dfc45b9529eb7c52bb8` has independent whole-game **FAIL** E1/E2 at `/private/tmp/towers-v1-runtime-independent/AUDIT-22d997a.md`. The independent grouped design challenge is `/private/tmp/towers-v1-architecture/POST-22D-REVIEW.md`.

## Baselines before editing

- E1 held final authority read after a committed exit left Start disabled beyond the settlement timeout (`/private/tmp/towers-v1-runtime-evidence/e1-baseline.cjs`).
- E2 two post-allocation held first reads exhausted the old whole-promise open cap despite healthy fresh IndexedDB (`/private/tmp/towers-v1-runtime-evidence/e2-baseline.cjs`).

## Grouped change

- One bounded abortable settlement pass covers initial reconciliation, action/terminal writes, final ordered read and notification. A transient failure is explicit and retryable; committed writes reconcile by immutable request identity. Old callbacks and session completion carry attempt identity.
- Connection acquisition owns the native-open slot only until its request callback, aborts and closes an allocated handle across initialization/reads/migration, and fences late delivery. IndexedDB transaction errors/abort remove listeners and settle the logical operation.
- The candidate uses the existing frozen forms, report and versioned root schema. Main's unrelated governance/reference working files were not edited.

## Checks completed so far

| Design row | Evidence | Developer result |
| --- | --- | --- |
| C1 | `e1-repaired.cjs`, `e1-two-failures.cjs`, `e1-replacement.cjs` | Held final read recovers automatically; after two held deliveries manual retry is visible and works; late callback leaves a new run active; one exited event/snapshot, no page errors. |
| C2 | Focused `runtime.test.ts` injected failures at first/second/final read, before/after action or terminal commit, ordered lock acquisition and unseen cancellation; `held-terminal-delivery.cjs` | Bounded retry reconciles one action/terminal or retires one unseen request. |
| C3 | `e1-replacement.cjs`, focused held-initial-read/new-run and old-run `markSettled` tests | Old callbacks and completion cannot retire or change a new run. |
| C4 | Focused throwing-subscriber and manual retry/nudge convergence tests; two-held-read manual retry browser case | Notification isolated; retry/timer/nudge coalesce; exhausted retry remains actionable. |
| C5 | `e2-repaired.cjs` | Two held allocated reads close old handles; third open works before old deliveries; late callbacks harmless. |
| C6 | `e2-init-repaired.cjs`, `e2-second-read-repaired.cjs`, `allocated-before-deadline.cjs` | Two held initialization or second-read completions close handles and permit a third open; each phase delivered before deadline adopts one healthy handle. |
| C7 | `two-open-cap.cjs`, `raw-open-late-error.cjs` | Two truly unresolved opens cap; late success/error frees only its slot; fresh open succeeds. |
| C8 | `history-reopen-watchdog.cjs`, `ready-replacement-recovery.cjs`, `initial-open-watchdog.cjs`, `two-replacements.cjs` | Replacement-history and initial-open recovery controls pass; two replacements before old read delivery retain the latest empty installation. |
| C9 | `terminal-delete-orders.cjs`, `deletion-current.cjs` | Individual and Delete all, both terminal-confirmation/deletion orders, with absent notices: old data absent and no page errors. |
| C10 | `migration-current.cjs`, `migration-held-commit.cjs`, `migration-before-commit.cjs`, `invalid-root-unavailable.cjs` | Historical events/snapshots preserved; held precommit callback does not migrate; retry maps once; held post-commit callback cannot undo mapping; corrupt/unsupported root not reset. |
| C11 | `deadline-current.cjs`, focused final-move and deadline read-failure tests | 119999 ms final solve; 120000/120001 ms timeout, with final-read failure reconciling one saved terminal. |
| C12 | `healthy-race.cjs`, `view-navigation.cjs`, `valid-controls-current.cjs`, `immediate-removal-current.cjs`, `held-move-read-failure.cjs`, `dev-start-lifecycle-current.cjs`, `dev-intent-lifecycle-after-watchdog-current.cjs`, `migration-current.cjs` | Healthy journey, report/reload, presentation guard, owner/lifecycle, history and prior C/D controls observed. Physical/device/accessibility qualification remains separate. |

Focused runtime/storage tests: **27 passing** after this grouped change; production build and lint pass. The prior full repository suite was not rerun for this focused correction. `display-matrix-current.cjs` has an obsolete retry-button assertion while its captured root shows a saved terminal; `report-versus-start.cjs` targets inactive port 43930. Neither script is counted as a product PASS. Physical device and assistive technology qualification remain open.

The C1–C12 matrix is developer evidence with injected faults. It is not a guarantee against every browser callback or physical device condition. Complete-root bytes were reconciled in E1, terminal/deletion, migration and healthy play cases; connection-only cases use native handle counts and route controls. Frozen form/spec/history files are unchanged.

**Handoff:** inspect final diff/call graph and check the exact candidate tree, then commit one clean SHA and obtain a separate exact-SHA whole-game audit. This record does not claim Towers independently passed, founder acceptance or qualification.
