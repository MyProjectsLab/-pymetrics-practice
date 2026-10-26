# Stop V1.2 native Mac Chrome physical-keyboard baseline — bounded result

**One human-attested built-in-keyboard baseline completed valid.** The tester said they used the MacBook Pro built-in physical keyboard, without assistive input or key remapping, for scored responses. The QA agent dispatched no scored key input. This establishes one exercised baseline path, not physical input latency, display scanout timing, or Chrome support certification.

This task began from clean QA HEAD `1b47efa79bf86f92aea7704649279db7dd1ba638`; an initial no-participation check was logged and committed at `75bf96d9ce602550dc93b2d83e6c8c6b96459df3`, then the tester joined and the physical run resumed from that clean evidence-only HEAD. The product files remain unchanged from verified product commit `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`. The 48-character product identifier in the request is not a Git SHA-1 object in this repository.

## Environment and sequence

- Native Google Chrome `154.0.8037.95`; macOS `26.6.2` build `25G83`; MacBook Pro `Mac17,2` with Apple M5. The built-in Liquid Retina XDR display is 3024 × 1964 Retina. System Settings showed the built-in display at default 1512 × 982 scaling and **60 Hertz**. This is the configured setting, not measured physical refresh or scanout. [Identity](IDENTITY.json) records source and build hashes.
- Fresh local origin `http://127.0.0.1:5595/` had no results, drafts, chains, exposures or reservations in its [before export](before.raw.json.gz). Analytics consent stayed off. The observer and read-only exporter were installed only in ignored `dist` before the unchanged production bundle.
- The guide, GO/NO-GO rule, four correct untimed examples and three correct understanding answers were visible. Those untimed actions were tool-dispatched. The setup visibly selected the standard color-plus-marker form, Space, physical-keyboard declaration based on the tester's attestation, and no latency-adding assistive input. The native window was enlarged to a supported viewport before timed play. [Visible-screen notes](VISIBLE-SCREENS.md) retain the observed text.
- The tester refreshed during a preliminary setup attempt. Its [interrupted export](interrupted.raw.json.gz) retains 634 browser events, including trusted Space events and window changes, plus preparation evidence; it has **no Stop result, draft, exposure or scored journal**. This interruption is preserved, not counted as a valid or invalid scored attempt.
- After the refresh, the tester physically completed the Space input check and the warm-up and scored task without further agent-dispatched key input. The valid baseline `a6d2091f-ad50-444b-af29-5232389551f4` used `stop-baseline-04`: 8 warm-up trials, 80 scored trials, 766 ordered Stop events. The 193 browser observations between protection start and completion reported a 1509 × 827 CSS-pixel viewport, visible and focused, without an observed resize, hide, pagehide or freeze. A trusted blur/focus pair at protection start both reported `document.hasFocus() === true`; the Stop journal contains no loss-of-focus invalidation.

## Scored result and input quality

| Measure | Independently reconciled value |
|---|---:|
| GO hits / misses | 60 / 0 |
| NO-GO correct withholds / false alarms | 19 / 1 |
| Overall correct | 79/80 = 98.75% exact; report displays 99% |
| Eligible correct-GO task RT | 60 responses; median 328.9 ms, displayed 329 ms; IQR 58.35 ms |
| Scored Space input | 61 trusted browser keydowns and 61 keyups, all non-repeat, matching 61 ordered Stop `input_received` and `response_accepted` events |
| Quality flags | 0 ignored responses, 0 anticipatory accepted responses, 0 timing anomalies, 0 session invalidations |

The one false alarm occurred on NO-GO trial index 57. The four scored blocks were 15/15 GO hits each, with NO-GO correct-withhold counts 5, 5, 4 and 5. [The standard-library reconciliation script](reconcile.py) checks form order, all trial outcomes, rates, quartiles, block summaries, ordered input events, browser key trace, exposure and reload without importing product code. It passed. `isTrusted` confirms browser delivery; hardware provenance comes from the tester's statement and no scored tool dispatch. The browser/journal clock alignment and task RT are **not** physical input-latency measurements.

The original visible report said Valid and saved, with the same counts and rounded timing. Native Chrome `Cmd+R` returned to the library. History then showed the valid `stop-baseline-04` result, 99% overall, 100% GO, 95% NO-GO and 329 ms median; reopening the original report showed the same values. The entire IndexedDB installation object is exactly equal in the [complete](complete.raw.json.gz) and [post-reload](reloaded.raw.json.gz) exports, including the confirmed form exposure and 766-event journal.

The [comparison-copy candidate](COPY-ISSUE.md) remains logged for separate review. No product code or governing specification changed, and no analytics activation, push, deployment, release or Chrome certification occurred. Physical input latency and display timing still require measurement equipment; wider browser/device and accessibility qualification remains open.
