# Stop M2B-1 verification

Date: 2026-09-28; updated for Founder clarification M2B-02. Scope: the headless Stop V1.1 timing, input, interruption, and validity engine. This is deterministic engine evidence, not real-browser timing certification or a completed Stop journey.

## Starting point and authority

- The original M2B-1 implementation started from clean `main` at `2fdcb8cbe40bf4266d21e1f35ee339875c7e6d61` and was committed as `e75712c125e3a854ad56204a17ee2aa78b84e2ab` with 233 passing tests. The focused M2B-02 correction started from that clean commit.
- Read `AGENTS.md`, `IMPLEMENTATION_TRACKER.md`, both binding specifications, and `docs/qa/m2a/VERIFICATION.md` completely.
- M2A candidate components, the readiness checkpoint, dependencies, form manifests, and both binding specifications remain unchanged.
- M2B is split into M2B-1 (this engine) and M2B-2 (browser/React integration, warm-up, form assignment/exposure, scored run, interruption screens, and completion boundary).

## Adapter contract

`src/stop/engine/index.ts` exports the engine and its typed adapters. It imports no React, DOM, network, storage, form registry, or scoring code.

1. Inject one finite, non-negative, monotonic clock. The engine samples it for input receipt and confirmations; it does not accept browser event timestamps or animation-frame timestamps with another origin. Event envelopes record observation time. Timeout records separately retain the exact logical resolution deadline; they are never backdated.
2. `Scheduler.at(t, callback)` dispatches at or after `t`. `Scheduler.after(t, callback)` dispatches strictly after `t`, so an input observed at exactly the deadline is still eligible. A later callback must not add its delay to the logical resolution time or next eligible onset. This is a scheduler contract, not a one-millisecond grace period. The fixture's 0.001 ms step represents the strictly-after boundary only.
3. `FrameAdapter.request` receives an onset or offset request with `notBeforeMs` and a caller-supplied trial definition. It must confirm exactly once, synchronously with the first eligible rendered frame, and use the injected clock. An onset request is not presentation evidence. A missing confirmation has a watchdog; duplicate or incompatible confirmations invalidate. Browser rendering, frame confirmation, and adapter accuracy remain M2B-2 work.
4. Adapter callbacks must be asynchronous, cancellation functions must be idempotent and non-throwing, and key events must be delivered immediately without buffering or replaying them across trials. The event sink must be synchronous and must not re-enter the engine. A thrown/reentrant sink invalidates and preserves a local diagnostic journal.
5. `begin` opens protection at readiness, with the observed held-key state. Before `start`, the caller must forward current visibility, focus, viewport, and settings validity from its preflight/browser adapters. A held key or unfocused document delays initial fixation until key release/focus acquisition. No inferred key release occurs on blur.
6. `start` accepts a nonempty caller-supplied, single-phase warm-up or scored batch with unique trial indices. It does not choose trial sequences, counts, stimuli, form families, or exposure. Drill execution is not included. Each batch starts with 1,000 ms fixation.
7. Under M2B-02, accepted outcomes resolve immediately, and the post-trial interval begins at `max(resolvedAtMs, confirmedOffsetMs)`. Both timestamps must exist before that interval can be scheduled. `fixation_started.expectedAtMs` records this anchor, and the unchanged `post_resolution` event kind names the interval. Next-onset eligibility and transition anomaly measurement use the anchor. `batch_finished` follows the same interval after the final trial. Protection continues between batches and after the final batch. Only the caller's later completion flow may call `endProtection`, after its completion record exists. The engine never emits `session_completed` or asserts a product result is valid.
8. A first warm-up timing anomaly stops the batch and emits `warmup_restart_required`; the caller must supply the restart batch. A second warm-up timing anomaly invalidates. Timestamp/integrity failures invalidate immediately because a reliable restart cannot be inferred from a broken clock or record. No warm-up UI, sequence, or form exposure was implemented.

The in-memory journal uses `stop_engine_event_v1`, separately versioned from M1/M2A's existing `stop_event_v1`. Events and nested payloads are cloned/frozen, with a stable session identifier and one-based sequence. No existing schema was silently changed. The shared recorder and engine accept a validated optional `sequenceOffset` to continue the prior stage's last sequence number without rewriting immutable events. The caller must retain the same session clock and identifier. M2B-2 must explicitly compose the two event schemas in the eventual session record; no composition was connected here.

## Rule identifiers and evidence

All identifiers have the prefix `stop_validity_v1.`. Each invalidation and note names its triggering event sequence; the rule version is exposed in snapshots.

| Identifier suffix | Stop V1.1 rule |
|---|---|
| `hidden` | Any hidden document during protection |
| `lifecycle` | pagehide, freeze, or reported lifecycle restoration |
| `blur_over_1000ms` | Visible blur strictly longer than 1,000 ms; no count limit on brief blurs |
| `viewport_below_768x600` | Either dimension below the supported minimum |
| `settings_changed` | Response key, visual/timing profile, input-device class, or accessibility setting changed |
| `severe_timing` | Section 14.3 severe timing/timestamp threshold |
| `two_timing_anomalies` | Second separate non-severe timing observation |
| `one_timing_anomaly` | One non-severe observation; affected trial timing excluded |
| `second_warmup_anomaly` | Second warm-up timing anomaly across the one allowed restart |
| `three_anticipatory` | Three accepted responses below 100 ms; triggering outcome is retained |
| `three_premature` | Three fresh response-key presses in scored fixation before a response window |
| `five_wrong_keys` | Five non-repeated wrong keys during the scored batch |
| `five_extra_inputs` / `ten_extra_inputs` | Input note at five extra eligible presses; invalid at ten |
| `integrity` | Incompatible/missing/duplicate required events, impossible eligible response, or sink failure |

The engine records repeat, held, wrong, unfocused, fixation, extra, and late inputs. Only a non-repeated, released-to-pressed transition can resolve a trial. Repeat events alone never invalidate. Accepted responses below 100 ms retain the hit/false-alarm outcome and are marked for timing exclusion.

Classification details: a fresh press after an accepted response is extra; if it is also beyond the original deadline, a late record refers to the same input sequence without incrementing the extra counter twice. A press after a timed-out trial is late. A press before onset, including while awaiting the next frame, is premature fixation input. Held/repeated inputs cannot increment these eligible-press counters or leak into the next trial. Anticipatory/extra counts span the protected attempt; the explicitly scored-only premature/wrong counters exclude warm-up.

A single delayed transition can violate both the onset-delay and post-resolution-duration bands. The engine records both issues in one observation, rather than counting one delayed transition twice. The upcoming trial is marked for timing exclusion; a delayed final post-resolution boundary belongs to the final trial. Separate observations, even on one trial (for example offset and deadline), count separately.

For clock corruption, the diagnostic envelope retains the last reliable monotonic sample (zero if no valid sample exists yet) and records the rejected observation separately. It does not imply a valid physical occurrence time after clock failure. The run stops.

## Deterministic coverage

| Test file | Evidence |
|---|---|
| `timing.test.ts` | 0/99/100/199/200/201/999/1,000/1,001 ms response boundaries; inclusive tie; all four outcomes; both phase starts; M2B-02 early/timeout progression, delayed valid offsets, same-timestamp input/offset ordering, and final-trial boundaries; delayed confirmed frames; all numerical anomaly bands; missing frames; one/two/severe anomalies; affected timing exclusions; caller-controlled warm-up restart |
| `input.test.ts` | Held-at-entry and held-through-onset; missing repeat flag; repeat without initial keydown; repeat counts alone; wrong/remapped keys; first-only resolution; extra/late/fixation classification; carryover protection; focus/key release; below/at anticipatory, premature, wrong, and extra thresholds |
| `interruption.test.ts` | 999/1,000/1,001 ms blur; watchdog without refocus; repeated brief/duplicate blur notifications; hidden page throughout protection; all lifecycle signals; viewport boundaries; every setting category; causal event sequences; cancellation and inert input after invalidation; protection through the caller completion boundary |
| `integrity.test.ts` | Immutable snapshots/definitions/order/schema/session; monotonic and broken clocks; sink failure/reentry; required-event removal/duplication; held/repeat/wrong-key response corruption; outcomes/timestamp/source corruption; valid response and timeout reconciliation; bad scheduler contracts; duplicate callbacks; phase handoff without a form decision |

Tests execute with Vitest's **Node environment**, a synthetic scheduler, and synthetic frame confirmations. No browser timers, real input devices, display refresh rates, or browser lifecycle delivery were measured.

## Acceptance status

Every entry below is **partially covered at engine level**. None is claimed fully passed until the corresponding M2B-2 browser flow and retained-event behavior are verified.

| Acceptance ID | Engine evidence | Remaining gate |
|---|---|---|
| S10 | First keydown accepted; repeated keydowns ignored/logged | Browser key-repeat/scoped input adapter |
| S11 | One outcome, extra inputs recorded and thresholded | Browser input delivery |
| S12 | Wrong key logged without closing the window | Browser bindings/shortcuts |
| S13 | Premature input ignored and held state carried until release | Live fixation and focus behavior |
| S14 | 1,001 ms input late; outcome unchanged | Browser dispatch and clock checks |
| S15 | Confirmation-based onset/offset and every anomaly boundary | Measured rendered visibility on supported environments |
| S16 | 1,000 ms before each supplied warm-up/scored batch | Real warm-up and scored orchestration |
| S17 | Response after offset through 1,000 ms accepted | Browser rendering/input timing |
| S18 | M2B-02: max(resolution, confirmed offset) +1,200; next confirmed frame and final interval | Real frame adapter and final interval behavior |
| S35 | Immediate hidden-page invalidation | Browser visibility adapter and full protected interval |
| S36 | 999 ms visible blur retained without invalidation | Real browser focus behavior |
| S37 | Exactly 1,000 ms brief; 1,001 ms long; repeated brief allowed | Browser blur watchdog and focus delivery |
| S38 | pagehide/freeze/restoration invalid; never resumes | Browser lifecycle adapters |
| S39 | One non-severe observation retains outcome and excludes timing | Scoring, denominator checks, valid-with-note report |
| S40 | Two separate non-severe observations or one severe invalidate | Browser measurements and exclusion from baseline/retest flows |
| S41 | Exact input-quality boundaries tested | Real keyboard and scored-session integration |
| S42 | Every specified settings category invalidates | UI/browser setting detection |
| S43 | Batch reconciliation and retained-stream mismatch detection | 80/60/20 manifest/checksum verification, immutable completion, scoring/storage recovery |

S09 (held-key inheritance), S28 (input timing eligibility only), S66 (viewport invalidation only), and S69 (integrity diagnostics only) gain partial engine evidence. S01 is still partial, with no report flow. Existing M1/M2A status remains unchanged. S19–S20, S25–S26 and the remaining scoring/report/training/storage/analytics/release tests are **not yet applicable to M2B-1**. No complete product acceptance test is newly marked passed here.

## Founder clarification M2B-02 — overlap resolved

The founder approved `transition anchor = max(outcome resolution timestamp, confirmed stimulus-offset timestamp)` on 2026-09-28. This replaces the earlier resolution-only progression for responses before confirmed offset and resolves the Section 7.2 overlap. The full clarification is retained under “Founder clarifications” in `IMPLEMENTATION_TRACKER.md`. Neither binding specification was edited.

Outcomes and response times are still recorded immediately. Stimulus offset still targets onset +200 ms. The 1,200 ms interval waits for confirmed offset when the outcome occurred earlier. For responses after offset and for timeouts, progression stays resolution +1,200 ms. The final headless batch boundary follows the same rule. Existing event payloads are unchanged; no schema migration or React integration was added.

Explicit deterministic fixtures verify:

- With an on-time 200 ms offset, responses at 99, 100, 199, and 200 ms request the next onset at 1,400 ms; 350 ms requests 1,550 ms; timeout requests 2,200 ms, all relative to the current onset.
- Early GO/NO-GO responses record their hit/false-alarm and RT immediately. Offset is neither shortened nor canceled, and post-trial fixation starts only after both required timestamps exist. Extra input cannot restart the interval or change the recorded outcome.
- Valid delayed confirmed offsets at 201, 216, and 250 ms move eligibility accordingly. A response at 225 ms with offset at 250 ms waits until 1,450 ms, demonstrating that actual confirmation, not the nominal 200 ms target, controls the anchor.
- Both callback orders at a shared 200 ms response/offset timestamp produce one interval. Later-frame confirmation follows the corrected eligibility time.
- Final completion is absent one millisecond before the anchor +1,200 ms boundary and occurs exactly at that boundary in the synthetic scheduler, including early responses, delayed valid offsets, later responses, and timeouts.
- Fast responses alone create no timing anomaly. A genuine 251 ms visibility anomaly remains one anomaly; real transition lateness is measured from the corrected anchor. Invalidation or a warm-up restart while awaiting offset prevents subsequent progression.
- Input-quality threshold fixtures now use the corrected onset schedule while preserving the existing three-anticipatory and 100 ms boundary assertions.

No specification ambiguity remains open for this correction. S15–S18 remain partially covered at engine level. The complete product completion flow, rendered fixation, and real-browser timing accuracy still require M2B-2 verification.

## Commands and document integrity

Environment: Node.js 24.13.1, npm 11.8.0; existing lockfile and dependencies.

| Command | Result |
|---|---|
| `npm run lint` | Passed; no warnings |
| `npm test` | Passed after M2B-02; 14 files and 267 tests (192 engine tests, 75 existing/shared tests) |
| `npm run build` | Passed; TypeScript 6.0.3 and Vite 8.3.1 |
| `npm run check` | Passed; lint, tests, deterministic regeneration of all 14 M1 manifests, build |

Both governing files byte-match both the original starting commit and the M2B-02 starting commit `e75712c125e3a854ad56204a17ee2aa78b84e2ab`. SHA-256:

- Master Strategy: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`
- Stop V1.1: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`

The original M2B-1 commit contains `IMPLEMENTATION_TRACKER.md`, this QA record, `src/core/events.ts` and its test, and ten files under `src/stop/engine/`: `contracts.ts`, `engine.ts`, `index.ts`, `rules.ts`, `integrity.ts`, `fixture.ts`, `timing.test.ts`, `input.test.ts`, `interruption.test.ts`, and `integrity.test.ts`.

The focused M2B-02 correction changes only `IMPLEMENTATION_TRACKER.md`, this QA record, `src/stop/engine/engine.ts`, `src/stop/engine/timing.test.ts`, and `src/stop/engine/input.test.ts`.

## Scope exclusions and provenance

Original TypeScript and synthetic fixtures were authored for this repository from the frozen Stop specification. No external assets, competitor implementation, new dependency, or copied trial sequence was introduced. No React/browser integration, warm-up sequence, form selection/exposure, scored candidate journey, scoring/report, storage/history, Advanced Training/retest, analytics, network request, or deployment was added. The M2A readiness development checkpoint remains unchanged.
