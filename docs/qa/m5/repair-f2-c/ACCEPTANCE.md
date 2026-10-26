# F2-C adversarial acceptance — written before product edits

Starting clean HEAD: 53286f778bfc3deaad43e1beeff51ef4daa0c791; parent 881b60f04b0c4633eec3f797610bbb07ddd22c14.

Pre-edit reproduction: candidate read delivery held + native Back, candidate confirmation held before write + native Back, and admission read held past the existing +500 ms onset watchdog all retain the acquired Web Lock and block deletion until the held promise is released. Candidate cases wait 2.2 seconds after cancellation. BroadcastChannel is unavailable. Original and reproduction evidence are preserved separately.

## Ordering argument to implement

Keep the stable cross-installation exclusive lock and original eligible frame timestamp. Cancellation must settle the *acquired callback*, not only abort a queued request. The admission read is read-only; after its await, check the aborted signal before accepting state or calling presentation. The frame wrapper checks cancellation before requesting/confirming and cancels the installed browser frame. A run-owned abort controller remains reachable after first confirmation (when the engine removes its frame cancellation job). Session invalidation aborts it synchronously.

The same signal travels into the exposure-confirmation write. Check it before opening the transaction and again inside the transaction before mutation; register synchronous transaction abort for cancellation while requests are outstanding. A transaction already committed stays committed. A canceled transaction cannot later commit when delayed promise delivery resumes. Installation identity, deleted-record guards, and existing draft retention remain in force. The acquired callback may stop waiting only with these fences installed. Its late promise rejection must be observed and cannot cause later engine changes.

Before onset: cancel frame, preserve invalid journal, release known-unexposed reservation/marker. After onset: preserve the immutable stimulus event and in-memory consumption; existing invalid-draft persistence retains confirmed consumption. Canceling the pending confirmation never marks the form unseen. Delete-all removes the old installation; every old continuation must leave replacement bytes unchanged. No new timeout, eligible-time reset, storage wait in input/resolution, or reclamation rule.

## Matrix

| Boundary | Cancellation | Deletions | Required evidence while held and after release |
|---|---|---|---|
| Lock queued behind controlled owner | Back / existing watchdog | required drill / all / unrelated | canceled request leaves queue; owner release permits deletion; no late frame |
| Acquired admission read pending | Back / existing watchdog | required drill / all / unrelated | lock released, deletion committed while read held; zero onset; late read cannot request frame |
| Admission complete, frame pending | Back / existing watchdog | required drill / all / unrelated | installed frame canceled; lock released; zero onset; late callback harmless |
| Real onset, confirmation pending before transaction | Back | required drill / all / unrelated | immutable onset and consumed form retained; deletion completes before promise release; late write rejected |
| Real onset, confirmation delivery pending after commit | Back | required drill / all / unrelated | same liveness; committed consumption remains; late delivery has no write effect |
| Confirmation transaction outstanding | abort | individual / all | transaction abort prevents queued exposure/activity mutation; later delivery cannot recreate records |
| Ordinary unrelated deletion without cancellation | none | unrelated | run remains live, event/consumption preserved |

The onset watchdog is canceled by actual confirmation; it cannot truthfully be claimed to fire after real onset. Post-onset confirmation stalls use lifecycle cancellation. Critical cases disable BroadcastChannel. Capture actual navigator.locks.query(), IndexedDB, full immutable journal, marker, reservation, chain admission and replacement installation before/after late release. Separate seeded fixtures and injected stalls from ordinary candidate completion.

Regress all 45 original onset/deletion combinations, D1 saved/buffered disclosure, F1 journal retention/retry, F3 load admission, B1–B5/N1, normal baseline/retest completion/reload, and repository checks. N2, S46, initial-frame handling, disclosure/certification/M6/release gates remain open.
