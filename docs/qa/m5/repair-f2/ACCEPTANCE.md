# Pre-edit F2 / D1 adversarial acceptance matrix

Starting clean HEAD 881b60f04b0c4633eec3f797610bbb07ddd22c14; parent 499deb4ee02fb8ec9cd8c90e2ae95673dd0e10c6.

Every deletion row is required-drill / delete-all / unrelated, each with delivered / delayed / unavailable BroadcastChannel. Use real IndexedDB, UI confirmation, actual frame-confirmed journal evidence. Record timestamps on a common wall-clock basis and transaction completion; an asynchronous UI check is not proof of onset ordering.

| Boundary | Required result |
|---|---|
| Before arming | Required deletion blocks arm; no onset, no marker or reservation; unrelated permits retest. |
| Armed initial fixation | Deletion commits before first presentation: zero scored onsets, invalid review draft, known-unexposed marker/claim released, no eligibility. Unrelated does not interrupt. |
| Presentation callback, deletion wins | Hold deletion's ordering lock until transaction completes; frame cannot pass admission; zero onset/consumption. |
| Presentation callback, presentation wins | Hold presentation lock across durable admission and actual frame callback; a waiting deletion cannot commit in the gap. Preserve confirmed onset and consumption before deletion; invalidate after required deletion. |
| Confirmed onset first | Keep actual event and consumed form after individual deletion. Delete-all removes durable records/markers and the old tab cannot repopulate replacement storage. |
| Canceled/delayed admission | Engine cancellation/watchdog prevents any later paint; no new timing tolerance. Real confirmed late onset still retained before invalidation per M2B-02. |
| Replacement installation | Old store cannot present, save, reserve, arm or clear the new installation. Preserve new bytes. |
| D1 saved journal in failed retirement queue | Exact durable per-attempt journal remains labeled saved. Genuinely buffered sibling retains tab-only warning through failure, disappears only if deliberately deleted, and becomes durable on successful retry. |

Regress F1 retention/retry, F3 initial-fixation admission, same-tab deletion, B1 form inventory/setup-exposure/drill notes/profile grouping/save failures/N1 starts, ordinary pre-onset exit and completion/reload. Run lint, all tests, both manifest checks and TypeScript/build. Keep injected fixtures/faults separate from ordinary browser creation. Do not close N2, S46 or release gates.

Ordering proposal before production edits: one origin-scoped Web Lock serializes destructive IDB transactions and first scored admission. Presentation obtains it at the first-onset request, checks installation, dependencies and armed reservation from IDB, holds it through the actual eligible rAF paint and synchronous engine confirmation, then through the exposure write. Cancellation releases without painting. Deletion obtains the same lock before creating its transaction and releases only after commit. Thus there is no gap where deletion can commit between successful admission and presentation. No lock is held throughout initial fixation. Independent durable observation revokes an exposed run even without BroadcastChannel; it does not gate inputs, trial resolution, offset or later timing. Existing onset timestamps, thresholds and watchdog measure any admission delay; no clock or eligible time is reset. Web Locks unavailable must fail closed for this persistent operation using the existing unsupported-feature boundary; it cannot fall back to an unsafe async check.
