# Independent read-only Balloons B1-A audit — FAIL

Audit date: 2026-10-03. Verdict applies only to **f7d5c13454485107b5057629b2f48342b53c1282**, immediate parent **5e254f3a1c339bd7aaadea87248d02690b60eab0**.

The headless core produces correct normal-path arithmetic, but its basic-report admission checks accept contradictory journals, unsupported outcome accounting, inconsistent category labels and altered manifest bytes. These fail the requested B1-A report-integrity boundary. This is not a browser, persistence, router, or whole-B1 verdict.

## Identity, scope and authority

HEAD and parent matched before testing and at final verification. Tracked/untracked porcelain status was empty before and after. `git diff --check 5e254f3a1c339bd7aaadea87248d02690b60eab0 f7d5c13454485107b5057629b2f48342b53c1282` passed. All 714 tracked files in the external archive were byte-compared with the unchanged working checkout after repository checks. No specification file differs from the parent.

Changed-file scope (nine paths):

```text
M	IMPLEMENTATION_TRACKER.md
A	docs/qa/balloons-b1-a/VERIFICATION.md
M	package.json
A	scripts/check-balloons-manifests.mjs
A	src/balloons/contracts.ts
A	src/balloons/core.test.ts
A	src/balloons/core.ts
A	src/balloons/manifests.ts
A	src/balloons/report.ts
```

Read AGENTS.md, the full Master Strategy, the Balloons V1.0 specification and both review documents, freeze record, tracker, developer verification, and all added implementation/test/checker code. Both packet JSON files were parsed in full; every scored row was regenerated and all 975 fixture action rows independently recalculated. Fixture router expectations and drill generators were not audited as B1-A features. The developer record was treated as a set of claims, with checks rerun independently. No product implementation occurred and no governing conflict was identified within this headless scope.

## Frozen packet hashes

All five actual hashes match the **frozen** hashes in FREEZE.md. Source-draft and frozen hashes are intentionally distinct where the freeze records wording-only changes.

| Frozen file | Independently computed SHA-256 | Result |
|---|---|---|
| ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` | PASS |
| ASSESSMENT_PRACTICE_BALLOONS_FORM_REVIEW_V1_0.md | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` | PASS |
| ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURES_V1_0.json | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` | PASS |
| ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURE_REVIEW_V1_0.md | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` | PASS |
| ASSESSMENT_PRACTICE_BALLOONS_SPECIFICATION_V1_0.md | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` | PASS |

## Blocking findings

### F1 — Completed-report journal checks do not establish ordered action replay

Location: `src/balloons/report.ts:129–164`, especially 137–145 and 150–163. Governing basis: Balloons §§3, 6, 7 and the developer claim that the report audits completed event ordering.

Create a genuine complete BL1 session using fixed policy k=6. The independent correct totals are **810 banked cents, 125 lost cents**. Its first round has T=1 and the events are `round_presented`, `pump_attempted` (burst), `round_resolved`. Exchange the last two events and renumber only sequenceNumber to maintain 1..N. The report still returns `headless_complete`, although resolution precedes its action.

A separate mutation replaces every non-null action ID with 1 and sets nextActionId=2. The report still accepts the completed 39-round history. Its action test permits equality throughout and checks only the final counter; it never establishes that repeated IDs belong exclusively to one accepted action's event group. Further independent mutations of successful-pump pre/current/post totals, event mapping, chain/stage/generations/validity, and final round/revision/current state are also accepted (raw states retained).

Impact: a report can describe a journal that could not be emitted by legal core transitions. Version/sequence checks and event counts alone do not reconcile the action ledger. This is a report calculation/admission failure already in B1-A; it does not require implementing IndexedDB or ownership machinery to reproduce.

Required repair boundary: reconcile ordered event groups, unique action progression, per-event pre/post transitions and final snapshot against the existing headless rules; refuse contradictory evidence before supported report generation.

### F2 — Conservation checks accept money banked on a burst

Location: `src/balloons/report.ts:173–181` and `:163`. Governing basis: Balloons §§4 and 7.

On the same genuine k=6 BL1 result, round 5 is T=4: four attempts, three successes, burst, **0 banked / 15 lost**. Change that result to **15 banked / 0 lost**, keeping outcome `burst`. Adjust state totals and resolution cumulative totals by +15 banked/-15 lost. The report returns `headless_complete` with **825 banked / 110 lost**, whereas the action sequence requires **810 / 125**. Both versions conserve 935 cents, demonstrating why conservation is necessary but insufficient.

The report lacks outcome-specific constraints: burst banks zero, voluntary/cap collection loses zero, cap requires exactly 32 successes, and threshold/outcome consistency must hold. The retained mutation also contains contradictory non-resolution journal totals, which F1 should independently refuse; F2 identifies the missing per-round arithmetic invariant.

Required repair boundary: enforce integer nonnegative outcome-specific cents/pumps/censoring and legal threshold/cap outcomes in addition to overall/category/block conservation.

### F3 — Candidate category labels are trusted instead of reconciled with mapping

Location: `src/balloons/report.ts:172` and `:182–187`; candidate review projection at `:126–127`. Governing basis: Balloons §§5 and 7.

Swap `Type 1` and `Type 2` in the completed results' visibleType fields, leaving the canonical BL1 mapping and all events unchanged. The report accepts the contradiction and labels profile-A numbers as Type 2 and profile-B numbers as Type 1. The per-round review repeats the incorrect labels. `round/profile mismatch` validates hidden profile against the manifest but omits the visibleType-to-mapping relationship.

Impact: correct underlying totals are attributed to the wrong candidate-visible category.

Required repair boundary: validate the stored mapping and every result label against it, including journal mapping consistency, before rendering the candidate projection.

### F4 — Report admission does not verify manifest content/hash

Location: `src/balloons/report.ts:168–172`, identity comparison at `:136`. Governing basis: Balloons §§4 and 6.

Clone the genuine completed BL1 state and change its first threshold from 1 to 2 without changing manifest.sha256 or journal identity. The report returns `headless_complete`; the recorded first-pump burst is now impossible under the supplied form. The loader/start boundary correctly rejects changed manifests, but basicReport neither revalidates content nor requires a currently verified manifest. Comparing two retained hash strings does not authenticate changed bytes.

Required repair boundary: establish the approved immutable manifest at report admission and reconcile outcomes against it. This does not require regenerating any played form.

## Independent positive evidence

- Separate Python implementation regenerated candidate seeds 0–34 from SHA-256 counter draws, rejection sampling, Fisher–Yates, order exclusions, inclusive threshold quartiles/sum bands and duplicate playable signatures. The first acceptances are **1, 3, 15, 16, 20, 23, 24, 33, 34**.
- All nine manifest objects, manifest hashes and playable-signature hashes exactly match. Each has 39 rounds/13 per profile and the seed-specific 4/4/5 blocks. All 36 pairwise playable differences are within 35–39. All fixed-k payouts and cap-survivor counts match the form review. Full per-form hashes are in regeneration-results.json.
- **326 complete independently checked sessions / 12714 rounds / 123949 accepted transitions.** Includes every fixed policy k=0..32 on all nine forms (297 sessions), RT manifests under each of the three stored cyclic mappings at the headless boundary, and additional sample/window cases. These RT data checks are not retest-chain implementation evidence.
- Per-round outcomes, bank/loss, attempts/successes, voluntary/censoring fields, all 39 rounds, total/category/block conservation and completion match separately calculated expected values. Every emitted event's type, grouping, sequence, versions, pre/post amounts and outcome was independently reconciled on these valid paths.
- T=1: 1 attempt, 0 successes, 0 banked/lost. T=32: 32 attempts, 31 successes, 155 lost, 0 banked. T=33: 32 attempts/successes, automatic cap collection of 160, no voluntary point. Zero-pump Collect remains voluntary at 0. Bursts preserve previously banked money.
- **18 invalid-action probes** refused duplicate/out-of-order/noninteger IDs, stale rounds/revisions, Next during active play, Pump/Collect after resolution, and all actions after completion, with state identity and contents unchanged. Invalid source/empty epoch tests throw. Normal mixed input-source records retain eligibility.
- BL/RP startup mapping accepts only the proper form-number rotation. All three cyclic mappings are accepted for each RT manifest; chain authority is outside scope. Seven packet mutations (threshold, hash, generator string, seed, signature, missing form, extra form field) are rejected by the committed loader.
- §7 full-category voluntary counts covered **0 through 13**, including 4/5; support begins at 5. Early/late comparison exercised 2/3, 3/2, 3/3 and higher boundaries, with exact medians and signed differences. Caps and bursts do not enter voluntary samples. Post-burst tests cover 0, 1 and 2 qualifying disjoint windows, differences 4/5/6, exact four-observation evidence, and overlapping raw windows suppressed to a single selected window.
- Incomplete state/missing results cannot produce a complete report in the exercised cases. Missing completion, missing presentation, incorrect event version and sequence gap are refused. The other targeted contradictions below are not.
- Candidate projection on valid runs contains no threshold, hidden profile, mapping, seed or manifest hash fields, including supported post-burst evidence. This verifies headless report data only, not any future React/history screen. No claim of hidden-threshold secrecy for arbitrary corrupted input is made.

## Mutation disposition

Each mutation starts from a separate clone of the genuine k=6 BL1 completed state. These are deliberate integrity probes, not claims that normal gameplay generated corrupt data.

| Probe | Actual report disposition |
|---|---|
| missing-final-event | Refused |
| missing-presentation | Refused |
| version-mismatch | Refused |
| sequence-gap | Refused |
| missing-result | Refused |
| resolve-before-action | **Incorrectly accepted** |
| reused-action-id-everywhere | **Incorrectly accepted** |
| contradictory-pump-totals | **Incorrectly accepted** |
| wrong-event-mapping | **Incorrectly accepted** |
| wrong-event-context | **Incorrectly accepted** |
| wrong-visible-category | **Incorrectly accepted** |
| changed-manifest-threshold | **Incorrectly accepted** |
| contradictory-current-state | **Incorrectly accepted** |
| burst-money-banked | **Incorrectly accepted** |

## Reproducibility and repository checks

Artifacts, copied dependencies, caches and builds are outside the repository at `/tmp/balloons-b1a-audit-gH5XJE`. Node v24.13.1 / npm 11.8.0. `checkout/` is a git archive of the exact target, with a physical dependency copy (no symlink or hardlink into the original checkout).

Run independent generation and the broad headless oracle:

```sh
python3 /tmp/balloons-b1a-audit-gH5XJE/regenerate.py
node /tmp/balloons-b1a-audit-gH5XJE/prepare.mjs
node /tmp/balloons-b1a-audit-gH5XJE/audit.mjs
```

prepare.mjs performs TypeScript transpilation and module-resolution adaptations only on external files. To confirm failures without that adaptation, the following tests import the original untouched repository TypeScript through Vitest:

```sh
/tmp/balloons-b1a-audit-gH5XJE/checkout/node_modules/.bin/vitest run --config /tmp/balloons-b1a-audit-gH5XJE/vitest.config.mjs
```

Expected current result: **1 valid control passes; 5 required-integrity rejection tests fail** (F1 order, F1 action ID reuse, F2 burst money, F3 visible labels, F4 manifest mutation). Exit 1 is the retained audit failure, not a harness or compilation error. See direct-source-repro.log and repro.test.ts.

Repository `npm run check` was rerun in the exact external archive and exited 0: lint (two inherited warnings at docs/qa/m5/repair-f1-f3/cross-tab.mjs:47 and src/App.tsx:62), **667 tests in 38 files**, 14 Stop forms, five Stop drills, TypeScript and both production builds. `npm run balloons:check` separately exited 0. Logs: repository-checks.log, developer-manifest-check.log. The check command does not include balloons:check; it was explicitly run in addition.

Harness correction: the initial broad oracle evaluated a stateful test-policy callback twice, making its intended actions disagree with its expected rows. That harness-only failure is retained in harness-initial-policy-error.log. The corrected harness materializes each intended plan once, then independently calculates outcomes and submits actions from it. Product source was unchanged; the final broad run and direct-source reproductions are the reported evidence.

## Status boundaries and limits

| State | This audit's disposition |
|---|---|
| B1-A implementation | Present at the target; four report-integrity findings remain |
| Developer testing | Claims independently rerun; repository suite passes |
| Independent B1-A audit | **FAIL at f7d5c13454485107b5057629b2f48342b53c1282** |
| Founder B1-A acceptance | Pending; not granted by this audit |
| Full B1 completion | Open; B1-A is only the headless subset |
| B2 router/drills/retests | Not assessed as implemented or completed |
| B3 browser/device/accessibility qualification | Open; not attempted here |
| Deployment | Not performed |
| Release | Not performed/approved |

A headless `round_presented` is an in-memory transition record. Every emitted event is explicitly `headless_unconfirmed`. It proves neither a browser display nor durable exposure. `headless_complete` is not a durable valid baseline. No React UI, canonical native click, held-key suppression, frame-confirmed display, IndexedDB, cross-tab ownership, exposure/recovery, drill/router/retest chain, mock/history integration, physical timing or device qualification has been closed by this work. These are scope exclusions, not additional B1-A failures.

No repository edit, commit, push or deployment occurred. The target, parent, clean status and full tracked byte identity were rechecked after tests. A changed SHA requires a fresh audit; this FAIL stays bound to the named target.
