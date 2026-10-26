# Precommit source inventory and review

Reviewed the complete changed runtime call graph against the amended reconciliation before the candidate commit. No known unmet implementation invariant remained at review. This is developer source review, not an independent audit.

## Central observations

| Store route | Register evidence / ownership |
|---|---|
| `open` | Validate complete root, create installation/domain register, observe frozen open root. Native connections share the domain/installation state. |
| `checkedRoot` → read, loadArmed, loadSnapshot, listAttempts, loadReportViews | Capture originating immutable Store/install provenance before backend read; inspect and observe below public `withAbort`; return monotone latest only while verified. |
| `transactionRoot` → Start, snapshot, activity, individual deletion | Validate committed preimage, observe copied root, enforce same installation/verified current preimage before mutating. Proposed successor is only validated, never observed before commit. |
| Start/snapshot/activity normal readback and catch fallback | Every read uses `checkedRoot`; stronger negative/integrity evidence survives an operation failure. Transaction matching, immutable journal/provenance checks and CAS remain write preconditions. |
| Delete all / replacement read / adoption | Transaction first guards original installation, then validates/observes preimage. Explicit reset alone may catch the typed integrity-block exception while preserving blocked state and leaving conflicting preimage out of latest; ordinary writes have no exception. Replacement candidate is not observed. Validated durable replacement feeds originating A register, retiring only A; adopted B gets its own provenance/register. Delayed A cannot poison or erase B. |
| `openForDeletion` | Invalid root identifies only installation for explicit reset; no root authority fact. Valid replacement must be read and verified after commit. |
| `verifyIntegrity` | Bounded fresh read under publication/deletion order, with captured post-conflict dispatch permission. Cached/ordinary and pre-conflict dispatched callbacks cannot clear integrity. |

`authority.observe` is called only from Store runtime paths. Runtime observation ports, `startOperation`, manual `retire`, `observePublication`, duplicate prefix recovery classifiers and error-message retirement are removed. An error-message retry remains solely for terminal snapshot CAS contention, not authority classification. Notifications remain advisory and require reads.

## Consumers and action boundaries

| Consumer | Captured target and freshness boundary |
|---|---|
| Entry begin / confirmArm / checkCurrentArm | Clone invocation request/profile; immutable original-arm handle before first await; all nested reads central. Timed/live ownership with bounded acquisition and late callback fence. Terminal-ineligible is an admission precondition, not arm retirement. |
| Entry currentCheckpoint | Required semantic handle; original arm/result/floor captured before both first confirmArm and second snapshot reads. Both observations reach the shared register independently of public cancellation. |
| Entry checkpoint / saveBreakExit / currentBreakExit / saveTerminal / currentTerminal | Immutable result target before first await; centralized exact-result evaluator; explicit absent/checkpoint terminal controls; Store preimage/readback preserved. |
| Entry Start / Continue admission | Shared deletion/presentation boundary; exact current target before synchronous browser action; immutable per-block token retained through actual first onset. Deadline and owner cancellation release lock independently of storage delivery. |
| Browser save/retry/settlement/Continue | Interned exact break target with verified floor; relevant child subscription withdraws P despite arm remaining current. Timed callbacks never await storage. Waiting keyup/layout/controls rechecked before action; keyup extends prefix and restarts admission. |
| Recovery | One shared exact handle; bounded/coalesced delivery controller. Register owns retirement/integrity; catches record operational uncertainty. Successful current delivery required in addition to register confirmation for Saved outcome; late callback cannot revive. |
| Journey live/released/history | Shared handle attachment binds store identity/generation, surface generation, navigation and opening; synchronous withdrawal before freshness checks. Saved publication/open/resumption/poll pairs fresh ordered read with synchronous exact-session DOM confirmation. |
| Journey activity append/retry/readback/poll | Same immutable confirmed snapshot handle and genuine view ID; activity scopes never infer authority from errors; detached/old callback cannot affect new surface. Explicit integrity resumption reuses opening rather than fabricating an event. |
| Journey explicit reset recovery | Blocked report offers existing reset confirmation directly. Success awaits Store durable replacement plus navigation/opening/Store ownership fences. Failure restores only an owned blocked target, with the existing genuine view ID; stale failure cannot restore a detached or newer surface. |

## Truth table / history review

- No accepted root or original-arm witness: unknown; never definitive retirement from a pre-admission counter alone.
- Newer legal tombstone/missing witnessed arm or verified replacement: absorbing arm-family retirement.
- Desired checkpoint P with earlier compatible checkpoint at/above a verified floor: recoverable; exact P: confirmed; successor beyond P: only P retired. Published P additionally requires exact snapshot revision/kind/review/journal bytes.
- Optimistic terminal T with absent/checkpoint: recoverable; equal T: confirmed; different U: only T retired. Original arm and U remain available.
- Invalid/malformed or operationally unavailable read: no authority fact; delivery remains uncertain. Committed preimage negative is a fact even if later write aborts. Uncommitted proposal is never a fact.
- Canonical equal-revision conflict or illegal higher history: persistent integrity block hides claims and disallows admission; does not invent deletion. Full activity identity participates in equality/history.
- Lower late revision cannot undo latest, witnesses, block or retirement; independent installation revisions are never compared.

## Changed files

Runtime: `src/arrows/authority.ts`, `storage.ts`, `entry.ts`, `browser.ts`, `recovery.ts`, `Journey.tsx`.

Tests adapted to real register evidence: `authority.test.ts`, `storage.test.ts`, `entry.test.ts`, `browser.test.ts`, `recovery.test.ts`, `recovery-surface.test.tsx`, `authority-surface.test.tsx`, `Journey.test.tsx`.

New real Entry/Store fixtures/matrix: `register-test-support.ts`, `register-reproduction.test.ts`, `register-browser.test.ts`, `register-reset.test.ts`.

QA: this file and `QA.md`. No other games, frozen specs, engine, contracts, manifests, report/scoring code, generation or styles changed.

Amendment source review: the only product changes after initial `fcf8dd2` are the explicit-reset preimage exception and the Journey recovery controls/owned failure restoration. Reviewed the complete resulting reset path against `REGISTER-PREFLIGHT.md`: original-installation transaction guard precedes exception, no proposed replacement observation, no ordinary-write exemption, no adoption before durable readback, and no stale failure restoring newer UI. Developer review only; no independent verdict.
