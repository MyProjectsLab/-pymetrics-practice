# Independent Balloons B2-B exact-SHA audit

**Verdict: FAIL.** Five in-scope defects are reproduced below. The first-completion transaction and the tested deletion/callback eligibility fences passed their bounded probes; those successes do not override the findings.

Target: `0273e9a1ef3df307d2a45573380a0b698873a5bc`
Immediate parent: `abc5136eb2033eaa6b8345ad658bf057b581895e`
Date: 2026-10-04, America/New_York.

## Identity and read-only boundary

HEAD and its single parent match the requested identities. Initial and final Git status are empty. All **802 tracked working files remain byte-identical** to their initial SHA-256 inventory. No repository edit, Git mutation, commit, push, deployment or release occurred. All audit code, browser profiles, logs, captures and builds are outside the repository, under `/private/tmp/balloons-b2b-audit-0273e9a/`.

The audit uses a `git archive` of the target and a separate copy-on-write clone of installed dependencies. Every archived tracked file was compared with the original before adding audit harnesses. Product source was not patched. Repository checks ran once before independent harness additions. Node v24.13.1; automated Chromium 145.0.7632.6 headless runtime (executable `chromium_headless_shell-1208`). This is functional browser evidence, not physical input or browser qualification.

Read AGENTS.md, complete Master Strategy, Balloons V1.0 specification and both reviews, both fully parsed JSON companions, complete tracker, retained B2-A independent audit, B2-B VERIFICATION, all changed production/test files and QA claims. The 25 fixture forms/975 rounds were independently recalculated from primitive thresholds and intentions using the retained independent Python oracle, rerun here. This audit did not repeat B2-A's 31,200-mutation campaign.

All **14 changed paths** were reviewed: tracker; seven files under `docs/qa/balloons-b2-b/`; `Journey.tsx`, `PracticeReport.tsx`, `TrainingJourney.tsx`, `storage.ts`, `training-storage.ts`, and `training-storage.test.ts`. The exact names/statuses are in [changed-paths.txt](changed-paths.txt).

All five frozen Balloons hashes match the freeze register, the parent bytes, and the recorded approved original-source hashes. Master Strategy remains `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`. No governing file changed. Full hashes: [frozen-hashes.json](frozen-hashes.json). Identity: [initial](identity.txt), [tracked hashes](initial-hashes.json), [final](final-state.json), [13 build hashes](build-hashes.json).

## Findings

### F1 — P1: Delete all retains training records and baseline data

Location: `src/balloons/storage.ts:21` (new optional training field) and `:173–174` (existing replacement operation); candidate promise at `Journey.tsx:195`.

Reproduction: complete a drill, open Balloons history, click **Delete all Balloons data**, then read `assessment-practice-balloons-v1 / installation / root`. Records and tombstones are empty and installation ID changes, but `root.training` remains byte-identical. It retains chains, full drill journals, recommendation settings/mapping and `recommendation.baselineCore`, which contains the original baseline core/events. The UI explicitly says this action clears results and chains.

Cause: `Object.assign(root, freshRoot())` does not remove properties omitted by `freshRoot()`. B2-B added the optional training field without extending deletion. This is a new integration regression even though the deletion line itself is inherited. Ordinary individual deletion withdrawing authority is separate from Delete all actually removing data.

Evidence: [delete-all.json](audit/delete-all.json), [browser-results.json](audit/browser-results.json), [adapter reproduction](source/audit/adapter.test.ts), [late replacement](audit/late-replace.json). The production UI and actual IndexedDB reproduce the defect; no direct deletion mutation is needed.

Required correction: clear all training records atomically with installation replacement; preserve the existing late-write and replacement-authority fences. Verify the entire replacement root, not just `records`.

### F2 — P1: No exclusive drill owner; two tabs can advance one attempt

Location: `src/balloons/training-storage.ts:47–72,87–110`; `TrainingJourney.tsx:45–63`.

Reproduction: open the same active saved exercise in two tabs. Pump in tab B; wait for tab A's 1.5-second authority poll; Pump in tab A. Both commits succeed in the same round and journal. The captured root has `owner: null`; its final two actions use separate browser clock epochs. Neither tab had to pause/relinquish ownership or acquire a new drill owner.

A stale *snapshot* is rejected, as independently tested. But a poll supplies the newest snapshot to a tab that has no exclusive ownership, so revision comparison does not enforce the approved stale-owner rule. The global mutation gate serializes individual operations; it is not a session owner/lease. No training assignment/action checks a drill owner token or generation. Balloons §§3,5,6 require ownership and stale-owner rejection, including integrity/lease checks for drill recovery.

Evidence: [two-tabs.json](audit/two-tabs.json), [fault-results.json](audit/fault-results.json), [faults.mjs](audit/faults.mjs). This uses ordinary candidate controls after seeded admission; no storage corruption or manufactured action object.

Required correction: bind assignment, recovery and actions to exclusive installation/attempt ownership, with atomic generation checks. A refreshed record must not silently grant ownership to an old tab.

### F3 — P2: The new exercise screen omits approved focus and accessibility behavior

Location: `src/balloons/TrainingJourney.tsx:101–116`.

Reproduction: focus Collect, press native Enter, and wait for its committed result. Focus is `<body>`, rather than **Next balloon**. Activate Next: focus again remains `<body>`, rather than Pump. This also occurred in all seven inventory journeys. An ordinary Space Pump was correctly recorded as `keyboard`, so the defect is the new journey's focus integration, not evidence that all native clicks fail.

The screen displays a Type text label but no stripe/dot/grid balloon identity (`.balloons-training .balloon` count 0). The captured live region contains only “1 of 18 rounds saved. Current exercise state saved.” Category, current/banked values and outcome are ordinary paragraphs outside the live region, despite the bound `verbose: true` baseline setting. The B1 announcement/focus effect only executes for its Practice `view.mode === 'playing'`; it does not cover TrainingJourney.

These are missing implementation semantics under Balloons §§3,5,10, not a claim about screen-reader/device qualification. No physical screen-reader test was performed.

Evidence: [input-blur.txt](audit/input-blur.txt), [fault-results.json](audit/fault-results.json), [browser-results.json](audit/browser-results.json), seven feedback screenshots/text captures. Required correction: carry the specified Type identity, focus handoffs and announcement profile into the assigned-drill UI; verify actual native keyboard transitions.

### F4 — P2: Blur does not pause the assigned exercise

Location: `src/balloons/TrainingJourney.tsx:45–63,114–116`.

Reproduction: during an active drill, deliver `window.dispatchEvent(new Event('blur'))`. The drill remains `active`; no pause command/event is appended and there is no Resume boundary. Pump/Collect return available. TrainingJourney listens to focus/visibility only to reread authority; it never issues a lifecycle pause. The enclosing Practice handler has no live Practice controller after entry to training. The input observer cancels a key cycle but does not pause the drill.

Balloon §3 explicitly requires controls to pause on blur/visibility interruption and a fresh press after recovery; §6 requires interruption/recovery integrity. This is an **injected-event functional reproduction**, supported by source inspection. It does not prove physical OS lifecycle delivery, and does not close or extend B3.

Evidence: [input-blur.json](audit/input-blur.json), [fault-results.json](audit/fault-results.json), [faults.mjs](audit/faults.mjs). Required correction: pause/fence exercise actions at interruption, record the boundary, and resume the same committed round through verified authority.

### F5 — P2: Familiar-inventory labeling is restricted to the current chain

Location: `src/balloons/training-storage.ts:59–66,120–123`; `TrainingJourney.tsx:107`.

Reproduction: complete BL1's `D-maintenance`, retain its started/completed journal, then open the recommendation from a second valid BL2 maintenance baseline in the same installation. The adapter assigns the exact same manifest hash but sets `familiar: false` and `priorAttemptIds: []`. The UI says **“This fixed exercise is new in this training chain.”** and omits **“Familiar exercise”**.

The first sentence is narrowly true about the chain but does not provide the required familiar label for an already-started fixed inventory. Balloons §9 requires a repeated drill to be labeled familiar. The lower-level attempt constructor already filters prior started attempts by installation and inventory; the adapter removes all other chains' attempts before passing that history.

Evidence: [two-chain-seed.json](audit/two-chain-seed.json), [familiar-browser.txt](audit/familiar-browser.txt), [familiar-browser.json](audit/familiar-browser.json), [familiar.test.ts](source/audit/familiar.test.ts), [supplement-results.json](audit/supplement-results.json).

Required correction: calculate familiarity from admitted prior started uses of that inventory across the installation while keeping chain-specific resume/completion selection separate.

## Independent successful checks and exact coverage

- **All five kinds / seven inventories:** outcome, information, updating, consistency A/B/C and maintenance completed through the production UI. **126 rounds, 708 journal events and 21 feedback boundaries** independently reconciled. Policies cycle 0,1,4,32,2,6 pumps and include voluntary collection, burst, cap and loss cases. Python derives each outcome from the frozen threshold and intended action, verifies event sequence/action/revision continuity, money, bound mapping/settings, manifest hashes, router evidence and visible feedback. Outcome's two unscored histories precede Start.
- **All BL mappings:** 21 independently selected/replayed baseline plans across BL1/BL2/BL3; seven full BL1 drill runs plus 14 BL2/BL3 assignment/start screens. Displayed first Type matches the inventory's hidden profile under the original BL mapping. Settings and versioned identities persist. These seeded BL records are admitted canonical journals, not claims of actual prior human play.
- **Unseeded control:** a fresh production-browser preparation → 39 zero-collection rounds → saved report → reload → assigned exercise. The original root has no `training` property and remains readable, with unchanged baseline core after report-view append and training assignment. This is the independently exercised old-B1 schema compatibility control. It is not an exhaustive historical database migration survey.
- **Reload/repeated assignment:** first-round and completed journals remain identical after reload in every inventory run; reopening returns the same attempt, and no additional completion is created.
- **Atomic final completion:** an actual IndexedDB final-action abort leaves 17 results, unchanged training bytes and a null first-completion lock. A committed final write with withheld callback leaves 18 results and one matching lock; the UI reconciles durable state after the watchdog. Releasing the old callback changes neither journal nor lock. Repeating the old action or terminal completion rejects.
- **Deletion/replacement races:** independent adapter probes mutate authority immediately before/after assignment and final transaction. Production-browser cases use a second tab's actual Delete/Delete-all controls with delivery held at assignment, final write and the second post-save verification read. All six browser race cases withhold the old eligibility after deletion/replacement and late delivery. The Delete-all retention defect remains F1. Fresh reads reject missing/deleted/invalid baseline, changed settings/mapping/version, installation mismatch, missing/deleted/corrupt drill and inventory mismatch: 16 explicit rejection cases.
- **Invalid restart:** restarts begin at round one on the same inventory, with fresh identity and no inherited eligibility. Repeated calls on the same old invalid ID produce additional live attempts, including after a first completion; the reproduction is retained as an ownership/idempotency concern associated with F2. It did **not** produce a second first-completion lock and is not reported as a separate grant defect. Ordinary re-assignment after a sole valid completion returns the locked attempt.
- **Delayed notifications:** a queued old BroadcastChannel callback delivered after a newer Pump left current durable training bytes unchanged and rechecked the current view in the exercised case. This is a bounded training regression, not closure of N1's replacement-session case.
- **Hidden data:** all recommendation and 6/12/18 feedback captures contain only projections; no raw manifest/journal fields or hidden burst thresholds rendered. A substituted card rejects authority. An extra opaque `internalRaw: {threshold:99}` header field is admitted by the inherited replay implementation but is **not rendered** by the candidate UI. No claim of cryptographic tamper evidence is made.

Primary evidence: [browser results](audit/browser-results.json), [independent arithmetic](audit/reconciliation.json), [reconciler](audit/reconcile.py), [live/mapping results](audit/live-results.json), [fault results](audit/fault-results.json), [race results](audit/race-results.json), [authority rejections](audit/authority-rejections.json), [adapter log](audit/adapter.log), [fixtures](audit/fixtures.log). Full roots, journals, visible text and screenshots are retained in `audit/`.

The eligibility conclusions above come from actual durable records, not `completedDrillEligibility`'s in-memory proposal. A first-completion lock does not establish an RT reservation, form exposure, playable retest or comparison entitlement. None was inferred or exercised.

## Repository checks — once

`npm run check` passed: lint with the same two inherited warnings; **987 tests / 48 files**; 14 Stop forms; five Stop drills; TypeScript; client and disabled-analytics production builds. `npm run balloons:check` passed nine scored forms and seven drill inventories. Target-versus-parent `git diff --check` passed. SQLite experimental and large-bundle warnings are retained. No repository suite was retried.

Logs: [repository-checks.log](repository-checks.log), [balloons-check.log](balloons-check.log). Additional independent harness runs are separate from that single repository run.

**OBS-1 remains open:** the unchanged Stop focus assertion passed in this run. The B2-A audit's earlier `<body>` versus heading-focus failure remains unexplained. A passing run does not prove flakiness or resolve its cause.

**N1 remains open:** delayed old notifications could affect a replacement Practice session under the prior injection model. Training's tested delayed-message result does not certify the old Practice callback lifetime or universal replacement-byte invariance. Native reachability remains unestablished.

## Harness corrections and limitations

Preliminary audit harness errors are preserved: the system Python lacked `tarfile.extractall(filter=...)`; the trusted local Git archive was extracted with the supported call. External Vitest module resolution was corrected by placing harnesses inside the isolated archive's `audit/` directory. The first assignment-race hook intercepted the preceding asynchronous report-view write; the final harness waits for the assigned-exercise button before arming its hook. A negative test initially assumed all extra header metadata must reject; opaque metadata is instead admitted and was separately tested for non-rendering. An initial second-baseline seed used textual identity substitution and failed canonical replay; the valid reproduction rebuilds the record through `createRecord`/`advance` under its new identity. None of these harness corrections changed product source or the governing contract.

A held periodic authority read leaves the prior eligibility sentence visible while “Checking saved training…” is shown. The two-second watchdog eventually withholds it if the read remains unavailable. This is recorded in `fault-results.json`; no new indefinite stale-eligibility or stale-callback grant is claimed from that observation.

This audit is limited to B2-B at the target/parent above. It does not cover RT reservation/play, comparison, mock integration, approved browser/device/accessibility qualification, physical input/display timing, founder acceptance, deployment or release. Whole B1/mock, full B2, B3, N1 and OBS-1 remain open. The five functional findings are not deferred merely because qualification is excluded.

## Reproduction

All commands run outside the original repository. Start the already-built target:

```sh
cd /private/tmp/balloons-b2b-audit-0273e9a/source
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4197
```

From `/private/tmp/balloons-b2b-audit-0273e9a/`, run `node audit/browser.mjs`, `node audit/faults.mjs`, `node audit/races.mjs`, `node audit/live.mjs`, `node audit/supplement.mjs`, and `python3 audit/reconcile.py`. Saved seed/boundary files are already present. To regenerate synthetic seeds/boundaries and deterministic reproductions, run the individual `source/audit/*.test.ts` files with `./node_modules/.bin/vitest run --config audit/config.ts <test-file>` from `source/`; `python3 audit/plans.py` regenerates the 21 baseline plans from frozen data. The original Python oracle was reused from the prior independent B2-A artifact, inspected and rerun here; it imports no repository production/test implementation. The new browser/adapter drivers were written for this audit.
