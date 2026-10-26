# Stop M5 focused repair — developer verification

Date: 30 September 2026 (America/New_York).

**Subsequent audit:** the independent audit of `88b7ec53228d258f0048b27c1ca98d7cb76bf092` returned **FAIL** for R1 deletion/retry resurrection and R2 contradictory standard-session evidence. The verification below is historical developer evidence for that SHA. The focused continuation, pre-edit reproductions, case-by-case results and open gates are in [R1/R2 repair verification](../repair-r1-r2/VERIFICATION.md). Fresh separate audit and founder acceptance of that continuation remain pending.

**Status: implemented and developer-tested. Independent audit of the repair SHA and founder acceptance remain pending.** The independent FAIL remains attached to `bcf319f05f8f371e39688ee51fc2fa8b7b6c1caa`. This repair does not claim an audit PASS, deployment, or release.

## Authority and starting state

The founder authorized B1–B5 and N1 in the independent [audit](/private/tmp/stop-m5-audit-bcf319f/AUDIT.md). Read that audit completely, repository `AGENTS.md`, both complete governing specifications, the tracker, and the M5 verification record before implementation. Initial HEAD was `bcf319f05f8f371e39688ee51fc2fa8b7b6c1caa`, parent `0c5f984048721a8dfd25a6a75e67bf594c83b206`; index and working tree were clean.

The governing documents retain their approved SHA-256 hashes:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

No specification, standard form, drill manifest, timing engine, scoring formula, routing threshold, claim boundary, or twelve-game Public Beta scope was changed. The drill runner adds only the actual-attempt start callback; timing and input resolution remain independent of storage promises.

## Repairs and acceptance mapping

| Finding / checks | Implemented behavior and focused evidence |
|---|---|
| B1 / S25, S26, S50, S56 | A reviewable invalid draft with an empty realized sequence and no scored presentation no longer blocks allocation after release. Actual/uncertain exposure, live claims, completed records and drafts without clear pre-onset evidence remain conservative exclusions. Deleting the unexposed draft invents no exposure and preserves any later claim/marker using that form. Invalid pre-onset retest history can restore its completed-drill chain. Browser checks cover baseline/replay/retest, exposed controls, reload, deletion and reuse. |
| B2 / S53, S55, S68, S73 | Completed-result admission requires a supported binding code and visual profile, physical keyboard setup, matching final preflight evidence before protection, and matching protection key. Reload also reconciles exposure form identity and visual profile. Rejected source bytes and exposure are preserved. No-response results are tested so key contradictions cannot hide behind response-dependent checking. |
| B3 / S49, S55, S68 | Reload reconciles the drill's boolean validity, completion validity/count/version/checksum, all block journals, initial and post-resolution intervals, final fixation, anomaly observations, quality notes and invalidating lifecycle evidence. Inconsistent chains grant no retest eligibility. All five intact drills pass; valid timing-note and extra-input-note controls also pass. |
| B4 / S53, S73 | History and comparison share canonical compatibility fields: specification, scoring version, visual profile, physical binding code, physical-keyboard class and the supported standard timing. Display labels do not define groups. KeyA/A and KeyQ/A stay in separate series; different display labels for one binding remain compatible. |
| B5 / S55, S59 | Chain writes are serialized with one automatic retry. Failed transitions and attempt journals remain in memory; pending and failed status update the UI and storage disclosure. Failure emits a local diagnostic and exposes an explicit save retry. Reload before successful retry recovers only the older saved state; reload after success restores the completed drill. History refresh cannot replace an unsaved active chain. |
| N1 / local activity | `drill_started` is emitted when the drill enters its protected timed attempt, with that attempt's ID. Intro navigation emits nothing. Each actual retry has a distinct event. Restoration does not synthesize starts for earlier attempts. |

These are implementation-agent regression results, not independent acceptance of the S-checks.

## Automated checks

[check.txt](check.txt): `npm run check` passed:

- Lint: no warnings/errors.
- Tests: **424 passed across 27 files**.
- Standard manifests: **14** match deterministic regeneration.
- Drill manifests: **five** match deterministic regeneration.
- TypeScript and production build: passed.
- `git diff --check`: passed before commit.

The existing deterministic run fixture now includes the real device-check event required by reload validation. The new tests cover contradictory setup/exposure, completion validity, malformed validity flags, severe and fabricated anomaly evidence, hidden-page evidence, missing/short fixation and trial evidence, all five complete drills, legitimate quality notes, canonical grouping, actual start identity, and failed ordered chain persistence with recovery.

## Bounded browser checks

Chromium **145.0.7632.6**, headless macOS, **1200 × 800** CSS pixels. No page errors in the retained passing runs.

| Evidence | Scope and result |
|---|---|
| [browser.json](browser.json), [driver](browser.mjs), [fixture generator](fixtures.mjs) | Real IndexedDB plus complete deterministic production-engine journals. Baseline/replay/retest pre-onset drafts retain full family availability after reload; exposed controls withhold one form. Deletion preserves a reused form's later marker. Setup/exposure/drill audit mutations are rejected on reload without changing stored evidence. A pre-onset retest chain restores and can reserve again. Same-label distinct bindings render two series. Actual UI drill starts and a native Back retry record two distinct starts and zero intro starts. Injected chain-write failures show the visible warning; failure/retry reloads restore the correct durable state. |
| [pre-onset-browser.json](pre-onset-browser.json), [driver](pre-onset-browser.mjs) | Real guide, examples, comprehension, physical-keyboard preflight and eight-trial warm-up. Native Back 200 ms after Start scored task, inside initial fixation. Reload shows the reviewable invalid attempt; zero scored presentations, no exposure/claim, and all four baseline forms available. |
| [completion-browser.json](completion-browser.json), [driver](completion-browser.mjs) | Fresh production-build journey through eight warm-up and 80 scored trials, original report, successful reload, individual deletion and retained exposure marker. This no-response control also exercises setup reconciliation without accepted key responses. |

The focused fixture generator uses an independent deterministic scheduler around the production engines, not summary stubs. Seeding its records bypasses baseline/drill creation UI only for those identified probes. Chain failure is injected at `saveChain`; it is not a natural quota/disk failure. The full journey and native Back checks are separate real-browser creation paths. None of this measures physical input/display latency or certifies the supported browser/device matrix.

Harness corrections: an initial drill driver tried clicking a header covered by the timed canvas; the retained driver uses native Back and the visible Restart drill flow. The retry driver initially reloaded as soon as the failure button disappeared (while saving was still pending); it now waits for confirmed successful saving. A fresh dev-server start was needed after source edits because Vite hot-reload query identities differed from direct test imports. Those preliminary runs are not counted as successful checks.

## Explicit limits and remaining decisions

- **N2 remains open:** an abandoned unarmed baseline/replay claim owned by another tab can strand inventory indefinitely. There is no new timeout, lease, reclamation or ownership policy. Deleting all local data may be the only remaining recovery and also removes useful history. A separate founder decision is required.
- **S46 remains separate:** no precision/tie policy change was made.
- Save retry can recover when storage becomes writable and the chain's required saved results still exist. Closing/reloading before success loses the unsaved transitions; the UI states this. Original saved results are not rewritten to mark an unsaved chain transition.
- Earlier records missing or contradicting required preparation/completion evidence are excluded, preserved and not silently repaired. This is consistency validation, not cryptographic protection against coordinated rewrites of every record.
- Initial-frame recovery, pre-start screen-reader disclosure, native lifecycle/physical timing, supported browsers/minimum versions, full accessibility/visual review, M6, privacy/rights/claims release gates, and the wider twelve-game product remain unfinished.
- No push, deployment, release, independent audit PASS or founder acceptance is claimed. A separate auditor must inspect the new exact repair SHA.

## Reproduction

From the repository root, use installed dependencies:

```sh
npm run check
npm run dev -- --host 127.0.0.1 --port 5198 --strictPort
# Separate terminal, after the final source is saved and the dev server freshly started:
node docs/qa/m5/repair/browser.mjs
node docs/qa/m5/repair/pre-onset-browser.mjs
npm run preview -- --host 127.0.0.1 --port 5199 --strictPort
# Separate terminal:
M5_PREVIEW_URL=http://127.0.0.1:5199/ node docs/qa/m5/repair/completion-browser.mjs
```

Browser scripts use isolated contexts and close them. Installed Playwright/Chromium paths are recorded in the drivers. Evidence files are overwritten on a rerun. No external service is contacted by the product.

## Changed-file inventory

Product:

- `src/App.tsx`
- `src/stop/History.tsx`
- `src/stop/TrainingFlow.tsx`
- `src/stop/comparison.ts`
- `src/stop/drill-integrity.ts`
- `src/stop/drill-run.ts`
- `src/stop/run.ts`
- `src/stop/storage.ts`
- `src/stop/training.ts`

Tests:

- `src/stop/History.test.tsx`
- `src/stop/drill-run.test.ts`
- `src/stop/run.test.ts`
- `src/stop/training.test.ts`

Tracker and evidence:

- `IMPLEMENTATION_TRACKER.md`
- `docs/qa/m5/VERIFICATION.md`
- `docs/qa/m5/repair/VERIFICATION.md`
- `docs/qa/m5/repair/check.txt`
- `docs/qa/m5/repair/fixtures.mjs`
- `docs/qa/m5/repair/browser.mjs`
- `docs/qa/m5/repair/browser.json`
- `docs/qa/m5/repair/pre-onset-browser.mjs`
- `docs/qa/m5/repair/pre-onset-browser.json`
- `docs/qa/m5/repair/completion-browser.mjs`
- `docs/qa/m5/repair/completion-browser.json`
