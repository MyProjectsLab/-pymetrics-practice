# Stop M5 F2-C — developer verification

**Subsequent audit:** the independent audit at `555288d6d19916d4092fa093498aa849ed142391` returned **FAIL solely on C1**, completed-run visibility and deletion liveness while confirmation delivery remains held. The original F2-C cancellation repairs passed the exercised audit cases. This record is historical; see [C1 repair verification](../repair-c1/VERIFICATION.md). Fresh exact-SHA audit and founder acceptance remain pending.

Implemented and developer-tested. The repair commit has parent `53286f778bfc3deaad43e1beeff51ef4daa0c791`; its exact SHA is supplied in the handoff. This is implementation-agent evidence, not independent audit PASS or founder M5 acceptance.

## Authority and reproduction

Started at clean `53286f778bfc3deaad43e1beeff51ef4daa0c791`, parent `881b60f04b0c4633eec3f797610bbb07ddd22c14`. Read AGENTS.md, the complete Master Strategy and Stop V1.1, tracker, all five M5 verification records, and the complete [independent audit](/private/tmp/stop-m5-audit-53286f7/AUDIT.md). No agents were delegated.

[Integrity record](governing-integrity.json): working specifications match starting HEAD, parent and founder-verified continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

- Master: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`.
- Stop: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.

All three failures reproduced before product edits using copied audit drivers against the unchanged checkout, with BroadcastChannel unavailable:

| Reproduction | Before repair |
|---|---|
| Candidate admission read delivery held, native Back | After 2.2 seconds: acquired presentation lock held; other tab's Delete all pending. Releasing read alone lets deletion finish. Zero onset. |
| Candidate confirmation held before write, native Back | Same lock/deletion failure, with one actual onset and retained consumed form. |
| Admission read held through existing onset watchdog | Severe timing invalidation and zero onset, but deletion remains blocked until read release. |

The original independent audit files remain untouched. Reproduction copies and full observations are retained in the raw archive's `before/` directory. [Pre-edit acceptance and ordering proposal](ACCEPTANCE.md) was written after reproductions and before product edits.

## Exact release and late-work ordering

The stable exclusive `assessment-practice-stop-presentation-v1` lock still orders first scored presentation against deletion commit across installation replacement. Normal admission holds it through the read, eligible browser frame, synchronous event/consumption and confirmation write. Original eligible timestamps and all timing bands remain unchanged.

The Web Locks callback's returned promise controls an acquired lock's lifetime; aborting the request signal alone only cancels an ungranted request. This repair explicitly settles the acquired callback on cancellation. [Web Locks specification](https://www.w3.org/TR/web-locks/).

1. A run-owned controller remains reachable after first confirmation removes the engine's frame cancellation job. `session_invalidated` aborts it synchronously. Leaving the run also aborts it, including after trial completion while persistence delivery is still pending; this does not rewrite the completed journal or invalidate a completed result. The existing onset watchdog also reaches cancellation through the frame job; there is no new timeout.
2. Cancellation marks the signal aborted, cancels the installed browser frame and settles its wait. Admission's cancellation listener rejects its acquired callback wait even if the read or confirmation delivery remains held.
3. Abort listeners run before the promise continuation releases the lock. An active confirmation transaction receives `IDBTransaction.abort()` in this same cancellation dispatch. IndexedDB orders subsequent deletion writes after that transaction's commit or abort. [IndexedDB transaction model](https://w3c.github.io/IndexedDB/).
4. The late read is read-only. Its continuation checks the signal immediately after `await read()` and cannot admit a frame, reconcile stale state or trigger a later run failure. The frame wrapper checks the signal before requesting/confirming and cancels its native callback.
5. The exposure write receives the same signal. It checks before opening a transaction and after the transaction's read, before any state/activity mutation. Cancellation also aborts an outstanding transaction, including a write awaiting commit. A late wrapper that has not called the write yet therefore cannot open one. A transaction already committed retains its result; late delivery performs no second write.
6. Pending work has rejection handlers. Late settlement cannot restart the run. Existing installation binding and deleted-record guards remain in force for draft retention and other writes.

This is a cancellation race **with side-effect fences**, not a race that leaves an unfenced writer running. The application’s retest library-exit and restart paths now derive the release flag from that session’s actual in-memory exposure evidence. They cannot erase a consumed marker while confirmation is still pending. Cancellation does not call release with a false exposure flag after onset. The immutable stimulus event and in-memory consumption survive; existing invalid-draft persistence records confirmed consumption and releases the claim. Individual deletion retains the marker; Delete all removes the old installation, and late old work cannot alter its replacement.

Deletion-first still prevents the first scored paint. Presentation-first still records the actual event and consumption before required deletion invalidates. Input, outcome resolution, offset and later trials never await storage. M2B-02 and the existing +500 ms onset watchdog remain unchanged. After an actual onset that watchdog has ended; confirmation-pending cases correctly use lifecycle cancellation instead of inventing a post-onset timeout.

## Case-level evidence

[CASES.md](CASES.md) lists every focused cancellation row and every prior ordering row. [Raw journal verification](journal-check.json) recomputes scored event counts and checks original journals, locks, markers, ordering and replacement bytes; it does not merely accept driver pass flags.

| Evidence | Observed outcome |
|---|---|
| [24 candidate liveness cases](liveness.json), [eligibility](eligibility.json) | Queued, read-pending and admitted-before-frame stages × Back/watchdog × drill/all/unrelated; confirmation before transaction and after commit × Back × drill/all/unrelated. Deletion finishes while delivery stays held. Late release does not change event journals, exposure, reservation or replacement records. |
| [Original candidate reproductions after repair](reproduction-after.json) | Both formerly failing Back cases have empty held/pending lock lists while their promises remain held for 2.2 seconds. Zero pre-onset events; one post-onset event. |
| Existing watchdog reproduction | `severe_timing`, zero onset, deletion completed and real Web Lock lists empty before the held admission read resumes. Full events/lock queries in archive `focused/` and `before/`. |
| [Four transaction cases](transactions-summary.json) | A real readwrite transaction is kept active by injected IDB requests. Abort rolls back pending read/write work. Individual deletion and Delete all finish before held read delivery resumes; replacement state/activity bytes remain identical. These are deliberately injected transaction stalls. |
| Thirteen production-engine/browser-canvas protocol cases | Installed-frame cancellation and existing missing-frame watchdog prevent late paint; read/lock/frame rejection fails closed; a permitted 200 ms onset delay retains its original eligible time; exposure failure alone does not invalidate. With confirmation still held, a 350 ms response, offset and second-trial timeout resolve without a storage wait. Archive `protocol/` contains every full journal and trace. |
| [45 existing ordering cases](CASES.md#existing-deletiononset-ordering) | All boundaries/deletions/message modes pass again. Required deletion first prevents onset; real presentation first retains consumption. Unrelated deletion leaves the run live. Fifteen replacement-installation cases reject five old-store operations each without changing bytes. |
| [Five admission edges](admission-edges.json), [eight original onset cases](audit-onset.json), [six draft/install boundaries](audit-boundaries.json) | Prior cancellation, observer-unavailable, unsupported-lock, installation binding and after-arming cases retain their expected behavior. |
| [F1 / D1](audit-f1.json) | Seven failure/delay/late-rejection cases preserve nondeleted journals, retirement/retry and durable reload. A saved 522-event drill remains labeled saved; two genuine buffered attempts retain their tab-only disclosures. |
| [Same-tab deletion](deletion-races.json), [edges](deletion-edges.json) | All 36 order/dependency/retry combinations and both relationship/retired-history edges pass. |
| [F3](initial-fixation-load.json), [R2](reload-evidence.json) | 24 initial-fixation and 76 protected-evidence load cases preserve their expected admission/rejection results and original bytes/exposure. |
| [B1–B5 / N1](prior-regressions.json), [supplement](supplement.json) | Known-unexposed form availability/reuse; setup/exposure checks; all five drills and legitimate notes; canonical profile grouping; actual attempt starts; failed-save disclosure, ordering, retry and durable-only reload pass. N2 remains observable and open. |

The new deterministic controls cover late read resolution/rejection after acquired-lock cancellation, cancellation reachable after frame confirmation, refusing an already-canceled confirmation before any transaction, preserving ordinary baseline failure handling, and releasing ownership when leaving after a completed journal has closed protection. [check.txt](check.txt): lint, **445 tests / 28 files**, both deterministic manifest checks (**14 standard forms / five drills**), TypeScript and production build pass. Two inherited lint warnings remain in App.tsx and the older F1–F3 driver. Test counts do not establish browser or acceptance certification.

## Ordinary browser evidence

Chromium **145.0.7632.6**, headless macOS, **1200 × 800** CSS pixels. Final retained browser drivers report no page errors.

- [Pre-onset Back](pre-onset-browser.json): real guide/input check/eight warm-up trials, native Back in scored initial fixation and reload. Zero scored events, reviewable invalid draft, absent marker/claim, four available baseline forms.
- [Baseline completion](completion-browser.json): final production bundle, real preparation, eight warm-up and 80 scored trials, 644 events, report and byte-identical reload. Individual deletion retains its minimal exposure marker. Visibility **200.3–209.1 ms**; final fixation **1,201.1 ms**.
- [Retest completion](retest-completion.json): seeds only a prior valid baseline/drill, then runs real preparation/warm-up/80 scored trials. 643 events, zero anomalies, visibility **200.1–209.6 ms**, first scored onset **7.1 ms** after its original eligible timestamp. Byte-identical reload and complete chain restored.

Both completion controls have 0 hits / 60 misses / 20 correct withholds / 0 false alarms (25% accuracy). No scored responses, timing faults or storage faults are injected into these ordinary completion journeys. They are not a physically performed baseline→drill→retest qualification study.

## Acceptance mapping

| Checks | Bounded developer result |
|---|---|
| S16/S25/S26/S50/S51 | Original fixation/onset timestamps, known-unexposed release, actual event/consumption retention and canceled admission liveness covered. |
| S35–S43/S66 | Existing timing/lifecycle/input thresholds and protected-evidence/F3 admission regress; no threshold changes. |
| S49/S53/S54 | Required-deletion chain eligibility, unrelated controls, valid drill notes/profile grouping and retest comparison reload regress. |
| S55/S56/S59 | Durable records, individual deletion, truthful per-attempt failure disclosure and retry/journal preservation covered. |
| S57/S60 | Delete all completes despite pending promise delivery; replacement installation resists late work and old-store operations. |
| S68/S72/S73 | Immutable journal reconciliation, report reload, incompatible/invalid history exclusions regress. |
| B1–B5/N1 | Original affected production-path regressions pass in the bounded cases above. |

## Reproduction and evidence provenance

The [raw archive](raw-evidence.tar.gz) retains full before/after observations, fixture input, browser drivers copied for regression, logs and ordinary journals. Its [SHA-256 index](raw-evidence-index.json) identifies each uncompressed entry. Extract to an empty directory with `tar -xzf docs/qa/m5/repair-f2-c/raw-evidence.tar.gz -C <directory>`. [Tested source/build hashes](tested-source.json) and [complete changed-file inventory](FILES.txt) accompany it.

The pre-edit audit drivers were copied to `/private/tmp/stop-m5-f2c-before/`; originals were not overwritten. Candidate/ordering fixtures are complete production-engine journals from the independent audit. Fault probes deliberately hold promise delivery, queue locks, suppress BroadcastChannel, reject writes, or keep transactions active. They use real IndexedDB/Web Locks but do not model natural hardware failure.

One preliminary queued-watchdog probe inspected lock state before its asynchronous polling had actually observed invalidation. Explicit awaited polling corrected the harness; no product expectation was relaxed. A new scope-control unit test also caught overly broad suppression of an ordinary baseline confirmation failure in the initial patch. Cancellation is now scoped to retests; that test and all final checks pass. Final review also added a failing production-run fixture for leaving after trial completion with confirmation pending. Run exit now cancels that remaining admission lifetime without changing the completed journal. An extra completed-run UI-exit probe was inconclusive and is excluded from passing evidence: after all trials end with confirmation still held, the live overlay keeps the library button hidden. Same-URL Back and Shift+Tab also did not leave the component. The retained deterministic test covers explicit run cleanup after completion; a user-visible completed-run exit during this injected stall is not browser-verified. The excluded driver and failure are archived under `excluded/`. The full 24/45 matrices, original three failures and ordinary journeys were rerun after the lifetime and exposure-release guards.

From the repository root, using installed dependencies and the Playwright/Chromium paths recorded in the scripts:

```sh
npm run check
npm run dev -- --host 127.0.0.1 --port 5357 --strictPort
npm run preview -- --host 127.0.0.1 --port 5358 --strictPort
# In another terminal, after a fresh dev-server start:
node docs/qa/m5/repair-f2-c/candidate-reproduction.mjs
node docs/qa/m5/repair-f2-c/watchdog-reproduction.mjs
node docs/qa/m5/repair-f2-c/liveness.mjs
node docs/qa/m5/repair-f2-c/transactions.mjs
node docs/qa/m5/repair-f2-c/protocol.mjs
node docs/qa/m5/repair-f2-c/regressions.mjs matrix
node docs/qa/m5/repair-f2-c/regressions.mjs fast
node docs/qa/m5/repair-f2-c/regressions.mjs ordinary
node docs/qa/m5/repair-f2-c/verify-eligibility.mjs
python3 docs/qa/m5/repair-f2-c/verify-journals.py
python3 docs/qa/m5/repair-f2-c/collect-evidence.py
```

Drivers use isolated contexts and overwrite their own outputs. The collector archives full repeated records and leaves concise results directly readable. This is local implementation verification; the new commit must receive a separate read-only audit.

## Scope and limits

Only presentation cancellation, its exposure transaction fence, exposure-aware retest exit/restart release, tests and repair evidence change. No frozen specification, form, drill, scoring/routing rule, claim, other game or mock change. No push or deployment.

These are bounded Chromium headless/macOS development checks with real Web Locks and IndexedDB. They do not certify physical display scanout, native keyboard latency, natural disk/quota failure, native OS suspension, browser/device support or accessibility. A fully stalled event loop or database service cannot be given a wall-clock liveness guarantee by this application; held promise delivery with a progressing browser is covered. Mixed old application versions and browser-level data clearing remain outside the cooperating-tab protocol.

**N2 abandoned-tab claims and S46 precision remain open.** No reclamation rule was added. Initial-frame handling, screen-reader disclosure, browser/device/accessibility qualification, M6, deployment and release remain open. Every changed SHA requires a fresh separate read-only independent audit; no founder acceptance is claimed.
