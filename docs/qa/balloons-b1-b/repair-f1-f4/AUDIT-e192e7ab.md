# Independent Balloons B1-B audit — FAIL

Date: 2026-10-03 (America/New_York).

**FAIL applies to `e192e7ab6aef5f529b6511ca03cb9a20ab36abcd`, immediate parent `a1d0b808c442c5f0bd73af55a7d74e905f3c47cf`, for standalone B1-B BL/RP Practice.** Four reproducible correctness findings remain. Ordinary journeys and arithmetic pass, but they do not overcome these failures. No repair was made.

All artifacts are outside the repository in `/private/tmp/balloons-b1b-independent-ajhtowdj`. The test checkout is an exact Git archive of the target with a physical dependency copy. Production source was not modified in either the original checkout or the archive. Browser probes use isolated contexts at `http://127.0.0.1:4187`, Chromium headless **145.0.7632.6**, Node **24.13.1**, npm **11.8.0**. These are automated browser and injected-fault observations, not human physical-device evidence.

## Blocking findings

### F1 — P1: sustained intent-write failure can regain baseline eligibility

**Reproduction:** start BL1; inject failure of the `action_pending` put and subsequent `pause` cleanup put; click Pump. The candidate sees “Unsaved action or display” and “This attempt is not eligible as a durable baseline.” The durable record nevertheless stays `phase: active`, `comparisonEligible: true`, `pendingAction: null`. Reload, restore storage availability, resume that same BL1 and complete all 39 rounds. The final report says **“Saved standalone baseline”**, with `comparisonEligible: true`.

The failed Pump is not committed or counted. The defect is that the failure/ineligibility boundary is lost and the same warned-ineligible attempt is later admitted as a baseline. The warning is not merely missing: it is contradicted by the later durable eligibility and report.

**Cause:** [controller.ts:155](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:155>) persists `pause/write_failed` only through another fallible write; line 159 swallows cleanup failure. [durable.ts:102](</Users/renzo/Documents/Assessment Practice/App/src/balloons/durable.ts:102>) recovery preserves eligibility whenever the previous exposure is confirmed and no pending intent exists. Failed intent plus failed cleanup leaves exactly that apparently clean record.

**Evidence:** [initial failure and recovery](persistent-intent-failure-recovery.json), [fresh full completion and visible report](failed-intent-and-cleanup-completes-as-baseline.json), [screenshot](failed-intent-and-cleanup-completes-as-baseline.png), [supplemental driver](supplemental-browser.mjs). This was reproduced twice; the second run completes all 39 rounds. A control with failed **action** and cleanup writes remains review-only because its durable intent survives: [control](persistent-action-write-failure-control.json). Submitted one-shot failure cases also pass when cleanup can write.

**Required outcome:** sustained write failure, including failure to save the failure marker, must not permit the warned-ineligible attempt to return as a valid baseline. Preserve same-session form/exposure and committed-result integrity without claiming unsaved work was saved. Balloons §§3, 5–6 and the B1-B verification claim require this boundary.

### F2 — P1: deletion depends on notification delivery to release a stalled mutation lock

**Reproduction:** disable BroadcastChannel in two isolated tabs. In the active tab, hold the transaction-complete callback after the assignment, arm, confirmation or action has committed. In the other tab, request individual deletion or Delete all. In **all eight combinations**, after 2.6 seconds the result still exists, the originating tab owns both the owner and mutation locks, and the deletion request is queued for the mutation lock. The stalled phase has no independent deadline, so without delivery or candidate exit the wait has no bound.

Only an explicit **Pause and open history** in the originating tab releases the gate and allows deletion/replacement. After that exit, all eight late callback deliveries leave deleted/replacement storage unchanged. Thus stale-write rejection works once deletion is allowed to commit; deletion liveness is the failure.

**Cause:** assignment/action/presentation hold `withMutationGate` across awaited response delivery: [controller.ts:59](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:59>), [controller.ts:87](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:87>), [controller.ts:113](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:113>). The two-second timer covers frame confirmation or cleanup after cancellation, not these stalls. [controller.ts:169](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:169>) excludes saving/busy work from authority polling. The cancellation that normally unlocks deletion comes from the BroadcastChannel begin message.

**Evidence:** `no-notifications-{assignment,arm,confirm,action}-{individual,installation}.json`; [combined results](independent-results.json), [driver](independent-browser.mjs). Each case retains actual Web Locks held/pending state. All eight corresponding submitted cases pass with notifications enabled; their passing result does not establish absent/delayed-notification behavior.

**Required outcome:** deletion/replacement must make bounded progress during stalled delivery without relying on a message or an action in the stuck tab, while retaining arm-before-mount ordering, cancellation fencing and conservative exposure. The 2.6-second observation is a test bound, not a proposed gameplay timeout. No exact replacement policy is invented by this audit.

### F3 — P2: a healthy delayed history read permanently closes the selected report

**Reproduction:** open a saved report from history, then delay only successful readonly transaction-complete delivery by 150 ms. No data changes and no read fails. The next periodic refresh removes the report. When the healthy read finishes, the history list returns but the selected report does not. Storage is byte-identical before/after. Further polls alternate the list and “Checking saved history…” rather than restoring the selected report.

**Cause:** [Journey.tsx:88](</Users/renzo/Documents/Assessment Practice/App/src/balloons/Journey.tsx:88>) clears `selected` after two frames; line 92 restores a selection only if the old value is still non-null. Clearing the value destroys the session ID needed to restore it.

**Evidence:** [delayed healthy read](healthy-delayed-history-read.json), [screenshot](healthy-delayed-history-read.png). A separate 6.5-second healthy fast-read control reports **zero report removals** with unchanged storage: [control](healthy-normal-report-polling.json). The seeded follow-up uses the two genuine completed records produced by this audit; it is not represented as another played journey.

**Required outcome:** preserve which report is selected across a slow successful authority check, and restore only the current verified record. Any necessary temporary suppression must not discard navigation state. Do not relax deletion or replacement authority to keep a stale report visible.

### F4 — P2: native Space actions are durably misclassified

**Reproduction:** focus Collect or Pump and use browser-dispatched Space through the browser's native button default action. Three fresh Space activations are recorded as `unknown_or_assistive`; the Enter control records `keyboard`. The independent full journey also records its first Space collection as `unknown_or_assistive`.

**Cause:** [input.ts:30](</Users/renzo/Documents/Assessment Practice/App/src/balloons/input.ts:30>) assumes Space's click precedes the queued keyup microtask. In this real browser the guard clears both `keyup` and `keyboard` before the default click reaches `source()`, so reliable preceding keyboard evidence is discarded. The jsdom test manually dispatches click before awaiting the microtask and therefore does not model this native ordering.

**Evidence:** [native input trace and journals](native-space-source-and-repeat.json), [driver](supplemental-browser.mjs). Space and Enter still produce exactly one action, and held Space release after focus change adds none. This finding concerns inaccurate input-source evidence and report context, not wrong money or duplicate pumping. Balloons §3 requires the best supported per-action source.

**Required outcome:** retain correct keyboard classification through actual native Space click delivery, while retaining first-press activation, repeat/focus cancellation and acceptance of genuinely unclassified clicks.

## Identity, authority and all 31 changed paths

- Exact HEAD and immediate parent verified before and after testing. Tracked and untracked porcelain status is empty. `git diff --check HEAD^ HEAD` passes.
- All **748 tracked files** retain their initial SHA-256 values. The tested archive's tracked source bytes match the original checkout. See [initial hashes](initial-hashes.json), [final identity](identity-after.json).
- The actual 31-path diff equals `docs/qa/balloons-b1-b/changed-files.txt` exactly. All changed product and test files were inspected, as were the QA plan, verification claims, drivers, logs, JSON evidence, compressed full record and reopened screenshots. [Actual diff](diff.txt).
- Read AGENTS.md, the complete Master Strategy, Balloons V1.0, tracker, freeze, B1-A independent PASS, B1-B QA plan and verification. No governing conflict was found within this bounded audit. No specification revision was made.
- All **48 entries** in the submitted identity register, including source, production bundle, packet and evidence files, independently match their recorded hashes: [verification](submitted-identity-checks.json).
- The copied B1-A PASS byte-matches its external original. B1-A core, contracts, manifest loader, report calculations and their existing tests are unchanged from the parent: [reuse boundary](b1a-reuse-boundary.json). Its earlier PASS is reused only for those unchanged mechanics and report semantics. The changed integrity path was freshly tested as described below.

Frozen authority:

| File | SHA-256 |
|---|---|
| Balloons V1.0 | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| Fixed manifests | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| Form review | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| Router fixtures | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| Router fixture review | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |

The five packet values match FREEZE.md. The Master Strategy matches retained governing identity. The 31 changed paths are:

```text
IMPLEMENTATION_TRACKER.md
docs/qa/balloons-b1-b/B1-A-INDEPENDENT-PASS.md
docs/qa/balloons-b1-b/QA-PLAN.md
docs/qa/balloons-b1-b/VERIFICATION.md
docs/qa/balloons-b1-b/browser-faults.json
docs/qa/balloons-b1-b/browser-faults.mjs
docs/qa/balloons-b1-b/browser-results.json
docs/qa/balloons-b1-b/browser.mjs
docs/qa/balloons-b1-b/changed-files.txt
docs/qa/balloons-b1-b/checks.txt
docs/qa/balloons-b1-b/complete-session.json.gz
docs/qa/balloons-b1-b/identity.json
docs/qa/balloons-b1-b/independent-rounds.json
docs/qa/balloons-b1-b/mobile-report.png
docs/qa/balloons-b1-b/report.png
src/App.test.tsx
src/App.tsx
src/balloons/Journey.test.tsx
src/balloons/Journey.tsx
src/balloons/LibraryStatus.tsx
src/balloons/PracticeReport.tsx
src/balloons/balloons.css
src/balloons/controller.test.ts
src/balloons/controller.ts
src/balloons/durable.test.ts
src/balloons/durable.ts
src/balloons/format.ts
src/balloons/input.test.ts
src/balloons/input.ts
src/balloons/integrity.ts
src/balloons/storage.ts
```

## Independent positive evidence

The 785 tests and submitted browser results were treated as claims and rerun from the exact external archive. All **785 tests / 43 files** pass. Lint passes with the two inherited warnings. TypeScript and both production builds pass; the client bundle bytes match the submitted identity. Balloons regeneration/hash/constraint checks and the unchanged Stop form/drill checks pass. Logs: [tests](test.log), [lint](lint.log), [build](build.log), [Balloons](balloons-check.log), [Stop forms](forms-check.log), [Stop drills](drills-check.log).

The changed `integrity.ts` now admits exact legal prefixes and wraps completed admission with its separate 39-round requirement. The six original B1-A rejection/control tests and twenty independent adversarial tests were freshly rerun against current repository TypeScript, including **479 mutation rejections** and the retained parent counterexamples. Six new tests additionally check **1,516 legal prefixes** across BL1–3/RP1–3, **7,258 rejecting mutations**, truncation of atomic event groups, and continued refusal to admit incomplete prefixes as complete reports. All **32 tests** pass. [Log](independent-integrity.log), [prefix source](prefix.test.ts), [prefix counts](prefix-results.json), [adversarial dispositions](adversarial-results.json). This is fresh target verification, not extension of the parent's integrity verdict by assumption.

### Complete production journeys and separate arithmetic oracle

A fresh independently written browser driver completes all preparation steps, BL1 with varying pump/collect choices, saved report, reload/history reopen, and a separate 39-round RP1 replay. Preparation has zero assignments before Start. The two-question retry and settings prerequisites also pass the rerun component checks. Candidate guide, run, report and history projections contain no hidden thresholds/profile letters; the data model and shipped manifest necessarily retain thresholds locally and are not a secrecy boundary against developer tools.

[Independent Python oracle](reconcile.py) reads the **committed manifest**, then derives every ordered core event, durable lifecycle event, expected totals, action progression, result row, visible Type mapping and exposure/confirmation snapshot from the recorded action commands. It does not import production scoring, replay or transition code. It independently validates all report category/block numeric cells, the 39 visible review rows, and supported full-category medians. Fresh reload and report-view checks require identical header/snapshot/core bytes with only an appended durable `report_viewed` event. [Reconciliation results](reconciliation-results.json), [log](reconciliation.log), [captured report DOM](independent-BL1-report-dom.json).

| Record | Banked/lost cents | Attempts/successes | Collected/burst | Ordered core/durable events |
|---|---:|---:|---:|---:|
| Committed developer BL1 record | 810 / 125 | 199 / 187 | 27 / 12 | 305 / 608 |
| Fresh submitted-driver BL1 | 810 / 125 | 199 / 187 | 27 / 12 | 305 / 608 |
| Fresh independent BL1, before report view | **455 / 470** | **198 / 185** | **26 / 13** | **303 / 603** |
| Independent BL1 after initial/reopened report views | 455 / 470 | 198 / 185 | 26 / 13 | 303 / 605 |
| Fresh independent RP1, zero-pump collections | 0 / 0 | 0 / 0 | 39 / 0 | 118 / 234 |

Every complete record has exactly 39 confirmed/resolved rounds and 13 of each Type. The independent BL1 includes six zero-pump collections; conservation is `5 × 185 = 455 + 470 = 925` cents. RP1 remains replay rather than baseline. These controls establish correct ordinary saving and report immutability; F1 separately demonstrates erroneous recovery of eligibility after a failure.

### Adversarial boundary disposition

| Boundary | Result within exercised scope |
|---|---|
| Native Enter/Space activation, repeat and changed-focus release | One action per first activation; repeated/changed-focus release suppressed. **Space source classification fails F4.** |
| Mouse, emulated touch, unclassified DOM clicks | Accepted through native button click; classification retained for pointer and unclassified controls. Emulation/injection is disclosed. |
| Duplicate clicks while delivery is held; fresh clicks after commit | Submitted rerun passes: five injected duplicates rejected; later intentional pumps accepted. Visible amounts remain at the last acknowledged commit while saving. |
| Intent/action/arm/confirm one-shot failures | All submitted fault cases pass when cleanup storage works; no failed action advances the core. **Persistent intent-plus-cleanup failure fails F1.** Persistent action-plus-cleanup failure remains review-only. |
| Pending → armed → confirmed | Assignment/arm/confirmation journal order, arm-before-scored-mount, two frames and controls-after-confirmation pass exercised controls. |
| Pre-arm cancellation and late assignment | Positive unmounted release works in submitted rerun; no scored mount. |
| Post-arm cancellation, hiding and reload | Uncertain form remains uncertain or the same resumed form becomes confirmed but review-only; no fresh/unseen relabeling. Hiding was injected. |
| Stalled frames and late frames | Independent frame hold triggers the existing watchdog, keeps exposure uncertain with zero confirmed rounds, revokes eligibility, releases both locks; late frames write nothing. [Evidence](independent-first-display-watchdog.json). |
| Concurrent cross-tab assignment | Independent no-BroadcastChannel simultaneous starts produce one BL1 and one ownership refusal. [Evidence](independent-concurrent-assignment.json). Submitted sequential owner transfer correctly allocates RP1. |
| Stale owner/storage CAS | Generation, expected-record and installation checks reject stale commits in rerun durable tests; no old callback resurrected records in eight independent deletion cases after deletion was allowed to commit. |
| Individual/delete-all during assignment, arm, confirm, action delivery | Submitted eight cases pass with notifications. **All eight absent-notification liveness cases fail F2.** After explicit origin-tab exit, deletion/replacement succeeds and late responses change no bytes. |
| Keyboard exit during stalled gameplay write | Submitted native Enter exit passes; independent exits release the gate without waiting for held responses. |
| Healthy report authority | Fast-read history control has zero removals. **Slow healthy history reads fail F3.** |
| T=1 / T=32 / T≥33 | Core/durable checks pass. No BL/RP committed manifest has T=32; that exact threshold is RT1 round 34 and remains headless coverage only. No RT journey was introduced. |

The submitted browser driver rerun has seven reported journey observations; its 20-case fault driver also passes. The independent scripts add **17 named scenarios**: five positive scenario results and twelve failure reproductions grouped into F1–F4 (eight are F2 combinations). The independently completed journeys still pass their numerical/action-count assertions; their recorded Space source supplies additional F4 evidence. Results: [independent](independent-results.json), [supplemental](supplemental-results.json), [boundary controls](boundary-results.json). Browser runtime errors were not used as product findings; expected injected storage failures are observed through product handling.

## Reproduce

Dependencies and all build output are already retained in the external archive. No repository writes are needed.

```sh
cd /private/tmp/balloons-b1b-independent-ajhtowdj/checkout
npm test
npm run lint
npm run balloons:check
npm run forms:check
npm run drills:check
npm run build
npm run preview -- --host 127.0.0.1 --port 4187 --strictPort
```

In another terminal, while that production preview is running:

```sh
node /private/tmp/balloons-b1b-independent-ajhtowdj/independent-browser.mjs
node /private/tmp/balloons-b1b-independent-ajhtowdj/supplemental-browser.mjs
node /private/tmp/balloons-b1b-independent-ajhtowdj/boundary-browser.mjs
python3 /private/tmp/balloons-b1b-independent-ajhtowdj/reconcile.py
/private/tmp/balloons-b1b-independent-ajhtowdj/checkout/node_modules/.bin/vitest run --config /private/tmp/balloons-b1b-independent-ajhtowdj/vitest.config.mjs
```

The browser scripts are observational audit drivers: product failures are recorded as `pass: false` in their JSON outputs, not necessarily as process exit failures. They also record separate `harnessError` entries if a probe itself fails. Final retained runs contain no harness-error entries. `independent-browser.mjs` must precede supplemental seeded report controls. Rerunning overwrites that run's external evidence. To reproduce submitted claims, the two external `submitted-browser*.mjs` copies differ only in preview port; set `BALLOONS_QA_OUT` to an external directory.

Harness disclosures: initial localhost/browser launches were sandbox-blocked, then succeeded through the tool's approved execution path. The initial independent library-button helper compared raw text and missed the decorative arrow; it was corrected to use the accessible button locator, with the initial log retained. The first copied B1-A probe run omitted its external retained-mutation fixtures; after copying those fixtures, all 32 tests ran and passed. None of these harness corrections edited product source or count as a product defect.

## Qualification limits and separate states

- **B1-B standalone audit: FAIL at the exact target SHA**, on F1–F4. Implementation exists and developer/ordinary controls pass; founder B1-B acceptance is separate and not granted.
- **Whole B1 remains partial.** Mock restart/integration is outside this implemented slice and was not certified.
- **B2 Advanced Training** router, drills, retests and comparison remain outside this implementation/audit verdict. The five-file packet remains frozen.
- **B3 browser/device/accessibility qualification remains open.** This audit uses headless Chromium, browser-dispatched input and explicit faults. It includes no physical keyboard/touch, screen-reader device, native OS lifecycle, physical timing or scanout measurement. Two-frame confirmation is only an operational boundary. No browser/device combination is certified.
- Original-copy/pattern inspection and candidate-safe projection checks are not final visual, accessibility or rights acceptance. Mobile screenshot/reflow evidence is bounded to the submitted Chromium rerun.
- Replay reconciles internal consistency; it does not authenticate human behavior. Fixed forms remain uncalibrated; no trait, employer, improvement or hiring claim is established.
- **No edit, commit, push, analytics activation, deployment or release** was performed in the repository. A repair requires a new SHA-bound audit. This report does not authorize repair or advance any other milestone.
