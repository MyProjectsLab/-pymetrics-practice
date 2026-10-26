# Money Exchange 2 V1.0 — complete standalone developer candidate

2026-10-12. **Developer checks PASS for the bounded scope below.** Independent exact-SHA whole-game audit, founder acceptance, physical device/browser/accessibility qualification, mock, deployment and release remain unperformed. This document travels in the single implementation commit; the handoff status records its exact SHA. Production source identities are retained in `evidence/candidate-source-sha256.json`.

Base: `dc32d890338d6321ccfb4195eafaa3cc0c27e0d2`. Frozen packet: `d35e1f15a23b212ba6ef7e002d148936463eaead`. All 12 frozen companion identities match, recorded in `evidence/frozen-identities.json`; no frozen file was changed.

## Complete milestone

- Actual Practice library tile opens a fresh `money2.html` document. The standalone guide explains both rounds, has a worked example/check, and opens an unarmed Ready ticket. Only Ready Next allocates a form/attempt.
- Original source-based sequence: starting $5, Connecting placeholder, Connected, partner/rules, bonus, candidate or fixed original partner choice, allocation, untouched 0–10 fairness selection, new partner, second round, Test Complete, report. Integer cents preserve the $15 total; round 1 Give only; round 2 signed Give/Take in $0.50 steps. Six frozen forms cycle deterministically with familiarity disclosure.
- Two report pages, arithmetic help, Try Again, completed/incomplete history, per-record deletion and Delete all, byte-preserving reload review. An incomplete review retains committed partial facts without fabricating a second completed report page. Individual deletion retains form exposure; Delete all resets it and withdraws the generation (reload is required after this explicit installation withdrawal).
- Typed root reducer derives decisions and report pages, validates exact request payloads and replays the durable command ledger to validate the entire root. Requests bind installation, generation, owner lease, route, ticket and attempt revision. Completed report and attempt facts are immutable under subsequent replay/navigation.
- Native IndexedDB and native Web Locks provide the ordered read/write/publication boundary. The document owns one play lease; another tab cannot score concurrently. Current authority is re-read before DOM publication. History refresh and report page/help changes share deletion ordering without BroadcastChannel.
- Ready/active Close and Restart synchronously fence the local view, then settle exact originating lineage. Pending opening/Restart Close precedence is preserved. Admitted animation and receipt continuations cannot admit new user actions. Late callbacks cannot revive stale routes or detached controls.
- Two writes per admitted request maximum, two automatic read attempts, bounded 2-second deliveries and at most two unresolved native opens. Retry rereads the same request and does not replenish its write budget. Falsey/corrupt present values are blocked, never silently initialized. Explicit deletion can recover falsey and missing-root states.
- Owned document is established before arm: fresh top-level HTML/head/body, closed shadow root, finite control topology/style identity and immutable SVG path amounts/direction plus an accessible semantic equivalent. Result intent is stored before possible display. A decoded, geometrically visible, unobstructed checked result earns a bounded receipt only through the already admitted continuation. Any failure preserves `possibly_revealed`; it never changes it to unseen.

## Developer checks and retained evidence

| Check | Result | Evidence |
|---|---|---|
| Focused engine/controller/storage tests | 85/85 PASS, 3 files | `evidence/tests.log` |
| Typecheck + production build | PASS | `evidence/build.log` |
| Lint | Exit 0; 3 pre-existing warnings, no new warning | `evidence/lint.log` |
| Native gameplay/display/keyboard/responsive matrix | 14/14 PASS | `evidence/matrix/results.json`, `evidence/matrix.log` |
| Native storage/ordering/recovery matrix | 18/18 PASS | `evidence/storage/results.json`, `evidence/storage.log` |
| Native deletion/publication/stale-control matrix | 12/12 PASS | `evidence/deletion/results.json`, `evidence/deletion.log` |
| Actual library entry, filmed two-round $2 / rating 8, two report pages/help, reload | PASS | `evidence/filmed.log`, `evidence/filmed/filmed-root.json`, report/reload screenshots |
| Reduced-motion and forced-color emulation | PASS, completes both rounds and records settings | `evidence/accessibility-results.json`, `evidence/accessibility.log` |
| Frozen companions | All 12 SHA-256 identities unchanged | `evidence/frozen-identities.json` |

The 85 focused tests include all 48 frozen arithmetic cases (96 round outcomes), exact six-form and per-form SHA-256 comparison, malformed amounts, seven corrupt-root values, complete-root corruption, Ready/arm/exit orders, terminal/exit orders, pending opening/Restart Close, conflicting exact-request reuse, old deletion with successor, generation and lease withdrawal, ten controller cases including two failed reads, and capped unresolved native opens.

Retained command logs have trailing whitespace normalized.

The 46 bounded production-browser scenarios use the final production build. Native matrices assert visible route/content together with authoritative root fields. Complete roots are retained for the six-form run, all seven result faults, both Ready/Close and Ready/Restart commit orders, terminal/withdrawal orders, and the filmed report/reload journey. They include zero and endpoint choices/ratings, partner recipients, Take $1.50 and Take $5, history deletion with pending successor, owner/reload loss, false/0/empty-string/null roots, missing root explicit recovery, two rejected writes and manual read-only Retry, stale detached Ready control, history refresh after external deletion, and missing BroadcastChannel.

## Source and visual comparison

The existing source research and complete frozen specification/authority companions were read before implementation, as were current founder governance, the full master strategy/tracker and the cross-game failure-pattern review. The saved `Money Exchange 2 Game/download-2.png` and `download-3.png` were inspected directly at their 2668×1704 source size; no repeated media extraction was needed.

Retained `source-size-*` screenshots use that same viewport. The implementation preserves the large white workspace, left turquoise/right lilac participant roles, dark amount pills, green amount/fairness emphasis, purple navigation, two report pages and paired report facts. Avatars and path lettering are original simplified art, not copied source assets. Report wording discloses the original partner policy and uncalibrated forms. At 320 CSS pixels the participants remain side by side and report cards stack without horizontal overflow. The source-size, 320px and 2× visual-zoom paths complete both rounds. This is a bounded developer comparison, not an independent visual-equivalence verdict.

## Fixes made during developer verification

Before the candidate commit, checks exposed and fixed: rescheduling a receipt on its confirmed rerender; failing to hide old report numbers during a held publication read; detached same-stage native controls retaining admission after rerender; pending opening Close using a refreshed route epoch; missing recorded input context; focus being lost when an action became disabled or its history row disappeared; and history retaining a deleted row when a fast refresh changed root revision. Adjacent checks now cover these paths. Some earlier harness runs also failed because an injected Web Lock wrapper supplied an invalid overload or a zoom click used layout coordinates; those harness defects were corrected. Only final passing artifacts are retained here; none of those developer failures is represented as an independent audit result.

## Reproduction and limits

Run `npm test -- src/money-exchange-2`, `npm run build`, and `npm run lint`. Serve that build on port 4282 (`npm run preview -- --host 127.0.0.1 --port 4282`). Execute the five `browser*.mjs` drivers (excluding the support module). The scripts declare the local Playwright module and Chromium executable locations; adjust those environment paths on another machine.

Browser evidence is headless Chromium 145.0.7632.6 (Playwright 1.62.1), local production Vite preview, native IndexedDB and Web Locks. Test-only pre-entry interception retains the closed shadow root for inspection; no product test hook exists. Pointer/keyboard actions use browser input, while some slider/radio choices use injected DOM events. Storage fault cases inject held locks or lost completion callbacks around real native operations; the pagehide case dispatches a synthetic lifecycle event. Cross-actor deletion fixtures write an exact compatible deletion command/root in native IndexedDB under the same data lock with BroadcastChannel absent. These are controlled injections, not physical power-loss/multi-device or unrelated production UI observations.

The 2× check uses CDP visual viewport scaling, and reduced motion/forced colors use browser media emulation. Keyboard focus/Enter/Space/range/radio evidence is not a screen-reader certification. Font/path visual fidelity and long report scrolling remain subject to independent audit and founder acceptance.

The receipt establishes only the checked owned image/semantics, identity, geometry and hit-test conditions at the bounded handoff. It does not prove human perception or universal paint correctness. Periodic authority/display checks run every 750 ms; this is not a claim of continuous surveillance. Root replay assumes trusted application code and is not authentication against a coherent malicious rewrite of the entire local database. Storage capacity/performance at very long histories, other browser engines, physical mobile devices and OS-level zoom are not qualified.

No optional analytics, accounts, server sync, Advanced Training, mock, other-game implementation, deployment or release changes are included. The normal build still invokes the repository's pre-existing analytics build step; this milestone adds no analytics instrumentation.
