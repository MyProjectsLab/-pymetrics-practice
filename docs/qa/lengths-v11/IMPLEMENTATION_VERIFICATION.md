# Lengths Mouth V1.1 standalone implementation verification

## Identity and status

- Exact clean starting SHA: `8821a6c875ccf7da67bbc904d4cb0e037ac3be5b`.
- Isolated checkout: `/private/tmp/lengths-v11-impl`, branch `agent/lengths-mouth-v11`.
- Target: the single coherent milestone commit containing this record. Its SHA is supplied in the worker handoff; no self-referential SHA is embedded here.
- Developer verification: **PASS within the bounded checks below**. Separate exact-SHA functional audit is **pending**.
- Frozen specification readiness PASS at `2f9ea397fdb9d8ec4b625d89f24d07fad94095db` does not certify this implementation.
- No main edits, push, deployment, analytics activation, mock integration, founder personal acceptance, environment/accessibility qualification or release.

## Delivered behavior

The Lengths tile opens a short original mouth-task guide, two face examples, understanding check, input/setup checks and measured readiness. Six canonical forms are replay verified. Browser play has 90 trials in three sets, the six required stage confirmations, selected keyboard or pointer input, intermittent positive feedback and simulated rewards. The normal healthy checkpoint automatically advances; interruption or uncertain delivery uses a neutral retry/manual gate. Each face onset holds the same ordered authority boundary as deletion/replacement through its factual DOM confirmation.

The original V1.0 bar module and frozen assets are untouched and accessible through the labeled legacy route. Mouth V1.1 has its own database, ownership/order locks, versioned records, family counters, snapshots and activity; it neither migrates nor reinterprets legacy reports. Reports are descriptive and make no provider-equivalence, trait, percentile, diagnosis or qualification claim.

Storage captures immutable checkpoint/terminal state before callbacks, validates complete authoritative preimages inside writes, and publishes Saved only after exact readback. A delivery timeout remains uncertain and retries the same request/snapshot. Deleted/replaced installations cannot be revived. Report publication uses ordered admission and immutable targets; unresolved authority withdraws aggregate numbers after one full rendering cycle. Local report-view activity has snapshot revisions, does not modify timed bytes, and permits legitimate later checkpoint extension.

## Deterministic and build checks

| Check | Result / scope |
|---|---|
| `npm test` | PASS: 89 files, 1,536 tests, including 38 new Mouth tests; unchanged existing suites also ran. |
| New Mouth tests | Six canonical all-correct forms each 800¢; wrong/omitted 0¢; eligible miss 750¢; ineligible miss 800¢; replay corruption; stage/watchdog boundaries; 50/51/250/251 quality; 1299/1300 response cutoff; early response plus removal; input rejection; n=5 median and n=8/9 IQR; own-cell sufficiency; factual onset before frame-gap invalidation; authority/idempotence/recovery/activity/deletion. |
| `npm run lint` | PASS with three inherited warnings: frozen checker unused expression, existing M5 script unused parameter, unchanged App history-effect dependency. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS. Large-bundle warning and static/dynamic order-import warnings remain; Mouth has the same import pattern. Build generates existing analytics artifacts but does not activate them. |
| `node scripts/check-lengths-mouth-forms.mjs` | PASS: six forms, 12 rich/4 lean rewards, maximum 800¢, pairwise distance 34–52; payload hashes match freeze. |
| Frozen bytes and legacy source | All seven frozen-file SHA-256 values match FREEZE.md; `src/lengths`, packet and freeze have no diff against base. Dependency package/lock unchanged. |

Source and final build hashes are in [source-hashes.json](implementation/source-hashes.json). The production probe is compiled separately outside the application build; it is absent from the candidate entry bundle.

## Bounded Chromium execution

The scripts use local production preview at port 4188 and a separate production-compiled module probe at port 4190. Playwright Chromium headless shell revision 1208, macOS arm64, viewport 1280×900 unless stated. Each script creates isolated browser contexts and real native IndexedDB. The tests distinguish wall-clock candidate UI from injected clock/callback probes. Executed scenarios are retained as JSON, scripts and two screenshots.

| Evidence | Cases | Actual scope |
|---|---:|---|
| [browser-results.json](implementation/browser-results.json) | 3 | Production candidate UI, actual wall-clock 90-trial keyboard journey, all correct, 90 confirmed onsets/closures, 16 rewards/800¢, both automatic continuations, Saved/report, history genuine views, exact snapshot bytes through review/reload; protected blur invalidation; narrow 350×550 readiness blocked. Browser events are automated, not physical input. |
| [fault-results.json](implementation/fault-results.json) | 19 | Production modules and real DOM/IndexedDB with injected monotonic clock and callback queues: all six confirmation-frame watchdogs and late callback fencing; trial-2 individual deletion/replacement both orderings without notifications; canceled held onset read/order release; canceled owner callback; ownership contention; checkpoint/terminal failed writes and committed-undelivered callbacks, immutable retry and truthful status; hide/manual checkpoint gate; pointer held/simultaneous/outside release. |
| [repair-results.json](implementation/repair-results.json) | 10 | Pending arm cancellation on End/hidden/blur; selected key held during asynchronous arm and reusable owner/same request; four factual DOM failures (missing face, retained face, absent reward, retained feedback); delayed frame factual onset before invalidation with both callback orderings. Clock/callback injection, native IndexedDB. |
| [arm-ui-results.json](implementation/arm-ui-results.json) | 3 | Production candidate UI, native committed arm with held readonly completion; timeout, End, and held selected key each reconcile one request/session/counter. Owner can be reused. |
| [publication-results.json](implementation/publication-results.json) | 2 | Native IndexedDB ordered report-first/deletion-first and canceled stale publication; checkpoint report-view activity retained through legitimate later 60-trial snapshot extension. Synthetic replay-valid state. |
| [ui-authority-results.json](implementation/ui-authority-results.json) | 1 | Production candidate report withdraws numbers after one rendering cycle while native readonly delivery is held; actual second-tab deletion without notifications, then late positive callback cannot restore numbers. Injected replay-valid all-omitted terminal seed, not a physical 90-trial run. |
| [layout-results.json](implementation/layout-results.json) | 4 | CSS zoom 200% face/control fit, pointer-transparent overlay rejection, protected resize invalidation, byte identity of a valid empty legacy root after Mouth arm/Delete one/Delete all. This does not qualify browser menu zoom or populated legacy attempts. |
| [two-tab-results.json](implementation/two-tab-results.json) | 1 | Two actual Chromium tabs, native Web Locks: owner refusal consumes no attempt, canceled/released first owner lets second acquire. |
| [continuation-results.json](implementation/continuation-results.json) | 16 | Onsets 31/61 × automatic/manual paths × individual deletion/replacement × deletion-first/onset-first, notifications disabled. DOM neutral before ordered admission; deletion-first retains no face and unchanged journal, no root revival; onset-first has genuine face/onset before retirement, unchanged durable checkpoint revision, following authority failure. Clock/callback injection, native IndexedDB. |

Total: **59 bounded cases**, plus deterministic tests. The 65-case preflight inventory at `/private/tmp/lengths-v11-preflight/REVIEW.md` is a risk inventory, not a statement that every listed case was run. The table above is the executed scope.

The final production candidate bundle is `index-DBHDnjAp.js`; the final wall-clock journey ran against that build. Final UI-only authority/arm probes also run against that build. The final separate module probe is `probe-C5xncJt0.js`.

## Precommit findings and grouped correction

The read-only precommit source review at `/private/tmp/lengths-v11-preflight/CANDIDATE_REVIEW.md` identified C1–C5 before any milestone commit. Pending Start now has cancellation/generation fencing and owner cleanup; retries freeze the same request; replacing ready runners disposes old listeners and inherits held controls; confirmations require exact factual stage DOM and actual visible contents; a confirmed stage is recorded before same-frame quality/invalidation. Candidate UI and the 10 repair probes exercise these boundaries. The reviewer subsequently reported these source traces closed, without issuing an exact-SHA functional verdict.

Adjacent A1 was reproduced on the uncommitted candidate: `continuation 31 automatic individual delete-first` failed with **“answer-bearing short face exposed before continuation authority”**. `continue()` had called preview rendering before its ordered check. The grouped repair allows `prepare(profile, false)` to retain an empty neutral stage for continuation readiness; the ordered stage renderer alone writes the next face. The expanded 16-case matrix checks the DOM, factual journal and durable root in both checkpoint paths/orderings. The separate read-only [A1 source closure](/private/tmp/lengths-v11-preflight/A1-CLOSURE.md) closed that specific concern at browser source SHA-256 `e622186f0e879aadbbb52ef5988fa0f5bd8ed4983047120cf8eb7dae21f7b80d`, without rerunning browser evidence or certifying the full milestone. No intervening micro-fix commit was submitted. The first expanded set-61 probe timed out because its harness held the earlier set-31 admission; the hold was restricted to the target checkpoint and the set-61 cases reran. That was a harness error, not a product verdict.

## Limits and open gates

These are developer checks, not independent certification. The real complete journey used one standard keyboard form with automated responses. All six form/reward fixtures and wrong/omitted arithmetic were checked deterministically; six full physical journeys, full pointer/accommodated journeys and every 65-case combination were not run. Injected timers, rAF queues, event dispatch, readonly delivery holds and explicit notification suppression establish bounded ordering behavior; they do not certify naturally occurring closed channels or physical timing.

Native user input, screen readers, mobile browsers, OS suspend/resume, full browser/device/accessibility matrix, menu zoom, acoustic behavior and provider equivalence remain unqualified. A legacy-empty-root byte test and unchanged original code/data namespaces establish isolation within that scope; populated historical attempt migration was not exercised because migration is excluded. Complete product acceptance, broader report/delete variations, full mock, analytics/privacy activation, deployment and release remain open. A separate read-only audit must bind its verdict to the final commit.

## Changed-file inventory

Only `src/App.tsx` is an existing product source change: import/route the Mouth journey and update the tile's description, symbol and duration. `IMPLEMENTATION_TRACKER.md` adds bounded candidate status. No original Lengths source, frozen packet, dependency package or lock changes.

New `src/lengths-mouth/` files:

- `contracts.ts`, `manifests.ts`: identities and canonical form verification.
- `engine.ts`, `report.ts`, `core.test.ts`: deterministic replay journal, reward/quality/report calculations and focused tests.
- `storage.ts`, `authority.ts`, `order.ts`, `entry.ts`, `recovery.ts`: separate IndexedDB authority, ownership, ordered admission, exact confirmation and cancellation.
- `report-publication.ts`, `report-session.ts`: report/activity admission helpers.
- `display-context.ts`, `browser.ts`: captured layout context and factual DOM/timing/input adapter.
- `Journey.tsx`, `mouth.css`: original candidate guide/setup/play/report/history and legacy route.

New QA: `IMPLEMENTATION_BRIEF.md`, this record, `implementation/source-hashes.json`, `browser.mjs`, `faults.mjs`, `repair.mjs`, `arm-ui.mjs`, `publication.mjs`, `ui-authority.mjs`, `layout.mjs`, `two-tab.mjs`, `continuation.mjs`, their nine result JSON files, `probe.ts`, `probe.html`, `build-probe.mjs`, `readiness.png`, and `report.png`.
