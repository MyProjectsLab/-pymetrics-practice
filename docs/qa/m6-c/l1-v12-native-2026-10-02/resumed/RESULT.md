# Stop V1.2 native lifecycle — bounded observations

**Product:** unchanged `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`. **Starting QA commit:** clean `09f4bfa84379f9bceb48fba76b6ede382f808ada`. **Date:** 2 October 2026 EDT (raw timestamps 3 October UTC). **Outcome:** trusted library control and all four requested tab-hide boundaries observed. No ignored delivered hidden event was found in these cases. This is a bounded native diagnostic, **not Chrome or M6-C qualification**.

Chrome 154.0.8037.95 on macOS 26.6.2 / 25G83; dedicated native Chrome window, standard visuals, Space binding, loopback port 5592. The native app bridge dispatched OS inputs. No DevTools, CDP, browser attachment, synthetic lifecycle event, altered clock or patched product handler was used. See [method](README.md), [identities](IDENTITY.json) and [independent reconciliation](RECONCILIATION.json). Browser capture and product journals are separate. Browser `isTrusted=true` establishes browser delivery, not physical input or display calibration.

## Results

Times below are `performance.now()` milliseconds within the product document with `timeOrigin=1790993973385.3`; the earlier library control has its own origin, `1790993942838.1`. Event sequence numbers are local to each Stop attempt. Raw UTC is retained without conversion or reconstruction.

| Case | Browser delivery | Stop journal and exposure | Visible result |
|---|---|---|---|
| Library control | Trusted hidden at 15025.700; visible on return at 18423.100. | No Stop draft, result or exposure. Later pagehide/hidden/freeze in this export came from navigating to the export helper and is excluded from the tab-switch control. | Native library switch preceded all Stop tests; [control export capture](control-export-ui.png). |
| 1. Hide during live warm-up | Trusted hidden at 93232.800. | Visibility event 30 at 93232.900 → warm-up interruption 31 → restart-required 32. Two warm-up trials had been scheduled; restart then schedules fresh indices 0–7 and finishes eight at event 94. Pause snapshot has no exposure or reservation. | [Warm-up needs to restart](case1-warmup-recovery.png), then [Warm-up complete](case1-restarted-warmup-complete.png). |
| 2. Hide at Warm-up complete | Trusted hidden at 183468.800, after warm-up completion at 138764.700; trusted visible on return. | No invalidation at this untimed pause. Accepted scored entry records protection event 95 at 197926.600, followed by scored onset and confirmed exposure. | [Warm-up complete retained](case2-pause-return.png); scored start succeeds. Later viewport interruption prevents a valid completed native recovery claim; see below. |
| 3. Hide after accepted start, before onset | Trusted hidden at 472626.300, about 11 ms after protection started at 472615.300. | Protection 65 → visibility 67 → hidden invalidation 68. Zero scored trials scheduled/presented. `stop-baseline-01` absent from exposure and reservations. | [Invalid hidden-page recovery](case3-pre-onset-recovery.png), not eligible for comparison. |
| 4. Hide after confirmed onset | Trusted hidden at 693711.400. | Protection 65 at 687708.600; first scored presentation 69 at 688734.500. Three scored trials presented before visibility 86 → hidden invalidation 87 at 693711.900. `stop-baseline-04` exposure remains confirmed and owned by this session. | [Invalid hidden-page recovery](case4-post-onset-recovery.png), not eligible for comparison. |

Cases 1 and 2 intentionally share session `93ba0dae-e7ff-4df1-acaa-a4c883240e99`, form `stop-baseline-03`. Case 3 uses `351e8b4f-b7f9-42d0-a01d-a5c4b1daa3a2`; case 4 uses `99e75f87-e7b5-42aa-b64f-c3d417823533`. Warm-up journals are retained in the durable drafts after scored entry; the separate pause export contains no draft yet. Absence of a draft at the pause is not treated as absence of warm-up events.

## Extra observations and explicit limits

- The case 1/2 attempt continued through 78 scheduled scored trials, then viewport events 640–644 recorded widths 793, 787, 780, 772 and 760 at height 749. Event 645 invalidated under `stop_validity_v1.viewport_below_768x600`, linked to event 644. The [visible viewport recovery](cases1-2-later-viewport-recovery.png) and full draft are preserved. There is **no valid completed result** from that attempt; completed native interruption → save → reload → original-report recovery remains open. The cause of the window-size change was not established. No product defect is inferred from the supported invalidation.
- Before case 4, the window was again too small. The [scored-entry rejection](case4-admission-recovery.png) visibly requested a larger window. Enlarging the native window allowed entry. This supports the viewport admission check only; it does not independently retest every admission condition. Case 3/4 recorded start environments were 1512×771 CSS pixels; the case 1/2 draft records 805×749.
- All four intended tab-hide events were delivered. No undelivered-event failure occurred in these four cases. This does not resolve the earlier debugger-attached observation or promise delivery in other conditions. Freeze/resume, lock/sleep, minimize, back/forward cache, discard/restore and precise blur-duration handling were not exercised here. Incidental exporter navigation events do not qualify those scenarios.
- Physical response latency, stimulus scanout, 60/120 Hz accuracy, screen readers, accessibility matrix, Safari/Firefox/Windows/mobile and unsupported/unavailable devices remain open. Earlier hardware/60 Hz attestation is historical, not freshly verified. Instrumentation overhead is unmeasured. No scored key responses were made; these are lifecycle and retention observations.
- No product repair was needed or made. This packet has unchanged-code observations only, so there is no after-repair run. Support boundaries, candidate-facing meaning, timing/validity policy, specifications, forms, scoring, twelve-game Practice/full mock/three-game Advanced Training scope and analytics activation configuration remain unchanged. Analytics remains disabled.

## Raw evidence and reproduction

Original downloads are retained byte-for-byte:

- [Control](control.raw.json)
- [Cases 1/2 pause](cases1-2-pause.raw.json) and [durable final draft](cases1-2-final.raw.json)
- [Case 3](case3-pre-onset.raw.json)
- [Case 4](case4-post-onset.raw.json)

Each case also has separate `caseN.browser-events.json`, `caseN.stop-journal.json` and `caseN.exposure-state.json`. They are reproducible, lossless selections from the original exports, not additional runs. Case 1 selects journal events 1–94; case 2 selects 94–645 to retain the later viewport limit. Browser selections use the corresponding document and boundary interval. Exposure files retain labeled pause/before and after states; case 3's unconsumed state is its post-interruption snapshot in both fields. Full exports retain events outside the selected interval, including export operations. PNGs and matching `.txt` files capture visible recovery and native accessibility trees.

To reproduce, build this exact product, install the retained independent recorder before its unchanged bundle with `python3 docs/qa/m6-c/l1-install-probe.py install` from the repository root, and serve the production output locally. First switch away and back at the library. Complete preparation; hide during live warm-up, return, restart all eight trials, then export at the untimed pause. Hide/return at that pause and start scored play. Use new attempts for an immediate hide after accepted start and a hide after confirmed scored onset. Export records through the read-only helper in a separate tab; preserve failures and window-size changes. Reconcile retained files with:

```sh
python3 docs/qa/m6-c/l1-v12-native-2026-10-02/resumed/reconcile.py
```

Reconciliation passes ordered journal continuity, browser/Stop hidden linkage, fresh-eight restart, pause ordering, and pre/post-onset exposure. `npm run build` passed; [build log](build.log) retained. No product source changed, so accepted exact-SHA lint/tests and exhaustive fixtures were reused after the 119-path byte comparison rather than repeated. The accepted [independent repair audit](REPAIR-AUDIT-f6b8ae0.md) remains PASS at f6b8ae0; its injected recovery checks are not relabeled native.

The dedicated QA window was closed and preview stopped. Probe files were removed and original `dist/index.html` restored. [Cleanup verification](CLEANUP.json) records source/build equality. The local test-origin records and downloaded raw evidence remain; no user data was deleted. No push, deployment or release occurred. M6-C, Stop completion, analytics/privacy/provider gates, deployment and release remain open.
