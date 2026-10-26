# Stop M6-A — correctness and pre-start access

Date: 2026-10-01 (America/New_York). Started from clean HEAD `33400f5e7ab79590381bd46ad6da3db14410932d`.

Status: implemented and developer-tested locally. Independent exact-SHA audit and founder acceptance are pending. This is not Stop completion, browser/device qualification, deployment, or release. No analytics, other game, or frozen specification was changed.

## Authority and unchanged documents

Read AGENTS.md, the complete Master Strategy, complete Stop V1.1 specification, and complete implementation tracker before product edits. The user's M6-A instruction authorizes the strict router correction, 30-minute unarmed baseline/replay lease, 2-second initial-frame watchdog, and pre-start assistive-input disclosure.

Both governing documents byte-match approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

`TESTED-SOURCE.json` records the base, approved-source comparison, and every source/test and production-build file hash. Stored standard and drill manifests remain unchanged.

## Failures reproduced before product edits

Only regression tests and reproduction drivers were added at this point; application code still matched the requested HEAD.

- **S46:** adjacent recorded severities 1 and 1.001 differ by `0.0009999999999998899`. The old router rounded the difference to .001 and incorrectly chose stability over higher-priority detection. The new regression failed with that exact choice.
- **N2:** actual Chromium IndexedDB claims for baseline and replay retained `expiresAtMs: null`; another tab at creation + 1,800,000 ms received form 02 while abandoned form 01 stayed blocked. `before-claims.json` records both families.
- **Initial frame:** a withheld callback still left the run live at 2,000 ms; the recovery assertion failed.
- **Pre-start disclosure:** the exact §22.4 copy was absent from rendered preflight; the visibility assertion failed.

`before-tests.txt`: three new failures, 96 passing existing tests. `claims-browser.mjs` with `BEFORE=1` produced the two claim reproductions. Current-run output without that variable is `claims-browser.json`; both forms are reclaimed at the boundary.

## Implementation

### S46 — versioned strict comparison

New recommendations record `stop_drill_router_v2`. They compare `maximum - recordedSeverity < .001` directly, with no decimal rounding. Trigger formulas, exclusions, maximum-based tie membership, and fixed priority remain unchanged.

Historical `stop_drill_router_v1` is retained as an explicit reproduction path. Storage admission recomputes using the snapshot's recorded version; it neither upgrades a saved recommendation nor replaces its original choice or metrics. Unknown versions fail admission. The chain schema remains `stop_training_chain_v1` because the recommendation already carries its own version.

Tests exercise these adjacent representable stability severities against detection severity 1:

| Severity | Recorded difference | v2 selection |
|---|---|---|
| 1.0009999999999997 | 0.0009999999999996678 | detection |
| 1.001 | 0.0009999999999998899 | detection |
| 1.0010000000000001 | 0.001000000000000112 | stability |

The earlier decimal `.001` fixture now expects the result implied by its actual stored binary values. Tests also reproduce the v1 choice and admit v1/v2 chains without changing their bytes.

### N2 — durable unarmed claims

- New baseline/replay reservations get a 1,800,000 ms wall-clock lease and `leaseVersion: stop_unarmed_lease_v1` in their reservation record.
- The same IndexedDB readwrite transaction checks eligibility, expires safe abandoned claims, and assigns the new claim. Reclamation requires `armed === false`, no exposure marker, no saved result for the form, and no uncertain/exposed draft. Armed claims, missing/unknown armed evidence, uncertain markers, and confirmed markers remain blocked.
- Legacy baseline/replay records with a null deadline and affirmative unarmed/unexposed evidence receive a full lease starting at their first committed observation. Their creation time was not recorded, so no past creation time is guessed. Later reads/writes do not renew it. The existing local schema uses an additive migration; saved journals and recommendations are unchanged.
- `arm` atomically rechecks claim identity, conflict, and expiry. Missing/reclaimed/expired claims raise a typed error. The current tab mirrors the durable deadline and checks it immediately before the first scored DOM presentation. Atomic arming prevents any other tab from reclaiming that claim between arming and this check.
- A stale current tab shows “Form reservation expired” and “Restart Stop”; it does not silently allocate a substitute. Retest keeps its existing explanation/restart wording and lease policy.
- If expiry is observed only after an actual confirmed onset, its onset and consumption are retained and the attempt is invalidated. Once exposed, lease time cannot release the form.

Lease expiry never reclaims armed or exposed records. The existing owner cleanup can still release a known-unexposed attempt after its callbacks are fenced and its journal proves no scored presentation. A failed cleanup write conservatively leaves the durable uncertain marker.

### Initial-frame watchdog

A shared run-owned initial-frame gate covers warm-up, scored starts, and each drill block. It uses the run's monotonic clock and injected scheduler with a 2,000 ms deadline. A callback at or after the deadline fails even if timer delivery was delayed. Success cancels the timer; invalidation/leave cancels the frame and timer. The browser adapter checks the same ownership/deadline guard **before touching the canvas**. Duplicate or canceled callbacks cannot paint fixation, begin a batch, or overwrite a retained attempt.

Hidden-page and lifecycle invalidations retain their existing immediate rules; the watchdog does not resume hidden play. Missing initial frames produce an integrity diagnostic and recoverable invalid screen. No scored presentation is invented. When a fenced run's draft saves successfully, the form is known unexposed and released. If that write fails after arming, the durable uncertain marker stays reserved.

### Assistive input before Start

The exact §22.4 disclosure and explanation of latency sources are visible at setup; the exact disclosure is repeated at readiness. A labeled checkbox lets the candidate identify latency-affected input. It disables timed progression while keeping the guide and untimed examples reachable. Changing back requires a fresh input check. Drill introduction also shows the disclosure and blocks Start drill when this input is selected.

The optional setup flag records this access boundary. Timed run entry and completed-record validation reject an affirmative latency flag. Historical records without it remain supported. No timed assistive profile, modified timing, familiarization score, or standard timing comparison for the selected unsupported input was introduced. Physical hardware and assistive latency remain self-reported rather than automatically detected.

## Deterministic checks

`npm run check` passed:

- Lint; final driver cleanup is recorded in `final-lint.txt` with only the two inherited warnings.
- **510 tests / 32 files.**
- All **14 standard manifests** and **five drill manifests** reproduce from their generators.
- TypeScript and Vite production build, asset `index-P0l-P6T7.js`.

New coverage includes adjacent router values and historical replay; lease expiry before/equal/after, stale arming and armed preservation; timer-first and frame-first deadline ordering, delayed timers, canceled callbacks, hidden/pagehide/freeze/leave races, warm-up and baseline/replay/retest starts, invalid drill retention, disclosure visibility, and access gating. The full suite retains prior storage, timing, completion, deletion, and comparison regressions. `boundary-tests.txt` is an intermediate focused run; the final suite count supersedes it.

## Bounded real-browser evidence

Chromium headless shell **145.0.7632.6**, macOS, normally 1200×800; accessibility reflow at 320×800. Actual IndexedDB and production browser adapters were used. Clock shifts, withheld frames, lifecycle dispatch, and failed writes below are deliberate injections.

| Evidence | Result |
|---|---|
| `claims-browser.json` | Both original baseline/replay abandoned-claim reproductions now reclaim the safe form at exactly 30 minutes. |
| `lease-matrix.json` | **26 two-tab cases**, baseline/replay × before/exact/after expiry; armed, confirmed, uncertain-marker, confirmed-marker, armed-without-marker and unknown-armed controls; legacy migration without renewal; concurrent arm/reclaim; explicit arm-first and reclaim-first. Atomic outcomes preserve unique ownership. |
| `journey-results.json` | **Seven visible journey cases:** accessible preflight, missing warm-up frame, hidden-page race, missing scored initial frame, failed draft write, expiry before arm, expiry before first onset. All asserted cases passed, with raw source runs named in the summary. |
| `journey-browser.json` | Six asserted cases completed before a harness clock-injection error in the seventh case. Its overall `pass: false` is retained. It is not represented as a fully passing run. |
| `journey-lease-before-onset.json` | Corrected seventh case passes: the injected wall-clock wrapper is installed before run creation. No scored onset, explicit restart, immutable draft, no surviving exposure after successful cleanup. |
| `journey-access.json` / `assistive-input-320.png` | Exact disclosure, disabled timed controls, no horizontal overflow, and keyboard return to the rule. Full-page image independently opened and visually inspected. |
| `router-drill-browser.json` | Three adjacent severity cases, unchanged/admitted v1 snapshot, v2 new decisions, reload/resume of historical training, drill latency gate, withheld initial-frame recovery, hostile late delivery fenced, and keyboard restart retaining one invalid drill without retest eligibility. |
| `production-start.json` | Ordinary built-app warm-up and first scored onset, browser-Back interruption, confirmed exposure, invalid draft reconciled to its actual scored presentations, and reviewable history after reload. No timer or storage fault injection. Browser input/navigation is automated. |

The historical seed `historical-assigned-state.json.gz` derives from `/private/tmp/stop-m5-audit-53286f7/fixtures.json` (original SHA-256 `618c790ddd607f3c9590c387d97fcd3c6a568dc7a9f98d2d940c59d61fa91ced`). Only its chain status was set to assigned and its drill-attempt list emptied for the introduction probe. The baseline events and original v1 recommendation were retained. This is seeded boundary evidence, not a newly completed baseline/drill/retest.

### Harness corrections retained

- `preliminary-journey-browser.json`: dynamic imports resolved a separate module instance after development HMR. Restarted Vite before final browser runs.
- `preliminary-journey-save-failure.json`: deliberately failed draft persistence clears the active global writer, so the harness now keeps its original store reference for readback.
- Final seventh journey probe: replacing `Date.now` after run creation did not affect the captured function. A wrapper installed before startup now supplies the injected time.
- `preliminary-production-start.json`: the script attempted to click the site header while the timed canvas intentionally hides it. The final probe uses browser Back and the existing interruption screen. An earlier selector attempt was stopped before completion. `preliminary-production-onset-count.json` records a too-strict one-onset assertion: automated Back occurred after two onsets. The final check admits one to three and reconciles every retained scored presentation with the realized sequence.

These are harness limitations/corrections, not evidence that a failed run passed. Raw results and exact current drivers are retained.

## Reproduction and limits

Run `npm run dev -- --host 127.0.0.1 --port 5566 --strictPort`, then the browser drivers with Node. Start with a fresh Vite server to avoid duplicate HMR module instances. Drivers use the explicit installed Playwright and Chromium paths in their source. The full journey driver runs all seven cases; `CASE=lease-before-onset` or `CASE=access` runs just that named case. For the production probe, first run `npm run build`, then `npm run preview -- --host 127.0.0.1 --port 5567 --strictPort` and `node docs/qa/m6-a/production-start.mjs`. Reruns overwrite their corresponding evidence; copy this directory first to preserve the handoff record.

Limits: no founder-approved browser/device matrix exists in the tracker. These checks do not certify Safari/Firefox, physical display latency, native screen-reader speech, switch/voice hardware, OS-native freeze/suspension, high-refresh devices, 200% zoom, or full accessibility. A browser event-loop stall can delay timer delivery; the guard also rejects late frame delivery. Cross-tab lease deadlines use wall time, independently of monotonic trial timing. Already-loaded older application code is not retroactively upgraded. No new full baseline-to-drill-to-retest real-browser qualification was attempted; complete journeys retain deterministic-suite coverage and prior milestones' separate evidence.

Scope mapping: S46 corrected; N2 availability policy implemented; S25/S26 and S69 focused frame/claim behavior checked; §22.4 and the affected S64/S65 preparation paths checked. Whole-M5 acceptance, full M6, complete S01–S75 acceptance, analytics authorization, supported-environment/accessibility qualification, founder acceptance, deployment and release remain separate gates.

Changed-file inventory: `FILES.txt`. Evidence/source hashes: `EVIDENCE-SHA256.json` and `TESTED-SOURCE.json`. The local commit SHA is the independent-audit handoff; this document cannot grant an independent PASS.
