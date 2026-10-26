# Independent Balloons B1-B F1–F4 repair audit — FAIL

Date: 2026-10-03 (America/New_York).

**Verdict: FAIL at `31d8bd60914fa487a68082c743d6501538dc3127`, immediate parent `e192e7ab6aef5f529b6511ca03cb9a20ab36abcd`.** The original four reproductions are repaired within their exercised boundaries. A further completion-edge case contradicts the explicit requirement that an attempt warned ineligible must not subsequently appear as a saved baseline. This is a P2 candidate-status defect, not evidence that an uncommitted action was admitted.

All work and evidence are external to the repository at `/private/tmp/balloons-31d8-independent-xg522a3z`. No product, specification, tracker, or repository file was edited. No commit, push, deployment, analytics activation, acceptance, or release occurred.

## R1 — P2: completed action delivery timeout gives a false definitive ineligibility warning

**Reproduced twice in fresh full 39-round BL1 journeys**, first with zero-cent collections and again with one genuinely successful pump followed by a five-cent final collection.

1. Complete rounds 1–38 normally and enter confirmed round 39.
2. Hold only delivery of the final `action` transaction's completion callback after IndexedDB has actually committed. The intent and final action are both durable; this is a delivery stall, not a failed put.
3. Let the new 2,000 ms mutation-delivery watchdog expire. The candidate sees: “Unsaved action or display. Controls are paused. This attempt is not eligible as a durable baseline. Only committed actions can be recovered.” The offered action is “Check and resume saved session.”
4. Read storage independently. The same session is `phase: completed`, `comparisonEligible: true`, `pendingAction: null`, with all 39 rounds confirmed and resolved. The cleanup does not change it.
5. Reload, open Balloons history, and open the saved report. It says **“Saved standalone baseline.”** The nonzero reproduction correctly shows five cents banked. No new form or session was substituted.

Cause: the delivery watchdog in [storage.ts](</Users/renzo/Documents/Assessment Practice/App/src/balloons/storage.ts:185>) rejects after a transaction may already have committed. [controller.ts:174](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:174>) routes that rejection through `pause('write_failed')`. [controller.ts:153](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:153>) publishes the unconditional ineligibility warning before authoritative reconciliation. [controller.ts:162](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:162>) then skips completed records; the controller retains its pre-completion view. History correctly admits the genuinely committed complete record as a baseline, contradicting the earlier definitive warning.

**Required outcome:** make delivery uncertainty, proven failure, verified completion, displayed eligibility, and offered recovery agree. Preserve genuine committed actions and immutable completed results. This finding does not prescribe invalidating a genuinely saved complete record merely to make the warning true. The requested truthful visible/durable boundary must hold at the final action as well as mid-session.

Evidence:

- [First full reproduction](evidence/independent-final-action-delivery-timeout.json), [pre-reload record and warning](evidence/independent-final-action-before-reload.json), [warning screenshot](evidence/independent-final-action-warning.png).
- [Independent nonzero repeat](repeat-evidence/independent-final-action-delivery-timeout.json), [before/committed/timeout records](repeat-evidence/independent-final-action-before-reload.json), [saved baseline screenshot](repeat-evidence/independent-final-action-delivery-timeout.png).
- [Repeat driver](final-action-repeat.mjs), [repeat dispositions](repeat-evidence/additional-results.json).
- The same final-round **intent-delivery** stall control, before action commit, remains review-only after recovery and completion. Its genuine one-pump prefix and five cents survive. This distinguishes the completion boundary from the original failed-intent bug.

## N1 — additional held-notification robustness limit; not a second native product blocker

The stronger replacement-byte check exposes a separate effect under the submitted delayed-notification injection model. After deletion has completed, start and durably confirm a new RP1 session. Deliver the old transaction callback first: replacement bytes remain identical. Then release the earlier deletion's held `begin/end` notification handlers: the new session is paused, its view is cleared, and exactly one `pause / ownership_or_deletion_changed` event is appended. The candidate sees “Local history changed in another tab. Open history to check what remains.”

This occurs in all **16 isolated delayed-handler combinations**: assignment/arm/confirm/action × individual/Delete all × deletion-before-delivery/delivery-before-deletion. The core, mapping, confirmed exposure, ownership identity and eligibility are preserved; no old record is resurrected and no money or committed action is lost. Root revision and interruption count advance and the new session's phase changes from active to paused. All 16 corresponding absent-notification populated cases preserve bytes. Old transaction delivery preserves replacement bytes in all 32 combinations.

The cause is the unscoped handler at [Journey.tsx:58](</Users/renzo/Documents/Assessment Practice/App/src/balloons/Journey.tsx:58>): it dereferences the current controller when an old handler runs. [controller.ts:197](</Users/renzo/Documents/Assessment Practice/App/src/balloons/controller.ts:197>) then pauses that current session. Neither the message nor handler binds the notice to its original installation/session or effect lifetime.

**Important limit:** the injection intercepts a received `onmessage` invocation and holds the application callback, including across effect cleanup/channel closure. This establishes failure of unconditional byte invariance under that injected callback model. It does **not** establish that native BroadcastChannel delivers a queued event after its channel is closed, nor that normal browser transport can reproduce that schedule. A conservative pause also differs materially from stale-write resurrection. I therefore retain this as a scoped robustness observation rather than claim a second native production blocker. Any future assertion that *all* delayed notifications leave replacement bytes untouched must account for this boundary explicitly.

[Isolated dispositions](evidence/notification-results.json), [driver](notification-replacement.mjs), [example containing before/after roots and replacement-visible text](evidence/notification-delayed-assignment-installation-delete-first.json). Every case first independently asserts that old transaction delivery leaves the full populated root unchanged, then records the separate notice-induced mutation. The initial populated matrix records these assertion failures as `harnessError` because its generic wrapper labels all thrown assertions that way; the isolated driver returns the same byte-invariance failures as `pass: false` with complete raw data and no harness error.

## F1–F4 disposition and independent positive evidence

| Boundary | Result |
|---|---|
| F1 original failed `action_pending` plus failed `pause` writes; reload; complete same BL1 | PASS: warned attempt recovers review-only and finishes as a saved review-only result, never a baseline |
| F1 failed action write with durable pending intent | PASS: committed prefix survives; pending action is not replayed; eligibility remains false |
| Genuine committed round-2 pump, header, mapping, confirmed rounds and exposure | PASS: exact core preserved through both fault recoveries |
| Clean durable pause and reload | PASS: same form/core and eligibility retained |
| Final committed action callback timeout | **FAIL R1:** definitive warning contradicts saved baseline |
| F2 four delivery phases × both deletion types × absent/delayed notices × both orderings | PASS for deletion progress, exposure/tombstones, empty replacement bytes and old transaction fences; 32-case matrix |
| Populated replacement session before old delivery | Old transaction callbacks preserve bytes in all 32 cases; notice-handler caveat N1 above |
| F3 fast healthy selected report checks | PASS: zero removals in the 6.5-second normal control and 3.5-second fast phase following delayed reads; bytes unchanged |
| F3 150 ms successful reads | PASS: numbers temporarily hidden, selected verified report restored with identical content; durable bytes unchanged |
| F3 held selected-report read crossed with individual/Delete all, absent/delayed notices | PASS: all four cases suppress stale numbers; releasing the held read after deletion cannot restore them |
| F3 timeout and later recovery | PASS: timeout warning appears; a subsequent fresh read restores the same report **before** the abandoned callback is delivered; late callback changes neither report nor bytes |
| F4 native Space/Enter, repeats and focus changes | PASS: keyboard classification and action counts correct; fresh presses remain accepted |
| Mouse, emulated touch and genuinely unclassified DOM clicks | PASS: `mouse`, `touch_or_pen`, `unknown_or_assistive` preserved |

The independent extra native-input probe records **keyup → microtask → native click** in real Chromium and still records `keyboard`. It exercises held Space beyond two seconds with repeat, Enter repeat after the first action has committed, focus-change release for both keys, fresh Space, and subsequent unclassified/pointer/touch actions. Every intended collection adds one action; canceled/repeat inputs add none beyond the allowed first Enter action. [Native order and counts](evidence/independent-native-default-order-and-holds.json), [driver](native-order.mjs).

The mutation timeout is an engineering delivery bound, not a gameplay response deadline or reservation-expiry rule. The 32-case rerun's maximum deletion-request-to-observed-durable-completion time was **1,881 ms**; this is an observation in the test environment, not a wall-clock guarantee during suspended browser/OS execution. Assignment/arm delivery stalls mount no scored balloon; confirmed exposure remains consumed; individual deletion retains matching form/exposure/chain tombstones; Delete all creates a new installation identity. Queued mutation and owner locks release without an action in the stalled tab. The populated delivery-first probes also explicitly wait for, and bound-check, owner-lock release before starting another session.

## Ordinary completion, arithmetic and reload

The original independent audit driver was reviewed and rerun against this freshly built exact archive. It completed full preparation, BL1 with varied decisions and mixed input, save, direct reload and original report reopening, then a separate complete RP1. Report-view writes append only their event; header/core/snapshot and previous journal prefix remain unchanged.

A separate Python arithmetic oracle, reviewed before reuse, derives every ordered core/durable event and visible table from the committed manifest and action commands without importing production transition/scoring code. Fresh results:

| Journey | Banked/lost cents | Attempts/successes | Collected/burst | Core/durable events |
|---|---|---|---|---|
| Varied fresh BL1 before report | 455 / 470 | 198 / 185 | 26 / 13 | 303 / 603 |
| Same BL1 after original/reopened report views | 455 / 470 | 198 / 185 | 26 / 13 | 303 / 605 |
| Fresh zero-pump RP1 | 0 / 0 | 0 / 0 | 39 / 0 | 118 / 234 |

There are 39 resolved and confirmed rounds, 13 per Type; `5 × 185 = 455 + 470 = 925` cents. All visible category/block tables and 39 review rows match; supported category medians match. [Oracle output](evidence/reconciliation-results.json), [oracle](reconcile.py), [BL report DOM](evidence/independent-BL1-report-dom.json).

An additional **fresh explicit RP1 journey** uses one pump on odd rounds and zero on even rounds. An independent manifest-based row oracle verifies all 39 outcomes and 100 banked/zero lost cents. Direct reload and reopening preserve the header, complete snapshot and journal prefix, adding exactly one report-view event. Its visible report remains identical and never claims baseline status. [RP direct reload](evidence/independent-RP1-direct-reload.json), [driver](rp-direct-reload.mjs).

## Identity, authority, changed scope and reuse

- HEAD and immediate parent exactly match the requested values before and after. Tracked/untracked porcelain status is empty. `git diff --check HEAD^ HEAD` passes.
- All **764 tracked file SHA-256 values** are unchanged in the repository and match the external tested archive after testing. [Initial register](initial-hashes.json), [final proof](identity-after.json).
- The actual **26-path** diff exactly matches the repair inventory. All changed product/test files and repair records/drivers were inspected. [Complete diff](diff.txt), [complete inventory](changed-files.txt), repeated below.
- All **43 submitted identity-register hashes** match independently, including freshly rebuilt client bundle files, frozen authority, QA scripts and evidence archives. [Hash checks](submitted-identity-checks.json). The historical FAIL copy byte-matches the external original named in the request.
- Read AGENTS.md, complete Master Strategy, governing Balloons specification/reviews, freeze, tracker, original FAIL and repair verification; parsed both packet JSON files fully. No specification conflict within this audit boundary was identified. Both submitted evidence archives were inventoried and all contained JSON parsed; these remain submitted evidence rather than independent outcomes.
- [Parent comparison](parent-reuse-boundary.json) verifies unchanged B1-A mechanics, contracts, manifest loader, prefix/report integrity and report arithmetic, assets, Stop/shared code, App and dependencies. Parent positive evidence is reused only for these unchanged pure mechanics/report and unaffected preparation boundaries. No parent pass is reused to establish changed recovery, controller, storage-gate, history or input behavior; these were tested afresh. This does not extend qualification.

Frozen SHA-256 values independently match FREEZE.md (Master Strategy also matches the original audit's authority identity):

| File | SHA-256 |
|---|---|
| Balloons specification V1.0 | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| Fixed manifests V1.0 | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| Form review V1.0 | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| Router fixtures V1.0 | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| Router fixture review V1.0 | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |

Complete changed paths:

```text
IMPLEMENTATION_TRACKER.md
docs/qa/balloons-b1-b/VERIFICATION.md
docs/qa/balloons-b1-b/repair-f1-f4/AUDIT-e192e7ab.md
docs/qa/balloons-b1-b/repair-f1-f4/VERIFICATION.md
docs/qa/balloons-b1-b/repair-f1-f4/changed-files.txt
docs/qa/balloons-b1-b/repair-f1-f4/checks.txt
docs/qa/balloons-b1-b/repair-f1-f4/identity.json
docs/qa/balloons-b1-b/repair-f1-f4/independent-browser.mjs
docs/qa/balloons-b1-b/repair-f1-f4/post-evidence.tar.gz
docs/qa/balloons-b1-b/repair-f1-f4/post-summary.json
docs/qa/balloons-b1-b/repair-f1-f4/pre-evidence.tar.gz
docs/qa/balloons-b1-b/repair-f1-f4/pre-summary.json
docs/qa/balloons-b1-b/repair-f1-f4/preserved-boundaries.json
docs/qa/balloons-b1-b/repair-f1-f4/reconcile.py
docs/qa/balloons-b1-b/repair-f1-f4/repair-boundaries.mjs
docs/qa/balloons-b1-b/repair-f1-f4/repair-controls.mjs
docs/qa/balloons-b1-b/repair-f1-f4/supplemental-browser.mjs
src/balloons/Journey.tsx
src/balloons/controller.test.ts
src/balloons/controller.ts
src/balloons/durable.test.ts
src/balloons/durable.ts
src/balloons/history-recovery.test.tsx
src/balloons/input.test.ts
src/balloons/input.ts
src/balloons/storage.ts
```

## Fresh checks and reproduction

All checks ran in the external exact archive with a physical dependency copy. Production source was unchanged in both archive and repository.

- **812 tests / 44 files pass**: [test log](test.log).
- Lint passes with the two inherited warnings: [lint](lint.log).
- TypeScript, client and disabled-analytics production builds pass: [build](build.log).
- Nine Balloons manifests regenerate and pass hashes/constraints: [Balloons check](balloons-check.log). The 14 unchanged Stop forms and five drills also pass [forms](forms-check.log), [drills](drills-check.log).
- All **55 submitted repair browser scenarios** pass on fresh rerun: 11 original-independent cases, three supplemental, 37 boundary cases and four controls. Independent additional expectations found R1 and the separately scoped N1; green submitted assertions do not override them.
- Runtime: Node 24.13.1, npm 11.8.0, headless Chromium 145.0.7632.6, isolated Playwright contexts, localhost port 4197. Browser runtime paths are explicit in each driver. No existing user browser history/profile was touched.

Start the retained production build:

```sh
cd /private/tmp/balloons-31d8-independent-xg522a3z/checkout
npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
```

In another terminal, use a fresh external output directory to retain this audit's evidence:

```sh
cd /private/tmp/balloons-31d8-independent-xg522a3z
mkdir -p /private/tmp/balloons-31d8-reproduction
export BALLOONS_REPAIR_OUT=/private/tmp/balloons-31d8-reproduction
node independent-browser.mjs
node supplemental-browser.mjs
node repair-boundaries.mjs
node repair-controls.mjs
node native-order.mjs
node report-timeout.mjs
node rp-direct-reload.mjs
node final-action-repeat.mjs
node notification-replacement.mjs
```

The first driver must precede seeded history checks. The repair-boundary driver's fixed seed path points to this audit's genuine completed root; changing it to the new run's `independent-full-root.json` is a harness-only path adaptation. `reconcile.py` similarly names this retained evidence directory. `report-timeout.mjs` is the standalone selected-report timeout/recovery probe. The preliminary combined `additional-browser.mjs` is retained for provenance; its intent-stall branch had the history-render race disclosed below and is superseded by `final-action-repeat.mjs`.

`final-action-repeat.mjs` is expected to exit 1: the final-action case is `pass: false`, while final-intent is `pass: true`. `notification-replacement.mjs` is expected to exit 1 for the stronger injected byte-invariance expectation, with 16 `pass: false` records and no harness errors. Some original drivers only record failure in JSON; always inspect `pass` and `harnessError`, not process status alone. Full checks can be repeated with the npm commands above from the external checkout; do not rebuild while a browser probe is running.

Harness disclosures: initial local server startup was sandbox-blocked and then succeeded through the approved execution path. The system Python lacks the newer tar extraction filter argument; extraction was retried on the local `git archive` output. A parent comparison was corrected to handle the newly added test file. Preliminary populated-session probes needed an explicit history-render wait, the bounded owner-release wait, and the correct RP expectation for the explicitly chosen replay route; their logs/scripts remain in `preliminary-populated*`. The first final-intent probe branched before history rendered and timed out; the corrected complete nonzero repeat passes that control. No such harness failure is a product finding. The isolated N1 matrix distinguishes assertion failure from harness error and retains both complete roots.

## Limits and separate states

This audit uses real browser execution with automated native-button input, explicitly injected IndexedDB/notification delivery faults, emulated touch and DOM-click unknown input. It is not human physical keyboard/touch evidence, physical timing/scanout measurement, native OS lifecycle qualification, assistive-device identification, screen-reader validation, or browser/device certification. Two-frame confirmation remains an operational boundary. N1 has the additional callback-lifetime limit stated above.

The original e192e7ab FAIL remains bound to that SHA. This repair verdict is **FAIL at 31d8bd60914fa487a68082c743d6501538dc3127 on R1**, with N1 retained as a narrower injected robustness limit. Any repair requires a new exact-SHA audit.

Founder B1-B acceptance, whole B1 (still partial), mock integration, B2 Advanced Training, B3 qualification, complete Balloons acceptance, deployment and release remain separate open states. No audit outcome grants them. Fixed forms remain uncalibrated and support only the approved descriptive claims.
