# Stop M6-C L1 — physical Chrome tab-switch observation

**Product SHA:** `a84084af2a8e8a8c3c48c4e3b748ee74f7d6c5fc` (clean before capture). This is a development observation, **not** certification of the Chrome support row. No product source, governing specification, validity rule, form, analytics setting, or tracked test was changed for this run. The recorder and export helper were installed only into ignored `dist`; no DevTools, CDP, or browser automation/debugger attachment was used for the physical test.

## Setup and evidence

- Native Google Chrome `154.0.8037.95` from the installed app's `Info.plist`; macOS `26.6.2` build `25G83` from `sw_vers`.
- The user attested that they used the MacBook Pro built-in physical keyboard only, with no latency-adding assistive input. [Setup and input-detected screen](input-detected.png) shows Space selected. This is a self-attestation and on-page input check, not independent hardware sensing.
- [System Settings display screenshot](display-60hz.png) shows the built-in display set to **60 Hertz**. This is setting evidence, not physical scanout/latency measurement.
- The user physically switched Chrome tabs and supplied raw same-origin downloads. The recorder captured trusted `blur`, `focus`, and `visibilitychange` events with UTC and `performance.now()`; the export includes Stop IndexedDB drafts/results. Browser and Stop times below use the same document time origin within each case. Event histories span navigations, so comparisons use the matching UTC interval and `timeOriginMs`, not `performanceNowMs` alone.

| Case | Browser recorder | Stop journal and visible result |
|---|---|---|
| [Library control](control-library.json) | Trusted `blur` at `11:03:12.843Z` / `115766.5 ms`; trusted hidden `visibilitychange` at `11:03:12.844Z` / `115766.8 ms`; visible on return at `11:03:23.669Z`. A second later control hide is also retained in the raw trace. | Zero Stop drafts/results. This proves the independent event capture observed a real tab hide. |
| [Warm-up interruption](warmup-interruption.json), [UI](warmup-invalid-ui.png) | Trusted `blur` at `12:12:19.467Z` / `3939553.7 ms`; trusted hidden at `12:12:19.469Z` / `3939555.4 ms`. | Draft `2ba97e93-55b4-4b5b-bb2d-1b6477812848`: one warm-up trial, zero scored. `focus_changed:false` at `3939555.2 ms`; `visibility_changed:false` and `session_invalidated` by `stop_validity_v1.hidden` at `3939556.0 ms`, about 0.6 ms after the recorder's hidden event. UI says hidden and not eligible for comparison. |
| [Scored interruption](scored-interruption.json), [readiness](scored-readiness.png), [UI](scored-invalid-ui.png) | Trusted `blur` at `12:55:46.602Z` / `1564216.2 ms`; trusted hidden at `12:55:46.606Z` / `1564219.7 ms`; visible on return at `12:55:53.103Z`. | Draft `567513e9-6936-4385-88b6-cd4db55dd088`: eight warm-up and **12 scored trials scheduled before the switch**. First scored trial at `1542703.3 ms`, last at `1562713.3 ms`. `focus_changed:false` at `1564218.9 ms`; `visibility_changed:false` and `session_invalidated` by `stop_validity_v1.hidden` at `1564220.8 ms`, about 1.1 ms after the recorder's hidden event. UI says hidden and not eligible for comparison. |

The raw exports also retain an [uninterrupted 8+80 valid practice run](warmup-attempt-1.json) that did not perform the requested warm-up switch, plus [pre-scored focus interruptions](pre-scored-focus-interruption.json) before a scored trial was scheduled. These are excluded from the two L1 interruption conclusions. The scored export contains another later pre-scored focus draft; it is not counted as scored evidence.

**Interpretation:** Chrome delivered trusted hidden events in both physical interruption cases. Stop received matching events and invalidated each draft. No ignored delivered hidden event or product defect was reproduced. The earlier debugger-attached selected-tab change at `c41260b` had **no hidden event recorded** in the Stop journal; independent Chrome delivery was not captured there, so its cause remains unresolved. The physical observation does not prove every tab switch, browser/OS lifecycle path, timing behavior, or support row.

Remaining Chrome work includes the full integrated chain and drill distribution, other native lifecycle cases, physical onset/offset and input-latency measurement, accessibility and responsive coverage, and independent support-row acceptance. Safari, mobile/accessibility, reference originality, S70–S71, privacy activation, deployment, and release remain open. No product repair or regression test is proposed because this L1 run reproduced no product defect.

## Raw-file SHA-256

| File | SHA-256 |
|---|---|
| `control-library.json` | `43cc5ef2442c7559e953de07704c305cdcb7b6ded8db6de7090ca545bd4adbd1` |
| `warmup-attempt-1.json` | `ff2a3aff7b764142ad08e50fc1381fbbe6d54ea9c9fd4f2dae4d714dcce0e7b2` |
| `warmup-interruption.json` | `9667fafb13d0346f75bd56dc77c19031ad03e1dddb596accb5fca0609e3ee85a` |
| `pre-scored-focus-interruption.json` | `f97154805ee15031eec5324dc4c02c3bcb0d12ba1dbc28c2efcca78c481a0db5` |
| `scored-interruption.json` | `3d3e1ac7b107fc7aa9dc185d953b0cc48c6283d1c2c02de550f75cef1f2f4795` |

After export, `python3 docs/qa/m6-c/l1-install-probe.py restore` restored the saved ignored `dist/index.html` and removed both probe files. The disposable preview process was stopped; a direct loopback check then returned connection refused. The retained raw downloads are unaffected.

The user also reported that repeating the introduction and setup for every attempt is frustrating and proposed making the warm-up handoff a validity boundary. These are product decisions for a separate review. The current [Stop V1.1 specification](../../../specifications/ASSESSMENT_PRACTICE_STOP_SPECIFICATION_V1_1.md) §14.2 explicitly starts protection at “I’m ready” before warm-up, so this evidence does not revise the rule.
