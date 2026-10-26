# Independent exact-SHA Balloons B2-A audit

**Verdict: PASS for the bounded headless B2-A foundation. No in-scope blocking defect found.**

Target: `abc5136eb2033eaa6b8345ad658bf057b581895e`
Immediate parent: `ae0a52a61595e0a881274ab4d8b02117c609178e`
Audit date: 2026-10-04, America/New_York.

**The full repository test run was not entirely green:** 982/983 tests passed; one unchanged Stop focus assertion failed. This is retained as observation OBS-1 below and is not represented as a successful aggregate check. The B2-A verdict is limited to the reviewed new headless subsystem and its independently verified behavior. It is not a whole-repository PASS.

## Identity, read-only boundary and authority

HEAD, its single immediate parent, and empty tracked/untracked status were verified before work and again afterward. Every tracked working file was SHA-256 inventoried and remained byte-identical. No repository file was edited and no Git mutation, commit, push or deployment occurred. All audit code, outputs, logs, build caches and artifacts are under `/private/tmp/balloons-b2-audit-abc5136/`.

Checks ran against a `git archive` of the target with a separate copy-on-write clone of the installed `node_modules`, not a dependency symlink. Every archived tracked file was compared to the clean original before independent harness additions. This permits build/test outputs without writing into the audited checkout. Runtime: Node v24.13.1; npm 11.8.0.

The 21 changed paths comprise five headless production modules, five test/support modules, one independent drill checker, one package script change, the tracker, and eight QA files. No pre-existing Balloons product source, Stop product source, App, stylesheet, lockfile or governing specification changed. The package change extends only `balloons:check`. The new production modules have no candidate UI consumer. All 13 fresh client/disabled-analytics build outputs match the retained parent build-hash register; the parent build was not rerun in this audit.

Read AGENTS.md, the complete Master Strategy, complete Balloons V1.0 specification, both reviews, complete tracker, B2 QA plan and VERIFICATION.md. Both JSON companions were fully parsed and their relevant rows evaluated. Developer tests, oracle, checker and QA claims were reviewed as claims, not accepted as independent evidence.

The five frozen files match both the freeze register and parent bytes; all five original approved source hashes also match the files in the recorded source directory. Master Strategy SHA-256 is `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`.

| Frozen Balloons artifact | SHA-256 |
|---|---|
| Specification | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| Fixed manifests | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| Form review | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| Router fixtures | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| Fixture review | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |

Identity and full per-file hashes: [initial](audit/identity.json), [final](audit/final-state.json), [changed paths](audit/changed-files.txt).

## Independent reconstruction and adversarial results

A new Python oracle imports no repository production or test implementation. It reads profile, threshold and intended action, simulates every pump, then derives observations and routing. Stored outcome/expected fields are compared only after reconstruction. A separate TypeScript audit invokes production APIs and compares their outputs to that oracle.

- **25 fixtures / 975 rounds:** all observed outcomes, money, attempts, successes, voluntary points, censoring and stored expected fields agree. Round/profile/block counts, support, quarter coverage, sum bands, order exclusions and overall/per-category conservation pass.
- **31,200 additional single-action substitutions:** every other intended-pump value 0–32 at each round of each fixture. Production matches the complete independent evidence object, not merely the selected route. This includes all 30 four-observation windows and overlap exclusions, all six ordered pairs, exact denominators, medians/quartiles, evidence choices and exclusions. These are mutations of legal synthetic fixture forms, not admitted production baselines.
- Exact five-pump outcome differences, two disjoint windows, consecutive same-category matching, three early-burst/late-median differences for information, two-burst/two-pump-range differentiation, minimum three late voluntary points, minimum eight consistency points and six-pump IQR all behave as specified. Fractional medians/IQR remain unrounded. Burst/cap observations never substitute for voluntary points. Evidence ties use the specified early difference, late difference, IQR, voluntary count and alphabetical ordering; first-true route priority is preserved.
- **500 independent exploratory order perturbations:** preserve each profile's chronology and every 13-round block's profile counts; full production evidence agrees with the oracle, with 0/500 primary routes changed. This is an observation under that constrained perturbation, not calibration, statistical significance or a new acceptance threshold.
- **Seven drill inventories regenerated independently in Python from seed zero through first acceptance:** outcome 22, information 7, updating 5, consistency A/B/C 0/0/0, maintenance 1. Every row, seed and canonical manifest hash matches. Supports, mixed 2-per-profile blocks, single-profile 18-round variants, run/alternation restrictions, quarter coverage and threshold-sum bands pass. Edited, reordered, missing, wrong-version and self-rehashed inventory substitutions reject. Input mutation during asynchronous loading cannot alter the admitted copy; admitted rows are frozen.
- **321 complete drill runs / 5,778 independently simulated rounds / 963 feedback boundaries:** all seven inventories, all 33 constant policies on BL1, varied/extreme policies on BL2/BL3, repeated attempts and sparse consistency cases. Visible types retain the baseline mapping. T=1, T=32 and T>32, zero collection, burst-before-increment, cap collection and money conservation reconcile.
- **27 explicit zero/one/two-voluntary consistency cases:** range/IQR suppressed below two and correctly calculated at two. Feedback matches only completed prefixes at 6/12/18. Outcome pairs use the immediately next same-category voluntary collection without skipping intervening outcomes, retaining only the latest supported pair per profile. Both outcome demos are unscored and precede Start. Card/demo/feedback projections disclose no hidden threshold, manifest or baseline-core data. Raw internal records are not safe candidate-facing projections.
- **All 64 phase/control combinations**, represented by 2,736 checked controls across plans: illegal controls, terminal controls, duplicate action IDs and stale revisions/rounds reject without a new state. Pause/resume preserves the committed round/prefix and supports a fresh epoch. Invalid attempts require restart from round one with the same inventory and a fresh ID; supplied previously started attempts produce familiar labeling. Mixed supported input sources remain valid. Invalid clocks/sources and unreconciled imported objects reject.
- **1,449 inconsistent record edits:** sampled header, snapshot, event identity/version, pre/post state, time, command, duplicate/missing/completion events and result edits reject under canonical replay. This proves internal consistency checking, not cryptographic proof of human actions. A coherently rewritten non-scoring timestamp can remain valid; settings that replay internally are still rejected when they contradict the current baseline.
- **399 authority rejection cases across 21 genuine headless BL plans:** missing/unsaved/deleted/invalid/corrupt baseline or drill, replacement installation, chain tombstone/closure, missing/stale chain, changed baseline settings/history, changed attempt identity, route and incomplete/invalid drill all withhold eligibility. Genuine report-view append alone preserves the recommendation binding. First completion proposes the lock; re-evaluation against that locked authoritative chain is idempotent, stale unlocked chains reject, repeats cannot grant a second first completion, and deletion withdraws eligibility.

Evidence: [oracle](audit/oracle.py), [primitive reconstruction log](audit/oracle.log), [21 independent baseline plans](audit/plans.py), [independent test driver](audit/independent.test.ts), [passing log](audit/independent.log), [counts](audit/counts.json), [authority case results](audit/authority-results.json), [ordering log](audit/ordering.log). The 25 reconstructed evidence objects and 31,200 mutation objects are retained alongside the scripts.

The first audit-harness tamper assertion incorrectly assumed `structuredClone` broke shared references: editing an event time also edited its aliased command time. That coherently changed legal time was accepted. The harness was corrected to JSON round-trip the record before independently editing event fields. No product code or expected product rule was changed. [Initial harness log](audit/independent-initial.log) is retained.

## Pure eligibility is not a durable RT entitlement

Confirmed at this scope: `completedDrillEligibility` evaluates caller-supplied snapshots and returns an **in-memory proposal**. It neither writes storage nor reserves/exposes an RT. Calling it twice with the same unlocked authority returns `firstGrant: true` twice, while leaving authority unchanged. Only supplying the proposed lock as the current chain makes the subsequent evaluation return `firstGrant: false`; presenting the old chain against that current authority rejects.

Therefore `status: 'eligible'` must never be treated as evidence that a grant was persisted. The API comments, verification record, `headless_unconfirmed` event codes and absence of UI/durable consumers preserve this boundary in B2-A. A future adapter must read complete fresh authority, atomically compare and persist the first-completion lock, revalidate after asynchronous work/deletion/replacement, and implement RT reservation and exposure separately. Cached authority, omitted tombstones/history or a fabricated saved-drill map cannot establish actual durability. This audit does not certify such an adapter.

## Repository checks, run once

| Check | Result |
|---|---|
| `npm run check` | Exit 1: lint passed with two inherited warnings; tests 982 passed / 1 failed, 46 files passed / 1 failed |
| B2 tests within that run | All 162 passed |
| `npm run forms:check` | Pass: 14 Stop manifests |
| `npm run drills:check` | Pass: five Stop drills |
| `npm run build` | Pass: TypeScript, client and disabled-analytics builds |
| `npm run balloons:check` | Pass: nine scored manifests and seven drills |
| Target-vs-parent `git diff --check` | Pass |

The aggregate command stopped after its test failure. Forms, drills and build were then invoked once separately; lint/tests were not repeated. The separate independent audit harness is additional audit evidence, not a rerun of the repository suite.

Logs: [aggregate](repository-checks.log), [remaining checks](remaining-checks.log), [Balloons checks](balloons-check.log).

### OBS-1 — unchanged Stop focus assertion failed; outside B2-A

At `src/stop/Journey.test.tsx:25`, “offers a verified shortcut while retaining current setup and journaling only the chosen path” expected the “Remember the Stop rule” heading to have focus; the recorded focused element was `<body>`. Reproduction command and failing output are in `repository-checks.log` (`npm run check`, executing `vitest run`). This is a recorded single-run failure, not a claim that every repetition will fail. It was not retried or repaired.

The test and `src/stop/Journey.tsx` are byte-identical to the parent, B2 modules have no path into the candidate bundle, and the fresh bundle matches the retained parent hash. The heading focus is assigned in an effect, but the cause of this particular assertion failure has not been independently established. It must not be dismissed as proven flakiness. It is non-blocking for the narrowly specified headless B2-A verdict; the full repository check remains failed and merits separate Stop/test follow-up.

## Exact limits

This PASS applies only to `abc5136eb2033eaa6b8345ad658bf057b581895e` against its named parent and the described headless B2-A behavior. Synthetic API runs prove arithmetic, state transitions, internal replay and supplied-authority rules; they do not prove actual presentation, persistence, ownership or save success.

No training UI, persistence adapter/schema, retest reservation/allocation/expiry/exposure/comparison, mock integration, real-browser or browser/device/accessibility qualification, founder acceptance, deployment or release is covered. Whole B1/mock, the separately recorded B1 N1, full B2 and B3 remain open. This audit does not extend an older audit verdict or create a release approval.

## Reproduce the independent audit

From `/private/tmp/balloons-b2-audit-abc5136/`:

```sh
python3 audit/oracle.py
python3 audit/plans.py
./node_modules/.bin/vitest run --config audit/vitest.config.ts
python3 audit/ordering.py
./node_modules/.bin/vitest run --config audit/order.config.ts
```

The retained archived source and isolated dependencies permit these commands without touching the original repository. The oracle's mutation file is approximately 387 MiB. Repository checks can be reproduced with the commands in the table, but were deliberately run only once during this audit.
