# Keypresses V1 local-storage foundation

**Scope:** versioned IndexedDB installation, transactional armed identity, complete immutable state, authoritative completion confirmation, review-only incomplete records, individual deletion, Delete all, installation replacement, and integrity-gated history. The browser journey is not connected yet; this is a headless storage milestone.

The store writes the armed identity before any scored presentation. The 15-second input loop will keep its complete event journal in memory and call `saveCompleted` after the observation window. A failed or missing completion callback is **uncertain**: the caller must query `confirmCompleted` before claiming the result was saved. Completion after individual deletion or installation replacement is rejected. Delete all remains available even if an existing record fails integrity checks. Incomplete armed records remain review-only on reload; they never resume a timed run or become a completed report.

Focused storage fixtures cover successful arm/completion/history, lost callback after a committed write, deletion and replacement fences, corrupt-record rejection, and Delete all on corrupt data. Production IndexedDB, browser ownership, UI save/retry copy, report-view events, physical input and cross-tab delivery races are **not** yet verified. The frozen Keypresses V1.0 and V1.0.1 documents are unchanged.

Developer checks: `npm run check` passed with **1,111 tests across 55 files**, 14 Stop forms, five Stop drill manifests, TypeScript and production builds. Lint passed with two inherited warnings. `npm run balloons:check` passed for frozen scored and drill inventories. `git diff --check` passed. These checks do not verify production IndexedDB behavior or candidate UI.

This milestone needs a separate exact-SHA audit. It is not Keypresses completion, browser/device qualification, deployment or release.

## Independent audit of foundation and follow-up

The independent audit **FAILED at `6a9625bc80d8abf12173261339fa4e9680166af6`** on a deletion-access defect reproduced with real IndexedDB: a corrupt saved record made normal `open()` reject after reload, leaving no store handle from which to call Delete all. An already-open handle could delete all. Transaction aborts, uncertain completion delivery, duplicate completion, tombstones and stale-installation writes passed the audit's bounded checks. A delivered read can still be stale after a later deletion; UI authority checks remain pending.

The follow-up adds `openForDeletion()`, which opens only an installation-bound **Delete all** handle without treating the corrupt record as valid. Normal `open()` continues to reject corrupt history. The interface must surface this recovery control when normal opening fails. Its exact-SHA independent audit included the real IndexedDB reload case.

The [focused independent recovery audit](/private/tmp/keypresses-recovery-audit-c812bf5-_95no0na/AUDIT.md) **PASSED at `c812bf5be802a4ec9554a6d7f8e7690c80330705`**. It reproduced the parent failure and checked the repaired reload, Delete all, installation replacement, stale-write fence, corrupt-report rejection and tested connection cleanup with real IndexedDB. Its stated limit remains: a deletion-only handle that is opened but never used has no explicit cancel/close method. The candidate interface should obtain that handle only when the user confirms deletion. This PASS covers the storage recovery repair, not the browser journey or full game.
