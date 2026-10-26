# Stop M5 C2–C4 case outcomes

Developer verification on the source hashes in `TESTED-SOURCE.json`. Full captures and verifiers are in [raw-evidence.tar.gz](raw-evidence.tar.gz); [raw-evidence-index.json](raw-evidence-index.json) hashes every archived file. PASS below means the named developer check passed. It is not independent audit PASS or founder acceptance.

## Focused full candidate journeys

Every row includes real preparation, eight warm-up and 80 scored trials, actual IndexedDB, keyboard-accessible pending report, current/durable state, locks, reservations, exposure, complete immutable journal, late delivery and history/reload checks. Delayed/unavailable refer to BroadcastChannel. Before/after refer to the completion transaction boundary. All rows hold confirmation delivery separately.

| Case | Outcome | Save calls | History action for original retest | Comparison action | Checked result |
|---|---|---:|---:|---:|---|
| `delayed-after-all-none-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `delayed-after-baseline-report-ordinary` | PASS | 1 | 1 | 0 | saved immutable review; chain retired |
| `delayed-after-drill-report-ordinary` | PASS | 1 | 1 | 0 | saved immutable review; chain retired |
| `delayed-after-result-report-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `delayed-before-all-none-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `delayed-before-baseline-report-ordinary` | PASS | 1 | 0 | 0 | tab-only immutable review; chain retired |
| `delayed-before-drill-report-ordinary` | PASS | 1 | 0 | 0 | tab-only immutable review; chain retired |
| `delayed-before-result-report-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `delayed-before-unrelated-report-ordinary` | PASS | 1 | 1 | 1 | saved; comparison navigates; reload identical |
| `same-tab-unavailable-after-all-exit-ordinary` | PASS | 2 | 0 | 0 | deleted; no review or comparison |
| `same-tab-unavailable-before-all-exit-ordinary` | PASS | 2 | 0 | 0 | deleted; no review or comparison |
| `unavailable-after-all-none-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `unavailable-after-baseline-report-ordinary` | PASS | 1 | 1 | 0 | saved immutable review; chain retired |
| `unavailable-after-drill-report-ordinary` | PASS | 1 | 1 | 0 | saved immutable review; chain retired |
| `unavailable-after-none-report-retry` | PASS | 2 | 1 | 1 | saved; comparison navigates; reload identical |
| `unavailable-after-result-report-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `unavailable-after-unrelated-report-ordinary` | PASS | 1 | 1 | 1 | saved; comparison navigates; reload identical |
| `unavailable-before-all-none-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |
| `unavailable-before-baseline-report-ordinary` | PASS | 1 | 0 | 0 | tab-only immutable review; chain retired |
| `unavailable-before-drill-report-ordinary` | PASS | 1 | 0 | 0 | tab-only immutable review; chain retired |
| `unavailable-before-none-report-fail` | PASS | 2 | 0 | 1 | single retry exhausted; exact warning; same-tab comparison |
| `unavailable-before-result-report-ordinary` | PASS | 1 | 0 | 0 | deleted; no review or comparison |

The two same-tab rows each include a second full candidate journey: a fresh baseline and new training chain in the replacement installation. Their two save calls belong to different results; they are not a retry. The original retest remains deleted. Replacement result, chain, storage and activity are unchanged by its old callback.

Before-transaction individual-result deletion uses the storage API because the pending result has no history row. After-commit result deletion uses the candidate history UI. Required drill, baseline and Delete all use candidate UI.

## Pending admission and overlapping callbacks

PASS. The pending completion blocks ordinary second-retest UI. A separately labeled construction models an already-overlapping attempt. Two real 8+80 journals remain intact; current and durable selected retest stays `58c1d571-1bc9-4fd1-8b2f-e5a6849f6f14` after the older callback. The newer report opens the actual comparison. Both attempt IDs, relationship links and confirmed exposure markers remain present.

| Journal | Events | SHA-256 of normalized full event array |
|---|---:|---|
| `1f05cf1b-c52e-49c2-81ab-643e14d919e9` | 643 | `d1525c9196bf1e0b181445788385f0b31e5ece088aa9b73efb374d48b3461b1a` |
| `58c1d571-1bc9-4fd1-8b2f-e5a6849f6f14` | 643 | `12ed464300a8b3956d031627e2603df1670c38a7a6b9c26e653a1ffbe45482f5` |

## Deletion/onset ordering — all 45 cases

Raw files: `regressions/raw/stop-m5-audit-555288d/raw/ordering-*.json`. The nested name reflects driver provenance; these are fresh captures. Each expected onset count is recomputed from the retained journal, with form/claim/exposure and replacement-write checks.

| Case | Outcome | Actual scored onsets | Eligible chain afterward |
|---|---|---:|---|
| delivered/before-arm/drill | PASS | 0 | False |
| delivered/before-arm/all | PASS | 0 | False |
| delivered/before-arm/unrelated | PASS | 1 | True |
| delivered/fixation/drill | PASS | 0 | False |
| delivered/fixation/all | PASS | 0 | False |
| delivered/fixation/unrelated | PASS | 1 | True |
| delivered/delete-first/drill | PASS | 0 | False |
| delivered/delete-first/all | PASS | 0 | False |
| delivered/delete-first/unrelated | PASS | 1 | True |
| delivered/present-first/drill | PASS | 1 | False |
| delivered/present-first/all | PASS | 1 | False |
| delivered/present-first/unrelated | PASS | 1 | True |
| delivered/after/drill | PASS | 1 | False |
| delivered/after/all | PASS | 1 | False |
| delivered/after/unrelated | PASS | 1 | True |
| delayed/before-arm/drill | PASS | 0 | False |
| delayed/before-arm/all | PASS | 0 | False |
| delayed/before-arm/unrelated | PASS | 1 | True |
| delayed/fixation/drill | PASS | 0 | False |
| delayed/fixation/all | PASS | 0 | False |
| delayed/fixation/unrelated | PASS | 1 | True |
| delayed/delete-first/drill | PASS | 0 | False |
| delayed/delete-first/all | PASS | 0 | False |
| delayed/delete-first/unrelated | PASS | 1 | True |
| delayed/present-first/drill | PASS | 1 | False |
| delayed/present-first/all | PASS | 1 | False |
| delayed/present-first/unrelated | PASS | 1 | True |
| delayed/after/drill | PASS | 1 | False |
| delayed/after/all | PASS | 1 | False |
| delayed/after/unrelated | PASS | 1 | True |
| unavailable/before-arm/drill | PASS | 0 | False |
| unavailable/before-arm/all | PASS | 0 | False |
| unavailable/before-arm/unrelated | PASS | 1 | True |
| unavailable/fixation/drill | PASS | 0 | False |
| unavailable/fixation/all | PASS | 0 | False |
| unavailable/fixation/unrelated | PASS | 1 | True |
| unavailable/delete-first/drill | PASS | 0 | False |
| unavailable/delete-first/all | PASS | 0 | False |
| unavailable/delete-first/unrelated | PASS | 1 | True |
| unavailable/present-first/drill | PASS | 1 | False |
| unavailable/present-first/all | PASS | 1 | False |
| unavailable/present-first/unrelated | PASS | 1 | True |
| unavailable/after/drill | PASS | 1 | False |
| unavailable/after/all | PASS | 1 | False |
| unavailable/after/unrelated | PASS | 1 | True |

## F2-C cancellation — all 24 cases

Raw files: `regressions/raw/stop-m5-audit-555288d/raw/cancellation-*.json`. Every row has empty held/pending locks, the expected immutable retained onset journal, and identical replacement state/activity after late release.

| Case | Outcome | Actual scored onsets | Late journal bytes |
|---|---|---:|---|
| queued-back-drill | PASS | 0 | Identical |
| queued-back-all | PASS | 0 | Identical |
| queued-back-unrelated | PASS | 0 | Identical |
| queued-watchdog-drill | PASS | 0 | Identical |
| queued-watchdog-all | PASS | 0 | Identical |
| queued-watchdog-unrelated | PASS | 0 | Identical |
| read-back-drill | PASS | 0 | Identical |
| read-back-all | PASS | 0 | Identical |
| read-back-unrelated | PASS | 0 | Identical |
| read-watchdog-drill | PASS | 0 | Identical |
| read-watchdog-all | PASS | 0 | Identical |
| read-watchdog-unrelated | PASS | 0 | Identical |
| frame-back-drill | PASS | 0 | Identical |
| frame-back-all | PASS | 0 | Identical |
| frame-back-unrelated | PASS | 0 | Identical |
| frame-watchdog-drill | PASS | 0 | Identical |
| frame-watchdog-all | PASS | 0 | Identical |
| frame-watchdog-unrelated | PASS | 0 | Identical |
| confirm-before-back-drill | PASS | 1 | Identical |
| confirm-before-back-all | PASS | 1 | Identical |
| confirm-before-back-unrelated | PASS | 1 | Identical |
| confirm-after-back-drill | PASS | 1 | Identical |
| confirm-after-back-all | PASS | 1 | Identical |
| confirm-after-back-unrelated | PASS | 1 | Identical |

The original read-pending, confirmation-pending and watchdog reproductions also pass with empty locks and completed deletion.

## D1/F1 journal and disclosure checks

| Case | Outcome | Captured check |
|---|---|---|
| baseline/failed/True | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| drill/pending/True | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| baseline/late-reject/True | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| drill/failed/False | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| baseline/pending/False | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| unrelated/failed/True | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| buffered/failed/True | PASS | Nondeleted full drill journals preserved; deletion scope and active/retired relationship checked |
| Saved sibling in failed retirement snapshot | PASS | Visible disclosure agrees with result saved in the other tab; no tab-only claim |

The unrelated F1 control includes an additional full before/current/durable capture in `regressions/f1-unrelated-full/`.

## Other captured-state checks

| Suite | Case | Outcome | Checked evidence |
|---|---|---|
| cancellation load eligibility | queued-back-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | queued-back-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | queued-back-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | queued-watchdog-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | queued-watchdog-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | queued-watchdog-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-back-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-back-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-back-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-watchdog-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-watchdog-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | read-watchdog-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-back-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-back-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-back-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-watchdog-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-watchdog-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | frame-watchdog-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-before-back-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-before-back-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-before-back-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-after-back-drill | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-after-back-all | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| cancellation load eligibility | confirm-after-back-unrelated | PASS | Current loader agrees with deletion scope and retained invalid attempt |
| presentation protocol | delete-first | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | present-first | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | queued-cancel | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | frame-cancel | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | frame-missing | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | frame-delay-200 | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | read-reject | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | lock-reject | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | frame-throw | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | confirm-reject | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | read-pending-cancel | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | confirm-pending-cancel | PASS | Actual onsets, terminal lock state and deletion completion checked |
| presentation protocol | later-storage-pending | PASS | Actual onsets, terminal lock state and deletion completion checked |
| native transaction cancellation | read-delivery/drill | PASS | Aborted transaction; late delivery leaves replacement state/activity identical |
| native transaction cancellation | read-delivery/all | PASS | Aborted transaction; late delivery leaves replacement state/activity identical |
| native transaction cancellation | write-uncommitted/drill | PASS | Aborted transaction; late delivery leaves replacement state/activity identical |
| native transaction cancellation | write-uncommitted/all | PASS | Aborted transaction; late delivery leaves replacement state/activity identical |
| completion atomicity | abort-after-put | PASS | Result, selected relationship, confirmed exposure and activity reconcile atomically |
| completion atomicity | success-twice | PASS | Result, selected relationship, confirmed exposure and activity reconcile atomically |
| completion write fence | ordinary | PASS | Captured transaction outcome and retained bytes checked |
| completion write fence | drill | PASS | Captured transaction outcome and retained bytes checked |
| completion write fence | baseline | PASS | Captured transaction outcome and retained bytes checked |
| completion write fence | result | PASS | Captured transaction outcome and retained bytes checked |
| completion write fence | all | PASS | Captured transaction outcome and retained bytes checked |
| R1 deletion retry | failed/drill/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/drill/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/completed-retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/completed-retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/baseline/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/baseline/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/all/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/all/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/unrelated/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | failed/unrelated/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/drill/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/drill/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/completed-retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/completed-retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/baseline/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/baseline/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/all/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/all/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/unrelated/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending/unrelated/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/drill/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/drill/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/completed-retest/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/completed-retest/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/baseline/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/baseline/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/all/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/all/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/unrelated/retry-before-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R1 deletion retry | pending-reject/unrelated/retry-after-delete | PASS | Deletion scope, reload hash, preserved unrelated result and late write outcome checked |
| R2 load integrity | baseline/intact | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/timing-note | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/hidden | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/pagehide | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/freeze | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/resume | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/pageshow | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/response_key | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/visual_profile | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/timing_profile | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/input_device_class | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/accessibility | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/width-767 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/height-599 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/viewport-boundary | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/blur-999 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/blur-1000 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/blur-1001 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/unmatched-blur-1000 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/unmatched-blur-1001 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/lying-blur-duration | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/repeated-brief-blur | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/severe-tail | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/false-nonsevere-tail | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/two-nonsevere | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/second-warmup-anomaly | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/fixation-2 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/fixation-3 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/wrong_key-4 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/wrong_key-5 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/extra-9 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/extra-10 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/repeat-20 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/pre-start-setting | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/hidden-during-warmup | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/negative-time | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | baseline/missing-stimulus | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/intact | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/timing-note | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/hidden | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/pagehide | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/freeze | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/resume | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/pageshow | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/response_key | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/visual_profile | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/timing_profile | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/input_device_class | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/accessibility | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/width-767 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/height-599 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/viewport-boundary | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/blur-999 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/blur-1000 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/blur-1001 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/unmatched-blur-1000 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/unmatched-blur-1001 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/lying-blur-duration | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/repeated-brief-blur | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/severe-tail | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/false-nonsevere-tail | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/two-nonsevere | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/second-warmup-anomaly | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/fixation-2 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/fixation-3 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/wrong_key-4 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/wrong_key-5 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/extra-9 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/extra-10 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/repeat-20 | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/pre-start-setting | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/hidden-during-warmup | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/held-outcome | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/repeat-outcome | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/negative-time | PASS | Independent eligibility expectation and preserved raw hash checked |
| R2 load integrity | retest/missing-stimulus | PASS | Independent eligibility expectation and preserved raw hash checked |
| F3 load integrity | baseline/control | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/hidden-warmup | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/freeze-tail | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/settings-initial | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/viewport-initial | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/blur-1000 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/blur-1001 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/initial-fixation-2 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/initial-fixation-3 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/initial-wrong-4 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/initial-wrong-5 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | baseline/warmup-second-severe | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/control | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/hidden-warmup | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/freeze-tail | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/settings-initial | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/viewport-initial | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/blur-1000 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/blur-1001 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/initial-fixation-2 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/initial-fixation-3 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/initial-wrong-4 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/initial-wrong-5 | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| F3 load integrity | retest/warmup-second-severe | PASS | Initial protected evidence and exact threshold/control eligibility checked |
| B1 | baseline/0 | PASS | Draft, consumption count and later exposure checked |
| B1 | baseline/1 | PASS | Draft, consumption count and later exposure checked |
| B1 | replay/0 | PASS | Draft, consumption count and later exposure checked |
| B1 | replay/1 | PASS | Draft, consumption count and later exposure checked |
| B1 | retest/0 | PASS | Draft, consumption count and later exposure checked |
| B1 | retest/1 | PASS | Draft, consumption count and later exposure checked |
| B2 | control | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | binding | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | visual | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | keyboard | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | exposureForm | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | exposureProfile | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | exposureSession | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | protection | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | deviceTiming | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | missingPresentation | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | summary | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B2 | scorer | PASS | Rejected altered result metadata/evidence without rewriting stored bytes |
| B3 | control | PASS | Drill validity and source preservation checked |
| B3 | timingNote | PASS | Drill validity and source preservation checked |
| B3 | extraNote | PASS | Drill validity and source preservation checked |
| B3 | completionInvalid | PASS | Drill validity and source preservation checked |
| B3 | severeTail | PASS | Drill validity and source preservation checked |
| B3 | missingFinalFixation | PASS | Drill validity and source preservation checked |
| B3 | shortFinalFixation | PASS | Drill validity and source preservation checked |
| B3 | missingOffset | PASS | Drill validity and source preservation checked |
| B3 | hidden | PASS | Drill validity and source preservation checked |
| B3 | falseNote | PASS | Drill validity and source preservation checked |
| B4 | profiles | PASS | Two distinct compatible-profile chart groups |
| B5 | retry/deletion | PASS | Single automatic retry, retained failure, explicit retry and no resurrection |
| N1 | drill starts | PASS | Two distinct actual-start IDs; no intro or reload fabrication |
| claims | cross-tab | PASS | Distinct claims; uncertain marker preserved; N2 still open |
| ordinary production | baseline | PASS | 644 events; 8+80 trials; full deadlines, outcome links, counts, rates and final interval reconciled |
| ordinary production | retest | PASS | 643 events; 8+80 trials; full deadlines, outcome links, counts, rates and final interval reconciled |

Additional required driver coverage passed: six draft/installation boundaries, two deletion edges, five admission/cancellation/unsupported-feature edges, eight original onset cases, saved/failed queue ordering and pre-onset Back/reload. Their captured observations and command statuses are archived under `regressions/` and the group status files.

## Commands

| Check | Result |
|---|---|
| `npm run lint` | PASS; two inherited warnings: App effect dependency and historical F1–F3 driver unused parameter |
| `npm test` | PASS; 462 tests / 29 files |
| `npm run forms:check` | PASS; 14 standard manifests |
| `npm run drills:check` | PASS; five drill manifests |
| `npm run build` | PASS; TypeScript and Vite production build |
| `git diff --check` | PASS |
| Frozen-document hashes | Both unchanged and byte-identical to approved source |

## Preserved failures and exclusions

- All three pre-edit C2/C3/C4 reproductions remain in `before/`, with separate raw-state/journal verification. They are expected failures of the parent SHA.
- `preliminary/`, `preliminary-2/` and `preliminary-3/` retain earlier or interrupted repair runs. They are excluded from the final-source outcome tables. An earlier Vite HMR run mixed module identities; final browser runs use a freshly restarted server and unchanged production source.
- The expanded replacement test initially used a synthetic activity with a null session ID; sorting that fixture failed. `harness-failures/replacement-null-activity/` preserves both captures. Reruns use a concrete synthetic session ID and complete fresh baseline/training journeys.
- `replacement-records-before-fix.txt` preserves the two failing tests that exposed old-installation callbacks clearing replacement in-memory records. Both rejection and success-delivery tests now pass.
- Source/build hashes were checked again before handoff. Some independent browser groups ran concurrently; completed captures on the unchanged final source were reused when the orchestration queue reached those same groups.

N2, S46, initial-frame handling, screen-reader disclosure, browser/device/accessibility qualification, M6, independent audit, founder M5 acceptance, deployment and release remain open.
