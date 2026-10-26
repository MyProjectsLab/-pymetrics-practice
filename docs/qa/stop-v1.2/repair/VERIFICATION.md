# Stop V1.2 focused audit repair — developer evidence

Date: 2026-10-02. Started on clean `68ccbabd7036779e23f57871e97af99c4705c184`, parent `1f834dbd7c9c5b54f879997dab3b91145c9099c9`. The repair commit containing this record has `68ccbabd7036779e23f57871e97af99c4705c184` as its parent. Local implementation/developer verification only; a fresh independent exact-SHA audit and founder acceptance remain open.

## Authority and unchanged boundaries

Read AGENTS.md, the Master Strategy, Stop V1.1, the V1.2 addendum, tracker, original V1.2 QA packet, and the final finding in **Stop V1.2 Exact-SHA Audit** (chat `01a0fdf7-8cb3-74e3-a2b4-f6ded0f15a07`). The audit failed remapped-key example button activation and left interrupted-warm-up durable recovery unverified. The founder expressly authorized both the keyboard repair and repair of any defect exposed by the recovery check.

No governing specification was edited. SHA-256 values match the approved values recorded in the original V1.2 packet:

| File | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |
| V1.2 addendum | `a3e5f9f23c55f1ddfb6bdd33f0a689fe510bd471d197d305d7e324c687a92f9c` |

## Reproductions before correction

1. Built unchanged HEAD, yielding `index-C-cTv6mB.js`. In loopback production preview, selected F in setup, returned via Back → Try examples, pressed Tab from the heading to focus Check example, then Space. No response or feedback appeared and the button stayed Check example. Enter resolved the example with “This was GO. Press F when it appears.” Correcting the contradictory expectation and adding focused input coverage first produced **2 failures / 11 passes** in `Examples.test.tsx` before changing product code.
2. The durable-recovery browser journey then exposed a separate restart defect. With the keyboard repair alone (`index-CvpfA588.js`), an interrupted warm-up displayed Restart warm-up but could not restart at a valid 1280 × 720 viewport. Restoration events queued `update()` before the asynchronous initial-frame callback; `update()` re-published the prior `warmup_restart_required` state and fenced the frame. The deterministic delayed-frame test reproduced **expected live, received warmup_restart** before the engine edit. The existing synchronous-frame fixture had missed this ordering.

## Focused changes

- Examples cancel keydown/keyup defaults only for the selected GO key while unresolved. Space-selected behavior and Enter activation remain; F-selected examples leave Space's native button action intact. No copy or control scheme change.
- `armWarmup()` acknowledges an accepted restart by moving to `waiting` before requesting the browser's initial frame. Existing diagnostics, one-restart timing limit, initial-frame watchdog, interruption handling and first-trial reset remain. Scored protection and form consumption are unchanged.
- Tests cover focused controls with both bindings, Tab/Enter defaults, keydown/keyup, response recording, and defaults after resolution; delayed initial frame through eight restarted warm-up and 80 scored trials; first/restarted-frame hidden/pagehide/freeze/leave races; and a second missing-frame anomaly ending preparation without exposure.

## Browser methodology and limits

Production Vite preview: `http://127.0.0.1:5589/`. Final application JavaScript: `index-D8pj7mZZ.js`, SHA-256 `883608dd9dd37db873b013259c93995870ef2995959ebe46e4e560aad5ef3acd`. The QA sidecar is installed only into generated `dist` by `install-probe.mjs`, never imported into the product bundle. It observes key/lifecycle events, offers an explicit synthetic hidden-event button, and reads IndexedDB without writing product records. The local-only receiver saves evidence to `/private/tmp`; this is QA capture, not analytics.

Keyboard input was tool-dispatched through the browser, not DOM-created keyboard events. On the repaired example code: F-selected Space activated Check example with withhold; F recorded a response without checking; Enter checked; F then Space produced correct GO feedback; Space activated Next example. With Space selected, Space recorded a response and left Check example unresolved; Enter checked; Space then activated Next example. Tab focus remained on the actual button.

The visible-tab native probe delivered trusted hidden events and displayed warm-up interruption, but switching the visible browser also reduced its viewport below the supported minimum. That partial run did not complete and is not durable-recovery evidence. A fresh background tab stayed at 1280 × 720; its tab-open/close probe did not deliver native hidden. The completed recovery journey therefore uses explicit `visibilitychange` injection (`isTrusted=false`) during live warm-up. Browser clock, animation frames, actual trial durations, scoring, exposure and IndexedDB writes are not mocked or accelerated. No physical display/input timing, screen reader, native lifecycle matrix or browser/device certification is claimed.

## Final verification

- `npm run check`: **658 tests / 37 files passed**, lint passed with the two inherited warnings (`cross-tab.mjs` unused parameter and `App.tsx` effect dependency), all 14 standard/five drill manifest checks, TypeScript and both production builds passed. Raw output: `check.log`. `git diff --check` passes.
- Final production bundle repeated both keyboard-binding checks after the engine repair. `final-keyboard-trace.json` retains trusted browser key events and their default-cancellation state. `earlier-native-trace.json` retains the earlier keyboard checks and trusted native visibility probe. Neither proves physical-keyboard/device certification. A premature click on the earlier probe's injection control was rejected because warm-up had already stopped; it dispatched no synthetic event. The sidecar now reports that guard without throwing. A browser download timeout was worked around by the loopback-only evidence receiver.
- Complete real-time browser run: **2026-10-02 16:24:51–16:28:33 America/New_York**, session `9c4144b0-6c5c-4b1f-aab6-0138ba41b726`, form `stop-baseline-02`, Space, standard visual profile, viewport 1280 × 720. Reported user agent: macOS Chromium `154.0.0.0`. Warm-up scheduled indices `0,1,2`, then interruption, then a fresh `0,1,2,3,4,5,6,7`. Eight restarted trials finished before scored protection. All 80 scored trials completed with no timing anomaly or invalidation. No GO responses were made: 0 hits, 60 misses, 20 correct withholds, 0 false alarms; the report correctly suppresses unavailable response-time evidence. This is validity/persistence evidence, not skilled-performance evidence.
- Saved and recovered **659 events**, including event 27 `visibility_changed:false`, 28 `warmup_interrupted` referencing 27, 29 `warmup_restart_required` referencing 28, restoration events 30–31, warm-up completion 91, scored protection 92, scored batch completion 656, session completion 658 and protection end 659. The final run's hidden event was injected and untrusted; trusted brief focus events were observed separately. Trace entries outside this run include earlier probes and reload lifecycle events and must not be attributed to this run.
- UI showed “This result is saved in this browser.” Reload → Stop history → Open original report reopened **Valid · Standard color-plus-marker form · Form stop-baseline-02**, with all 80 outcomes. `before-reload.json.gz` and `after-reload.json.gz` contain the actual read-only IndexedDB captures; both retain the identical original result bytes. SHA-256 of `JSON.stringify(result)`: `975998c8636ba647e08f9c5229e6d08ecc196eccad48e041497f1d1699aabbfe`. Captures also contain an older result, explicitly excluded from this completion claim.
- `recovery.test.ts` independently rechecks the captured record using the current production `verifyCompletedResult` and `inspectLocalState`, exact byte/hash equality, interruption event linkage, eight restarted trial indices, 80 scored resolutions and no invalidation/anomaly. It is a captured-record regression, not a fresh browser execution. An initial harness assertion used a nonexistent `trial_resolved.payload.trial`; correcting it to the recorded scored-protection sequence fixed that test-only error.

## Reproduction commands and file inventory

Run `npm run check`. For browser reproduction run `node docs/qa/stop-v1.2/repair/install-probe.mjs` after the build, then the loopback preview on 5589 and `node docs/qa/stop-v1.2/repair/evidence-server.mjs`. Use the normal UI; inject only during live warm-up if native delivery is unavailable, restart, complete scored play, read durable evidence, reload, reopen the report, and read evidence again. Rebuilding removes the sidecar from the generated application.

Changed product files: `src/stop/Examples.tsx`, `src/stop/engine/engine.ts`. Regression files: `src/stop/Examples.test.tsx`, `src/stop/run.test.ts`. Status: `IMPLEMENTATION_TRACKER.md`. Evidence packet: this `VERIFICATION.md`, `browser-probe.js`, `install-probe.mjs`, `evidence-server.mjs`, `recovery.test.ts`, `before-reload.json.gz`, `after-reload.json.gz`, `final-keyboard-trace.json`, `earlier-native-trace.json`, `check.log`.

No unrelated M6-C work, independent audit PASS, founder acceptance, analytics activation, push, deployment or release is claimed. Native interrupted-warm-up completion, physical input/display timing, browser/device matrix, screen-reader qualification and the broader product gates remain open.
