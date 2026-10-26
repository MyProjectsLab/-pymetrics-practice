# Balloons B1-A developer verification

Date: 2026-10-03. Started from clean `5e254f3a1c339bd7aaadea87248d02690b60eab0` on `main`. The founder explicitly authorized only the deterministic, headless Practice core in this stage. This is developer evidence, not an independent exact-SHA audit or B1 completion.

The original implementation/checks below describe the initial handoff. Its report-integrity claims were insufficient: the independent audit **FAILED at `f7d5c13454485107b5057629b2f48342b53c1282`** on F1–F4. The focused repair and current developer evidence follow at the end of this record. No independent repair PASS or founder acceptance is claimed.

## Governing evidence

Read `AGENTS.md`, the complete Master Strategy, Balloons V1.0 specification, tracker, freeze record and form review before implementation. No governing conflict was found. The five frozen packet SHA-256 values were recomputed and matched `docs/qa/balloons-v1-0/FREEZE.md`: specification `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324`, fixed manifests `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0`, form review `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b`, router fixtures `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30`, fixture review `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be`. Frozen files remain unchanged.

## Implemented boundary

- `src/balloons/contracts.ts`: separate versioned B1-A contracts for forms, mapping, actions, outcomes, ordered events and headless state. All value arithmetic uses integer cents.
- `src/balloons/manifests.ts`: load the committed nine scored forms only after approved embedded hash, canonical manifest/signature SHA-256, exact schema/algorithm identity and structural validation. Return frozen forms; the core refuses unverified form objects. This loader never regenerates a played form.
- `scripts/check-balloons-manifests.mjs`: independently regenerate candidate seeds 0–34 under `balloons-scored-v1` counter hashing, rejection sampling, Fisher–Yates, whole-form rejections and duplicate-signature exclusion. Verify the first nine accepted seeds and exact ordered profile/threshold rows, hashes, 39 rounds and 13/profile, rotating 4/4/5 blocks, run/alternation exclusions, inclusive quartiles, threshold bands, 36 pairwise playable differences (35–39), fixed-k payouts and C cap-survival counts against the approved form review. The script also verifies the frozen JSON file hash.
- `src/balloons/core.ts`: pure `startScoredSession`/`transition` with Pump, Collect and Next; attempted versus successful pumps; burst before increment; voluntary zero-pump collection; automatic 32-successful-pump collection; 39-round completion. BL/RP visible-type mapping follows the form number; RT mapping remains explicit for the later chain adapter. Accepted actions require the next app-allocated ID and current round/revision. Rejected duplicate, skipped, stale or post-resolution actions leave state and journal unchanged. Immutable events carry versions, identity, mapping, source, clock epoch/times, generations, sequence, action ID, pre/post totals and outcome. The headless `round_presented` event explicitly does not prove DOM presentation or durable form exposure.
- `src/balloons/report.ts`: pure complete-result arithmetic with exact per-round, overall, category and 13-round block conservation. The report audits completed event ordering and outcome counts. It returns explicit insufficient evidence for incomplete sessions, category voluntary medians below 5, early/late category medians below 3 per segment, and fewer than two disjoint qualifying post-burst windows. Cap and burst are censored and never become voluntary points. Candidate-facing report/review data omit hidden thresholds and profile letters; wording is limited to observed task outcomes and the approved limitation.

## Tests and checks

`src/balloons/core.test.ts` uses threshold-based independent expected values rather than copying core outputs. Nine tests cover first-attempt burst, `T=32` burst, `T=33` cap, zero-pump Collect and retained earlier bank, duplicate/skipped IDs, stale round/revision, all nine full 39-round forms, all overall/category/block conservation identities, complete-journal ordering, medians including halves, sparse-data suppression, two supported disjoint post-burst windows with all four observed outcomes, altered-journal rejection, form/hash rejection and form-number mapping. The manifest check is a separate Node implementation of the generator and structural audit.

Final checks: `npm run lint` exited 0 with two inherited warnings in `docs/qa/m5/repair-f1-f3/cross-tab.mjs` and `src/App.tsx`; `npm test` passed 667 tests in 38 files; `npm run balloons:check` passed nine scored forms and all 36 pairwise comparisons; `npm run forms:check` passed 14 Stop forms; `npm run drills:check` passed five Stop drills; `npm run build` passed TypeScript and both production builds; `git diff --check` passed. No browser or persistence behavior is claimed from these headless checks.

## Limits and next gates

B1-A provides no React screen or native click classification/held-key guard, browser presentation confirmation, storage commit, IndexedDB, cross-tab ownership, exposure or reservation, interruption/recovery, router, drills, retest, mock, history, analytics, device/accessibility qualification or release behavior. A caller must allocate action IDs from the canonical click and atomically persist returned events plus state before displaying committed outcomes; this stage does not claim that integration. `headless_complete` is not a durable valid baseline. The full B1 acceptance set, B2, B3, independent exact-SHA audit and founder acceptance remain open. The frozen specifications, Stop behavior and twelve-game scope were not changed. A separate founder instruction is required for the next stage.

## F1–F4 focused repair — 2026-10-03

Started from exact clean `f7d5c13454485107b5057629b2f48342b53c1282`, parent `5e254f3a1c339bd7aaadea87248d02690b60eab0`. Read the independent audit and direct-source reproductions, reviewed the governing §4/§6/§7 requirements and current code, and confirmed the frozen five-file packet hashes above. The Master Strategy remains `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`. No governing conflict or specification revision was needed.

### Before editing

Ran the audit's original command against the untouched repository TypeScript:

```sh
/tmp/balloons-b1a-audit-gH5XJE/checkout/node_modules/.bin/vitest run --config /tmp/balloons-b1a-audit-gH5XJE/vitest.config.mjs
```

Exit 1: one genuine complete BL1 fixed-k=6 control passed with 810 banked / 125 lost cents; all five required rejection tests failed. This reproduced F1 resolution-before-action, F1 reused action ID, F2 burst money banked, F3 swapped visible labels and F4 altered manifest threshold with the original stored hash. The [before log](repair-f1-f4/direct-source-before.txt), [unaltered direct-source test](repair-f1-f4/direct-source-repro.ts.txt) and [audit report](repair-f1-f4/AUDIT-f7d5c13.md) are retained. Audit report SHA-256: `101275f01c2f76a2c2c973f4aa68501581f4213127065029f390907e6ee407f0`; reproduction source SHA-256: `e15c10ab60a8d11caa612e3c3ac623d6a48d1087f6e4ef4ad73e0431d228b5dc`.

### Repair and evidence

- `src/balloons/integrity.ts` replays the submitted ordered journal through the unchanged `startScoredSession` and `transition` functions. The initial event and each complete emitted action group must match every field exactly, including sequence, action ID, source, versions, IDs, stage, mapping, generations, headless validity, time/epoch, outcome and pre/post pump/cent totals. Duplicate, missing, reordered, split or trailing groups fail. Final state and every per-round result must equal the replay, including revision, next action ID, active-round totals, cumulative amounts, profile, visible Type, censoring and voluntary points. Legal transitions enforce the threshold and 32-pump cap boundaries and outcome-specific integer arithmetic.
- `src/balloons/manifests.ts` retains a private registry of approved immutable forms only after successful full hash verification. Report replay compares all submitted manifest fields and rounds with that authority, then uses the immutable canonical form. It never regenerates a played form. Detached genuine snapshots remain acceptable when their manifest data match; a retained hash string cannot authenticate changed bytes. The loader snapshots its input before asynchronous checks so it verifies and retains the same data.
- `src/balloons/report.ts` calculates supported values only from the reconciled replay. Existing conservation checks, §7 sample minima, exact median arithmetic, insufficient-evidence behavior, limitation text and candidate-safe projections remain in place.
- `src/balloons/report-integrity.test.ts` adds **64 focused tests**. They include F1–F4, every additional audit mutation, separate event-context fields, pre/post totals, final-state fields, missing/duplicate/split/trailing groups, invalid clocks/sources, altered form data, label/mapping contradictions, burst/voluntary/cap accounting and T=32/T=33 censoring. The private manifest snapshot across asynchronous checks has a regression. Genuine originals and detached copies pass, including mixed input sources and legal clock-epoch changes. All **297 fixed policies k=0..32 across nine forms** are checked against threshold-derived expected outcomes and integer totals. Separate fixtures retain the 4/5 category-voluntary boundary and early/late 2/3, 3/2 and 3/3 boundaries; existing tests retain half medians and supported/unsupported post-burst evidence.

The same unchanged external direct-source reproduction now exits 0: **all six tests pass** ([after log](repair-f1-f4/direct-source-after.txt)). The first new test run had one fixture mistake: its “changed” resolution source was already `mouse`; changing that probe to `keyboard` made it a real contradiction. No product change was made in response to that fixture error.

Final repository checks all exited 0 ([raw check output](repair-f1-f4/checks.txt)):

| Command | Result |
|---|---|
| `npm test` | 731 tests / 39 files pass; 73 Balloons tests across two files |
| `npm run balloons:check` | All nine scored forms, frozen file hash, regeneration/constraints and 36 pairwise review checks pass |
| `npm run lint` | Two inherited warnings only: `docs/qa/m5/repair-f1-f3/cross-tab.mjs:47` and `src/App.tsx:62` |
| `npm run build` | TypeScript, Vite client and existing analytics build pass |
| `git diff --check` | Pass |

Changed implementation files are `src/balloons/manifests.ts`, `src/balloons/integrity.ts` (new), `src/balloons/report.ts`, and `src/balloons/report-integrity.test.ts` (new). Documentation changes are this record, `IMPLEMENTATION_TRACKER.md`, and five retained audit/reproduction/check files under `repair-f1-f4/`. `core.ts`, contracts, frozen specifications/forms, generator/checker, Stop and unrelated B1 work are unchanged.

### Remaining boundaries

This is developer verification of the repair, not a fresh independent verdict. Request a separate read-only audit bound to the new commit SHA, covering F1–F4 and the broader contradiction/valid-control matrix. The earlier FAIL remains attached to `f7d5c13...`; founder B1-A acceptance, B1 completion, deployment and release remain open.

The synchronous report requires `loadScoredManifests()` to have successfully initialized the verified form registry in the current process. Replay proves internal agreement with legal headless transitions; it does not authenticate a user's physical actions, validate browser exposure or establish storage durability, ownership or chain eligibility. `headless_unconfirmed` events and `headless_complete` reports keep those limits. No React, storage, router, drill, retest-flow or other stage was added.
