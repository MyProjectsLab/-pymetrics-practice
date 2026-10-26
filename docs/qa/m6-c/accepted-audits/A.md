# Stop M6-A independent audit

**Verdict: PASS within the requested four-change development scope. No reproducible M6-A blocker found.**

- Target: `1c716a544520309cc814062baf83078870fc2d98`
- Immediate parent: `33400f5e7ab79590381bd46ad6da3db14410932d`
- Date: October 1, 2026, America/New_York
- M5: already founder-accepted, per the founder's audit instruction. Pending-M5-acceptance wording in historical records and the M6-A record is stale.
- This verdict does not grant M6-A founder acceptance, start M6-B/C, establish Stop completion, or authorize deployment/release.

## Identity and scope

HEAD and immediate parent match the request. The working tree was clean at entry and exit, including untracked-file checks. No application, test, tracker, specification, evidence, or Git-state edits were made in the checkout. Tests, isolated browser profiles, and audit harnesses used a temporary git-archive snapshot; installed runtime dependencies were shared. The snapshot's tracked source bytes were checked against HEAD after testing.

The diff contains 52 files: ten product files, six test files, 35 M6-A evidence files, and the tracker. The ten product files implement router versioning/admission, claim leases and onset checks, initial-frame ownership/watchdog, and pre-start access copy/gating. No other game, analytics, mechanics, form manifest, scoring formula, comparison-authority logic, or specification was changed.

Both frozen specifications have identical SHA-256 hashes in the working files, target, parent, and approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| File | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

All source hashes in the developer's TESTED-SOURCE.json match. The fresh TypeScript/Vite build independently reproduced all submitted dist hashes, including `index-P0l-P6T7.js`.

## S46: strict router and historical meaning — PASS

Independent full-router probes made detection the higher-priority candidate and stability the higher-severity candidate. Actual recorded severity differences were:

| Difference | v2 | v1 |
|---|---|---|
| `0.0009999999999996678` | detection | stability |
| `0.0009999999999998899` | detection | stability |
| `0.001000000000000112` | stability | stability |
| `0.001000000000000334` | stability | stability |

The production predicate, extracted without changing its expression, was separately exercised at the immediately adjacent Number values below/equal/above `.001`: tie membership was true/false/false. This distinguishes exact comparator equality from a full-router fixture: near severity 1, representable severity differences cannot equal the Number literal `.001` exactly. In particular, `1.001 - 1` is below the cutoff. Decimal labels are not treated as exact floating-point differences.

A previously recorded v1 chain passed stored-record admission without byte changes. Explicit v1 reproduction retained its original choice; new routing uses v2. v1/v2 admission passed; future and missing versions were rejected, and direct routing with an unknown version threw. A fresh browser reload/resume preserved the historical recommendation through drill recovery.

Evidence: `independent.json`, `comparator-boundary.json`, `router-drill-browser.json`.

## N2: conservative unarmed lease reclamation — PASS

The independently written two-tab Chromium/IndexedDB matrix passed 34 cases across baseline and replay:

- Safe unarmed claims remain reserved at 1,799,999 ms and reclaim at 1,800,000 and 1,800,001 ms.
- Armed claims, uncertain/confirmed exposure, missing/null armed evidence, armed-without-marker records, ambiguous drafts, and saved-result evidence are not reclaimed as unseen.
- Legacy safe null-deadline claims receive a full lease on committed observation. Reads, existing-claim access, and subsequent writes do not renew it. An aborted migration leaves the null deadline intact; the later committed observation starts the full lease. Armed legacy claims remain blocked without inventing a safe deadline.
- Concurrent arm/reclaim, explicit arm-first, and reclaim-first preserve unique ownership. A reclaimed or expired stale owner's arm raises FormClaimExpiredError.

The visible journey probes independently rerun from inspected developer drivers show explicit expiry/restart before arm and before first onset, without silent form substitution. Missing frames retain no scored presentation. Successful known-unexposed cleanup releases the claim; failed draft persistence retains an armed uncertain marker.

An additional independently written browser injection crosses the lease deadline **between the scored DOM write and confirmation**. The attempt becomes invalid; one actual scored onset remains in the immutable draft, its exposure is confirmed, and later allocation cannot reuse the consumed form. Keyboard restart and reload preserve its reviewable history.

Evidence: `independent.json`, `journey-browser.json`, `late-onset.json`. These cases inject wall-clock values and selected storage/frame faults; they do not claim that ordinary browser activity lasts 30 minutes or naturally produces those races.

## Initial-frame watchdog and recovery — PASS

The independent gate matrix checks 1,999.999999, 2,000, and 2,000.000001 ms, timer-first/frame-first ordering, cancellation, duplicate delivery, and late attempted paint. Before the deadline it accepts once; at/after the deadline it rejects once. Canceled delivery cannot paint or start a batch.

Independent orchestration fixtures also check:

- Warm-up, baseline/replay/retest scored entry: withheld callbacks, exact deadline, immutable invalid draft, no invented exposure, hidden/pagehide/freeze/leave races, and late callbacks.
- Successful callback at 1,999.999 ms: warm-up and all three scored modes begin their initial fixation at the actual callback time.
- Missing frame at each of three maintenance block entries: earlier completed blocks and their onset evidence remain retained.
- All 16 block entries across all five drill manifests: hidden, leave, freeze, and successful delayed callback before the deadline. This includes the consistency reset and fourth block.

Fresh visible-browser checks cover warm-up/scored missing callbacks, hidden-page invalidation, keyboard recovery, canceled late canvas writes, failed persistence retaining uncertain exposure, and drill restart retaining one invalid attempt without retest eligibility. The 320 px disclosure capture was reopened and visually inspected.

Evidence: `independent.json`, the four `independent-*.test.ts` files, `journey-browser.json`, `router-drill-browser.json`, and their screenshots.

## Pre-start access — PASS

The exact §22.4 sentence is present at setup and readiness, and at drill introduction:

> This input method can change response timing. You can use it to learn the rule, but this beta will not compare the timing result with the standard physical-keyboard form.

Independent real-UI baseline and retest probes select latency-affected input **after a successful physical-key input check**. Both timed progression controls become disabled; readiness is unavailable. Unselecting does not reuse the old passed check: a fresh input check is required. The checkbox can be operated with Space, and Back/Enter reaches the rule and untimed examples. The drill introduction disables Start drill when the flag is selected. Completed-record validation rejects affirmative latency-affected setup.

Evidence: `access-extra.json`, `journey-browser.json`, `router-drill-browser.json`, `assistive-input-320.png`. This verifies UI disclosure and explicit selection, not detection or certification of physical hardware, native screen readers, or assistive latency.

## Checks and evidence reuse

Fresh focused tests: **134 existing tests in six files, plus 20 independently added tests in four temporary files, all passed.** Some independent tests loop through multiple modes, blocks, or lifecycle conditions. Lint passes with the two inherited warnings; TypeScript and production build pass. The full suite and unrelated form-generation checks were not rerun because their unchanged paths retain accepted parent evidence.

An ordinary fresh production-build check, without timer, frame, or storage fault injection, completed warm-up, reached scored onset, handled automated browser Back, retained confirmed exposure, and showed reviewable history after reload. This is a partial timed journey, not a newly completed baseline/drill/retest qualification.

The accepted parent audit was read at `/private/tmp/stop-m5-audit-33400f5-20261001/AUDIT.md`. 68 source/test files remain byte-identical. Unchanged App completion ownership, comparison authority/display logic, scoring, engine rules, validators, manifests and report/history paths reuse that audit only where this diff cannot affect them. Changed routing, storage migration, first-onset checks, and frame/access composition received fresh checks above. No prior SHA verdict is being presented as a verdict for changed code.

`git diff --check parent HEAD` reports new blank lines at EOF in three submitted logs: `before-tests.txt:183`, `boundary-tests.txt:9`, and `focused-tests.txt:9`. This is a non-blocking evidence-format issue; it is not reported as a passing whitespace check. No file was corrected during this read-only audit.

## Limits

Browser evidence is Chromium headless shell 145.0.7632.6 on macOS, normally 1200×800, with a 320 px preparation check. No approved browser/device matrix was available. No Safari/Firefox, physical display/input timing, native speech, switch/voice hardware, OS suspension, high-refresh display, 200% zoom, or complete accessibility certification is implied. Browser event-loop stalls can delay timer delivery; the callback guard also rejects a late frame when delivered. Synthetic lifecycle dispatch is distinct from native OS behavior. Already-loaded pre-M6 code is not retroactively upgraded. The existing parent rendering-boundary limitation and separate qualification/release gates remain.

## Reproduction

All outputs are isolated under `/private/tmp/stop-m6a-independent-1c716a5`; preserve them before rerunning, as drivers overwrite their own output files.

1. From `source/`, run `npm run dev -- --host 127.0.0.1 --port 5576 --strictPort`.
2. Run `node audit.mjs`, `node comparator-boundary.mjs`, `node access-extra.mjs`, and `node late-onset.mjs` from this directory. Browser drivers use local installed Playwright/Chromium paths recorded in the scripts.
3. `journey-browser.mjs` and `router-drill-browser.mjs` are inspected developer drivers copied here with their server port/output location changed. Their fresh outputs supplement the independently written probes; they are not described as independently designed harnesses.
4. To run the independent deterministic fixtures, copy the four `independent-*.test.ts` files into the temporary snapshot's `src/stop/`, run Vitest on those files, then remove the temporary copies before building. Production source remains unchanged.
5. `npm run build`, then `npm run preview -- --host 127.0.0.1 --port 5577 --strictPort`, then `node production-start.mjs` verifies the ordinary built-app case.

Identity/source reuse is in `identity-and-reuse.json`; exit identity/build checks are in `final-identity.json`. Audit output hashes are in `EVIDENCE-SHA256.json`. The audit servers were stopped. No push or deployment occurred.
