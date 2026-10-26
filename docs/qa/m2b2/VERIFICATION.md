# Stop M2B-2 verification

Date: 2026-09-28. Scope: real-browser integration of the approved Stop V1.1 engine, fixed warm-up, baseline-form exposure, scored run, invalidation, and an in-memory development completion boundary. M2A-01 and M2B-02/03/04 apply. This is an implementation-agent verification record, not an independent audit or release certification. The original evidence below describes `2a63296285656062a2c4e59db042ac954c2f31c1`, which subsequently failed independent audit. The focused-repair section at the end supersedes its handoff status.

## Starting state and authority

The repository was clean on `main` at `a3bfc7aab8908a57978c1007023d4aeb6d17ffe6`, the founder-verified M2B-02 commit. Git status, log, working diff, and index contained no later commit or unfinished M2B-2 work. The previous implementation report did not exist. Read `AGENTS.md`, the tracker, both specifications, and the complete M2A and M2B-1 verification records. No governing document or stored manifest was edited.

M2B-03 and M2B-04 are retained in `IMPLEMENTATION_TRACKER.md`. The fixed warm-up identifier is `stop_warmup_v1`. A baseline reservation is made only after warm-up, on Start scored task. All eligible forms in this milestone are unused, so their never-exposed rank ties; the injected local random choice breaks that tie. An exposed form cannot become eligible again during the same page lifetime.

## Implemented behavior

- Readiness opens protection synchronously, samples current held/focus/visibility/viewport state, acquires game focus, and starts the initial fixation on a DOM-confirmed animation frame. The same engine remains protected through warm-up, the transition/retry screen, form validation, scored trials, and draft creation.
- All timestamps use `performance.now()` with the same origin as preparation. The production timeout scheduler rechecks early callbacks and implements the engine's strictly-after deadline dispatch contract. Browser event/rAF timestamps are not mixed into the journal clock.
- The browser frame adapter changes an isolated DOM host using bundled original inline SVGs, checks presence and layout, and confirms within the eligible rAF. Onset and offset use the actual DOM change; an early response cannot remove the stimulus. These are browser DOM/frame observations, not physical display scanout measurements.
- The canvas contains one centered stimulus/fixation and the unchanged rule reminder. It has no score, counter, progress, sound, animation, or correctness feedback. Live SVGs are not announced through asynchronous live regions. Timed assistive-technology support is not certified by this milestone.
- The engine runs eight unscored warm-up trials, the exact warm-up-complete screen, and 80 stored-manifest trials. Each phase has a 1,000 ms initial fixation. Transitions and final intervals use M2B-02's `max(resolution, confirmed offset) + 1,200 ms`.
- Form exposure is committed on the first actual scored DOM/frame confirmation, even if the engine subsequently rejects the onset for quality. Pre-onset exit releases the reservation; post-onset interruption retains consumption. Exposure is behind `FormExposureRepository` and is **memory-only: refreshing resets exposure memory**. No IndexedDB, history, or cross-tab claim exists.
- Browser listeners cover keydown/up, visibility, focus/blur, pagehide/pageshow, freeze/resume where delivered, resize, browser back, beforeunload, in-app link/library exit attempts, OS accessibility media changes, and unexpected application errors. The integration also exposes a settings-attempt adapter for product setting controls; no mid-run settings UI is offered. Browser zoom is caught where a resize/DPR change makes it observable.
- Only the selected response key's default is prevented during protection. Modifier/composition input cannot score; physical held state survives modifier release, repeated input, focus changes, and phase transitions. Invalid/closed runs release default interception; ordinary pages retain keyboard behavior.
- Hidden/focus/viewport/settings/input/timing reasons use the exact Section 15.4 sentence and Section 23.2 recovery. Lifecycle suspension/restoration maps to timing failure under Section 14.3. Integrity/application failures use Section 23.3 technical recovery and retain the integrity reason. Invalid records include all available events and metadata in the active-tab buffer. The UI explicitly states the memory limitation.
- Preparation `stop_event_v1` events and engine `stop_engine_event_v1` events form one consecutive, immutable journal. Completion checks its session/order/timestamps, the engine's retained copy, all 80 results, the registered manifest identity, and the SHA-256 manifest validation. No missing outcome is estimated.
- The immutable `stop_development_draft_v1` retains setup, baseline mode, timing/specification/warm-up versions, full manifest/seed/checksum, realized sequence, browser/viewport context, wall times, clock origin, engine quality/reason, and the complete journal. Its status is `timed_run_finished_awaiting_m3`; scoring version and summary are null. The draft exists before `endProtection`; the retained final copy also includes `protection_ended`.
- There is no `session_completed`, aggregate score, report, valid-baseline claim, saved-result claim, completed product-session claim, persistence, training/retest, analytics, or deployment.

The M2B-1 engine's broken-clock/record-integrity failures remain immediately invalidating. A genuine warm-up presentation/timing anomaly gets the one M2B-03 retry; non-timing interruptions do not.

## Required commands

Environment: Node.js 24.13.1, npm 11.8.0, existing dependency lockfile. No dependencies were added.

| Command | Result | Evidence |
|---|---|---|
| `npm run lint` | Passed; no warnings | `lint.txt` |
| `npm test` | Passed: 18 files, 322 tests | `tests.txt` |
| `npm run build` | Passed: TypeScript 6.0.3 and Vite 8.3.1 production build | `build.txt` |
| `npm run check` | Passed: lint, same 322 tests, 14-manifest deterministic regeneration, build | `check.txt` |
| `git diff --check` | Passed | Final handoff check |

### New deterministic coverage

| File | Responsibility |
|---|---|
| `src/stop/run.test.ts` | Fixed warm-up and full 80-trial orchestration; immutable continuous journal; draft boundary; manifest validation failure before/after exposure; interruption while completion validation is pending; early/post-offset/timeout anchors; held input across scored activation; restart limit; non-timing interruptions; all five settings categories; brief/long blur; reservation/release/exposure/exhaustion; injectable random ties |
| `src/stop/browser.test.ts` | Production scheduler's inclusive/strictly-after boundaries and cancellation; actual eligible DOM onset/offset changes; missing/zero-size/canceled presentation; both visual profiles; modifier-to-held input protection; scoped defaults; lifecycle, focus, resize, route, media-preference and unexpected-error wiring; listener cleanup |
| `src/stop/LiveRun.test.tsx` | Minimal live canvas, focus transfer, exact warm-up and restart copy, exact recovery reasons/actions, technical failure, no-unused-form error, explicit development draft and M3 boundary |
| `src/stop/assets.test.ts` | All five bundled inline SVGs byte-match their original M1 public assets |
| `src/App.test.tsx` | Existing preparation regression now expects the real timed handoff, including StrictMode and readiness held-key protection |

All prior engine tests remain intact. These fixtures establish logic and boundary behavior; jsdom is not browser timing evidence.

## Real-browser development QA

**Engine:** Chromium / HeadlessChrome **145.0.7632.6**, installed Playwright Chromium headless shell build 1208, on this macOS development host. The recorded UA reports Macintosh Intel Mac OS X 10_15_7; that UA is not an OS/hardware attestation. Viewport: **1024 × 768 CSS pixels**, with a native resize to **767 × 600** for invalidation testing. The founder has not approved a final supported browser/device matrix.

The final full run used actual browser timers, `performance.now()`, rAF, production DOM adapters, the full preparation UI, and no accelerated clock. Preparation and the held-key scenario use Playwright's browser keyboard API. The full-run response script dispatches synthetic DOM keyboard events on observed stimuli; it tests the production input adapter but does not measure a person's physical keyboard latency.

### Measured full run

`full-run.json` contains the full retained journal and independent DOM observations. `timing-summary.json` is regenerated from it by `node docs/qa/m2b2/summarize-timing.mjs`.

| Measurement | Final observation |
|---|---|
| Assigned form | `stop-baseline-03` |
| Completed trial resolutions | 8 warm-up + 80 scored |
| Retained consecutive events | 784, including preparation and protection end |
| Confirmed stimulus visibility | **200.7–209.0 ms**, mean **204.87 ms**, across all 88 presentations |
| Eligible-onset to confirmed-onset delay | **1.4–8.5 ms**, mean **2.46 ms** |
| Initial fixation to first confirmed onset | Warm-up **1,003.5 ms**; scored **1,008.5 ms** |
| Transition anchor to next onset / final boundary | **1,200.5–1,203.4 ms** |
| Final scored interval | **1,200.7 ms** from the M2B-02 anchor |
| Early response example | **150.6 ms**; full visibility retained; next onset **1,202.2 ms after offset** |
| Post-offset response example | **350.8 ms**; next onset **1,202.2 ms after resolution** |
| Timeout example | Logical deadline at onset +1,000 ms; next onset **1,202.0 ms after deadline** |
| Timing anomalies | **0** |
| Space default-prevention failures during protection | **0** |
| Observed scroll position throughout live run | **(0, 0)** |
| Unexpected JavaScript page errors | **0** |

The script checked the exact 80-item realized sequence, 88 resolution records, one exposure marker, null scoring/summary fields, no `session_completed`, and restoration of normal Space handling after protection. The ignored-input record includes wrong, repeat, extra, and late input. The held/premature path is covered separately below. Screenshots were reopened and visually inspected: `live-canvas.png`, `development-checkpoint.png`, and `warmup-restart.png`.

### Interruption and recovery scenarios

`browser-faults.json` retains **13 passing scenarios**, each with its invalid draft and exact rule:

1. Hidden page: injected visibility state plus `visibilitychange`; immediate stop.
2. Visible long blur: injected blur; real unaccelerated browser watchdog invalidates after one second.
3–6. `pagehide`, `pageshow`, `resume`, `freeze`: injected lifecycle events; invalidation and no continuation.
7. Unsupported resize: native Playwright viewport change to 767 × 600; immediate stop.
8. Accessibility setting: native browser reduced-motion preference change; immediate stop.
9. Browser back: native history back/popstate; recovery remains available.
10. Held/repeated/premature input: actual browser keyboard down/up through fixation and onset; no accepted inherited response. Two injected visible blur/focus pairs of approximately 300 ms remain non-invalidating; a deliberate subsequent pagehide ends the fixture.
11. Warm-up retry: deliberate 300 ms main-thread stalls in the production rAF callback cause one exact restart screen and then `second_warmup_anomaly`; no form exposure.
12. Exit after reservation but before first scored onset: zero exposure markers; reservation released.
13. Exit after first confirmed scored onset: one exposure marker retained; the next reservation excludes that form.

**Native lifecycle limitation:** exploratory CDP `Page.setWebLifecycleState(frozen/active)` calls did not produce a usable native lifecycle invalidation in this headless environment, even with a 300 ms interval. That probe did not pass native freeze certification. Freeze/resume behavior is therefore claimed only for delivered/injected browser events. Native tab hiding, OS focus/suspension, physical keyboard hardware, display scanout, other browsers, other refresh rates, and the final browser/device matrix still need release QA.

### Reproducing browser QA

Start a fresh Vite server before the scripts. Editing application modules during a run can create separate hot-reload module instances and invalidate retained-buffer inspection; do not treat such a run as evidence.

```sh
npm run dev -- --host 127.0.0.1
# In another terminal, provide the installed Playwright module and browser binary:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chrome-headless-shell \
node docs/qa/m2b2/browser-qa.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chrome-headless-shell \
node docs/qa/m2b2/browser-faults.mjs
node docs/qa/m2b2/summarize-timing.mjs
```

Run the timing and deliberate-stall scripts separately. These tools are development QA dependencies supplied by the workspace runtime, not application dependencies.

## Acceptance-test status

“Passed for M2B-2” is limited to the implemented development behavior and the evidence above. It never means release or supported-browser certification.

| IDs | Status and limits |
|---|---|
| S01 | **Partial.** Guide through timed draft works; no product completion/report yet. |
| S02 | **Partial.** Approved warm-up/recovery copy and founder-authorized development boundary tested. Report/training/history copy remains later work. |
| S03–S05 | Prior preparation checks retained and regressions passed. Hardware remains self-confirmed plus input check. |
| S06 | Preparation gate retained; no new touch-only or broad device certification. |
| S07–S14 | **Passed for M2B-2** input/default/held/repeat/extra/wrong/fixation/late behavior in fixtures and the recorded browser environment. Physical hardware and shortcut matrix remain open. |
| S15–S18 | **Passed for M2B-2 development timing.** Measured frame/DOM visibility, initial fixation, post-offset input, M2B-02 progression and final interval. Physical display and support-matrix certification remain open. |
| S19–S20 | **Passed for M2B-2.** Fixed unscored warm-up, exact transition, no warm-up form allocation, and minimal live canvas. |
| S21–S24 | Prior M1 audits retained; all 14 manifests regenerate identically. Final originality/release gates remain as previously recorded. |
| S25–S26 | **Passed for memory-only M2B-2 exposure.** Before/after onset exercised in fixtures and browser. Durable behavior belongs to M5. |
| S27–S34 | M3 scoring/report work. Existing engine timing-boundary evidence for S28 is retained; no aggregate score or report is claimed. |
| S35–S38 | **Passed for adapter/integration handling of delivered events.** Browser injected visibility/lifecycle and blur tests plus real timers; native OS/tab/lifecycle matrix remains open. |
| S39–S40 | **Partial.** Existing deterministic scored anomaly rules and new warm-up retry/invalidation pass. M3 notes/denominators/reports and browser-matrix qualification remain open. |
| S41 | **Passed for input-rule integration.** Exact thresholds remain covered by the engine; browser input classifications are retained. |
| S42 | **Passed for exposed integration paths.** All five setting categories tested deterministically; native media setting change tested. Device changes that the browser cannot identify and broader assistive environments remain a support gate. |
| S43 | **Passed for M2B-2 draft integrity.** Retained engine events, full manifest/checksum/80-trial reconciliation and interrupted async validation tested. Product scoring/write recovery belongs to M3/M5. |
| S44–S60 | Reports, training/retests and durable storage remain unimplemented. M2B-2 exhaustion and temporary-memory disclosure are not a claim that all those tests pass. |
| S61–S63 | Prior standard-marker/shape/no-extended-time evidence retained; both SVG adapter profiles and byte-identical asset copies tested. Full visual/comparison review remains open. |
| S64–S65 | **Partial.** Keyboard/focus on new screens, fixed centered live canvas and 1024 × 768 browser evidence; prior content reflow tests retained. Screen-reader, 200% zoom, and full matrix QA remain open. |
| S66 | **Passed for below-minimum resize integration**, including native browser resize. Other device/orientation environments require matrix QA. |
| S67 | **Partial.** No live animation; existing reduced-motion CSS retained; mid-run preference changes invalidate. Broader accessibility review remains open. |
| S68 | Not implemented: M3 report recovery. |
| S69 | **Partial.** Engine/integration technical failure, local draft diagnostics, and exact technical recovery tested. Full product/report/storage recovery remains later work. |
| S70–S73 | No analytics, scoring reproduction, or persistent history implementation; no release pass claimed. |
| S74–S75 | Scope/claims/provenance checked for new code and development copy. Final product claims/rights audit remains open. |

## Governing-document integrity

Compared each working file's SHA-256 with its bytes at the founder-verified starting commit. Both match the recorded approved hashes exactly:

| File | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

No specification, dependency lockfile, or released manifest changed. New code and fixtures are original repository work; SVG artwork is unchanged and its provenance is recorded in `docs/STOP_ASSET_PROVENANCE.md`.

## Changed-file inventory

- `IMPLEMENTATION_TRACKER.md`, `README.md`: current scope, founder clarifications and status boundaries.
- `docs/STOP_ASSET_PROVENANCE.md`: inline bundle copies of original assets.
- `src/App.tsx`, `src/App.test.tsx`: availability copy, fresh-attempt restart and real readiness handoff regression.
- `src/App.css`: fixed centered live canvas and live scroll containment.
- `src/stop/Journey.tsx`: controller/adapters, continuous protection, readiness handoff and recovery navigation.
- `src/stop/LiveRun.tsx`, `src/stop/LiveRun.test.tsx`: live, transition, retry, invalidation, exhaustion and development-draft screens.
- `src/stop/browser.ts`, `src/stop/browser.test.ts`: scheduler, DOM/frame rendering and browser-event adapters.
- `src/stop/exposure.ts`: replaceable exposure repository and active-tab memory implementation.
- `src/stop/run.ts`, `src/stop/run.test.ts`: warm-up/scored orchestration, journal/manifest reconciliation, development drafts and integration fixtures.
- `src/stop/engine/engine.ts`: one explicit integration technical-failure entry point using the existing integrity rule.
- `src/stop/assets.test.ts`; `src/stop/assets/fixation.svg`, `standard-go.svg`, `standard-no-go.svg`, `shape-go.svg`, `shape-no-go.svg`: identical bundle assets and source-equality checks.
- `docs/qa/m2b2/VERIFICATION.md`: this record.
- `docs/qa/m2b2/browser-qa.mjs`, `browser-faults.mjs`, `summarize-timing.mjs`: reproducible browser tests and measurement extraction.
- `docs/qa/m2b2/full-run.json`, `browser-faults.json`, `timing-summary.json`: full raw development evidence and measurements.
- `docs/qa/m2b2/live-canvas.png`, `development-checkpoint.png`, `warmup-restart.png`: reviewed screenshots.
- `docs/qa/m2b2/lint.txt`, `tests.txt`, `build.txt`, `check.txt`: final command output.

## Handoff states and remaining gates

| State | M2B-2 disposition |
|---|---|
| Implemented | Yes, within the requested development scope |
| Tested | Yes: deterministic/component checks and the bounded Chromium QA above |
| Independently audited | Original commit `2a63296285656062a2c4e59db042ac954c2f31c1`: FAIL. Focused repair: not independently audited. |
| Founder implementation approved | Pending; specification/implementation authorization is already approved |
| Deployed | No |
| Released | No |

No new blocking product ambiguity was identified. Native lifecycle delivery, the founder-approved browser/device matrix, release accessibility/visual approval, M3 scoring/report completion, M5 persistence and later release work remain explicit gates. Refreshing erases the current records and exposure memory. The final implementation commit is reported separately so this file does not contain a self-referential commit identifier.

## Focused repair after independent audit FAIL

The independent audit **failed** at `2a63296285656062a2c4e59db042ac954c2f31c1`. Its blocking finding was loss of the confirmed first scored presentation when immediate onset-quality rejection followed exposure. The founder separately requested that repair and correction of generic technical-recovery copy. The audit report, reproduction script, and raw evidence under `/private/tmp/stop-m2b2-audit-2a632962/` were read before editing. Starting HEAD matched the failed target; status and working/index diffs were clean.

### Repair behavior

- `engine.ts` records `fixation_ended` and `stimulus_presented` at the confirmed monotonic timestamp before onset-delay/post-transition quality evaluation. A focus-duration check deferred only for this confirmed-onset observation then invalidates immediately when applicable. Clock validation, cancellation, duplicate-callback guards, quality thresholds, and input eligibility remain in force.
- `run.ts` commits baseline exposure from the retained first scored `stimulus_presented` event, using `confirmedOnsetMs` exactly. Thus any committed exposure has the same identity/onset evidence in the canonical ordered journal, and invalid-draft `realizedSequence` contains that stimulus. Quality rejection does not create a scored trial resolution or open a response window.
- Pre-onset interruption still cancels presentation and releases the reservation. A stalled onset callback that actually confirms before its blocked watchdog runs remains exposed and invalid.
- The engine event payload/schema and development-draft schema are unchanged: this repairs omitted observations and their ordering, without redefining fields or altering historical records. No governing specification or form was changed.
- `LiveRun.tsx` uses the exact Stop §23.3 heading, body, and actions for technical failures. It no longer appends “The recorded trials did not match the assigned form.” The active-tab development disclosure and comparison-ineligibility label remain. Local `integrity_checked.detail`, the invalidation's triggering sequence, draft form/environment, and timing events distinguish a browser/canvas failure from actual manifest/event mismatch.

### Deterministic/component regression evidence

Before product edits, the two new confirmed-onset tests and revised technical-copy assertion failed against the original implementation. After the repair:

- A 600 ms stall inside the scored onset callback retains the confirmed GO identity at 20,200 ms, before severe timing invalidation; exposure has exactly that timestamp, realized sequence contains GO, and no scored outcome/completion exists.
- The same callback with a visible blur that expires during the stall retains confirmation before long-blur invalidation.
- Pre-onset exit at 1 ms before eligibility leaves no exposure/realized stimulus; later canceled callbacks remain inert. Post-onset exit preserves exposure and realized identity.
- Ordered, monotonic, session-matching journals and canonical retained copies reconcile. Invalid results have null scoring/summary fields, no `session_completed` or `protection_ended`, and no invented scored resolution.
- A browser error passes through `bindBrowserEvents` → real run/engine → invalid draft → rendered recovery UI. The exact technical body/actions appear without a form-mismatch assertion, and the local diagnostic says `Unhandled browser error during protected interval`.
- Existing manifest-validation failures are additionally checked for their distinct local details: `Assigned manifest validation failed` or `Assigned manifest or continuous journal mismatch`.

`npm run check` passed: lint, **18 files / 325 tests**, deterministic regeneration of all **14 manifests**, TypeScript, and Vite production build. `git diff --check` passed. See `repair/check.txt`. These are implementation-agent checks, not independent audit approval.

### Real-browser repair regressions

Chromium / HeadlessChrome **145.0.7632.6**, macOS development host, **1024 × 768 CSS pixels**, isolated Vite server on port 5187. Actual production adapters, browser timers, rAF and `performance.now()`; no accelerated clock. Preparation used Playwright browser keyboard input. Faults were deliberately injected as described below. These are browser DOM/frame confirmations, not physical display scanout measurements.

| Scenario | Result / raw evidence |
|---|---|
| 600 ms stall inside first scored-onset rAF | Passed. GO DOM write; `stop-baseline-02` consumed. Eligible onset 20,406.6 ms, confirmed onset/exposure 21,008.6 ms (602.0 ms late). Journal sequences 79–83: scheduled → fixation ended → presented → timing anomaly → invalidated. `realizedSequence` is `["GO"]`; no scored resolution/timeout/response/completion. Next reservation excludes the consumed form. |
| Exit during initial scored fixation, before any confirmed scored onset | Passed. Injected pagehide immediately invalidates; zero exposure markers and empty realized sequence. After another 1,600 ms, no canceled callback consumes a form. The released form remains among all four available baseline reservations. |
| Canvas failure | Passed. Deliberately detached the presentation host; production DOM adapter detects failure. Exact §23.3 recovery copy; local detail `DOM presentation confirmation failed`; no form-mismatch candidate assertion. |
| Browser failure | Passed. Injected ErrorEvent reaches the production browser listener and run integration. Exact §23.3 recovery copy; local detail `Unhandled browser error during protected interval`; no form-mismatch candidate assertion. |

All four retained invalid drafts have consecutive sequence numbers, monotonic timestamps, null scoring/summary fields, and no product completion. There were no unexpected page errors. `repair/technical-recovery.png` was reopened and visually inspected.

Evidence and reproduction:

- `repair/browser-regression.mjs`: four-scenario assertion driver, adapted from the independent audit's preparation and stalled-frame reproduction.
- `repair/browser-regression.json`: complete raw drafts, exposure markers, candidate text, DOM-write evidence, and reuse evidence.
- `repair/technical-recovery.png`: browser-error recovery screen.
- `repair/check.txt`: final command output.

```sh
npm run dev -- --host 127.0.0.1 --port 5187 --strictPort
# Separate terminal, using an existing external Playwright runtime and Chromium:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chrome-headless-shell \
QA_URL=http://127.0.0.1:5187 \
node docs/qa/m2b2/repair/browser-regression.mjs
```

The original `full-run.json`, `browser-faults.json`, screenshots, and timing summary remain historical evidence for the original failed SHA. This focused repair did not repeat the full 80-scored-trial browser run or the full browser fault matrix; the complete automated suite, including full 80-trial orchestration and timing-boundary fixtures, passed. No browser/device certification is claimed.

### Acceptance, unchanged authority, and remaining gates

The focused S25/S26 boundary and M2B-2 invalid-draft retention regressions pass in the recorded environments. Technical-recovery copy and local diagnostic distinctions pass component/integration/browser checks. This evidence does not convert the broader S43/S69, guide-to-report S01, or full release matrix into completed acceptance tests.

Both working governing documents still byte-match the founder-verified base `a3bfc7aab8908a57978c1007023d4aeb6d17ffe6` and original target:

- Master Strategy SHA-256: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`
- Stop V1.1 SHA-256: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`

Explicitly still open:

1. **Audit N1:** initial-frame watchdog/recovery. No timeout or retry policy was invented or implemented.
2. **Audit N2:** missing pre-start screen-reader timed-game disclosure. No related UI/assistive behavior was changed.
3. Fresh independent audit at the new repair SHA and founder implementation acceptance.
4. Founder-approved browser/device matrix; native visibility/OS lifecycle, hardware/display, other-browser, screen-reader, zoom, and release accessibility/visual qualification.
5. Later scoring/report completion, durable storage, and release gates. M3 was not started; exposure and records remain active-tab memory only.

**States:** focused repair implemented and tested; new commit not independently audited; founder acceptance pending; not deployed or released. The previous independent FAIL remains attached to its original exact SHA. The focused repair's full commit SHA is reported in the handoff, avoiding a self-referential identifier in this document.
