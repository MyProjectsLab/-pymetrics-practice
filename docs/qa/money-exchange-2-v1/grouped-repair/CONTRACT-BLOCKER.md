> Historical pre-clarification checkpoint. The frozen V2.1 clarification and final affected checks are recorded in `DEVELOPER-QA.md`; original failure details below are preserved.

# Storage V2 navigation retirement / surviving proof conflict

Status: **OPEN; no completed repair candidate**. Exact frozen addendum hash remains `b8355b442c6712e80158d1b2f075a3682c7056ade121790bb9ed1b6ade4019f4`. No frozen text changed.

## Concrete reproduction

Focused test `D3 incomplete survivor proof survives deletion of newer attempt` in `src/money-exchange-2/storage-v2.test.ts`:

1. Arm A1.1 and Close, producing an Incomplete attempt with the original `ended_incomplete` event and exit command in its separate replay proof.
2. Enter again and arm A1.2, so A1.1's exit receipt is no longer part of a current/pending navigation chain.
3. Delete A1.2 while preserving A1.1 byte-for-byte.

Compaction retires the obsolete A1.1 exit receipt. A1.1's surviving event/proof necessarily still has that exit request ID and original time/reason. The checkpoint validator then rejects `proof request conflict`, because it enforces the addendum's statement that retired IDs are absent from payload-bearing records. In the native adapter this fails validation before the replacement root is written, so deletion must remain unconfirmed rather than erase a survivor or claim success.

## Contract clauses in tension

- Preserve surviving attempts/events/reports byte-for-byte, independently replayable for Incomplete as well as Completed.
- Retain navigation receipts only while required by a current or admitted pending successor chain; retire obsolete receipt IDs.
- Retired IDs must be absent from payload-bearing records.

Retaining every obsolete receipt would violate the second clause. Dropping the survivor's exit event/proof would violate the first. Allowing all retired IDs inside retained raw payloads without a defined distinction would weaken the third. None of these shortcuts was applied.

## Narrow proposed clarification for independent review

Distinguish erased-play retirement from obsolete-navigation fencing. An obsolete navigation ID may remain **only as an opaque cross-reference within an undeleted attempt's original immutable journal and its private replay proof**, when independently required to derive that surviving record. Its obsolete public receipt/body is discarded and its ID cannot authorize navigation or resurrect a callback. Deleting that surviving attempt must erase its private journal/proof and all payload-bearing references. Erased play requests remain prohibited in every payload-bearing record after their target's deletion.

This is a proposed interpretation/change, not authority to modify the frozen addendum. Coordinator should obtain a narrow exact-byte clarification/review and decide how it is recorded before the exception is implemented. Then retain this regression, cover the same case in native IndexedDB and migration, rerun affected integrity/deletion checks, complete the finite evidence map and commit the single coherent candidate.
