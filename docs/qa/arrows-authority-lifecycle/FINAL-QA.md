# Grouped R8–R10 lifecycle candidate

Status: uncommitted isolated implementation and focused developer checks. Parent is `2edd61613288934b123de9cf71fa928d5818873f`; main was not edited. Native matrix, final candidate identity, commit, integration and independent functional verdict remain with the coordinator. This note supersedes the earlier Claude draft's static-only claims.

## Ownership contract implemented

- Browser arm/result notifications share `withdraw()`. It latches before target refresh or cancellation can reenter, captures current immutable journal and verified checkpoint floor, stops execution, then creates/assigns one Recovery and publishes once. Both listener orders select the same owner.
- A break preserves the exact desired P, including an unsaved key release beyond saved Q. A protected withdrawal appends a technical interruption to the actual known journal at the run's monotonic clock and ends protection. It does not substitute retained P/U or resume timed execution after verification. A different retained terminal U retires the challenged target; existing Store preconditions and target checks prevent overwriting it.
- `ArrowsReportSession` owns original Store/installation, exact target, optional Recovery, source, stable session/view IDs and opening timestamp. Its immutable identity outlives BrowserRun and changing attachment generations. Failed reset reattaches this same session and genuine view ID only under the original navigation/Store/reset fences.
- `resumeReport(session)` uses captured ownership without looking up execution references. Open, resume, background poll and activity validate the session record. A result requires full snapshot binding plus exact fresh confirmation before synchronous ordered DOM publication or activity. Armed-only history has an explicit Start-record marker/copy; it cannot silently publish a snapshot or append result activity.
- Session-owned retry/reverification controls render outside the report-data/checking branches. Operational resumption failure or visibility loss after successful integrity resolution keeps an accessible retry while counts/saved claims remain hidden. Blocked/retired/unknown targets suppress ordinary retry. Successful retry preserves target, session and genuine opening ID.
- Native readonly/readwrite share a transaction lifecycle: active → abort requested → settled, or committed. One nonthrowing abort boundary preserves initiating cause, checks cancellation after preimage work and before put, settles once and removes the signal listener. Native callbacks contain exceptions; delayed completion after actual commit remains reconcilable. Timed global-error protection is retained.

## Changed-file inventory

Runtime: `src/arrows/browser.ts`, `Journey.tsx`, `storage.ts`; new `report-session.ts`.

Tests: expanded `register-browser.test.ts`, `authority-surface.test.tsx`; corrected and expanded copied independent `independent-live-reset.test.tsx`; new `report-session.test.ts`, `native-lifecycle.test.ts`.

QA: existing `BEFORE-STATE.md` and this corrected note. External `PREFLIGHT.md` and `CLOSURE.md` are review artifacts, not product implementation. Frozen engine/report/contracts/forms/specifications and other games are unchanged.

## Focused evidence

Logs are under `/private/tmp/arrows-r8-r10-*.log`; no full/global suite was run.

| Log | Scope and result |
|---|---|
| `source-first.log` | 58 checks across copied R8 component reproduction, authority/Journey surfaces and existing register/Continue matrix. |
| `focused.log` | Seven-file focused gate: 125 checks succeeded; six new higher-history fixture restorations initially attempted lower revision r2 after conflict r3 and remained correctly blocked. |
| `final-delta.log` | Corrected higher-history fixtures restore good history at the conflict revision; all 42 register/browser and report-session checks succeed. Includes 12 listener-order × saved/pending/protected × same/higher-conflict cases. |
| `native-adapter-final.log` | Six event-driven native-adapter double cases succeed: synchronous preimage cancellation, request/put failures, post-commit pre-callback cancellation in both modes, and cancellation before request. This is supplementary simulated evidence, not native-browser execution. |
| `surface-final.log` | 23 R8 and authority/Journey surface checks succeed after session-owned publication and React render-state changes. |
| `closure-final.log` | 29 checks succeed including released-prefix, live-break and protected withdrawal failure/retry. One publication fixture initially clicked the early retry before its intended publication failure finished. |
| `closure-barrier.log` | Final five live terminal/history/visibility checks explicitly wait for the intended failure barrier before retry; see completed log for result. |
| `typecheck-closure.log`, `lint-closure.log` | TypeScript succeeds with build info under `/private/tmp`; lint has only the two existing warnings outside Arrows (`src/App.tsx`, historical M5 QA driver). |

The original copied R8 test seeds a valid 24-trial prefix and mock admission, then uses the real BrowserRun interruption, Recovery, Store and rendered Journey. New component cases similarly pair actual DOM/control availability, exact handle/session ID and durable root/view bytes. Protected component fixtures seed known phase/journal state; they do not certify native onset timing. Listener-order tests explicitly reorder the register fixture's handle iteration while using actual Store validation and Browser callbacks. The adapter double deliberately throws on repeated/post-commit abort to exercise containment.

## Source closure inventory

`watchArm` and `targetForBreak` both dispatch to the same latched withdrawal. `stop()` occurs before Recovery constructor/handle refresh. Exactly one captured Recovery is assigned before the report callback; existing same-handle attachment rejects a different Recovery owner.

`attachReport` stores the captured session; `verifyAttachedReport` → `resumeReport(surface.session)`; no restoration uses `run.current`/`breakExitRun.current`. Those execution references remain only for initial handoff, live control and disposal. Common Saved validation is `session.assertRecord`, including open/poll/resume/activity. Store's snapshot activity scope is unchanged.

Reset captures the session before detachment, restores it only after an owned failure, and preserves its genuine view ID. Retry visibility is derived from the owned attachment's delivery metadata and authority state, independent of whether `review` exists.

`IndexedArrowsBackend.transaction` is the sole native abort owner for both modes. Proposed candidates are still unobserved; verified committed preimages and delivered readonly roots continue through the existing register below public cancellation. Global error/unhandled-rejection protection in the current timed run is unchanged.

## Limits / remaining gates

No independent functional verdict, physical timing, broader browser/device, assistive technology, deployment or release claim. The coordinator owns the native R8/R9/R10, deletion/no-deletion, transaction-error and lifecycle matrix under `/private/tmp/arrows-r8-r10-qa`; do not treat simulated checks as that gate. Native results must bind the final settled source/build identity. No commit or main integration is authorized to this worker yet.
