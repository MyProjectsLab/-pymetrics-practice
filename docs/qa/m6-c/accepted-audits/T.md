# Independent Assessment Practice Stop M2B-2 audit

## PASS — exact SHA

**9127249f49ab51f84c5e59cd560cecdcfc7ede31**

The prior blocking confirmed-onset record failure is repaired at this SHA. No blocking finding was identified in the requested M2B-2 development scope. Two previously recorded non-blocking findings remain open. This verdict does not approve release or close the browser/device, accessibility, scoring/report, persistence, or founder-acceptance gates.

- Failed parent: `2a63296285656062a2c4e59db042ac954c2f31c1`.
- Last founder-verified base before M2B-2: `a3bfc7aab8908a57978c1007023d4aeb6d17ffe6`.
- Repository: `/Users/renzo/Documents/Assessment Practice/App`.
- Audit evidence date: 2026-09-28 America/New_York / 2026-09-29 UTC.
- Prior FAIL remains attached to the parent. This PASS applies only to the target above.

## Authority and repository integrity

Inspected initial Git status, HEAD, parent, log, working/index diffs and the complete repair change set. Read AGENTS.md, the complete implementation tracker, both binding specifications, M2A/M2B-1/M2B-2 verification records, and the prior independent `/private/tmp/stop-m2b2-audit-2a632962/AUDIT.md` and reproduction. Read the changed production code and tests in context, browser adapters, exposure repository, journal recorder and reconciliation logic. Reviewed the repair driver, raw evidence and screenshot. M2A-01 and M2B-02/03/04 govern the applicable clarified behavior. No governing-document conflict was identified.

HEAD matched throughout the audit checkpoints. Initial and final status and working/index diffs were clean. Every tracked file's SHA-256 was compared before and after. Both specifications also byte-match the founder-verified base, failed parent and target:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

No tracked, product or governing file was edited. Requested checks generated ordinary ignored build/cache outputs. Audit drivers, raw evidence, screenshots and this report are outside the repository. The isolated audit server used port 5188 and was stopped; no other server was stopped. No commit, push, deployment or release was performed.

## Blocking findings

**None in the audited development scope.** The parent audit's B1 is resolved by fresh reproduction and journal verification at this target.

### Prior B1: confirmed onset rejected for severe timing

Sources: `src/stop/engine/engine.ts:148–188`, `src/stop/run.ts:81–110`.

Reproduction: complete the real eight-trial warm-up, then insert a 600 ms main-thread stall inside the first eligible scored-onset rAF. Keep the production DOM adapter, monotonic clock, timers, journal and exposure repository. Separately instrument DOM SVG writes. This is deliberate browser fault injection; it proves the application's DOM/frame-confirmation boundary, not physical screen scanout.

Fresh result (`browser-regression.json`, first scenario):

- Assigned form: `stop-baseline-01`; first identity GO.
- Eligible onset: **20,315.799999952316 ms**.
- DOM/frame-confirmed onset and exposure: **20,917.299999952316 ms**, exactly matching; **601.5 ms** late.
- Journal: sequence 79 scheduled → 80 fixation ended → 81 stimulus presented → 82 severe timing anomaly → 83 invalidated.
- Invalid draft `realizedSequence` is exactly `["GO"]`; DOM instrumentation records the corresponding SVG write before confirmation.
- No scored `response_accepted`, `trial_resolved`, `trial_timed_out` or `batch_finished`. No `session_completed`, protection end, score or summary.
- The form remains consumed and is excluded from the next reservation.

The repair records the observation before evaluating onset quality. Exposure uses that retained event's exact confirmed timestamp. State changes to `response` only after quality and blur checks survive. Cancellation, batch identity, duplicate-delivery and monotonic-clock guards remain ahead of the normal onset flow.

### Additional independent ordering and failure probes

`fixture-probes.mjs` was authored for this audit using production modules with an explicitly synthetic monotonic clock, scheduler and frame adapter. All eight scenarios passed:

1. Severe first-onset stall: one presentation, one exposure, invalid, zero scored results.
2. Blur expires during the same stall: one retained presentation/exposure, immediate long-blur invalidation.
3. Canceled confirmation called manually after interruption: no exposure or realized scored stimulus; retained invalid draft unchanged.
4. Duplicate onset confirmation: one presentation/exposure, integrity invalidation, no second presentation or scored result.
5. Exposure repository throws before mutation: canonical presentation retained, integrity invalidation, recovery screen reached, no fabricated exposure or result.
6. Exposure repository commits then throws: consumed marker retained with the same timestamp; canonical invalid draft retained, no result.
7. One 150 ms onset delay: all 80 scored trials reconcile; engine quality `with_note`, exactly one timing-excluded result, null scoring/summary.
8. Two such delayed onsets: second anomaly invalidates; both presented identities retained, only the first trial resolved.

The artificial pre-write exception tests failure containment; it is not evidence of durable exposure recovery under storage failure. The current production repository is synchronous memory only; M5 remains open.

Additional real-browser probes in `independent-browser.json` confirm:

- A delivered blur that exceeds 1,000 ms while the scored onset callback is blocked retains its actual confirmed presentation and exact exposure timestamp before long-blur invalidation. No scored response, timeout or resolution is created.
- A production eligible-onset rAF callback is withheld, pagehide is injected, then the stale callback is manually delivered after 1,700 ms. It cannot paint, expose, append events or alter the invalid draft. The released form remains among all four available reservations.

The first attempt at the latter probe intercepted Playwright's own rAF-based `waitForFunction` polling callback and timed out. The external driver was corrected to timer polling and rerun. `attempt1-independent-browser.log/json` preserve that harness failure; no product change was made.

## Technical recovery copy and diagnostics

Fresh canvas-detachment and injected browser ErrorEvent tests passed through production browser listeners/adapters, engine, invalid draft and React recovery UI. Both show the exact Stop V1.1 §23.3:

- Heading: “Stop could not finish this session”.
- Body: “A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.”
- Actions: “Restart with a new form” and “Return to library”.

Neither falsely appends the form-mismatch sentence. Both retain comparison ineligibility and the active-tab-only development disclosure. The fresh screenshot was reopened and inspected.

Local `integrity_checked.detail` distinguishes **DOM presentation confirmation failed** from **Unhandled browser error during protected interval**. The invalidation references the diagnostic event. Draft metadata and preceding events retain session, form/version where assigned, environment and timing/state context. The repository's rerun manifest-failure fixtures separately retain **Assigned manifest validation failed** or **Assigned manifest or continuous journal mismatch**. Sink-failure fixtures retain canonical events even after external sink delivery stops.

## Full warm-up and 80-trial browser rerun

**Chromium / HeadlessChrome 145.0.7632.6**, Playwright Chromium headless shell build 1208, macOS **26.6.2 (25G83)** host, **1024 × 768 CSS pixels**. Node **24.13.1**, npm **11.8.0**. The UA's Intel Mac OS X 10_15_7 string is browser metadata, not hardware/OS attestation.

Actual browser timers, rAF, `performance.now()` and production DOM/input adapters; no accelerated clock. The app was served from unchanged target source by Vite. Preparation used Playwright keyboard/control automation. Timed full-run responses were synthetic DOM KeyboardEvents dispatched from observed stimuli. These establish adapter behavior, not human or physical-keyboard latency.

| Measurement | Fresh observation |
|---|---|
| Form | `stop-baseline-02` |
| Resolutions | 8 warm-up + 80 scored |
| Consecutive retained events | 784 |
| Confirmed stimulus visibility | 200.4–209.9 ms; mean 204.806 ms |
| Eligible-to-confirmed onset delay | 1.2–11.5 ms |
| Initial fixation | 1,002.7 ms warm-up; 1,005.5 ms scored |
| M2B-02 anchor-to-next onset/final boundary | 1,200.7–1,211.5 ms |
| Final scored interval | 1,200.8 ms |
| Early response | 150.7 ms; next onset 1,202.4 ms after confirmed offset |
| Post-offset response example | 351.7 ms; next onset 1,201.2 ms after resolution |
| Timeout example | Logical onset +1,000 ms; next onset 1,211.5 ms after deadline |
| DOM-observer time minus journal onset | 0–0.3 ms |
| Timing anomalies / unexpected page errors | 0 / 0 |
| Response-key default-prevention failures / scroll | 0 / (0, 0) |

Independent Python verification recomputed the manifest checksum, fixed warm-up and assigned 80-item sequence, event/session order, presentation identity, outcome classification and response/timeout arithmetic, every transition anchor, exposure timestamp, and protection boundary. Null scoring/summary and absence of product completion were verified. Live-canvas, development-checkpoint, warm-up-retry and technical-recovery screenshots were reopened.

## Interruption rerun and evidence classes

All **13 reviewed supplied fault scenarios** passed on fresh rerun at this SHA: hidden page, long blur, pagehide, pageshow, resume, freeze, below-minimum resize, accessibility preference change, browser back, held/repeated/premature input plus repeated brief blur, first/second warm-up anomalies, and exit before/after first scored onset. All **four focused repair browser regressions** also passed.

- Browser automation APIs: viewport resize to 767 × 600, history navigation, browser media-preference emulation with delivered change events, and keyboard down/up.
- Injected DOM events/state: visibility, blur/focus, pagehide/pageshow/freeze/resume, ErrorEvent. Brief/long-blur waits use real browser time.
- Deliberate faults: rAF stalls, withheld and manually replayed callbacks, detached canvas.
- Synthetic deterministic evidence: exact numerical thresholds, sink failures, duplicate callbacks, scored note/rejection cases, manifest/journal corruption and interrupted asynchronous reconciliation.

No native tab hiding, minimization, screen lock, OS sleep, physical keyboard latency or native freeze/resume certification is claimed. The earlier failed CDP native-freeze experiment is historical evidence; it was not rerun or converted into a pass here.

## Non-blocking findings and unresolved policy

### N1 — Initial-frame gate has no watchdog

Sources: `src/stop/Journey.tsx:75`, `src/stop/run.ts:156`.

Fresh deliberate withholding of the initial rAF, while ordinary timers continue for 1,700 ms, leaves no rendered fixation, invalid draft or recovery screen. Source inspection confirms no watchdog is scheduled for this separate initial gate. An injected pagehide still invalidates it. This is a bounded injected-fault reproduction, not proof of a native browser occurrence.

**Remains open.** The exact timeout and retry/technical-failure policy still needs resolution. No timeout was invented by this audit. Non-blocking for this limited private development verdict; S69 and release recovery acceptance remain partial.

### N2 — Pre-start screen-reader timed-game disclosure is missing

Sources: `src/stop/LiveRun.tsx:21`, preparation/setup/readiness copy in `Preflight.tsx` and `Journey.tsx`.

Live stimuli remain `aria-hidden`; pre-start copy has no disclosure that screen-reader timed gameplay is unsupported. Stop §22.1 requires that limitation to be disclosed, with assistive-input timing boundaries in §22.4. Source/copy review confirms the prior finding remains unchanged.

**Remains open.** Non-blocking only for this private development audit; resolve before candidate release. No native screen-reader test or accessibility certification was performed.

## Repository checks

`npm run check` passed: lint; **18 test files / 325 tests**; deterministic regeneration of **14 forms**; TypeScript and Vite production build. `git diff --check` passed. See `check.txt`. No dependency was installed or modified. A full browser run of the built production bundle was not performed; browser evidence uses target source with the production adapters.

## Acceptance-test boundaries

| Acceptance IDs | Audit disposition |
|---|---|
| S01–S02 | Partial: preparation through timed draft and repair copy verified; report/product completion absent; N2 open. |
| S03–S06 | Preparation regressions pass in current tests/journey; hardware identity remains self-confirmation plus input check; touch/device matrix open. |
| S07–S14 | Development input/default/held/repeat/wrong/extra/late behavior passes; physical keyboard and shortcut matrix open. |
| S15–S18 | Development DOM/frame timing and M2B-02 progression pass; display/refresh-rate/browser matrix and N1 remain open. |
| S19–S20 | Fixed warm-up, transition/retry and minimal live canvas pass. |
| S21–S24 | All 14 standard forms regenerate and pass audits; drill and final originality scope remain later gates. |
| S25–S26 | Memory-only pre-/post-confirmation release/consumption passes, including severe-rejected confirmation and canceled callback. Durable behavior remains M5. |
| S27–S34 | M3 not implemented; S28 input-boundary foundation only. |
| S35–S38 | Delivered/injected event handling passes; native OS/device lifecycle certification open. |
| S39–S42 | Scoped timing/input/settings logic passes fixtures/browser probes; scored report/denominator and wider hardware detection acceptance remain open. |
| S43 / invalid-draft obligation | Prior B1 resolved; canonical presentation/exposure/realized-sequence retention and 80-trial reconciliation pass. Product scoring/write/recovery remains M3/M5. |
| S44–S60 | Reporting, training, retests and durable storage remain later milestones; memory-only tests do not pass the whole group. |
| S61–S67 | Partial: current assets/profiles/keyboard/resize/reduced-motion foundations pass scoped checks; N2, screen reader, zoom, contrast and support matrix remain open. |
| S68–S69 | Report recovery deferred; exact generic recovery/diagnostics pass, but N1 and complete technical recovery acceptance remain open. |
| S70–S73 | Analytics, scoring reproduction and durable history remain unimplemented; no release pass. |
| S74–S75 | Repair copy/scope reviewed, no changed external assets or prohibited claims found; full product rights/claims review remains open. |

## State separation

| State | Status at audited SHA |
|---|---|
| Implemented | M2B-2 repair and development timed-run scope implemented; complete Stop product remains unfinished. |
| Tested | Repository checks, full 8 + 80 browser path, 13 fault scenarios, 4 repair regressions and independent fixtures/probes completed with the limits above. |
| Independently audited | **PASS at 9127249f49ab51f84c5e59cd560cecdcfc7ede31**, scoped to this report. |
| Founder-approved | Specification and implementation authorization are recorded; founder acceptance of this repair remains pending. This audit does not grant it. |
| Deployed | No deployment performed; repository records report not deployed. |
| Released | No release performed; repository records report not released. |

Explicitly open: initial-frame watchdog policy; screen-reader disclosure; founder-approved browser/device matrix and native lifecycle/display evidence; accessibility/visual acceptance; M3 scoring/report completion; M4 training/retests; M5 persistence/history; M6 privacy, rights, claims and other release gates; founder repair acceptance. A changed HEAD requires a new audit.

## Evidence and reproduction

All evidence is under `/private/tmp/stop-m2b2-audit-9127249/`:

- `initial-state.json`, `final-state.json`, `complete-repair.diff`: identity, tracked hashes and complete repair delta.
- `check.txt`: full repository-check output.
- `full-run.json`, `timing-summary.json`, `full-run.log`, screenshots: fresh full browser run.
- `browser-faults.json/log`: fresh 13-scenario interruption matrix.
- `browser-regression.json`, `repair-regression.log`, `technical-recovery.png`: fresh four-scenario repair regressions.
- `fixture-probes.mjs/json/log`: eight independently authored synthetic repair/sink/ordering fixtures.
- `independent-browser.mjs/json/log`: blur-confirmation, stale callback and open initial-gate evidence.
- `verify_evidence.py`, `verify-invalid-evidence.py`, `verification.log`: independent raw-journal assertions.
- `REPRODUCE.md`: exact commands, driver provenance and evidence classes.

Fresh blur-stall confirmation detail: onset/exposure **20922.400 ms**, eligible **20320.700 ms**; invalid rule `stop_validity_v1.blur_over_1000ms`.
