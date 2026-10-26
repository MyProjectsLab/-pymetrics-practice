# F2-C case-by-case results

Injected stalls use real candidate preparation, warm-up, Web Locks and IndexedDB. BroadcastChannel is unavailable. Full records are in [raw-evidence.tar.gz](raw-evidence.tar.gz), identified by [the SHA-256 index](raw-evidence-index.json).

## Cancellation liveness

Every row completes deletion while promise delivery remains held (queued cases release only the external control lock after cancellation). Late delivery leaves events and durable state unchanged.

| Stage / cancellation / deletion | Scored events | Invalid rule | Marker after deletion | Claim | Chain | Late bytes |
|---|---:|---|---|---|---|---|
| queued-back-drill | 0 | lifecycle | absent | absent | 0 | unchanged |
| queued-back-all | 0 | lifecycle | absent | absent | 0 | unchanged |
| queued-back-unrelated | 0 | lifecycle | absent | absent | 1 | unchanged |
| queued-watchdog-drill | 0 | severe_timing | absent | absent | 0 | unchanged |
| queued-watchdog-all | 0 | severe_timing | absent | absent | 0 | unchanged |
| queued-watchdog-unrelated | 0 | severe_timing | absent | absent | 1 | unchanged |
| read-back-drill | 0 | lifecycle | absent | absent | 0 | unchanged |
| read-back-all | 0 | lifecycle | absent | absent | 0 | unchanged |
| read-back-unrelated | 0 | lifecycle | absent | absent | 1 | unchanged |
| read-watchdog-drill | 0 | severe_timing | absent | absent | 0 | unchanged |
| read-watchdog-all | 0 | severe_timing | absent | absent | 0 | unchanged |
| read-watchdog-unrelated | 0 | severe_timing | absent | absent | 1 | unchanged |
| frame-back-drill | 0 | lifecycle | absent | absent | 0 | unchanged |
| frame-back-all | 0 | lifecycle | absent | absent | 0 | unchanged |
| frame-back-unrelated | 0 | lifecycle | absent | absent | 1 | unchanged |
| frame-watchdog-drill | 0 | severe_timing | absent | absent | 0 | unchanged |
| frame-watchdog-all | 0 | severe_timing | absent | absent | 0 | unchanged |
| frame-watchdog-unrelated | 0 | severe_timing | absent | absent | 1 | unchanged |
| confirm-before-back-drill | 1 | lifecycle | confirmed | absent | 0 | unchanged |
| confirm-before-back-all | 1 | lifecycle | absent | absent | 0 | unchanged |
| confirm-before-back-unrelated | 1 | lifecycle | confirmed | absent | 1 | unchanged |
| confirm-after-back-drill | 1 | lifecycle | confirmed | absent | 0 | unchanged |
| confirm-after-back-all | 1 | lifecycle | absent | absent | 0 | unchanged |
| confirm-after-back-unrelated | 1 | lifecycle | confirmed | absent | 1 | unchanged |

Queued controls hold an external owner lock; cancellation removes the retest request from its queue. The acquired-read/frame/confirmation cases show no held presentation lock after cancellation. All rows show empty held/pending lock lists after deletion and late delivery. See [liveness.json](liveness.json), [production eligibility checks](eligibility.json), and [raw journal verification](journal-check.json).

## Existing deletion/onset ordering

| Delivery | Boundary | Deletion | Scored events | Marker | Claim | Eligible |
|---|---|---|---:|---|---|---|
| delivered | before-arm | drill | 0 | absent | absent | False |
| delivered | before-arm | all | 0 | absent | absent | False |
| delivered | before-arm | unrelated | 1 | confirmed | absent | True |
| delivered | fixation | drill | 0 | absent | absent | False |
| delivered | fixation | all | 0 | absent | absent | False |
| delivered | fixation | unrelated | 1 | confirmed | absent | True |
| delivered | delete-first | drill | 0 | absent | absent | False |
| delivered | delete-first | all | 0 | absent | absent | False |
| delivered | delete-first | unrelated | 1 | confirmed | absent | True |
| delivered | present-first | drill | 1 | confirmed | absent | False |
| delivered | present-first | all | 1 | absent | absent | False |
| delivered | present-first | unrelated | 1 | confirmed | absent | True |
| delivered | after | drill | 1 | confirmed | absent | False |
| delivered | after | all | 1 | absent | absent | False |
| delivered | after | unrelated | 1 | confirmed | absent | True |
| delayed | before-arm | drill | 0 | absent | absent | False |
| delayed | before-arm | all | 0 | absent | absent | False |
| delayed | before-arm | unrelated | 1 | confirmed | absent | True |
| delayed | fixation | drill | 0 | absent | absent | False |
| delayed | fixation | all | 0 | absent | absent | False |
| delayed | fixation | unrelated | 1 | confirmed | absent | True |
| delayed | delete-first | drill | 0 | absent | absent | False |
| delayed | delete-first | all | 0 | absent | absent | False |
| delayed | delete-first | unrelated | 1 | confirmed | absent | True |
| delayed | present-first | drill | 1 | confirmed | absent | False |
| delayed | present-first | all | 1 | absent | absent | False |
| delayed | present-first | unrelated | 1 | confirmed | absent | True |
| delayed | after | drill | 1 | confirmed | absent | False |
| delayed | after | all | 1 | absent | absent | False |
| delayed | after | unrelated | 1 | confirmed | absent | True |
| unavailable | before-arm | drill | 0 | absent | absent | False |
| unavailable | before-arm | all | 0 | absent | absent | False |
| unavailable | before-arm | unrelated | 1 | confirmed | absent | True |
| unavailable | fixation | drill | 0 | absent | absent | False |
| unavailable | fixation | all | 0 | absent | absent | False |
| unavailable | fixation | unrelated | 1 | confirmed | absent | True |
| unavailable | delete-first | drill | 0 | absent | absent | False |
| unavailable | delete-first | all | 0 | absent | absent | False |
| unavailable | delete-first | unrelated | 1 | confirmed | absent | True |
| unavailable | present-first | drill | 1 | confirmed | absent | False |
| unavailable | present-first | all | 1 | absent | absent | False |
| unavailable | present-first | unrelated | 1 | confirmed | absent | True |
| unavailable | after | drill | 1 | confirmed | absent | False |
| unavailable | after | all | 1 | absent | absent | False |
| unavailable | after | unrelated | 1 | confirmed | absent | True |

All 15 Delete-all rows reject five old-store operations (arm, reserve, saveChain, saveDraft, deleteAll) without changing replacement bytes. Required deletion before onset has zero scored events; presentation first retains one. Unrelated deletion leaves the run live until the driver deliberately exits.

## Additional boundaries

Four real transaction-abort probes pass: pending read delivery and uncommitted write, each with individual deletion and Delete all. Read-delivery promises remain unsettled when deletion completes. See [transactions-summary.json](transactions-summary.json).

The 13 protocol cases cover queued cancellation, installed-frame cancellation, missing-frame watchdog, a permitted 200 ms onset delay, read/lock/frame rejection, exposure failure, held read/confirmation cancellation, and timed input/offset/later-trial progress while confirmation is held. Full journals are in the archive under `protocol/`.
