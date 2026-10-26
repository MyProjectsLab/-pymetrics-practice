# Money Exchange 2 storage V2 addendum — independent exact-byte readiness re-review

**Verdict: PASS — bounded specification/implementation readiness for the grouped B1/B2 repair.** This is not implementation, test, product audit, founder acceptance, qualification, integration, deployment or release PASS.

Reviewed file: `/private/tmp/money-exchange-2-v1-recovery/docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_STORAGE_V2_ADDENDUM_DRAFT.md`.

Independently computed and matched SHA-256: `b8355b442c6712e80158d1b2f075a3682c7056ade121790bb9ed1b6ade4019f4`.

The full revised addendum was read against the frozen V1 authority/specification boundaries, the deletion design challenge and the recovered source behavior inspected in the prior review. Coordinator-reported recovery base remains `a3fd628528aa1a81eac0620095cafebbfff65ea7`. No product/governing files changed and no code tests or browser audit ran during this review. The prior FAIL at hash `f5553d2c2bc64f60082d17265782049defcb94459738fcb6612a2071ac36fedf` and `STORAGE-V2-ADDENDUM-REVIEW.md` remain historical; this verdict applies only to the new bytes.

## Prior findings closed

| Finding | Revised contract and disposition |
|---|---|
| R1: deleted-origin rejection before necessary receipt resolution | Request classification now explicitly permits nonmutating deletion confirmation, most-recent reset confirmation across its old/new boundary, and validated successor-chain resolution before the deleted-origin mutation guard. Same owner/lease/generation, exact chain and still-current successor remain required for a chained mutation. Fresh actions targeting the deleted lineage remain fenced. **Closed at specification level.** |
| R2: exact raw navigation retention versus timestamp/input erasure | Navigation/deletion identities now have explicit field allowlists and canonical absent representation. New V2 equality uses that identity. Historical V1 receipt migration projects away `at`, runtime `input`, context and other nonidentity payload with an explicit, bounded exception to whole-command equality. Discarded-field changes cannot authorize a different action. Original exit event timestamp/reason remains only in a surviving attempt's private proof/journal, erased with that attempt. Scored request equality is preserved while retained. **Closed at specification level.** |
| Schema/installation integer wording | String identities are distinguished from integer generation/revision. **Closed.** |
| D5 write coverage | Round-1 fairness and report/history activity writes are explicitly included in both deletion orders. D6/D8/D10/D13 now cover receipt identity conflicts, deleted-origin resolution, V1 at/input projection and lost reset completion. **Closed.** |

## Whole-contract assessment

The storage design is internally implementable within the declared scope:

- Atomic deletion replaces the validated state with one sanitized checkpoint and subsequent command tail. Independent retained-attempt replay derives the original state/events/revision/report for Completed, Incomplete and intermediate attempts. It does not silently claim replay proof of erased history.
- Erasure covers commands, journals, private proofs, serialized hashes, receipt identities, activity, caches and backups. Only allowlisted familiarity and authority metadata may remain. Surviving historical records retain their original bytes and version meanings.
- Retirement terminates erased-request reconciliation without payload discrimination or former-success display. Deletion/reset confirmation is a narrow historical readback exception. Successor navigation receipts preserve the active/pending chain without conferring current authority by themselves.
- Same-database version-2 opening fences legacy writers; schema reconciliation remains distinct from IndexedDB version completion. Historical validation precedes conversion. Failed conversion, lost completion and concurrent V2 openers have defined behavior. Present corruption or a missing root in an existing database blocks; explicit damaged-data deletion is separate.
- Current-owner admission, synchronous local revocation, atomic final publication, exact successor guards and ordinary terminal/exit precedence remain binding. The checkpoint does not weaken those runtime obligations.
- D1–D13 plus V1–V2 form a finite acceptance matrix covering full-root privacy, surviving bytes, both deletion orders, pending writes/readbacks, active successors, migration/corruption, source hierarchy, accessibility labels and owned presentation. These are required future evidence, not passed checks.
- B2 and the round-specific Give/Give-or-Take labels implement the frozen source/visual contract. Gameplay, form, event and scoring semantics remain unchanged. Frozen files remain byte-preserved; the addendum makes the storage and comparison exceptions explicit.

No remaining blocking contradiction was identified in these exact revised bytes. Implementation must make the declared allowlists, request classes and validation rules concrete and produce fresh evidence. In particular, obsolete navigation retirement must retain only its necessary opaque fence, never an old raw command; permission to preserve a live chain is not permission to retain its deleted attempt's payload.

**Next authorized step:** freeze this exact reviewed addendum identity, reproduce B1/B2 on the recovered original source, implement one grouped repair, complete the specified proportionate developer checks, and submit one new clean exact SHA for separate whole-standalone read-only audit. Earlier f8ea2f6 product FAIL and lost-evidence limits remain in force until fresh candidate evidence closes them.
