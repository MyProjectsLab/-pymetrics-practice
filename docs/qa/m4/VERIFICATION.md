# Stop M4 implementation verification

Status: **local implementation and developer verification; independent exact-SHA audit and founder implementation acceptance remain open.** Work began from clean `d386d5b54ed5873a43f515080b81f728ffc6a1c1`, the founder-accepted M3 head. M2B-2 and M3 accepted behavior remains in scope for regression. No remote push, deployment, release, or other game implementation was authorized.

The repository `AGENTS.md`, complete Master Strategy, complete Stop V1.1, tracker, M3 verification and repair record, and the three M3 audit records were read before implementation. The M3 audit limits carried forward are S68 browser-refresh recovery, N3 `report_viewed`, initial-frame handling, pre-start screen-reader disclosure, and browser/device/accessibility certification. The frozen documents remain untouched. SHA-256: Master Strategy `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`; Stop V1.1 `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.

## Founder decisions and recorded §21.4 clarification

The founder approved M4-02 through M4-06 in the final M4 readiness package and confirmed M4-01's internal build-order exception. This record is **outside** `docs/specifications/` and does not revise the frozen specification. The twelve-game Public Beta scope is unchanged.

| Decision | Implemented interpretation |
|---|---|
| M4-01 | Implement only Stop M4 over the accepted same-tab M3 result. The drill runner reuses the accepted monotonic engine with explicit per-block timing; standard retests retain standard timing and scoring. |
| M4-02 / founder §21.4 clarification | Temporary mode permits **one active training chain at a time**. A later chain can start only after that chain completes and a **new valid baseline** is obtained. Same-page exposure markers remain across sequential chains. No claim is made about previous visits or other tabs. The temporary disclosure, retest explanation, comparison disclosure, `Start retest` action, and `Baseline and retest` heading use the final readiness package text. |
| M4-03 | Any baseline timing note excludes response-stability routing. Other eligible routes continue to be evaluated. The exclusion is recorded with candidate evidence and shown beside the recommendation, including maintenance; the timing note is not treated as evidence for maintenance. Routing uses complete halves, normalized unrounded severity, and the fixed tie priority. |
| M4-04 | Five versioned, seeded drill manifests with SHA-256 checksums, block counts, timing, full-sequence run caps, withholding conditions within Blocks 2 and 3, consistency reset, untimed examples and explicit summaries. All blocks share whole-drill protection and quality counters. An invalid drill restarts from its first block without a retest exposure. |
| M4-05 | The retest explanation reserves one eligible retest form for 30 minutes without renewal. Leaving before scored exposure releases it. The reservation is checked at scored preparation and again before scored presentation. Expiry before exposure returns to the explanation; a real confirmed first scored onset consumes the form, including an expiry race. An invalid consumed retest uses the next eligible form; no family substitution occurs. |
| M4-06 | A separate §20.4 cross-session classifier uses overall accuracy first, retains the two exact trade-off sentences, discloses opposite GO/NO-GO changes, and reports unsupported metrics as unavailable without suppressing supported metrics. It requires identical scoring versions and compatible setup. The founder's 42/18 + 18/2 to 54/6 + 14/6 worked example is an acceptance fixture. M3's within-session block-observation priority is not reused. |

The frozen §19.3 exhaustion sentence asserts browser-wide knowledge that temporary memory cannot establish. M4's temporary-mode exhaustion message is qualified to **records retained by this tab**, consistent with the founder's explicit direction to avoid unqualified browser-history or “unseen” claims. S52's exhaustion behavior is exercised; exact frozen copy is intentionally not displayed in temporary mode. This wording should receive explicit attention in the independent audit and founder acceptance.

## Deterministic and integration evidence

| Acceptance area | Evidence and limit |
|---|---|
| S45–S47 | `training.test.ts`: withholding/detection threshold, half-session consistency, exact hit-drop boundary, false-alarm rise plus count, timing-note exclusion, stability threshold, maintenance, strict tie threshold, one-active-chain/new-baseline rule. The router stores all candidate values and exclusions. |
| S48 | `drills.test.ts` and deterministic `drills:check`: all five manifests, counts, timings, checksum and negative mutations; complete-sequence run caps and within-block withholding contexts. `drill-run.test.ts`: summaries, full maintenance execution, consistency reset and protection, detection deadline. Original seed generator and stored manifests are committed as provenance; no reference-test sequence is copied. |
| S49 | `drill-run.test.ts`: an interruption across the summary invalidates the whole drill; restart begins at Block 1 and no retest form is allocated. |
| S50–S52 | `exposure.test.ts` and `run.test.ts`: reservation boundary, release, no renewal, before-presentation recheck, confirmation-onset consumption including race, invalid attempt, all four retest forms exhausted without replay substitution. Temporary-mode exhaustion copy is qualified as above. |
| S53 | `comparison.test.ts`: incompatible visual profile, binding, or scoring version blocks change comparison; sparse timing suppresses only timing. **Partial:** durable side-by-side history belongs to M5 and is absent. |
| S54 | `comparison.test.ts`: exact founder worked example, 10-point/50-ms bounds, 5–<10-point numbers-only case, opposite GO/NO-GO disclosure, causal limitation and form-difficulty warning. |
| Accepted M2B-2/M3 regression | Existing timing, input, exposure, scoring, report and same-tab recovery tests still run in the full suite. Standard retests use the same 80-trial scorer and result verifier. |

The final `npm run check` passed on the settled source: Oxlint, **25 Vitest files / 402 tests**, deterministic checks for **all 14 standard forms** and **all five drill manifests**, TypeScript, and Vite production build. Raw command output is in `check.txt`. `git diff --check` passed. The exact local commit SHA is recorded in the handoff after commit.

## Browser development check

`browser-development.mjs` uses real Chromium, browser `performance.now`, `requestAnimationFrame`, canvas, keyboard and DOM adapters against the local Vite server. It traverses guide, examples, comprehension, device/readiness, eight warm-up and 80 scored baseline trials, the assigned drill, reserved retest, and comparison in one tab. It checks baseline/retest validity, distinct form identities, drill completion UI, comparison copy, and browser errors, then saves a comparison screenshot and JSON evidence. In-memory chain and exposure-marker invariants are checked deterministically; Vite hot-module instances make a late independent module import unsuitable for that browser assertion. This bounded check is development evidence only; it does not certify human response latency, native lifecycle behavior, supported browser/device matrix, accessibility, screen readers, or physical displays.

Two preliminary full traversals reached the comparison with no browser errors, but the development QA driver failed a late direct import of the training singleton: Vite returned a separate module instance whose singleton was empty. That probe was removed from the final driver; it was not treated as product evidence. The final run uses the settled source with no hot reload.

Final stable run: **passed** in headless Chromium `145.0.7632.6` at a `1200 × 800` CSS-pixel viewport. Baseline `stop-baseline-04` and retest `stop-retest-03` both completed as valid, with zero GO keypresses and the expected 0 hits, 60 misses, 20 correct withholds, and zero false alarms. The deterministic router assigned the detection drill; all three blocks completed. The comparison showed the scoped exposure disclosure, separate category changes, causal limitation, and form-difficulty warning. No page errors were recorded. The raw run is `browser-development.json`, and the inspected full-page capture is `comparison.png`. This no-response path verifies flow and sparse timing behavior; it is not a human response-latency check.

## Open gates

- Independent exact-SHA M4 audit and founder implementation acceptance.
- S53 durable side-by-side history in M5; S68 browser-refresh recovery and N3 `report_viewed` remain open.
- Initial-frame handling and pre-start screen-reader disclosure remain open from prior accepted milestones.
- Accessibility and supported browser/device certification, native lifecycle review, deployment, and release remain open.
- Other eleven games, full mock, durable history, analytics consent implementation, and twelve-game Public Beta remain outside this local M4 commit.
