# F4-R8/R9/R10 Lifecycle Repair — Before-State Baseline

**Base SHA:** `2edd61613288934b123de9cf71fa928d5818873f`
**Parent:** `fcf8dd2644cb16aec941d6535f79780a7b6d1d7b`
**Date:** 2026-10-07

## Confirmed failures at clean base (from AUDIT.md at /private/tmp/arrows-register-independent/AUDIT.md)

Three blockers confirmed by independent audit at exact base SHA `2edd616...`:

---

## F4-R8 — failed reset loses the live terminal's usable recovery owner

**Root cause (static):** `deleteAll` calls `disposeActiveRun()` (clears `run.current`) and
`breakExitRun.current = null` in its success path, and calls `detachRecovery()` before the
reset attempt. On failure it restores `surface.controller` via `attachReport`, but
`verifyAttachedReport` (Journey.tsx:379–382) only calls `confirmRecovery` when
`breakExitRun.current ?? run.current` is non-null. Both are null after a failed reset from a
live-terminal surface. The authority is current and the recovery controller is correctly
restored, but the publication path is unreachable.

**Decisive evidence from audit:**
- `live-reset-verified-raw.json`: authority is current, original durable root/view ID
  intact, but DOM shows "Verifying the saved report" with no published-session marker.
- Independent test `independent-live-reset.test.tsx` fails at missing published marker after
  verifying authority and unchanged root/view ID.

**Affected path:** `src/arrows/Journey.tsx:379–382` (verifyAttachedReport branch for
surface.controller when no BrowserRun exists)

---

## F4-R9 — integrity withdrawal during a live break resumes a snapshot with an arm-only handle

**Root cause (static):**
1. When the arm subscriber fires during `phase === 'break'` (browser.ts:303–308), it sets
   `this.withdrawalValue = armAuthority` (arm-only handle, snapshot() === null).
2. Journey.tsx:461–463: `attachReport(withdrawal ?? recovery!.authority, store, withdrawal ? null : recovery)`
   passes `null` controller when withdrawal is set.
3. `verifyAttachedReport` goes to the no-controller branch and calls `recordView` with the
   arm-only handle as `surface.handle`.
4. `store.appendReportView` at storage.ts:431–432: `assert(... exact(target.snapshot(), expectedSnapshot), 'activity authority scope unavailable')` rejects because arm-only snapshot() is null.

**Decisive evidence from audit:**
- `live-break-integrity-retried-raw.json`: retained P visibly published (24 trials), but
  arm witness revision 1 instead of checkpoint revision 2 — arm-only handle attached.
- "Report-view activity could not be confirmed. Retry report-view record" persists
  indefinitely.

**Affected paths:**
- `src/arrows/browser.ts:303–308` (arm subscriber uses arm-only handle at break)
- `src/arrows/Journey.tsx:461–463` (drops recovery when withdrawal is set)

---

## F4-R10 — obsolete terminal write invalidates a newly owned run

**Root cause (static):**
1. `IndexedArrowsBackend.change()` (storage.ts:230–239): `request.onsuccess` calls
   `operation(root)`. Inside `this.transactionRoot`, `this.authority.observe` synchronously
   fires subscribers.
2. The recovery subscriber for AR1 (recovery.ts:47–50) calls `active.controller.abort()`,
   which fires the signal's abort listener synchronously: `tx.abort()` ← FIRST ABORT.
3. After `observe` returns, `matches(root)` throws "snapshot authority changed" (AR1 is
   tombstoned).
4. The catch block executes: `cause = error; tx.abort()` ← SECOND ABORT, throws
   `InvalidStateError: The transaction has finished` (native IndexedDB constraint).
5. `InvalidStateError` escapes the event handler as a global error.
6. AR2's `protectedBlock` global-error listener (browser.ts:108) calls `this.technical()`,
   invalidating AR2 with reason "technical".

**Decisive evidence from audit:**
- `independent-obsolete-production.mjs`: ordinary Replay/Start AR2, individual deletion AR1,
  held positive AR1 verification. **No abort/error injection.**
- Causal sequence: AR2 onset 2000.4 ms → AR1 transaction's `InvalidStateError` at 2031.9 ms
  → AR2 `invalidated(technical)` at 2033.8 ms.
- AR2 durable journal contains technical invalidation; root contains AR2, AR1 tombstone,
  arm count 2.

**Affected paths:**
- `src/arrows/storage.ts:230–239` (second tx.abort() in catch block escapes as global error)
- `src/arrows/recovery.ts:47–50` (synchronous abort inside transaction's onsuccess)

---

## Passing scope at base

The register, Start/Continue ordering, immutable journals, old/new installation fences,
healthy technical-error protection, and frozen mechanics all pass at the base SHA per the
83-row native scenario table in the audit.
