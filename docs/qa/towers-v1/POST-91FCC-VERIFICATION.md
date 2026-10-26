# Towers V1 post-91fcc runtime candidate: developer verification

Scope: one document-lifetime attempt settlement controller, independent view authority, and bounded local storage delivery. Parent `91fcc3b7f939a8729f9f1baf51cbeeb2ea232bfe` remains independently failed on D1–D3. This record is developer evidence for the candidate; it is not an independent audit, founder acceptance, device/accessibility qualification, Advanced Training, mock, deployment, or release.

Design gate: `/private/tmp/towers-v1-architecture/POST-91FCC-REVIEW.md`. Browser scripts and captured complete IndexedDB roots are under `/private/tmp/towers-v1-runtime-evidence/`. Runs used the production build in local Chromium with a fresh browser context per case. Script exit zero and the saved JSON/log were inspected; scripts that only log were checked against both DOM and root rather than counted as assertion-only proof. The legacy `display-matrix-current.cjs` assertion about a manual retry button is outdated: the current controller saves the terminal automatically. Its captured root is usable evidence only after correcting that assertion.

| Gate | Developer evidence | Result |
| --- | --- | --- |
| B1 | `held-onset-navigation.cjs`, `controller-onset-delivery-current.cjs`, `controller-onset-abort-current.cjs` | Exit persists through held and late onset delivery; aborted onset remains review-only. |
| B2 | `held-move-read-failure.cjs`, `controller-held-move-current.cjs` | Revoked board withdraws; captured move and one interruption persist, including held delivery. |
| B3 | `dev-start-lifecycle-current.cjs`, `controller-intent-delivery-current.cjs`, `controller-intent-delete-current.cjs`, `retried-intent-owner-current.cjs` | Canceled unseen Start is fenced; consumed intent never becomes unfamiliar again; owner can be reacquired. |
| B4 | `boundaries-current.cjs`, `deadline-current.cjs`, `runtime.test.ts` | Timely final move retains solved result; nonfinal interruption/expiry uses captured time. Failed final save retries without duplicating solved. |
| B5 | `deletion-current.cjs`, `controller-confirmation-delete-current.cjs`, `controller-report-delete-current.cjs` | Individual and Delete all, before/after held writes, withdraw pixels and leave no resurrected run. No-notice replacement included. |
| B6 | `view-navigation.cjs` | Held History/report success and failure cannot replace a newer chosen route or focus. |
| B7 | `report-versus-start-positive.cjs`, `history-stale-current.cjs` | Older report completion/error cannot steal a new Start. |
| B8 | `held-view-delete-order.cjs`, `controller-report-delete-current.cjs`, `controller-confirmation-delete-current.cjs` | Held History/report read across individual/Delete all is not published after deletion; prior published report is withdrawn. Complete root has zero runs. |
| B9 | `history-reopen-watchdog.cjs` | No-notice replacement with a held readonly callback recovers through another connection; late callback does not republish old history. |
| B10 | `initial-open-watchdog.cjs`, `ready-replacement-recovery.cjs`, `history-reopen-watchdog.cjs` | Timed initial open and replacement recovery keep chosen route; stale handle is closed. |
| B11 | `two-open-cap.cjs`, `invalid-root-unavailable.cjs` | Two held opens reach bounded unavailable state; release of one permits explicit retry, late second callback is harmless; unsupported root is preserved. |
| B12 | `held-terminal-delivery.cjs`, `actual-reload-review.cjs` | Held committed terminal releases data lock and permits Start by the first 3.2-second check; late release creates no second terminal. Reloaded intent remains review-only. |
| B13 | `controller-n1-current.cjs`, `immediate-removal-current.cjs`, `valid-controls-current.cjs`, `adjacent-current.cjs` | Earlier display/owner guard positives remain; normal disk, Undo/Clear and controls work. Physical-device and screen-reader qualification remain open. |
| B14 | `healthy-race.cjs`, `migration-current.cjs`, `storage.test.ts` legacy terminal snapshot test | Nine-move solution/report/reload, next unseen form, familiar Restart and reserved/active/complete migration work. Unit test compares old terminal snapshot/report bytes before and after migration. |

Additional adversarial baseline: `held-terminal-delivery.cjs` originally left the data Web Lock held and Start disabled after eight seconds. The replacement bounds the lock and sends the abort signal into the underlying IndexedDB transaction. If a transaction committed but its `oncomplete` delivery was held, readback settles the same immutable terminal request. A late callback rejects after abort and cannot publish data outside the lock. The `held-view-delete-order.cjs` matrix covers the same late delivery risk for history and report publication.

Focused verification: TypeScript, production build, lint (three pre-existing warnings), and 18 Towers runtime/storage/view tests pass. A full repository suite was already run on the prior candidate; it was not rerun without a concrete new risk. Frozen forms/specification and historical V1 result shape are unchanged.
