# Independent read-only Balloons B1-A repair audit — PASS

Date: 2026-10-03 (America/New_York).

**PASS applies only to target `a1d0b808c442c5f0bd73af55a7d74e905f3c47cf`, immediate parent `f7d5c13454485107b5057629b2f48342b53c1282`, within the F1–F4 headless report-integrity repair scope.** No remaining blocker was reproduced in that scope. The earlier FAIL remains bound to the parent.

This is an independent audit of the submitted repair. Developer verification and passing tests were treated as claims. Expected arithmetic, event groups, evidence thresholds and outcomes were calculated separately from the production replay implementation. No repository file was edited and no repair was implemented.

## Identity, authority and unchanged scope

- Exact HEAD, immediate parent and empty tracked/untracked porcelain status verified before testing and rechecked afterward. `git diff --check HEAD^ HEAD` exits 0.
- All **721 tracked files** retain their initial SHA-256 hashes. All 721 also byte-match the external target archive after its tests/build. Evidence: [initial hashes](initial-tracked-hashes.json), [initial identity](identity-before.txt), [final identity and scope](identity-after.json).
- Read AGENTS.md, complete Master Strategy, approved Balloons V1.0 specification, freeze, tracker, both packet review documents, developer verification, retained parent audit, direct-source reproduction and before/after/check logs. Parsed both packet JSON files and independently recomputed all 975 fixture action rows. Router selection and drills are not implementation claims of this audit. No governing conflict was identified within this scope.
- The target changes only `integrity.ts`, `manifests.ts`, `report.ts`, one new report-integrity test file and the seven QA/tracker paths listed in [diff.txt](diff.txt). All governing files, forms, generator/checker, `core.ts`, contracts, existing core tests, dependencies and Stop code are unchanged from the parent. No UI, native input adapter, storage, ownership, exposure, recovery, router, drill, retest-flow, mock/history, analytics activation or other excluded B1 implementation was added.

All five packet file hashes were independently matched to the frozen column of FREEZE.md; the Master Strategy hash also matches the retained governing identity. [Full hash evidence](hashes.json):

| File | SHA-256 |
|---|---|
| Balloons V1.0 specification | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| Fixed manifests | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| Form review | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| Router fixtures | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| Router fixture review | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |

## F1–F4 disposition and reproducible evidence

| Finding | Result and source locations | Independent evidence |
|---|---|---|
| F1: ordered groups, unique actions, context/totals and final state | **PASS.** [integrity.ts:46](</Users/renzo/Documents/Assessment Practice/App/src/balloons/integrity.ts:46>) checks the initial event; lines 49–64 infer and replay each complete action group, compare every contracted field, and reject illegal progression. Lines 68–70 require a completed replay and exact final snapshot agreement. [report.ts:134](</Users/renzo/Documents/Assessment Practice/App/src/balloons/report.ts:134>) gates supported calculations on reconciliation. | Original resolution-before-action and reused-action-ID failures now reject. Missing, duplicated, split, reordered, trailing and skipped groups reject after sequence renumbering. Separate context and all ten pre/post-total changes on ten representative event positions reject; final identity, revision, next-action counter, current totals and round results must agree. |
| F2: outcome-specific arithmetic, attempts, censoring, thresholds/cap | **PASS.** Replay uses unchanged [core.ts:106](</Users/renzo/Documents/Assessment Practice/App/src/balloons/core.ts:106>) through line 127 for threshold/cap transitions and lines 132–140 for outcome accounting/censoring; [integrity.ts:70](</Users/renzo/Documents/Assessment Practice/App/src/balloons/integrity.ts:70>) reconciles every result. | Original 15 burst cents moved to bank rejects. A stronger variant adjusting all applicable journal cumulative totals plus final state still rejects despite preserving 935 total cents. Negative, fractional, NaN, infinite and oversized result counts/amounts reject. Cap relabeled voluntary and T=32 burst relabeled cap reject. Independent valid-path arithmetic covers all k=0..32 on all nine forms. |
| F3: stored mapping, journal mapping and visible Type labels | **PASS.** [integrity.ts:37](</Users/renzo/Documents/Assessment Practice/App/src/balloons/integrity.ts:37>), lines 47/64/70 reconcile identity, every event and results. Unchanged [core.ts:74](</Users/renzo/Documents/Assessment Practice/App/src/balloons/core.ts:74>)–78 enforce BL/RP form-number mappings; line 135 derives visible labels. | Original swapped labels, journal-only mapping, identity-only mapping, and a coherently rewritten illegal BL mapping all reject. Nine RT/cyclic-mapping positive sessions and all BL/RP form rotations agree with independently derived visible labels and category totals. This does not establish RT chain authority. |
| F4: altered bytes retaining an approved hash | **PASS.** [integrity.ts:31](</Users/renzo/Documents/Assessment Practice/App/src/balloons/integrity.ts:31>)–32 compares submitted manifest data to verified immutable authority. [manifests.ts:113](</Users/renzo/Documents/Assessment Practice/App/src/balloons/manifests.ts:113>)–146 snapshots input, checks approved/content hashes, freezes forms and publishes the registry after the whole load succeeds. | Original T=1→2 mutation rejects. Also rejected: an unreached threshold change, a threshold change above cap preserving playable signature, changed IDs/family/seed/hashes, round order/profile changes and extra/missing fields. A failed last-form load cannot partially initialize or poison the registry; changing caller input during hashing or changing the returned Map cannot replace canonical form bytes. |

The retained six-test reproduction is byte-identical to the committed original (`e15c10ab60a8d11caa612e3c3ac623d6a48d1087f6e4ef4ad73e0431d228b5dc`). It imports untouched repository TypeScript directly. A separate external parent archive runs the same test body with only source import paths changed:

- **Parent:** 1 genuine control passes, all 5 required-rejection tests fail. [Fresh parent log](parent-repro.log).
- **Target:** all 6 original tests pass. The same invocation includes 20 new focused tests containing **479 separately recorded adversarial mutations; all 479 reject**. [Direct-source log](direct-source.log), [probe source](adversarial.test.ts), [each mutation and refusal reason](adversarial-results.json).
- All 14 original retained parent mutation snapshots are refused on target, including the combined context/totals/final-state cases. Missing results produce insufficient evidence rather than a supported complete report. [Retained states](retained-parent-mutations/), [fresh broad dispositions](audit-results.json).
- One additional isolated direct-source test verifies fresh-process behavior: detached complete data are refused before loading verified forms, remain refused after a failed partial load, and become accepted after a successful full verified load. [Registry test](registry.test.ts), [log](registry.log).

## Independent positive oracle and §7

The reviewed parent audit oracle was rerun against the target, strengthened to compare every event's remaining identity/source/time fields and both structured-cloned and JSON-round-tripped reports. It calculates expectations from the specification and frozen thresholds, not by calling production transition/reconciliation functions for expected results. Production transitions are used only to generate the system-under-test sessions.

**326 complete sessions, 12,714 rounds and 123,949 accepted actions** reconcile. This includes 297 combinations of nine forms × fixed k=0..32, nine RT/cyclic-mapping sessions, and 20 sample/window boundary sessions. Each session's original, structured clone and JSON-detached snapshot produces the same correct report. Extra direct-source controls cover reordered object keys, all four action sources and legal clock-epoch changes. Eighteen invalid/stale/duplicate/wrong-control actions leave the state and journal unchanged.

For threshold T and intended fixed k, independently compute burst when T≤min(k,32); successes are T−1 for burst and min(k,32) otherwise. Attempts equal successes plus one only for burst. Burst banks zero and loses 5×successes; other outcomes bank that amount and lose zero. A surviving 32nd pump is cap collection, with no voluntary point. The oracle reconstructs presentation, pump, cap/voluntary collection, resolution and completion groups; derives pre/post totals, unique action progression, context and final state; then compares totals, categories, blocks and candidate review rows.

| Boundary | Required and observed result |
|---|---|
| BL1 fixed k=6 | 810 banked / 125 lost cents; 935 cents = 5×187 successes |
| T=1, first attempted pump | 1 attempt, 0 successes, burst, 0 banked / 0 lost |
| T=32, pump through boundary | 32 attempts, 31 successes, burst, 0 banked / 155 lost |
| T=33, pump through cap | 32 attempts/successes, cap, 160 banked / 0 lost, censored, no voluntary point |
| Zero-pump Collect | Voluntary at point 0, 0 banked / 0 lost |

§7 checks at [report.ts:83](</Users/renzo/Documents/Assessment Practice/App/src/balloons/report.ts:83>)–125 retain:

- Full-category voluntary counts 0 through 13; median support starts at 5, with explicit 4/5 cases and exact half-pump medians. Burst/cap observations remain excluded from voluntary samples.
- Early/late comparisons require 3 in each segment; 2/3 and 3/2 suppress, 3/3 supports. Exact medians and signed late-minus-early differences match independent arithmetic.
- Post-burst differences at 4/5/6, zero/one/two qualifying windows, actual four-observation evidence, and greedy disjoint selection. Two raw windows sharing a same-category observation count as one and suppress the supported statement.
- Correct per-round/overall/category/block integer accounting and 39/13 denominators. Candidate report trees contain no hidden threshold, profile letter, mapping, manifest hash or seed fields, including supported post-burst evidence. The fallback observation and exact task-only limitation remain unchanged.

Evidence: [independent oracle](audit.mjs), [full results](audit-results.json), [log](audit.log). Separate Python regeneration recomputes candidate seeds 0–34, the first nine accepted seeds `1,3,15,16,20,23,24,33,34`, all form/signature hashes and 36 pairwise differences. Fixed-policy payout and cap counts agree with the approved review. It also recalculates all 975 synthetic fixture action rows; it does not qualify the unimplemented router. [Regeneration source](regenerate.py), [results](regeneration-results.json).

## Repository checks and reproducibility

All build artifacts, dependency copies, test caches, fixtures and logs are outside the repository at `/private/tmp/balloons-b1a-repair-audit-bpf6x44e`. `checkout/` is a `git archive` of the exact target with a physical dependency copy; `parent/` is a separate archive of the named parent. Node v24.13.1 / npm 11.8.0.

| Command/check | Independent result |
|---|---|
| `npm test` | 731 tests / 39 files pass, including 73 Balloons tests; [log](test.log) |
| `npm run balloons:check` | All nine forms, frozen hash, regeneration, constraints and 36 pairwise checks pass; [log](balloons-check.log) |
| `npm run lint` | Exit 0; only two inherited warnings at `docs/qa/m5/repair-f1-f3/cross-tab.mjs:47` and `src/App.tsx:62`; [log](lint.log) |
| `npm run build` | TypeScript, Vite client and existing analytics builds pass; [log](build.log) |
| Direct original + new probes | 26 tests pass, including all 479 adversarial mutations; [log](direct-source.log) |
| Fresh-process registry | 1 test passes; [log](registry.log) |
| Exact identity/cleanliness/bytes | Target and parent match, porcelain empty, 721 tracked hashes unchanged and byte-identical to tested archive |

Reproduce the independent checks:

```sh
python3 /private/tmp/balloons-b1a-repair-audit-bpf6x44e/regenerate.py
node /private/tmp/balloons-b1a-repair-audit-bpf6x44e/prepare.mjs
node /private/tmp/balloons-b1a-repair-audit-bpf6x44e/audit.mjs
/private/tmp/balloons-b1a-repair-audit-bpf6x44e/checkout/node_modules/.bin/vitest run --config /private/tmp/balloons-b1a-repair-audit-bpf6x44e/vitest.config.mjs
/private/tmp/balloons-b1a-repair-audit-bpf6x44e/checkout/node_modules/.bin/vitest run --config /private/tmp/balloons-b1a-repair-audit-bpf6x44e/registry-vitest.config.mjs
```

`prepare.mjs` only transpiles TypeScript and adapts imports in the external `compiled/` directory. The original failures and new probes separately use original repository TypeScript without that adaptation. For the expected parent failure, use `parent-vitest.config.mjs`; expect exit 1 and exactly five failed assertions. To repeat repository checks, run the four npm commands in the external `checkout/` directory.

Harness disclosure: the first extraction attempt used a Python `tarfile` argument unsupported by the installed Python; it failed before extraction and was rerun with the compatible API. The initial new probe suite's own change-detection assertion used Vitest loose equality, which ignores an added `undefined` field. It failed before calling the product for that probe. Changing only that external guard to strict equality allowed all five extra-undefined-field probes to execute and reject. [Retained initial harness log](harness-initial-undefined-equality.log). No product source changed in response.

## Limits and open gates

Replay establishes internal consistency with legal headless transitions and approved form bytes. It does not authenticate a person's physical actions or establish browser display, storage durability, exposure, ownership or chain eligibility. The current process must successfully call `loadScoredManifests()` before synchronous report admission; fresh-process refusal until that step is verified behavior, not a durable-storage implementation.

All generated events retain `headless_unconfirmed`; complete reports retain `headless_complete`. No browser or physical-device test was used to convert these into a valid baseline. Candidate threshold-free data projection was audited, not an unimplemented Balloons UI/history screen. Consistent rewrites of a whole legal history are not cryptographically authenticated by this repair.

Founder B1-A acceptance remains open. Full B1 completion, B2 Advanced Training and B3 browser/device/accessibility and storage qualification remain open. No deployment, release, push, commit, analytics activation or specification revision occurred or is approved by this PASS. A changed SHA requires a fresh audit.
