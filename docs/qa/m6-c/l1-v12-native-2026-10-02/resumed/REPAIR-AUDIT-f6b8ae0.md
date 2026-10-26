# Independent Stop V1.2 repair audit

**PASS — f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1**, against direct parent **68ccbabd7036779e23f57871e97af99c4705c184**. Audit date: 2 October 2026, America/New_York. This verdict closes the original keyboard blocker and the interrupted-warm-up durable-recovery acceptance gap within the requested repair scope. It is not founder acceptance, browser/device certification, analytics activation, deployment, or Public Beta release.

The original repository was read-only and clean at entry and final verification. HEAD and HEAD^ match the requested identities. Fifteen changed files comprise two product files, two regression-test files, ten repair-evidence files, and the tracker. `git diff --check HEAD^ HEAD` passes. No governing-document changes exist. The following hashes match the parent and recorded approved-source hashes:

| Document | SHA-256 |
|---|---|
| Master Strategy | c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3 |
| Stop V1.1 | d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843 |
| Stop V1.2 addendum | a3e5f9f23c55f1ddfb6bdd33f0a689fe510bd471d197d305d7e324c687a92f9c |

Read AGENTS.md, the complete V1.2 addendum, the original FAIL in chat `01a0fdf7-8cb3-74e3-a2b4-f6ded0f15a07`, both V1.2 verification packets, the QA plan, relevant governing sections/status, changed tests, and affected engine/orchestration/browser/recovery code. Developer reports and captures were treated as claims. Parent audit evidence for unchanged preparation/shortcut, admission/reservation, storage and scored behavior is reused only where unaffected; its unverified interrupted-recovery path is replaced by fresh evidence below. This does not expand the prior audit into complete support qualification.

## Keyboard blocker: closed

Fresh production-browser execution verified:

- Space selected: Tab reaches Check example; Space down/up records the GO response while Check remains unresolved; Enter checks it; Space activates Next example once resolved; a later GO accepts a released Space again.
- F selected after normal setup/remapping and Back → Try examples: Tab reaches Check example; Space activates it normally and yields missed-GO feedback, without recording a GO response. Space activates Next example. F down/up on another GO records the response without checking; Space then checks it and produces correct GO feedback. Enter and Tab retain their normal button/focus behavior.
- Actual browser-dispatched key events are trusted. This is automated browser input, not physical-keyboard qualification. The early capture listener's `prevented` field samples before later application listeners and is not used as evidence of final cancellation; visible native activation, recorded example outcomes, and focused unit assertions establish that behavior.

Product change: Examples.tsx cancels only the selected response key while unresolved. No other keyboard semantics were changed in the diff.

## Warm-up restart and durable recovery: closed

Six new adversarial tests in `src/stop/independent-audit.test.ts` reuse the existing deterministic scheduler helper but add independent schedules/assertions. They interrupt before any initial frame using hidden, freeze, pagehide, long blur, and unsupported viewport, deliver restoration before the restarted frame, force old callbacks and duplicate delivery, then complete all eight warm-up plus 80 scored trials. They also test 1999/2000-ms watchdog boundaries, preserve the first timing failure across an intervening lifecycle restart, end on the second missing-frame failure, and fence late callbacks without exposure or result creation.

All six fail with the parent engine (restart returns to `warmup_restart` instead of staying `live`) and pass with the target engine. The parent engine substitution occurred only in this isolated temporary copy; the target source was restored and rechecked. Product builds were never changed during that control.

The engine change acknowledges accepted warm-up restart by entering `waiting`. `warmupActive` still applies interruption/anomaly handling while awaiting the frame; the run's `awaitingInitial` guard prevents premature completion, and scored entry still requires the warm-up-complete screen. Anomaly counts, cancellation ownership and deferred-protection guards remain intact. No regression found in the inspected transition and focused tests.

Fresh production-browser recovery: session `ae647933-ff10-401d-a323-d3168f4e5354`, `stop-baseline-03`, Space, standard visual profile, 1280×720, reported macOS Chromium 154. Run began **17:23:17** and completed **17:26:56 EDT**. No task responses were made; the expected result is 0 hits, 60 misses, 20 correct withholds and 0 false alarms. This tests completion/persistence, not skilled performance or physical response timing.

An independent sidecar delays only the initial frames and injects explicitly untrusted visibility/restoration events; the production JavaScript bundle is unchanged. The completed journal proves:

- Hidden event 5 → warm-up interruption 6 → restart-required 7, before any fixation/trial presentation.
- Old canceled frame delivered later without creating a trial.
- Restart restoration events `pageshow` 11 and `resume` 12 arrive before initial fixation 13; the restart frame is held about 414 ms.
- Fresh warm-up indices 0–7 each resolve once; warm-up completion 72 precedes protection 73. No new form exposure existed at the pause.
- All 80 scored schedules match the manifest and resolve once; no timing anomaly or session invalidation; completion precedes protection end.
- UI confirms saved result. Reload → Stop history → Open original report reopens the same valid report.

`audit-capture-3.json` and `audit-capture-4.json` are independent read-only IndexedDB captures before and after reload. The result contains **640 events**, retains a confirmed form-exposure marker, and is byte-identical across reload. SHA-256 of `JSON.stringify(result)` is `06cbe696f0fefea574c9a743109bcc7fc55da45427924f252b79382458e4e88c`.

`src/stop/independent-capture.test.ts` independently checks event continuity, trigger linkage, ordering, eight warm-up resolutions, all 80 manifest-matched outcomes, recomputed counts, exposure, unchanged result bytes, production `verifyCompletedResult`, `inspectLocalState`, and scoring reconciliation. Corrupted counts and removal of the interruption event are rejected. The test passes. Details: `audit-reconciliation.json`.

## Verification and failed-attempt transparency

- Isolated production build passes and reproduces `index-D8pj7mZZ.js`, SHA-256 `883608dd9dd37db873b013259c93995870ef2995959ebe46e4e560aad5ef3acd`.
- 155 focused existing tests pass across Examples, run, engine interruption, browser, initial-frame and developer captured-recovery tests.
- Six independent adversarial tests pass; all six fail under the parent-engine control.
- One new captured-result reconciliation test passes. Total distinct focused tests: **162**.
- Exact repository lint passes with the two inherited warnings in App.tsx and cross-tab.mjs. The temporary-copy lint log additionally reports audit-harness unused imports/parameters; these are not product warnings.
- No full 658-test repetition or support-matrix rerun.

The first browser attempt is preserved as `audit-capture-1.json`, session `949ce5ef-7fdd-4786-8e77-ce4e1857314b`. The original probe accidentally intercepted an automation actionability frame before readiness; the intended hidden event therefore preceded warm-up, and a later injected onset delay caused a timing restart. A subsequent 640×360 viewport event correctly invalidated scored play. This attempt is excluded from durable-recovery acceptance evidence. The probe was corrected to arm at the actual readiness/restart click capture boundary, and a fixed supported viewport was used for the completed run. `audit-capture-2.json` retains its corrected injection trace and unexposed pause state.

## Remaining limits

The completed recovery interruption and restoration are injected (`isTrusted=false`), and initial-frame delays are test instrumentation. Scored timing, clock, frame rendering, engine, scoring, and IndexedDB remain real and unaccelerated. No fresh completed native-hide/freeze recovery journey, physical input/display timing, Safari/Firefox/Windows/mobile qualification, or screen-reader/complete accessibility certification is established. Prior partial native evidence is not promoted into a qualification PASS. The first attempt's native viewport invalidation is separately evidenced.

The original parent FAIL remains historically valid. This exact target passes the requested repair audit. Founder acceptance, broader M6-C qualification, analytics/privacy/provider gates, deployment and Public Beta release remain separate. No repository file, commit, push, deployment or analytics setting was changed. Audit files and build output exist only under this `/private/tmp` directory. The temporary browser tab was closed and its viewport override reset.
