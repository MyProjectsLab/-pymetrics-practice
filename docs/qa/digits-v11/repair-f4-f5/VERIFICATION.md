# Digits V1.1 grouped F4/F5 repair — developer verification

## Identity and scope

One grouped repair in `/private/tmp/digits-v11-impl`, beginning at clean `a8839de75f7c980fa067ce01a0ea1d47c19aa2f0`. The independent reaudit at that base is **FAIL F4/F5**, with the original F1–F3 closed. This document records developer checks; it does not change that historical verdict or claim an independent PASS. Main was not edited. No audit was started or requested.

Product changes: `src/digits/Journey.tsx`, `navigation.ts`, `handles.ts`, and `navigation.test.ts`. All other changes are evidence under this directory; `changed-files.txt` is the complete inventory. All 21 pre-existing Digits paths other than Journey and all 11 frozen packet/script entries match the base/prior recorded SHA-256 values. Engine, target construction, browser timing/input controller, journal/storage transactions/schema, persistence, ownership, scoring, CSS, V1.0 and V1.1 specifications are unchanged. `identity-and-hashes.json` records those comparisons, source/harness hashes, both review identities and production artifacts.

## Reproduction before edits

The supplied independent navigation and adjacent scripts were copied unchanged and run on the base's hash-verified production build before editing. `independent-navigation.json` retains six captures; `browser-retired-terminal.json` retains the two terminal deletion captures. Probe PASS means collection completed, not product acceptance. The raw captures demonstrate F4 aggregate/disclosure revival while History is pending, failure to acquire replacement History, and F5 successful/rejected old History/review callbacks overwriting the newer guide. The source reports are `/private/tmp/digits-v11-independent/REAUDIT-a8839de.md` and `/private/tmp/digits-v11-navigation-design/REVIEW.md`.

## Coherent repair

`DigitsNavigation` owns synchronous route epoch, destination, installation handle, target key `(installationId, sessionId, requestId)`, and latest producer channel. Exact target retirement is absorbing for the mounted journey. Explicit navigation detaches the old factual view and renders a neutral pending destination in one synchronous transition before its first await. React presentation state mirrors admitted transitions; clearing display flags cannot clear the retired identity set.

Each view producer checks a captured envelope before dependent work, after awaits, and on success/error/subscription/timer callbacks. Same-view channels fence reverse delivery. Scoped cleanup cannot reset another operation's busy state. Runner hooks, lifecycle handlers, countdown and voice sample completion use the same admission rule. An old target retirement cannot redirect a different target.

History and Replay share bounded fresh current-installation acquisition. History lists and report admission/activity/verification/visible publication remain inside the existing data lock. A missing report between its initial load and publication produces a truthful destination error. Stale loads cannot initiate new report activity; a write already committed before navigation remains a factual durable write and its obsolete UI continuation is suppressed.

Requested deletion keeps its captured command authority even if the user navigates. Its delayed success/error cannot hijack the newer route or restore removed data. `DigitsHandles` leases captured backend work and defers disposal; Delete all's returned alias cannot close an active or leased shared backend. Fresh abandoned opens dispose only their own connection. Required canceled-arm reconciliation/save remains background work after unmount, independently of stale UI admission. F1 first-cancellation/same-request timeout semantics and F2/F3 factual assistance/onsets remain intact.

The design challenge was applied proportionately: one small coordinator and one connection lease owner, with no schema migration, app framework, engine rewrite, broad accessibility redesign, mock integration or analytics activation.

## Checks and final browser matrix

- One required `npm run check`: **88 files / 1,498 tests PASS**, lint, included form/reviewer checks, TypeScript and production build, recorded in `checks-final.txt`. The focused Digits suite passed **9 files / 78 tests** before this gate. Nineteen added coordinator/connection tests cover stale route/handle/target/channel work, absorbing retirement, unrelated target isolation, strict mounting and leased shared-backend disposal.
- `build-final.txt` and `identity-and-hashes.json`: frozen final production artifact. The repository check rebuild produced the same artifact hashes.
- Final harness lint after removing unused copied helpers: only the two inherited warnings, recorded in `lint-final.txt`. Build retains existing dynamic-import/chunk-size warnings.
- **51/51 final production Chromium cases PASS**, summarized in `browser-matrix-summary.json`:

| Evidence | Cases | Coverage |
|---|---:|---|
| `browser-navigation-final.json` | 20 | Individual deletion/replacement; neutral pending History; replacement acquisition; held History/review/poll/Replay/refresh success and failure; held deletion completion with newer Replay; active fresh-handle usability; current deletion completion. |
| `browser-adjacent-final.json` | 12 | Mutation between saved load and publication, both types; held report load/write/verify success/error and newer navigation; initial open success/error after unmount; stale voice sample success/error after mode change. |
| `browser-unmount-final.json` | 2 | Committed undelivered arm unmount saves zero-onset Invalid in background; stale History cannot publish or append activity. |
| `browser-f1-f3-final.json` | 11 | Blur cancellation, timeout then blur, undeclared trusted paste live/reopened and unresolved Invalid, declaration-only labeling, all four Next/deletion orders, native before-put abort. |
| `browser-development.json` | 6 | Normal variable-length keyboard run and exact reload; keypad/Feedback blur; genuine checkpoint failure/retry; held terminal/retry; injected eligible auditory completion; bounded 200% CSS zoom. |

Root comparisons use complete serialized roots, including counters, attempts, tombstones and activity, rather than eligibility alone. F3 captures retain factual successor onsets and the four actual ordering traces. The saved natural trusted-paste root from the earlier repair is reused unchanged as an adjacent admission fixture; no synthetic journal is constructed. Both mutation-first and publication/onset-first outcomes preserve durable no-resurrection and truthful current view.

## Preliminary captures and limits

The first development batch was stopped after inspecting one adjacent removed-record fallback and frozen into preliminary captures. A complete F1–F3 batch and the selected final batch each exposed the same probe issue: a non-exact `Digits local history` heading matched the new `Loading Digits local history` heading, so assistance was asserted before the list settled. The body capture explicitly shows the neutral pending view. `browser-f1-f3-before-exact-heading.json` retains the final-batch failure. The probe now requires the exact settled heading; its single targeted rerun is `browser-F2-undeclared-trusted-paste-labels-live.json`, PASS. `browser-f1-f3-final.json` combines ten unchanged-source PASS captures and that corrected targeted result; it does not claim another eleven-case execution. All final results use the same recorded production artifact. Copied unused helper removal changes no tested harness path.

These checks use local headless Chromium, real IndexedDB/Web Locks, browser-generated trusted input/clipboard, injected storage callback delivery/failure, synthetic lifecycle and speech callbacks, and CSS zoom. Physical timing/input, real acoustic output, native suspension/exit, screen readers, native browser zoom and the full device/browser matrix are not qualified. Cumulative ending follows the frozen Assessment Practice contract and observed JobTestPrep footage, not a verified current Pymetrics/employer rule; conflicting online descriptions remain a limitation.

Exact-SHA independent whole-milestone audit, founder acceptance, broader qualification, mock integration, deployment and release remain open.
