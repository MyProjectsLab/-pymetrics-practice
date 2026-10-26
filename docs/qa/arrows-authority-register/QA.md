# Arrows verified-root register and ordered Continue

Status: implementation and developer verification only. No independent functional verdict, integration, qualification, deployment or release claim.

Base: `202a5dd19304f062d70c8c36d6ea3b458a59351e`. Isolated checkout: `/private/tmp/arrows-register-controller`. Exact resulting commit and file/evidence hashes are recorded after commit in `/private/tmp/arrows-register-evidence/IDENTITY.json`. Main and held `ee08cea846aa976a4893ffd35fc7420fae00c41a` were not edited or integrated.

## Contract

The amended register follows `/private/tmp/arrows-f4-design-challenge/CLAUDE-RECONCILIATION.md`, correcting Claude's prefix, integrity, cancellation and chronology assumptions. One register is shared by durable database domain and installation within a realm. Every supported validated root is canonicalized in full, including activity, copied and frozen. Lower revisions cannot replace newer evidence; identical equal revisions are a no-op; conflicting equal revisions or illegal higher-revision history persistently block integrity and notify attached targets. Only an explicit ordered fresh read dispatched after the conflict, preserving verified history, or installation replacement resolves that block. Ordinary reads cannot clear it.

Targets retain immutable original arms/results, verified admission and snapshot witnesses, positive checkpoint floors, and absorbing retirement. An unwitnessed future arm remains unknown even when a root's counter is high enough. A compatible earlier checkpoint at/above the witnessed floor may recover toward desired P; a successor beyond P retires P alone. Published snapshots require exact full snapshot bytes. An optimistic terminal recovers from absence/checkpoint; different terminal U retires T alone and preserves U/original arm. Contradictory historical roots block integrity rather than synthesize deletion.

Readonly roots already delivered into verification observe below public cancellation; aborting a still-active IndexedDB transaction remains supported and produces no invented evidence. Validated committed transaction preimages observe before mutation; uncommitted candidates never enter the register. Originating Store/provenance stays attached across A→B replacement. Register confirmation never grants a canceled callback permission to publish Saved DOM.

Every Continue uses the shared presentation/deletion order, fresh exact-prefix verification and current state/profile/layout/visibility/control checks. Admission remains held until the captured block's first confirmed onset (trials 25/49/73/97). Key release while waiting saves the extended prefix before new admission. Cancellation, invalidation, unmount and deadlines release the order. Timed callbacks only confirm captured tokens synchronously; they do not await storage.

## Reproduction and checks

Evidence root: `/private/tmp/arrows-register-evidence`.

| Check | Recorded result and scope |
|---|---|
| Before-edit R7 reproduction | `reproduction.log`: real Entry/Store first arm-confirmation read fails at exact base; two adjacent controls succeed. |
| Before-edit native Continue reproduction | `baseline-continue-deletion-raw.json`, `native-baseline.log`: actual production 24-trial journey; deletion commits during held positive final read; base then displays block 2/trial 25 with durable attempts=0, tombstones=1, counter=1. |
| One focused Arrows gate | `arrows-final.log`: 216 tests across 14 files succeed. This precedes final bounded ownership/chronology/attachment hardening; no global project suite or repeated full gate. |
| Final affected gate | `final-targeted.log`: 81 tests across authority, real register/browser, Entry and authority/Journey surface files succeed after all product edits. |
| Build / lint / frozen forms | `build-final.log` succeeds including TypeScript; `lint-final.log` has only the two existing warnings outside Arrows (`src/App.tsx`, old M5 QA driver). `forms-final.log` succeeds, canonical generated digest `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b`. |

Deterministic coverage includes read-start and callback orders; r5→r7→r6/activity-only roots; full same-revision conflict and explicit resolution dispatched before/after conflict; contradictory higher history; pre-arm/pre-floor evidence; reused session IDs and delayed A→B callbacks; committed preimage versus failed/uncommitted/undelivered writes; immutable exact P/T/U semantics; R7 first/second read canceled before/after verified U; live/released/history activity append, fallback, readback and polls; detached/remounted/new surfaces; operational read/write failures; timeout/retry; all later block deletion modes/orders; late/wrong onset; held keys, layout and lifecycle; immutable caller input capture and undelivered ownership deadline. Surface fixtures assert actual rendered DOM alongside root and handle state. Frame-only legacy browser tests use a declared test adapter that translates their mocked storage outcomes into actual register observations; real Entry/Store tests are separate.

## Native browser matrix

Local Chromium 1208 headless shell, native IndexedDB and Web Locks; BroadcastChannel removed in race probes. `browser.jsonl` records 35 candidate assertions plus one failing baseline observation. Drivers, raw durable roots, barrier/event logs and screenshots are retained beside it.

| Candidate cases | Method / decisive evidence |
|---|---|
| 3 R7 retry/settlement/Continue | Production bundle, three actual 24-trial keyboard journeys. Hold verification after underlying delivery; cancel, inject valid terminal U, keep fresh recovery/poll held, release old verification. Exact P withdraws before fresh retry; handle/generation/opening stay stable; U/arm bytes survive, reload opens U. |
| 16 Continue races | Blocks 2–5 × individual/Delete all × deletion-first/admission-first. Source-module browser adapter uses validated seeded break prefixes after actual initial Start/onset, then real Entry/Store/IndexedDB/Web Locks and actual new-block DOM/onset. Deletion-first rejects before fixation/onset; admission-first holds deletion until captured onset and then allows it. Root/counts, register/target witness, display and lock timestamps recorded. |
| 8 activity loss cases | Production live/history × prefix/terminal × individual/Delete all. Live prefix uses actual 24 trials; live terminal uses actual onset then blur; history uses explicitly seeded valid fixtures. Negative transaction preimage withdraws DOM before held fallback/polls; no resurrection or activity recreation; reload is empty. |
| 1 canceled initial terminal | Production actual onset; unbound T currentTerminal times out before held underlying verified U delivers. U retires T before new recovery, preserving U and arm. |
| 2 operational controls | Production activity timeout and injected write failure preserve saved result bytes and retry the same genuine view ID once. |
| 2 admission controls | Source adapter: held keyup extends P before Continue; layout failure withholds admission and healthy restoration admits/onsets. |
| 1 integrity control | Production published terminal history fixture: same-revision activity-byte conflict hides counts/saved claims. Ordinary restored-good poll remains blocked; explicit fresh verification restores the same opening/handle without adding another report-view event. |
| 2 poll orders | Production history terminal positive-first/negative-first deletion ordering, held native readonly completions and timeout; late positive cannot revive retired DOM/root. |

After the last product hardening, `final-native/browser.jsonl` records 21 affected replays: all 16 Continue race cases, both admission controls, production actual 24-trial R7 Continue, canceled initial terminal and integrity resolution. These production raw files include loaded asset URLs; `IDENTITY.json` hashes the final build assets and all changed source/tests. The remaining initial cases are explicitly earlier developer evidence, with final affected deterministic checks covering their changed dependencies; they are not claimed as an entire fresh native matrix at final SHA.

Harness-only corrections: bounded the integrity fixture wait and allowed its existing event count; stopped the abandoned wait process. Initial test failures exposed target interning, conflict chronology and test-double witness assumptions and were fixed before the initial candidate. Intermediate diagnostic logs remain retained and are not substituted for final checks.

## Explicit-reset preflight amendment

Static preintegration review blocked initial `fcf8dd2644cb16aec941d6535f79780a7b6d1d7b`: observing a durable integrity-conflicting preimage threw before an explicit reset could replace it. Reproduced both same-revision activity mutation and contradictory higher-revision activity history through real Store fixtures and the production Journey/history with native IndexedDB. Evidence: `reset-reproduction.log`, `reset-amendment/native-reproduction-corrected.log` and paired raw roots/DOM. The initial native driver tried to navigate a blocked report into history; that route is unavailable, exposing the adjacent recovery-control gap. This is recorded as a harness/path discovery, not a second product verdict.

The grouped amendment guards the original installation inside the reset transaction before observation. It validates and records the conflicting preimage but catches only its typed integrity block for explicitly requested Delete all; the root never becomes verified/latest, and ordinary writes still reject it. The fresh replacement is adopted only after validated durable readback. Stale A reset/read callbacks cannot erase or adopt a later installation. Failed/uncommitted replacement leaves old targets blocked, not retired; held readback does not publish success, and canceled delivery cannot install its old successor into a newer surface. The blocked report now exposes the existing explicit reset confirmation without reload. Failed reset restores only its still-owned blocked attachment and retains the genuine report-view ID for a later integrity check/retry.

Affected verification only: `reset-amendment/affected-final.log` records 105 tests across register, Store, Journey and reset fixtures; `final-delta.log` records the final 29 reset/authority-surface checks, including preserved report-view ID. Build and lint succeed in that folder (the same two existing warnings outside Arrows); no full suite rerun. Seven new real Store reset cases cover both conflicts, ordinary-write blocking, failed/aborted candidates, delayed/canceled readback, reused session IDs, and newer-installation ownership. Five added Journey checks pair visible withdrawal/success/failure/retry with actual durable roots and handles.

Native amendment evidence contains seven unique final scenarios: both conflict types × success/native transaction abort/injected write failure, plus normal reset. All use the production bundle, native IndexedDB/Web Locks and no BroadcastChannel; valid completed history/activity fixtures are explicitly seeded. Failure/abort preserves conflicting root and blocked DOM, then explicit retry resets to a verified empty installation. `native-abort-controls.log` repeats only the two abort cases with a corrected abort hook, plus normal deletion: the initial hook aborted and then threw, producing an artificial second-abort page error; corrected direct-abort controls have no page errors. Loaded asset URLs and raw roots/status/surface tokens are retained. `IDENTITY.json` identifies the amended commit, source/build hashes and current evidence; the initial candidate packet is retained separately.

## Limits

This is a local developer candidate. The 16 later-block race probes seed validated prefixes and do not claim complete 48/72/96-trial production journeys. Completed history fixtures are synthetic replay-valid records, not a native 120-trial timing run. No physical display timing, pointer-device, touch, Safari/Firefox, accessibility or full product browser/device qualification is established. Injection of terminal U, regressed/divergent history and equal-revision bytes is an explicit fault model, not asserted ordinary UI reachability. Independent functional audit and integration remain separate. Frozen engine/report/scoring/form contracts and other games are unchanged.

Changed-file inventory and precommit call-graph review: [CALL_GRAPH.md](CALL_GRAPH.md).
