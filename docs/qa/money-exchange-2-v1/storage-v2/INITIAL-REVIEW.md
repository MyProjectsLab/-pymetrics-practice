# Money Exchange 2 storage V2 addendum — independent exact-byte readiness review

**Verdict: FAIL — two bounded specification contradictions require correction before implementation.**

Reviewed file: `/private/tmp/money-exchange-2-v1-recovery/docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_STORAGE_V2_ADDENDUM_DRAFT.md`.

Independently computed SHA-256: `f5553d2c2bc64f60082d17265782049defcb94459738fcb6612a2071ac36fedf`, matching the review request. Recovered source base identified by coordinator: `a3fd628528aa1a81eac0620095cafebbfff65ea7`. This review inspected the addendum, recovered core/controller/storage/entry behavior and the already-read frozen governing boundaries. No product or governing file was changed; no implementation tests or browser audit were run.

## R1 — Universal deleted-lineage precedence contradicts retained deletion and successor receipts

Addendum line 33 places a deleted-lineage fence before retained request lookup for **every operation/readback**. Lines 35–37 require retained navigation receipts referencing deleted A and idempotent deletion receipts to remain readable. Following line 33 literally prevents both:

1. Delete A commits; its callback is lost. The exact deletion request still names tombstoned A. A universal lineage rejection runs before the receipt lookup needed to confirm that deletion.
2. Try Again or Restart from A commits successor ticket B; A is then deleted while the opening callback or chained Close is pending. The opening and Close commands still carry A's originating ticket. Rejecting that lineage before resolving the saved successor receipt prevents the required readback/Close even though B is current.

**Required correction:** define request classification and lookup order precisely. Retired play IDs return retirement before ordinary play processing. Exact value-free deletion-receipt lookup must remain available despite its deleted target, solely as nonmutating historical confirmation. A validated value-free navigation receipt/chain must resolve its effective successor before the current-lineage mutation guard; it authorizes no new action by itself. Only the exact admitted chain can target that still-current successor under the same installation/generation/lease and local admission rules. Fresh unrelated IDs or commands targeting A remain rejected. Add an explicit lost-Delete-all-completion readback rule if generation/installation changes: a fenced old request may confirm only the value-free reset identity, never execute again or recover old play authority.

D6, D8 and D13 should explicitly test these receipt-readback exceptions, including conflicting receipt reuse and a wrong successor chain.

## R2 — Exact raw navigation payload retention conflicts with the metadata erasure rule

Line 15 forbids retaining A's timestamp or input/accessibility context unless separately required as a stated live authority field. Lines 33/35 simultaneously require exact canonical payload equality and the exact value-free navigation command. The recovered command is not value-free under that definition:

- `controller.ts` `base()` adds `at: performance.now()` to every command.
- `entry.ts`'s `admit` helper passes `input` for ordinary buttons, including Try Again/reviewReplay; `Controller.admit` spreads it into the saved command.
- Current outcome matching compares the entire command using `JSON.stringify`, including those fields. The nominal `Command` interface omits `input`, but the runtime payload still contains it.

Thus retaining the exact command violates the proposed privacy rule; dropping these fields breaks the stated exact retry/readback identity. An ordinary hash retaining this input/time equality also violates the intended erasure boundary.

**Required correction:** specify the precise allowed navigation/deletion receipt fields and the comparison rule. Prefer admitting new V2 navigation with a value-free canonical identity from the start; explicitly define how historical V1 navigation containing `at`/`input` is migrated or retired. If migrated receipts use a projection, declare the bounded exception to old whole-payload equality and forbid those projected-away fields from authorizing anything. Do not call a projected migrated command byte-identical to the original. State when obsolete navigation metadata is removed, and test a V1 payload containing both fields plus exact/conflicting successor retries across deletion.

## Additional precise corrections within the same revision

- Line 25 says “schema/installation/generation/revision integers.” Schema and installation identities are strings. State their actual types and constrain generation/revision as integers.
- The race rules explicitly apply independently to fairness, report and activity writes, but D5 enumerates only choice, receipt and terminal. Add round-1 fairness and report/history activity commits to D5's finite held-write/both-orders list, or expressly map them to an identified equivalent tested transition. D9's report/history *publication* race does not itself exercise the activity write.

## Otherwise supported within this design scope

The addendum correctly makes erasure include serialized hashes, receipts, proofs, caches and backups; preserves surviving records and their original version meanings; supplies checkpoints plus independent retained-attempt replay rather than silently dropping genesis entries; states checkpoint proof limits; fences old database writers with the same-database upgrade; addresses schema-versus-database-version partial migration, concurrent opens, lost completion and corrupt present roots; and preserves frozen gameplay/visual scope. D1–D13 and V1–V2 provide a suitable bounded matrix once the specific gaps above are corrected.

No additional game feature, provider claim, unrelated architecture work or founder approval request is required by these findings. Revise the addendum as one coherent change, obtain a new exact-byte independent readiness verdict, then code the grouped B1/B2 milestone. This document does not grant implementation readiness or product PASS to the reviewed bytes.
