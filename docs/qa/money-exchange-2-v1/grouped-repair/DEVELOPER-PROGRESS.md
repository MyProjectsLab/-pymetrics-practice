> Historical pre-clarification checkpoint. The frozen V2.1 clarification and final affected checks are recorded in `DEVELOPER-QA.md`; original failure details below are preserved.

# Money Exchange 2 grouped B1/B2 repair — incomplete checkpoint

Base: `95cc1570c990e59626b1d45b72601fbcfd2af630`. No repair commit, candidate PASS, independent audit, integration, qualification, deployment or release. Main was not edited.

## Implemented in this working checkpoint

- Historical V1 core/validator preserved byte-for-byte in `legacy-core.ts`; V2 adds validated deletion checkpoints, ordered tails, independent retained-attempt proofs, payload-free deletion/reset/navigation identities, typed retirement/readback, and atomic V1 migration in the same IndexedDB database at version 2.
- Individual deletion compacts away deleted attempts, proofs, activity, personal ledger entries and stringified result fingerprints. Live successor receipts remain resolvable; old play requests are terminal retired/deleted. Exact retained and projected navigation readbacks do not rewrite storage.
- Controller deletion admission immediately hides affected history facts; stale/retired reconciliation clears caches, generation reset confirmation is distinguished from unknown status, and report publication rechecks deletion within ordered storage access.
- Choice screens use the source hierarchy: near-full-height white panel, separated original participant artwork/badges, centered green amount tile, native horizontal range with endpoints, Restart upper right and Confirm lower right. Round 1 labels say Give; round 2 labels say Give or Take. Native keyboard, hit testing, 320px and zoom journeys pass.

## Open blocking regression

**D3 incomplete survivor:** Close A1.1, arm A1.2, delete A1.2. Retiring A1.1's obsolete exit ID conflicts with its required surviving immutable event/proof. The strict checkpoint validator rejects the transaction. See `CONTRACT-BLOCKER.md` for the exact frozen clauses, reproduction and proposed narrow clarification. No exception was silently added. This prevents a completed candidate even though the other bounded checks pass.

## Fresh evidence at this source checkpoint

`evidence/checkpoint-source-sha256.json` identifies the current source/tests/integration files. The final focused run has **110 passed, 1 failed** across four files; the sole failure is the explicit incomplete-survivor regression above. TypeScript/production build pass. Lint exits 0 with the same three inherited warnings.

| Scope | Fresh result | Evidence |
|---|---|---|
| Untouched baseline B1/B2 | Both reproduced before edits | `evidence/baseline/` complete pre/post roots, layout JSON and 2668×1704 choice screenshot |
| Native V2 migration, privacy, retirement and write-order probes | 40/40 exercised cases pass; does not include the known incomplete-survivor failure as a native pass | `evidence/v2/results.json`, complete roots per case |
| Native deletion/publication/pending navigation | 17/17 pass | `evidence/deletion/results.json`, `evidence/deletion.log` |
| Native storage/failure/recovery regressions | 18/18 pass | `evidence/storage/results.json`, retained roots and log |
| Six forms, endpoint math, result integrity, keyboard and responsive matrix | 14/14 pass | `evidence/matrix/results.json`, roots/screenshots/log |
| Choice hierarchy / native slider hits / labels / keyboard endpoints | Source viewport, 320px, 200% visual zoom pass; both rounds in each | `evidence/visual/results.json`, six choice screenshots and three complete roots |
| Actual Practice entry; normal +$2 and rating 8 in both rounds; report pages/help/reload | Pass with byte-identical retained attempt on reload | `evidence/filmed/`, `evidence/filmed.log` |
| Reduced motion / forced colors | Emulated journey passes | `evidence/accessibility-results.json`, `evidence/accessibility.log` |
| Frozen V1 packet | All 12 identities unchanged | `evidence/frozen-identities.json` |
| Frozen V2 addendum | Unchanged reviewed hash `b8355b442c6712e80158d1b2f075a3682c7056ade121790bb9ed1b6ade4019f4` | `evidence/frozen-identities.json` |

### Finite addendum coverage

D1: native completed deletion, reload/history and full-root erasure. D2: native incomplete choice/receipt/rating boundaries. D3: native retained Completed A/new Armed B in both deletion orders; **older Incomplete survivor fails in focused test**. D4: exact/conflicting erased retries and late lost-completion delivery. D5: native choice, receipt, round-1 fairness, terminal, report and history activity, both orders. D6: failed deletion atomicity, lost completion and immediately hidden local history during a held write. D7: B active and lost choice/terminal completions while deleting A, preserved bytes/route and retained exact/conflicting readback. D8: Restart/Try Again/later Close with deletion before or after opening, wrong-chain focused rejection. D9: ordered report publication, current withdrawal, history refresh and owner/reload loss with notifications absent. D10: retained exact/conflict and V1 at/input projection with identity conflict rejection and no write. D11: retained/deleted/Armed migration, failed/lost completion, concurrent openers, blocked upgrade and old-writer VersionError. D12: falsey/unsupported roots plus malformed checkpoint/proof/tombstone/route, blocked unchanged. D13: individual-delete/reset/pending-arm orders, old request fences and lost most-recent reset confirmation. V1/V2: visual/control and owned-renderer suites above.

## Limits and reproduction

All fresh browser work uses headless Chromium via the executable declared in `browser-support.mjs`, production Vite preview on port 4282, native IndexedDB and Web Locks. Closed shadow roots are retained only by pre-entry test interception. Store-focused V2 cases import a separately built test probe through a data URL; it is not part of the shipped application bundle. These test actor calls use the real native storage adapter but do not claim human UI interaction for every storage command. All important UI publication/navigation regressions are separately exercised through the production page. Some amount/rating inputs in older recovered drivers use injected DOM events; `browser-visual.mjs` separately checks real native keyboard endpoints and unobstructed range hit targets.

Callback loss, transaction failures and lifecycle events are controlled injections. Zoom uses CDP visual viewport scaling, and accessibility modes are emulated. No physical device, OS zoom, screen-reader certification, disk-remnant erasure or provider-equivalence claim is made. Very large histories remain unqualified. No original lost screenshot/root/log was represented as recovered; all 37 old artifacts remain LOST in the recovery record.

The source frame at movie time 75 seconds was re-extracted via AVFoundation from the saved recording at 2668×1704, then directly inspected. It remains outside the product repository at the durable evidence path `work-evidence/money2-v1/source-075.png`. Original product artwork is retained.

Reproduce focused checks with `npm test -- src/money-exchange-2`, `npm run lint`, `npm run build`. Build `grouped-repair/probe.ts` as an isolated Vite library at `/private/tmp/money2-v2-probe/probe.js`; serve production build on 4282; run grouped-repair `browser*.mjs` drivers except support. Driver paths declare their local tooling. The deliberately failing D3 regression must remain until the independently reviewed clarification is implemented.

Next: resolve the narrow retirement/proof contract, add its native and migration regressions, complete the grouped implementation, rerun affected checks at final source identities, then create ONE clean candidate for coordinator's separate exact-SHA whole-game audit.
