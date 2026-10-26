# Money Exchange 2 — grouped B1/B2 developer candidate

Scope: the single grouped repair on docs-only base `590ea858a634cf08b82a87621551f2f350598cfb`, following recovery `a3fd628528aa1a81eac0620095cafebbfff65ea7` and storage V2 freeze `95cc1570c990e59626b1d45b72601fbcfd2af630`. The enclosing product commit is the candidate; its exact SHA is recorded in the external durable `GROUPED-REPAIR-STATUS.md`. These are developer results, not an independent product audit, founder acceptance, environment qualification, integration, deployment or release.

## Changes and authority

B1 was reproduced before edits: deleted attempt values remained in the V1 outcomes ledger and serialized comparison strings. The repair preserves the historical V1 validator byte-for-byte in `legacy-core.ts`, validates V1 before atomic migration, and uses the same IndexedDB database at database version 2. Storage V2 uses sanitized deletion checkpoints with ordered tails, independently replayed survivor proofs, canonical value-free navigation/deletion receipts, value-free retirement fences and typed terminal readback. Deletion removes all private copies belonging to the deleted attempt while preserving survivor events/reports, allocation and current successor authority. Controller admission/publication/reconciliation clears invalidated display authority and caches; lost confirmation remains distinct from absent, corrupt or retired state.

The original D3 regression was retained. Frozen V2.1 clarified that an obsolete Close/owner-withdrawal ID may occur in an undeleted survivor's necessary immutable ending proof while its public receipt is fenced. Validation now checks original installation/generation/owner/lease/ticket, unique command ownership, the necessary state transition, event identity and exact derived attempt bytes. A chained Close preserves its original command ticket and chain IDs. Its separate private lineage records only the canonical value-free opening identity and successor ticket, captured from the original accepted transition; validation checks matching chain kind/identity, authority, ticket inventory, existing request fence/record and any retained original command. Ticket rewriting alone cannot create a binding. Lineage carries no deleted play payload and is never exposed by request readback. Exact/conflicting fenced retries return only a typed status. Later survivor deletion removes its proof, journal and private lineage atomically. Checkpoints prove internal consistency, not authenticity against coherent malicious rewriting of erased history.

B2 was reproduced at the source viewport. The choice panel now follows the saved source hierarchy: large white panel, separated original participant artwork/badges, centered green amount tile, native range and endpoints, Restart at upper right and Confirm at lower right. Round 1's accessible label is Give-only; round 2 retains Give or Take. Forms, scoring and event/report meanings are unchanged.

## Evidence identity and results

- `evidence/final-source-sha256.json`: final 15 source/test/integration identities.
- `evidence/checkpoint-source-sha256.json`: earlier pre-clarification identities; retained for truthful visual/runtime provenance.
- `evidence/final-driver-sha256.json`: final grouped driver identities.
- `evidence/frozen-identities.json`: all 12 original frozen identities plus the reviewed V2 and V2.1 addenda, unchanged.
- `evidence/final-integrity.json`: final source, frozen bytes, legacy-core copy, visual-source continuity and complete evidence inventory hashes.

Final affected checks: **132/132 focused tests**, TypeScript/production build successful, lint successful with three inherited warnings. No unrelated repository suite was run. Native V2.1 matrix **26/26**, native V2 matrix **40/40**, native deletion/controller **18/18**, native storage/recovery **18/18**. See `evidence/final-*.log` and each suite's `results.json` and complete-root JSON files. Native tests use the production build and actual IndexedDB/Web Locks; storage probes import an isolated test-only bundle.

The earlier fresh grouped visual/gameplay evidence remains applicable to the unchanged art, entry, owned-document, controller, storage and form files (hash comparison recorded): matrix **14/14**, visual journeys **3/3** with both rounds at 2668×1704, 320px and 200% visual viewport scale; filmed normal +$2/rating 8 report/help/reload journey; reduced-motion/forced-colors emulation. Only `core.ts` and its new test file changed after that checkpoint. Their affected storage/controller paths were rerun above. This does not label the older browser runs as having executed the final whole source tree.

## Finite acceptance map

| Check | Evidence and result |
|---|---|
| D1 | `baseline/` reproduces ledger retention; `v2/` completed deletion/reload/privacy and `unit/` complete-root erasure |
| D2 | `v2/D2-*` native Incomplete choice, receipt and rating boundaries |
| D3 | `v21/D3-*` native and migration, Completed/Incomplete A with Armed B, both orders; before/after/erased complete roots and byte-equal survivor comparisons |
| D4 | `v21/D4-*` held old Close completion, exact/conflicting terminal readbacks, no mutation/private echo; `deletion/V21-held-close-*` held production controller read/completion cannot restore old screen |
| D5 | `v2/D5-*` choice, receipt, fairness, terminal, report and history activity in both write orders |
| D6 | `v21/D6-*` failed deletion leaves exact root bytes; successful retry; `deletion/` local admission hides facts while deletion write is held; lost callback confirmation in `v2/` |
| D7 | `v2/D7-*` active B and lost choice/terminal completion while deleting A; B bytes/route preserved, exact/conflicting retained readback |
| D8 | `deletion/` Restart/Try Again/Close before and after old deletion; `unit/` all four original opening lineages; `v21/V21-chained-*` native/migration with deleted origin and eventual survivor deletion |
| D9 | `deletion/` report publication/current withdrawal/history refresh and owner loss with notifications absent; original focused controller tests |
| D10 | `v2/D10-*` canonical projected navigation, retained exact/conflicting comparisons; survivor event/report equality in D3/D7 |
| D11 | `v2/D11-*` retained/deleted/Armed migration, concurrent open, failed/lost completion, blocked upgrade/old-writer rejection; `v21/` retirement migration equivalents |
| D12 | `v2/D12-*`, `storage/`, `v21/D12-*`: falsey/unsupported/malformed roots and missing/tombstoned survivor, scored payload as navigation, duplicate/mixed request, forged ticket/retirement/lineage, unrecorded lineage, deleted payload; rejects unchanged, no reset |
| D13 | `v2/D13-*` both reset/delete orderings and most recent reset readback; `deletion/` pending-arm boundaries; old generation fenced, familiarity cleared |
| V1–V2 | `visual/`, `matrix/`, `filmed/`, accessibility results: source hierarchy, labels, native keyboard/hit targets, renderer exposure negatives and responsive journeys |

## Historical failures and limits

`DEVELOPER-PROGRESS.md`, `CONTRACT-BLOCKER.md` and the original failing focused log preserve the pre-clarification failure. V2.1 review/freeze resolves its specification contradiction; the original regression now passes. A first new held-Close UI harness let an ordinary confirmation read run before retirement and therefore did not exercise the intended stale-delivery order. Its diagnostic root remains named `V21-held-obsolete-close-cannot-restore-screen-root.json`. The final driver holds UI data reads and uses a separate tab for the intervening native operations; final evidence is the explicit `V21-held-close-before/after.json`, screenshot and passing result. No product workaround was added for that harness issue.

The 37 original lost artifacts remain **LOST**. None is represented as recovered or reused as fresh evidence. Baseline and grouped evidence here are new captures. The proprietary source frame at movie time 75 seconds remains outside the product repository at `work-evidence/money2-v1/source-075.png`.

Browser verification is headless Chromium using the executable/tooling declared in `browser-support.mjs`, localhost preview port 4282. Some test actors call native Store commands rather than UI controls; UI publication/navigation is separately exercised through the production page. Some older input drivers dispatch DOM events, while the visual driver separately uses real native keyboard endpoints and hit testing. Failures/callback loss/lifecycle signals are controlled injections. Accessibility modes and zoom are emulated; no physical-device, OS-zoom, screen-reader, disk-remnant erasure, provider-equivalence or large-history qualification is claimed.

Reproduction: `npm test -- src/money-exchange-2`, `npm run lint`, `npm run build`; build `probe.ts` as an isolated Vite library to `/private/tmp/money2-v2-probe/probe.js`; run production preview on 4282 and the named `browser*.mjs` drivers. The test probe is not included in the product bundle.
