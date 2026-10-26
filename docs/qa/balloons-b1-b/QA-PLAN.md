# B1-B pre-implementation QA plan

2026-10-03. Verified exact HEAD `a1d0b808c442c5f0bd73af55a7d74e905f3c47cf` and empty porcelain status before edits. Read AGENTS.md, complete Master Strategy, frozen five-file Balloons packet (both JSON files parsed completely), tracker, B1-A verification, original FAIL and independent repair PASS. All five packet hashes and Master Strategy hash match the retained authority. The founder accepts B1-A as a headless development milestone; `headless_complete` remains headless.

## Durable transitions and failure points

| Transition | Required authority / QA probes |
|---|---|
| Preparation → readiness | Exact guide/demo/quiz, both answers correct together; settings/input check; no scored assignment before Start |
| Start → pending_exposure | Installation owner lock plus atomic assignment; lowest unused/unreserved BL or RP; explicit new BL chain; correct rotation; concurrent tabs |
| Pending → presentation_armed | Recheck installation/session/revision/owner under the presentation lock; commit before any scored mount or frame callback; pre-arm cancellation releases only with proof |
| Armed → form_exposed + round_presented | Two visible nonzero-box frames with category and controls; atomic confirmation before input; post-arm hide/cancel/reload/write failure retains uncertainty; callbacks fenced |
| Click → action + snapshot | Native click only; app IDs and current round/revision; one atomic commit; outcome after commit; pending duplicates ignored; failed write pauses and shows unsaved status |
| Resolved → Next → confirmed round | Durable resolution first; Next commits then two-frame confirmation; correct focus; no pump before confirmation |
| Pause/reload → same session | Reconcile manifest, core prefix, durable lifecycle journal, settings, exposure and new ownership; retain threshold/action; suppress interrupted latency; uncertain first display cannot become a baseline |
| Round 39 → saved report/history | Complete core replay plus 39 durable confirmations; reconcile integer totals independently; reload same result; candidate-safe projection only |
| Delete / replace installation | Tombstones retain exposure and retire BL chain; all-delete warning; generation/revision CAS rejects stale writes; delayed callbacks cannot recreate data |

Deterministic tests cover T=1/32/33, corruption and valid controls, source mixing, atomic failures and delayed work. Production-browser checks cover the ordinary complete journey and reload, native Space/Enter, repeat/focus cancellation, pointer and emulated touch, unclassified clicks, cross-tab assignment/deletion, and explicitly injected write/frame faults. Browser delivery is not physical-device or accessibility certification. No mock/drill/router/retest/comparison/analytics implementation. B1 remains partial while mock and qualification gates are open. Final lint, tests, all manifest checks, build, frozen-file diff, local commit and clean-tree checks are required; exact-SHA audit and founder B1-B acceptance follow separately.
