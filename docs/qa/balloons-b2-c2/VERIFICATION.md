# Balloons B2-C2 developer verification

Date: 2026-10-04, America/New_York. This is a local development handoff for a separate read-only exact-SHA audit. Founder B2-C2 acceptance, full B2, whole B1/mock, N1, OBS-1, browser/device/accessibility qualification, deployment and release remain open.

## Starting authority and scope

Started from clean `8e4d754b8253356c1a3006d842abc3f5244227ea`. The founder accepted B2-C1 at that SHA within the focused independent [F1–F2 PASS](/private/tmp/balloons-c1-independent-8e4d754/AUDIT.md) and its limits. Read `AGENTS.md`, the complete Balloons V1.0 packet, Master Strategy, tracker, B2-C1 developer verification and independent audit before editing. Both JSON companions parse. All five frozen packet SHA-256 values match `docs/qa/balloons-v1-0/FREEZE.md`; no file under `docs/specifications/` changed.

Only B2-C2 comparison calculation, its UI/history access, tests, evidence and tracker status changed. No C1 exposure/ownership, journal, drill, scoring, form, mock, analytics or Stop behavior was edited.

## Implementation and authority boundary

`compareSaved` receives one freshly read installation root and never writes. It reconciles immutable BL and RT journals/manifests, verifies a durable valid standalone BL and completed valid RT, requires the actual closed chain endpoint and original first assigned drill through `retestChain`, and refuses missing, deleted, unsaved, invalid or substituted dependencies. It checks installation identity, specification/form/scoring/router versions, BL/RT form family, Type mapping and information/accessibility settings. The approved model/cap/payout are enforced by immutable manifest and journal replay and basic-report arithmetic. Per-action input source is deliberately not a compatibility key.

The view shows actual BL/RT form IDs and signed RT-minus-BL differences for total and per-Type banked/lost cents, collected/burst counts, and voluntary/cap counts, with 39/13 count denominators. Full-Type voluntary medians need five observations on each side. Early and late segment differences each need three observations in that segment on each side. Unsupported median measures alone are suppressed, with both observed sample counts shown. Copy includes the exact approved sequence-difficulty statement and uncalibrated fixed-form/causal/employer limits.

The comparison opens from a completed retest report or saved history after reload. Every open, return, focus/visibility event and periodic check reads current authority. A slow periodic read removes cached numbers after two frames; deletion begin immediately clears them. Publication occurs inside the bounded deletion gate, and request generations fence late reads and navigation callbacks. A failed check shows a reason without retaining old numbers. Both original BL and RT journals remain unmodified by comparison.

## Checks and evidence

- Final `npm run check`: **1,090 tests / 52 files PASS**; lint has the two inherited warnings in `cross-tab.mjs` and `App.tsx`; Stop forms/drills, TypeScript, application and analytics candidate builds pass. See [full log](checks-final.txt). The experimental SQLite and bundle-size warnings are unchanged.
- Final `npm run balloons:check`: all nine scored forms and seven drill inventories pass frozen-hash, regeneration and structure checks.
- Focused comparison suites: **29/29 PASS**. They cover all nine BL/RT identities with actual dynamic RT assignment, mixed input sources, integer deltas, count conservation, exact 4/5 full and 2/3 early/late observation boundaries, missing/deleted/invalid/substituted endpoint and drill/chain/version/settings/mapping/installation/model/payout faults, read-only journals, and delayed cross-tab deletion/replacement UI reads after reload.
- Fresh production Chromium **145.0.7632.6** journey from guide: 39-round BL1, 18-round assigned drill, 39-round RT1 with nonzero payouts/bursts, report-to-comparison, history after reload, and baseline deletion in a second tab. The comparison withdrew its numbers and showed the specific deletion reason; no page errors. BL1 banked/lost **0/0 cents**; RT1 **110/5 cents**, with **two bursts**. [Browser result](browser-results.json), [driver](browser.mjs).
- The adapted independent [primitive reconciler](reconcile.py) imports no product code. It replays fixed thresholds and all accepted journal actions, action IDs/revisions, event pre/post totals, presentation, mapping, result rows, 39/13 and conservation for the browser BL/RT. **Two sessions / 78 scored rounds PASS**; visible total deltas match the primitive replay. [Arithmetic result](arithmetic.json).
- [Compact raw evidence archive](evidence.tar.gz) retains completed and comparison roots, visible text and screenshots before/after reload and deletion, plus final browser/arithmetic results. [Integrity register](integrity.json) records source, frozen packet, build and evidence SHA-256 values. Raw files also remain under `/private/tmp/balloons-b2-c2/`. `git diff --check` passes.

The first extended browser driver runs exposed two driver wait mistakes: it checked Collect during a transient disabled state, then observed a prior round's Next button before the new round mounted. The driver now waits for current-round presentation and enabled controls. Those preliminary failures are retained externally as `failure.*` and excluded from final evidence; the final fresh journey passed. No product change was made for them.

## Reproduction and limits

Run `npm run check`, `npm run balloons:check`, and `npm run preview -- --host 127.0.0.1 --port 4230`; then `node docs/qa/balloons-b2-c2/browser.mjs` and `python3 docs/qa/balloons-b2-c2/reconcile.py`. The browser script uses this host's installed Playwright/Chromium runtime. Automated native Space/Enter activation and headless Chromium supply bounded functional evidence; physical keyboard timing, screen-reader speech, touch/Safari/device matrix, natural race frequency and full accessibility qualification remain open. The fresh browser chain is BL1/RT1; all nine actual BL/RT identities are exercised in focused repository tests, not asserted as nine fresh browser journeys.

This is developer verification only. A new SHA requires its own separate read-only audit. No push, analytics activation, deployment or release occurred.
