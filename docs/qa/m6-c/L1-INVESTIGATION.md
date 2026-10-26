# Stop M6-C L1 — Chrome diagnostic and physical follow-up

**Status:** Diagnostic and physical L1 tab-switch cases observed; Chrome support-row qualification **open**. Product source HEAD was initially clean at `c41260b2a9b9bfba8d9e4a0617200602f0402f51` for the diagnostic and at `a84084af2a8e8a8c3c48c4e3b748ee74f7d6c5fc` for the physical follow-up. No product source, rules, validity policy, forms, analytics configuration or governing specification changed. The local recorder was inserted into ignored `dist/index.html` ahead of the unchanged product bundle. [Structured diagnostic observations](L1-UNATTACHED-OBSERVATION.json) and [physical raw evidence and reconciliation](l1-physical-2026-10-02/RESULT.md) retain the distinct methods, timestamps and limits.

## Method and limitation

Chrome `154.0.8037.95` ran as a native macOS 26.6.2 window. The native accessibility bridge operated the UI; no browser-tab automation handle, CDP, DevTools or debugger attachment was used for this run. A capture-phase listener in [l1-event-recorder.js](l1-event-recorder.js) stored `blur`, `focus`, `visibilitychange` and lifecycle events with `isTrusted`, visibility/focus state, `performance.now()`, `performance.timeOrigin` and UTC time in same-origin local storage. The local export page displayed those events beside the IndexedDB Stop drafts through native AX; the committed [export helper](l1-native-export.html) adds a raw-data download for the physical rerun. Recorder and Stop journal clocks share the same document's `performance.now()` time base.

The MacBook's built-in keyboard exists, but the run used **tool-dispatched OS input**, not observed physical key presses. The display inventory did not expose a refresh rate, and no 60 Hz setting or physical-input path was attested. The game's physical-keyboard checkbox was used only to enter this disposable diagnostic flow; its self-declaration is not evidence of actual hardware input. The origin already contained two saved valid QA results before this run; the three new records were invalid drafts. These limits prevent certification of the approved Apple Silicon/macOS 26/Chrome/physical-keyboard/60 Hz row.

## Control and result

| Probe | Browser capture | Stop journal and visible validity |
|---|---|---|
| Recorder control on the library | Native tab switch delivered trusted `blur` at `10:10:43.450Z` / `10127.8 ms`, trusted `visibilitychange` to `hidden` at `10128.0 ms`, then visible/focus on return. | No timed Stop run was active. This proves the capture path observed a known tab hide. |
| Warm-up | Trusted `blur` at `10:15:38.727Z` / `305404.9 ms`; trusted hidden event at `10:15:38.728Z` / `305405.7 ms`. | Draft `3fbdcc24…`: `focus_changed:false` at `305405.4 ms`, `visibility_changed:false` at `305405.8 ms`, and `session_invalidated` by `stop_validity_v1.hidden` at the same time. Four warm-up trials were scheduled; no scored trial. UI: invalid, not eligible for comparison. |
| Scored play | Trusted `blur` at `10:22:47.030Z` / `733718.1 ms`; trusted hidden event at `10:22:47.031Z` / `733718.7 ms`. | Draft `f7a205f0…`: all eight warm-up and **six scored trials** were scheduled before the switch. `focus_changed:false` at `733718.5 ms`, `visibility_changed:false` at `733718.9 ms`, then `session_invalidated` by `stop_validity_v1.hidden`. UI: invalid, not eligible for comparison. |

An earlier attempted scored switch, draft `19f558ff…`, occurred during scored-start handoff with **zero scored trials scheduled**. It is excluded from the scored-interval conclusion; its hidden event also invalidated the draft. Duplicate browser blur/focus notifications from native control are retained in the structured data and were not counted as separate tab switches.

**Distinction:** Here Chrome delivered hidden events to the independent recorder; Stop received matching events and invalidated both protected runs. No product mishandling of a delivered hidden event was reproduced. The original debugger-attached observation at `c41260b` had a selected-tab change and **no hidden event recorded** in the Stop journal, followed by a valid result. It did not independently capture Chrome's event delivery, so its cause remains unknown. This diagnostic neither explains that observation nor establishes a support PASS. No product repair or regression test is proposed without a reproduced defect.

## Approved physical follow-up at `a84084a`

The user used the MacBook Pro built-in keyboard in native Chrome `154.0.8037.95` on macOS `26.6.2` build `25G83`; a System Settings screenshot shows the built-in display set to 60 Hertz. No browser automation/debugger attachment or DevTools was used. The [physical evidence packet](l1-physical-2026-10-02/RESULT.md) preserves the three raw downloads, display/input screenshots, checksums and attempt exclusions.

The library control captured a trusted hidden event with no Stop run active. During warm-up, trusted browser hidden at `12:12:19.469Z` / `3939555.4 ms` matched Stop `visibility_changed:false` and invalidation at `3939556.0 ms`. During scored play, **12 scored trials were scheduled before the switch**; trusted browser hidden at `12:55:46.606Z` / `1564219.7 ms` matched Stop `visibility_changed:false` and invalidation at `1564220.8 ms`. Both visible results said not eligible for comparison. Earlier pre-scored focus interruptions are excluded from the scored case.

This closes the bounded physical L1 delivery-versus-handling check for the observed warm-up and scored switches: Chrome delivered both events and Stop handled both. It does not explain the historical attached-run observation or certify the Chrome support row. Other lifecycle paths, physical timing, integrated chain/drills, accessibility and remaining qualification gates stay open. The preview helper was restored after export and the server stopped, as recorded in the physical evidence packet.

## Short physical rerun

1. On the approved Mac/Chrome setup, record the full stable Chrome version, macOS build, physical built-in or wired keyboard, and **60 Hz** display setting. Use a disposable local browser profile. From the exact product SHA, run `npm run build`, then `python3 docs/qa/m6-c/l1-install-probe.py install` and `npm run preview -- --host 127.0.0.1 --port 5588 --strictPort`. Keep DevTools and browser automation/debugger attachments closed.
2. Open the app in Chrome. On the library, switch to a second tab and back; open `/l1-native-export.html`, download the raw evidence and confirm trusted hidden/blur entries. If the control is absent, the capture is unusable.
3. With the physical keyboard, switch tabs once during warm-up. Download the browser events and Stop draft/journal and record the visible validity. Restart on a fresh form, finish warm-up, wait until scored symbols are visibly underway, then switch again and download. Confirm a scored trial was scheduled before calling the second case scored.
4. Compare browser `performanceNowMs` with the journal `timestampMs`, retain both raw traces and the hardware attestations, and restore the ignored preview with `python3 docs/qa/m6-c/l1-install-probe.py restore`. A hidden browser event without matching Stop invalidation would be a product-defect reproduction; a missing browser hidden event would leave delivery unresolved.

No full suite, S01–S75 journey rerun, physical timing measurement, Safari check, analytics activation, push, deployment or release was performed here.
