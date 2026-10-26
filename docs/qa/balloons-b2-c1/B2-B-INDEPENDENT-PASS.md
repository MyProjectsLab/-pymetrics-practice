# Independent Balloons B2-B F1–F5 repair audit

**Verdict: PASS for the focused F1–F5 repair and the affected regressions described below. No in-scope blocking defect found.**

Target: `d1a40ceded441491142dd1ccd6bb8b6c21afd796`
Single immediate parent: `0273e9a1ef3df307d2a45573380a0b698873a5bc`
Audit date: 2026-10-04, America/New_York.

This is a new independent, read-only, SHA-bound audit. It does not turn developer checks into independent evidence or extend a previous audit verdict to this commit without testing.

## Identity, scope and frozen authority

Initial and final HEAD/parent match the requested identities; both Git status readings are empty. All **822 tracked working files remain byte-identical** to the initial SHA-256 inventory. The external source archive's corresponding 822 files also remain byte-identical. No source, specification, tracker, Git state, installed repository dependency, commit, push, deployment or release was changed.

All harnesses, logs, captured roots, browser profiles, generated caches and builds were created outside the repository. Checks ran against `git archive` of the target with a separate copy-on-write copy of installed dependencies. The archive was compared against every tracked original file before checks. No audit harness was present during the repository check. See [identity](identity.json), [initial inventory](initial-hashes.json), [final state](final-state.json), [build hashes](build-hashes.json), and [diff hygiene](diff-check.log).

The change has **27 paths**: five production files (`Journey.tsx`, `TrainingJourney.tsx`, `drills.ts`, `storage.ts`, `training-storage.ts`), the adapter test file, the tracker, and twenty QA files. Production/test changes were inspected; the exact scope is retained in `identity.json`. No governing document, Stop source, stylesheet, package/lockfile, router mathematics, inventory or feedback calculation changed.

Read repository `AGENTS.md`, the Balloons V1.0 specification and both reviews, parsed both JSON companions, the original external FAIL audit, the repair `VERIFICATION.md`, the retained B2-A independent audit, relevant Master Strategy authority/storage/training/accessibility/mock sections, and current/historical tracker gates. Developer claims informed probe selection only.

All five Balloons hashes match the freeze register and immediate-parent bytes. The five original source files in the freeze register were also rehashed and match their approved source hashes. Full source/frozen pairs are in [frozen hashes](frozen-hashes.json).

| Frozen artifact | SHA-256 |
|---|---|
| Specification | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| Fixed manifests | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| Form review | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| Router fixtures | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| Fixture review | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |

Master Strategy remains `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`.

## F1 — PASS: complete deletion and old-installation fences

Independent adapter checks completed an attempt whose chain contains `recommendation.baselineCore`, then deleted all data. The replacement has exactly the fresh-root keys; no optional training tree, chain, journal or embedded baseline remains. Installation changes; records/tombstones are empty; owner is null and generation zero. The normal backend revision increment is retained.

Assignment, action, pause and invalid-restart calls from the old installation reject without changing replacement bytes. Actual browser Delete all was also exercised at held assignment delivery, held final-action delivery and the second post-save authority read. The whole replacement root remains equal after old callbacks are released. Individual-result deletion separately withdraws eligibility. These checks include notification-disabled deletion/replacement at the delayed final authority read.

Evidence: [adapter assertions/log](source/audit/independent.test.ts), [adapter results](audit/independent.log), [browser race results](audit/fault-results.json), [notification-disabled results](audit/edge-results.json), and `audit/replace-{assignment,final,verified-read}.{json,txt}`.

## F2 — PASS: exclusive ownership and restart idempotency

A second tab cannot acquire the active drill, including after both polling intervals. A healthy owner poll preserves focus and journal state. Pause releases the browser lock; a new tab acquires a greater durable generation, recovers the same attempt as paused, and must Resume before acting. The old tab cannot act or resume while the new owner holds the lock. Reload recovers the identical committed journal prefix and adds the expected pause boundary.

Independent capability probes obtain a fresh observer snapshot after release, changed owner ID, changed attempt ID, changed generation and replacement-owner acquisition. The old capability still rejects action, owner-authorized read, assignment and pause; polling does not mint ownership. An injected replacement generation during held action delivery similarly withholds controls and ignores the late callback without changing authoritative bytes.

The existing Practice owner and drill owner exclude each other in both directions through actual candidate controls. The Practice guard accepts a native Space action after leaving training. The corresponding RP journal records keyboard input.

Invalid-restart probes create one successor with the same inventory, round one, no inherited result or completion lock, and familiar labeling after a started invalid attempt. Repeated old-ID restart returns that successor. A second call while the first transaction delivery is held rejects rather than creating another live attempt. After completion, old-ID restart returns the first completed attempt; there remain exactly two records (invalid original plus successor), and one first-completion lock.

Evidence: [ownership capture](audit/ownership.json), [shared Practice owner](audit/shared-practice-owner.json), [restart root](audit/restart.json), [owner replacement](audit/owner-replaced.json), adapter and browser result files.

## F3 — PASS: native focus, Type identity and announcements

All seven inventories were completed through automated native Space/Enter button activation. Focus transfers from Start/Next/Resume to Pump, from collection/burst/cap to Next or Continue at feedback, and from final completion to Balloons history. Both outcome examples and the ready phase have the expected next action focus. Healthy polling does not remove focus from Collect. Reloaded completed attempts preserve their journal and focus the history action.

Visible Type labels and `pattern-1/2/3` identities match each inventory's hidden profile under the stored baseline mapping. Verbose live-region text independently matches Type, current cents, banked total, successful pumps and all three resolution kinds throughout seven runs. Standard mode was tested from a fresh **unseeded 39-round Practice baseline**: successful Pump changes durable/visible value but leaves the polite announcement unchanged; collection and the next round update it correctly. Demo/ready/paused state messages are also present. This verifies DOM announcement semantics, not actual screen-reader speech.

Held Enter across collection/focus transfer does not activate Next; held Space across blur, pointer Resume and release does not pump. A fresh press then succeeds. The enclosing Practice guard works again after leaving training, and the full fresh baseline provides an additional native-keyboard control.

Evidence: [journey results](audit/journeys-results.json), [standard-mode results](audit/supplement-results.json), [held-key root](audit/held-keys.json), [fresh baseline](audit/fresh-baseline.json), [inspected focus/pattern screenshot](audit/standard-type.png), and per-inventory 6/12/18 text captures.

## F4 — PASS: immediate fences, committed-prefix pause and recovery

Injected blur and hidden events immediately fence an additional same-task control activation; no extra action appears. The durable pause preserves the last committed round, pumps, money and results. Resuming requires a fresh activation and current ownership. Recovery was checked at demo, ready, active, resolved, feedback and completed phases. A completed attempt stays complete and preserves its lock.

Blur while Pump, Collect, Next, Start, example-next or final-action delivery is held pauses the actual committed prefix, rather than the stale UI snapshot. Releasing each callback changes neither the durable state nor the restored control state. A blur injected before the action `put` aborts that action and durably pauses the earlier prefix. A separate actual failed Pump transaction also preserves the prior prefix and pauses it.

An aborted pause transaction produces “Pause needs checking,” hides gameplay controls and does not claim a saved pause. Fresh reopening recovers it. A held pause authority read likewise withholds controls and saved-pause copy even though the write itself committed; late delivery cannot republish the old operation. Owner replacement and deletion during pending work fail closed.

Evidence: [24 browser scenarios](audit/fault-results.json), [8 additional edges](audit/edge-results.json), [unavailable authority](audit/supplement-results.json), and `audit/pending-*`, `audit/precommit-blur.*`, `audit/abort-pump.*`, `audit/pause-failed.*`, `audit/pause-unavailable.*`.

## F5 — PASS: installation-wide familiarity, chain-specific selection

Independent canonical two-baseline records exercise prior ready/unstarted, started, invalid-after-start and completed attempts. Only started uses count as familiar. A second chain receives its own empty attempt and null completion slot while the previous chain/attempt remains unchanged. The actual UI displays familiar copy for started, invalid and completed prior uses, and first-use copy for the unstarted case.

The completed-prior case was also completed in the second chain through the browser. Each chain retains its own first-completion ID; reopening BL2 selects the second chain's attempt. No earlier result, completion or baseline selection is transferred.

Evidence: [adapter assertions](source/audit/independent.test.ts), [UI results](audit/supplement-results.json), and `audit/familiar-{ready,started,invalid,completed}.json` / `audit/familiar-ui-*.{json,txt}`.

## Affected regressions and arithmetic provenance

- **First-completion atomicity:** an aborted final transaction preserves the entire pre-final root and null lock in the adapter. A committed final transaction with delivery held saves 18 results and exactly one matching lock. The browser watchdog reconciles genuine completion and displays eligibility; late callback delivery changes no bytes. Stale final snapshots and duplicate terminal actions reject.
- **Deletion/callback admission:** the six assignment/final/second-verification browser races pass, plus both notification-disabled cases. No late eligibility reappears. Missing/deleted drill, journal/snapshot corruption, substituted card and changed inventory hash reject fresh UI authority without mutating the corrupted input.
- **Journal integrity:** new positive ownership-generation commands replay through pause/recovery and owner replacement. Twelve independent edits to snapshot, event/post state, IDs, revisions, generation validity, ordering, inventory, time and source reject. Historical journals without the optional generation field remain readable. This is internal consistency testing, not cryptographic proof of human actions or an exhaustive tamper survey.
- **Feedback and outcome boundaries:** a newly written Python reconciler reads primitive frozen thresholds and the audit driver's intended pump policies, independently derives every outcome, checks money and results, checks event/action/revision continuity, derives completed-prefix feedback, and matches visible text. **Seven inventories, 126 rounds, 758 events and 21 feedback boundaries pass.** No candidate-facing raw manifest, threshold field, baseline core or ownership data appears. These are new audit calculations, not the developer's `arithmetic.json`.

The retained B2-A arithmetic evidence remains bound to **`abc5136eb2033eaa6b8345ad658bf057b581895e`** and its stated headless scope: router fixtures/mutations, manifest generation, feedback mathematics and authority rules. It is reused for unchanged arithmetic, not claimed as a new exhaustive campaign at this SHA. [The exact reuse diff](b2a-reuse-diff.patch) shows the only difference in those five headless modules is the optional generation field and its positive-integer validation in `drills.ts`; arithmetic/feedback logic is unchanged. The earlier 31,200-mutation campaign was not rerun. No developer arithmetic report is represented as independent evidence.

New reconciliation: [script](audit/reconcile.py), [counts](audit/reconciliation.json), [log](audit/reconcile.log).

## Repository checks at the final exact SHA

`npm run check` completed lint, **1,001 tests / 48 files**, fourteen Stop form checks, five Stop drill checks, TypeScript, client production build and disabled-analytics build. `npm run balloons:check` passed nine scored forms/seven drill inventories. Target-versus-parent `git diff --check` passed. The two inherited lint warnings, experimental SQLite warning and bundle-size warning remain in the logs.

The aggregate suite was run once, after archiving the final requested SHA, including its final copy edit. The seven new adapter tests ran separately afterward. No repository test failure was retried.

[Repository check log](repository-checks.log), [Balloons check log](balloons-check.log). Runtime: Node v24.13.1, npm 11.8.0, installed Vitest 4.1.11/Vite 8.3.1; automated headless Chromium **145.0.7632.6**, `chromium_headless_shell-1208`.

## Harness corrections, evidence limits and open gates

Retained preliminary harness issues are not counted as product failures or hidden as clean runs:

1. The shell wrapper tried to assign zsh's read-only `status` variable **after** `npm run check` completed. The complete successful log was recovered; the suite was not rerun. The wrapper returned 1, so that exit is not represented as the aggregate command's recorded success exit.
2. A secrecy assertion matched the approved maintenance phrase “No targeted threshold.” It was narrowed to raw-field/hidden-value disclosure; the first six inventory successes were retained and maintenance resumed separately.
3. An initial stale-tab assertion expected Resume even after polling had correctly withdrawn the view. The driver now permits the actual Reopen path and verifies that reacquisition still rejects.
4. The fast fresh-Practice driver used native `focus()` without waiting for an enabled button during next-round confirmation. Its failures are retained. A diagnostic captured **Collect disabled, focus on body, and Enter delivered to body**, not a dropped enabled-control click. The corrected native helper waits for an enabled button; the complete 39-round run then passes. See [diagnostic trace](audit/readiness-diagnostic-trace.json), [failed round capture](audit/fresh-failed-round-17.txt), and retained preliminary logs. No product source was changed.

Most drill cases begin with canonical synthetic seeds from the original independent audit, copied byte-for-byte into this bundle with [provenance/hashes](audit/input-provenance.json). They are admitted test records, not evidence of actual prior human play. The fresh unseeded baseline is distinguished above. Lifecycle/owner-loss/fault probes are injected functional tests. Native button defaults use automation-generated keyboard input; no physical keyboard, OS lifecycle, screen-reader speech, display timing or full support matrix is certified. Mixed-version simultaneous clients are not qualified.

**N1 remains open and separate:** this audit does not close the earlier delayed-notification/replacement-Practice observation or establish its native reachability. **OBS-1 remains open and separate:** the unchanged Stop focus assertion passed in this run, but the intermittent cause is not established. Neither is dismissed as proven flakiness or resolved by these drill results.

A durable first-completion lock is not RT reservation, exposure, play or comparison entitlement. RT play/comparison, mock integration, whole B1/full B2/B3 completion, browser/device/accessibility qualification, founder acceptance, deployment and release remain separate and open. This PASS covers only the named focused repair and tested regressions at the target/parent above.

## Reproduction

Everything runs in the external audit directory, leaving the original checkout read-only:

```sh
cd /private/tmp/balloons-b2b-audit-d1a40ce/source
mv audit ../adapter-harness
npm run check
npm run balloons:check
mv ../adapter-harness audit
./node_modules/.bin/vitest run --config audit/config.ts
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4199
```

With the preview running, use another terminal:

```sh
cd /private/tmp/balloons-b2b-audit-d1a40ce
node audit/journeys.mjs
node audit/faults.mjs
node audit/supplement.mjs
node audit/edges.mjs
python3 audit/reconcile.py
```

The adapter harness generates the two-chain familiarity inputs; journeys generate the 6/12/18 phase inputs. Run in that order. Browser drivers use the installed Playwright/runtime paths stated in `audit/common.mjs`. The harness-only `source/audit/` folder was added after the original repository checks. The commands temporarily move it out of default test/lint discovery to reproduce the original 1,001-test scope, then restore it for the separate adapter run. The audit artifact inventory excludes cloned dependencies and generated caches and is recorded in `evidence-hashes.json`.
