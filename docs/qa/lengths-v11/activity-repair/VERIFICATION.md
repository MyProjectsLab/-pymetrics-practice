# Lengths Mouth V1.1 grouped F1 / OBS-1 / AR1 activity repair

## Identity and verdict boundaries

Base: exact clean `84a0d2f846cea41a96be693b3fbebdc16a8ffef7`. Isolated clone `/private/tmp/lengths-v11-activity-repair`, created with `--local --no-hardlinks`; branch `agent/lengths-mouth-report-activity`. Target is the one repair commit containing this record; its exact SHA is supplied in the handoff.

The [whole-standalone independent audit](/private/tmp/lengths-v11-independent/AUDIT.md) **FAILED at the base SHA on F1**, with OBS-1 retained. This repair is **developer-verified within the scope below**, pending a new separate read-only exact-SHA verdict. It does not grant whole-V1.1 PASS, personal founder acceptance, qualification, mock completion, deployment or release. Main was not edited. No push, deployment or analytics activation.

The original [milestone verification](../IMPLEMENTATION_VERIFICATION.md) and its source/build hashes remain historical evidence for `84a0d2f`, not hashes for this repair. [BRIEF.md](BRIEF.md) defines the grouped scope before product edits.

## Findings reproduced

| Finding | Unchanged-base reproduction and evidence |
|---|---|
| F1 | API-create a valid durable arm, then actual production UI history → recorded review → Retry report opening record. [reproduction-arm-review.json](reproduction-arm-review.json) retains complete roots and rendered text: revision 1, empty activity, original attempt bytes unchanged. [Screenshot](reproduction-arm-review.png). |
| OBS-1 | Persist 30-trial checkpoint, append one view, extend legitimately to 60, retry original ID/source/time/snapshot. [reproduction-activity-retry.json](reproduction-activity-retry.json) retains complete roots and the rejection `report view authority changed`; one old event remains correctly bound. |
| AR1 | Precommit [activity review](/private/tmp/lengths-v11-preflight/ACTIVITY_REVIEW.md) identified the gap between ordered report publication and first activity write. The same strengthened dispatch-barrier driver against the unchanged independent base artifact at port 4277 reproduces checkpoint extension overtaking the activity operation. [reproduction-AR1.json](reproduction-AR1.json) contains the explicit `extension overtook publication/activity order` failure and complete extended root without an opening event. Arm AR1 cannot dispatch at the base because F1 suppresses arm activity; the repaired arm path is tested with both held schedules below. |

F1 and OBS-1 ran before product edits. AR1 was separately reproduced on the unchanged base artifact after the source concern was raised; that artifact remains `index-DBHDnjAp.js` and is separate from the repair. The initial AR1 driver also attempted an arm dispatch, which timed out because of F1; it was narrowed to the decisive checkpoint race. This was a driver limitation, not an additional product verdict.

## Grouped correction

- Arm-only activity binds `resultRevision: 0` to the retained immutable three-event arm prefix. It never invents a checkpoint or terminal. Existing positive snapshot-revision events remain valid. Journal binding remains its first event's revision, and the validator accepts old arm activity after later legitimate extension.
- View IDs, observed wall time, source and original review binding are captured once at actual verified DOM publication and reused. An existing ID with changed source/time/revision rejects without modifying the complete root.
- In a verified current installation root, lookup of an already committed matching event precedes the old target's current-snapshot requirement. A historical acknowledgement after legitimate extension is a no-op; it does not revive the retired handle, publish old numbers or authorize a new view. New events still require current handle/installation, no tombstone, exact immutable arm and exact current arm-only/snapshot binding.
- The publication gate now awaits the activity append and exact readback while retaining the shared publication/snapshot/deletion ordering boundary. The same two-second bounded AbortSignal controls the activity transaction/readback. Failure or uncertainty withdraws report DOM and releases the order; canceled transaction dispatch cannot write later. Committed but undelivered activity can later be acknowledged with the original binding.
- Pending activity is a shared promise; confirmed activity is a separate flag. A canceled first request cannot cause another publication to treat an unfinished opening as confirmed. Navigation and target checks fence status callbacks.
- Historical activity retry is separate from current report publication. Retirement still withdraws old report numbers even when the existing event is reconciled. The authority implementation and its sticky retirement semantics are unchanged.
- Arm-only copy now says **“Incomplete review saved in this browser”**, so Saved refers to the factual incomplete review.

The separate read-only [AR1 source closure](/private/tmp/lengths-v11-preflight/AR1-CLOSURE.md) closed the precommit concern on the current source hashes, with no concrete adjacent blocker identified. It counted saved developer results but did not rerun browser/tests or issue an exact-SHA functional verdict.

## Developer checks

| Check | Result |
|---|---|
| Focused Mouth deterministic tests | PASS: 48 tests across core/activity files, including 10 new activity cases. Revision-zero event and unchanged attempt/counters; idempotent roots; arm→checkpoint and checkpoint→checkpoint→terminal acknowledgement; stale new-ID rejection; changed source/time/binding rejection; failed/committed-undelivered writes; deletion/replacement rejection; malformed binding validation. |
| Full `npm test` | PASS: **90 files / 1,546 tests**. |
| `npm run lint` | PASS, only three inherited warnings in frozen checker, old M5 driver and existing App history effect. |
| `npm run typecheck` / `npm run build` | PASS. Existing large-bundle/static-dynamic import warnings remain. Build generates existing analytics files but does not activate analytics. |
| Frozen packet and legacy integrity | All **12** V1.1/V1.0 freeze hashes match. No diff against base in frozen specifications, legacy `src/lengths`, Mouth engine/browser/forms, or App. |
| Source/build inventory | [source-hashes.json](source-hashes.json) records four changed source/test hashes, repair client bundle `index-BxXeUfis.js`, CSS and separately compiled probe. |

## Production UI / native IndexedDB matrix

[The driver](browser.mjs) and [all results](browser-results.json) retain **26/26 PASS**. Chromium headless-shell revision 1208 on macOS arm64, isolated contexts, 1280×900. Actual production candidate UI at port 4280; seeds are replay-valid API-created arm/30-trial checkpoint/90-trial omitted terminal fixtures, not physical timed journeys. No application clock is replaced for UI actions. Every case retains complete native before/after roots; reload and retirement cases retain the additional complete roots. The [full root archive](browser-roots.json.gz) is a losslessly compressed JSON array, indexed by `rootsRecord` in the small results file; decompress with standard gzip tooling. Compression round-trip verified exact raw bytes, with no root fields removed. [Arm report screenshot](arm-review.png).

| Cases | Count | Assertions |
|---|---:|---|
| Arm/checkpoint/terminal genuine opening, same-view retry and new genuine opening after reload | 3 | Exactly one original event, correct revision binding/source, root revision +1 only for activity; retry leaves complete root byte-identical; reload creates exactly one fresh view; all attempt bytes and counters unchanged; concise arm Saved copy. |
| Arm→checkpoint and 30→60 publication-first, activity held before native dispatch / after native commit | 4 | Extension cannot overtake held publication/activity order; exactly one original opening event retained with original binding; committed-undelivered timeout releases order, and late delivery/same-view retry changes no complete root; old numbers remain withdrawn after extension. |
| Each review type × individual deletion/replacement × before-dispatch/committed-delivery hold, notifications disabled | 12 | Deletion waits for the ordered boundary until activity completes or bounded cancellation; held pre-dispatch work is canceled; committed event is removed by deletion; late dispatch/callback/retry cannot change the complete retired root, revive activity or restore numbers. |
| Each review type × individual deletion/replacement winning before stale history click | 6 | Actual stale UI opening records no activity, changes no complete root and publishes no report numbers. |
| Native OBS-1 plus mismatched retry and new stale ID | 1 | Matching committed historical ID returns the exact existing event after 60-trial extension; old handle remains retired; new stale ID and changed source/time reject; complete root byte-identical through acknowledgement/rejections. |

The before-dispatch hold explicitly substitutes a contained queued transaction object before the first activity transaction is created. On release it dispatches the real native IndexedDB transaction; on abort it does not dispatch. This is a software fault-injection barrier used to expose the ordering gap, not a naturally occurring browser condition. The after-commit hold delays the actual native transaction `oncomplete` delivery. Second-tab extensions/deletions use real native Web Locks and IndexedDB and suppress BroadcastChannel notifications.

The strengthened driver passed after replacing an earlier native-get callback hold with the explicit pre-dispatch barrier; the latter decisively reproduces AR1 on the base. No passing evidence is presented as physical/browser/device certification.

## Limits and changed files

This is a report-activity repair. No new real-time 90-trial journey was run; timed mechanics and browser adapter bytes are unchanged, and the prior independent base audit's actual journey remains historical evidence within its scope. Fixture reports are tested through the real candidate UI, but replay-valid seeds do not certify natural crash/reload or physical input. Native user/device/screen-reader, OS suspension, full accessibility/browser qualification and provider equivalence remain open. Broad whole-game acceptance and release gates remain open.

Product changes: `src/lengths-mouth/storage.ts`, `Journey.tsx`, `report-publication.ts`; new `activity.test.ts`. Tracker records base audit FAIL F1 and OBS-1 and this pending repair. New QA folder contains brief, this record, source hashes, copied/adapted base reproduction scripts/results/screenshots, compiled-probe build helper, and the production UI race driver/results/screenshot. Original milestone evidence is retained byte-for-byte. No package, lock, frozen packet, legacy, engine, browser, App, analytics or other game source changes.
