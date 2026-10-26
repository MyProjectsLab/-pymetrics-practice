# Money Exchange 2 storage V2.1 — independent exact-byte clarification review

**Verdict: PASS — bounded specification readiness for the retirement clarification.** No product/test/browser/audit PASS is established.

Reviewed file: `/private/tmp/money-exchange-2-v1-recovery/docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_STORAGE_V2_1_RETIREMENT_ADDENDUM_DRAFT.md`.

Independently computed SHA-256: `2325bdb283cb2e8fe580f37a5fe4ac51b7d8e0e2c5c5f3e8603cf7a14cf95d57`, matching the requested identity. Frozen V2 addendum rehashed unchanged at `b8355b442c6712e80158d1b2f075a3682c7056ade121790bb9ed1b6ade4019f4`.

Read the complete clarification, `grouped-repair/CONTRACT-BLOCKER.md`, current `core.ts` and the relevant `storage-v2.test.ts` cases. This was source/contract inspection only: the failing test was not rerun, product files were not changed, and the evolving repair is not an exact-SHA product audit target. Earlier review files and verdicts remain preserved; this newly identified V2 contradiction was not caught by the earlier readiness PASS.

## Concrete defect and resolution

The reported failure follows directly from the inspected code. `apply` records an exit command in A's private proof when Close changes A to Incomplete. After B is started, A's exit no longer serves the current navigation chain. Deleting B invokes `compact`, which removes A's obsolete exit outcome and adds its request ID to `retired`. `validateState` then rejects every proof command whose ID appears in that map with `proof request conflict`. Preserving A's immutable ending event/proof and retiring its obsolete navigation receipt cannot both satisfy the old blanket rule.

The clarification resolves that precise contradiction without permitting A's result data to survive deletion of A:

- Erased-play retirement continues to prohibit every deleted-attempt payload, including private proof and low-entropy fingerprint.
- Obsolete-navigation fencing removes the actionable receipt but permits the same ID inside a still-existing, independently validated survivor's original journal/private proof when required to derive that survivor's state.
- Category claims are insufficient. The validator must establish the unique survivor binding, historical navigation/withdrawal operation, authority, valid original sequence, exact derived surviving state and absence of deleted-attempt data.
- External replay remains terminally fenced for exact and conflicting payloads. Internal replay is validation only. Existing current-authority history access to the retained record remains legitimate.
- Deleting that survivor removes all its private journal/proof references atomically; it never recreates a navigation receipt. Delete all removes the fences too.

No remaining concrete contradiction was identified in these exact clarification bytes.

## Privacy and authority neighbors checked

The exception is specific to necessary navigation/withdrawal history. It does not authorize scored commands disguised as navigation, shared/conflicting proof ownership, a fabricated survivor reference, payloads belonging to deleted B, obsolete receipt readback or restoration of a callback's authority. The original V2 canonical identity, current successor-chain and publication rules remain binding. A still-live successor receipt retains its existing V2 treatment until it becomes obsolete; this clarification does not prematurely retire it.

The current implementation must therefore do more than remove the `!retired` test: it must enforce the positive exception conditions. In particular, binding must be checked against original command identity and any valid resolved lineage; rewriting a ticket solely to make private replay succeed is not itself evidence of that binding. This restates the clarification's existing validation obligation, not a new feature or code audit verdict.

Both deletion orders, Completed and Incomplete survivors, later deletion of the retained survivor, reload, V1 migration, native storage, failed transactions and held exact/conflicting callbacks are explicitly required. The negative fixtures distinguish a valid retained historical reference from an erased-play reference and forged ownership. These cases belong to the existing grouped repair, with fresh complete-root evidence.

Keeping `money_exchange_2_storage_v2_0` is coherent for this precommit clarification: the stored shape and historical event/report meanings need not change; category and binding are derived from the validated checkpoint inventory. An optional explicit category field must itself be value-free and validated, never trusted as authority. The frozen V2 document remains unchanged and the V2.1 precedence is narrow and explicit.

**Next step:** freeze this reviewed clarification identity, implement its bounded validation rule, retain the original failing regression and complete the named neighboring checks. Then complete the single grouped B1/B2 candidate and submit its clean exact SHA for the separate whole-standalone audit. Founder acceptance, qualification, integration, deployment and release remain separate.
