# Arrows A6 F3-R5 visibility repair — developer verification

**Parent:** `525516fee4b332257287cb15578a2f84e7b12bfa`. Its independent audit reproduced two P1 false-visible cases: boxless `display: contents` branches and shared 3D depth ordering. A covered Arrows display could admit Start or remain valid during scored play.

The numeric stacking fallback now refuses branch paths containing `display: contents` and shared ancestors with preserved 3D or perspective. It still admits the tested ordinary 2D lower layers. No timing, input, form, journal, scoring, storage, or frozen specification changed.

The independent auditor's browser reproducer was copied to `/private/tmp/arrows-f3r5-dev/` and run against the local source server. All **12/12** new cases passed: each false-visible family was rejected before Start and invalidated during protected play; the six block/flat underlay controls remained available. Copied prior reproducers passed **22/22** stacking, **27/27** important-rule, and **3/3** attribute-sensitive cases. The JSON captures, logs and screenshots are retained in that external directory. These are developer reruns of independent fixtures, not an independent audit of this repair.

`npm run lint` passed with two inherited warnings; `npm test -- src/arrows` passed **51/51**; `npm run arrows:check` retained the frozen form digest; `npm run build` passed. Browser evidence is headless Chromium functional evidence, not physical timing, native lifecycle, device, zoom or accessibility qualification. A6 remains a source adapter without candidate navigation or durable checkpoints, results and history. A fresh read-only audit of the committed repair is required.
