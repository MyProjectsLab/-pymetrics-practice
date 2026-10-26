# B1-B F1–F4 repair — developer verification

Date: 2026-10-03 (America/New_York). Exact clean start and parent: **`e192e7ab6aef5f529b6511ca03cb9a20ab36abcd`**. The repair commit is the commit containing this record; its exact SHA is reported in the handoff, avoiding a self-referential commit hash. Local commit only.

The independent [FAIL](AUDIT-e192e7ab.md) remains bound to e192e7ab. Its copy is byte-identical to `/private/tmp/balloons-b1b-independent-ajhtowdj/AUDIT-e192e7ab.md`; relative evidence links inside that historical audit refer to that external directory. **This repair is implementation-agent evidence, not an independent audit or founder acceptance. A new independent read-only exact-SHA audit is required. B1 remains partial; B2, mock integration, B3 qualification, deployment and release remain open.**

## Before editing

Read the audit and reproduction drivers, repository instructions, complete Master Strategy, Balloons V1.0, packet reviews, tracker, freeze and preceding B1-B QA records. Parsed both packet JSON files completely. Frozen hashes match the freeze and audit. No authority conflict or specification revision.

The two audit browser drivers were copied outside the repository, changing only output-directory configuration and preview port. They ran against the unchanged exact-target archive's production build on port 4191. Original independent evidence was not overwritten. All four failures reproduced **before any product edit**:

- F1: persistent `action_pending` plus `pause` failures leave eligible active bytes with no pending intent. Reload recovers eligibility, and a full 39-round completion incorrectly says “Saved standalone baseline.”
- F2: all four stalled transaction-delivery phases × individual/Delete all retain the exclusive mutation lock and block deletion at 2.6 seconds without BroadcastChannel. Explicit origin-tab exit releases them; late delivery then changes no bytes.
- F3: a healthy 150 ms read removes the selected report permanently, with unchanged storage. The fast-read control has no removals.
- F4: three native Space clicks record unknown/assistive; native Enter records keyboard. Focus-change release suppression still works.

[Pre-summary](pre-summary.json) preserves all 14 scenarios: 12 failed observations (including repeated F1 evidence), two healthy controls. `pre-evidence.tar.gz` retains complete raw JSON, journals, DOM/key traces, screenshots and logs. Temporary working evidence remains under `/private/tmp/balloons-b1b-repair/`.

## Repair and authority argument

### F1 — absence of a durable failure marker

When both intent and cleanup writes fail, persistent bytes cannot distinguish an uninterrupted active record from a failed attempted action. **A missing intent is not proof that no action happened.** Another fallible failure-marker write cannot solve that ambiguity.

New recovery commands explicitly record `reason: checkpoint_required_v1`. Only an existing durable **paused** checkpoint, with no pending intent, no exposure uncertainty and eligibility still intact, can retain baseline eligibility. Recovery from uncheckpointed pending/armed/active/resolved/next-display states is review-only. This deliberately also treats a genuinely clean abrupt reload without a saved pause conservatively. A successful browser-interruption/navigation pause remains a positive control. No new form is substituted or reclaimed by this eligibility rule.

Recovery preserves the header, same form and thresholds, mapping, core journal/actions/results, confirmed round set and exposure. It appends a recovery event/new owner and clears an unresolved intent without replaying its action. The explicit reason tag preserves existing immutable v1 journal replay; historical events/results are not silently rewritten or migrated. A warned failure also stays sticky in the originating controller so subsequent navigation cleanup cannot write an eligible pause over it. Failed cleanup continues to show unsaved work, even when there is no durable marker.

Deterministic cases cover failure before intent and after intent, previously committed work, later navigation cleanup, all recovery phases, clean pause, and old-journal replay. Browser controls additionally reload with one genuinely committed successful pump on round 2: header/core/confirmed exposure remain exact, failed-intent bytes remain unchanged, and eligibility is review-only. The complete original F1 reproduction now finishes as a **saved review-only result**, never a saved baseline; only actually committed actions are represented.

### F2 — bounded mutation admission independent of messages

Every acquired Balloons mutation gate now has a **2,000 ms delivery watchdog** and its own cancellation signal. The watchdog aborts any still-active IndexedDB transaction, fences every awaited continuation, and rejects the gate callback so the exclusive Web Lock releases. Controller failure handling releases the owner lock and pauses controls. Cleanup itself remains bounded. Signals also reach report-view and deletion writes.

This is a storage-delivery/recovery bound, **not a gameplay response deadline, score, form-expiry policy or browser timing certification**. It cannot undo an already committed transaction: recovery must inspect durable bytes. A stalled assignment/arm response never authorizes a mount. The same gate still orders ownership recheck → committed arm → actual mount/two frames → committed confirmation against deletion. Action intent/action transactions retain atomic snapshot/journal commits. A committed confirmation remains exposed even if its response times out. Deletion retains the exposure/chain tombstone; Delete all installs a new identity. Old installation/owner/revision checks remain authoritative.

Late assignment cleanup is bound to its original run scope; it cannot overwrite a replacement run's controller token. All late gate continuations check the gate signal before publishing, mounting or committing. A queued deletion can proceed without notification or an origin-tab action. The engineering bound assumes the browser executes its event loop; it does not claim a wall-clock guarantee during OS suspension.

The original eight absent-notification cases pass. An additional **32-case production-browser matrix** covers four phases × two deletion types × absent/delayed BroadcastChannel × deletion-before-delivery/delivery-before-deletion. Tests inspect Web Locks, candidate state, installation/tombstone bytes and reload; delayed notifications and response callbacks cannot resurrect data. The recorded maximum deletion-request-to-observed-durable-completion time is in `post-summary.json` (under the 2.6-second probe bound). Eight deterministic serialized-lock regressions also pass.

### F3 — navigation identity separate from visible authority

A background history refresh retains the selected record identity while hiding the numerical report after one complete rendering cycle if unresolved. Fast successful reads preserve the report DOM. Slow success replaces the selected object only with that session's record from the newly verified root. Missing records clear selection. Read errors/watchdog timeouts hide authority without destroying navigation identity, allowing a later healthy check to restore it. Candidate navigation and request generations fence obsolete reads; overlapping background refreshes are not queued.

For an already-selected report, the read and synchronous publication share deletion's bounded mutation gate. Thus a read delivered after deletion has committed cannot restore stale numbers even when notification delivery is absent or delayed. A read that times out is fenced; a later check reads current data. Ordinary history-list reads do not acquire that gate. Deletion/replacement notifications continue to suppress immediately when delivered.

Component cases cover slow healthy restoration, missing record, replacement, navigation, fast stable DOM and recovery after timeout. Browser evidence covers healthy 150 ms reads, fast no-removal controls, and four held-read deletion/replacement cases with absent/delayed notifications. Durable bytes remain unchanged by refreshes. The original audit driver may capture its screenshot during the next intentional slow-read suppression; the separate restored-report control captures the restored report after returning to fast reads.

### F4 — native Space default action

The release classifier survives keyup's microtask checkpoint until the end of the current task, with one-use evidence. Space's browser-dispatched click therefore keeps keyboard classification. Evidence expires on a timer and is consumed by a click; pointer evidence clears it. Enter that already clicked on keydown does not leave release evidence for a later unclassified click. Repeat/focus-change cancellation remains scoped to the held physical key; native click remains the sole action entry.

Focused synthetic tests deliberately insert a microtask between keyup and click, then check consumption/expiry and genuinely unknown clicks. Production Chromium dispatches real button defaults using Space/Enter, including repeated held keys and focus changes. Mouse, emulated touch and unclassified DOM-click controls retain their distinct sources. This is not physical keyboard, touch-device or assistive-device certification.

## Checks and retained evidence

- Raw repository command output: [checks.txt](checks.txt).
- **812 tests / 44 files pass** (27 added tests plus strengthened Space ordering fixture).
- Lint passes with only the two inherited warnings in the original M5 QA driver and App.tsx.
- TypeScript and production client/disabled analytics builds pass.
- Nine Balloons manifest regeneration/hash/constraint checks, 14 Stop forms and five Stop drills pass.
- Full fresh BL1/RP1 production journeys, report/reload and all original audit reproductions pass on the final bundle. A separate Python oracle rederives core/durable events, counts, money and every visible table from committed manifests, without importing product calculation code. BL1: **455 banked / 470 lost cents, 198 attempts / 185 successes, 26 collected / 13 burst**. RP1: 39 zero-pump collections. `5 × 185 = 455 + 470 = 925`.
- [Post-summary](post-summary.json) includes **55 passing production-browser cases** (14 audit reruns, 37 expanded boundaries, four additional recovery/report controls). `post-evidence.tar.gz` contains their raw records, key/DOM/write traces, screenshots and logs. All final scenarios have `pass: true` and no harness errors.
- [Preserved boundaries](preserved-boundaries.json) compares frozen specifications and the unchanged B1-A mechanics/integrity/report/manifests, Stop/shared code and App entry bytes with exact e192e7ab. No dependencies, forms, Stop, B2, mock, analytics or other game changed.
- [Identity register](identity.json) binds changed source/tests, bundle, frozen authority, drivers and packaged evidence. [Changed files](changed-files.txt) is the exact repair inventory, including this evidence. Whitespace checks pass; the local commit and clean tree are verified in the handoff.

The browser runtime is **Chromium 145.0.7632.6 headless**, Playwright on this Mac, Node 24.13.1/npm 11.8.0, production preview `http://127.0.0.1:4191`. Contexts are isolated from user history. Transaction errors/delivery stalls and notification delays are injected faults; touch is emulated and unknown activation uses DOM click. No supported-browser/device, physical timing, native OS lifecycle, screen-reader or full accessibility/visual qualification is granted.

## Reproduction

Build with `npm run build`, then serve `npm run preview -- --host 127.0.0.1 --port 4191 --strictPort`. Set `BALLOONS_REPAIR_OUT` to a new external directory, and run `independent-browser.mjs` before `supplemental-browser.mjs` and `repair-controls.mjs` (they reuse its genuine completed records). Run `repair-boundaries.mjs` with the same output setting; its seeded history cases use the retained pre-repair genuine completed root at `/private/tmp/balloons-b1b-repair/pre/independent-full-root.json`. Extract the pre archive there or supply that file before replaying. Drivers deliberately retain the audit's configured local Playwright/browser paths; adapt only those runtime paths if needed. The arithmetic driver uses the retained final output path; changing that path does not change its calculations. Unpack either evidence archive with a standard tar/gzip reader to inspect its complete JSON.

The original audit drivers report observational failures in JSON rather than always setting process exit failure. Inspect every `pass` and `harnessError`. The expanded repair drivers additionally return a nonzero exit on failed cases. Do not rebuild while a production probe is running.

Harness corrections retained outside the final result set: localhost/browser processes required the approved execution path; the first expanded matrix's asynchronous browser predicate returned before durable deletion, so it was replaced with explicit host-side reads; its delivery-first action wait wrongly expected Pump after BL1's genuine T=1 burst and was corrected to Next. The first deterministic delayed-action fixture reset performance.now with fake timers and was corrected to fake only timeout delivery. A committed-work fixture was strengthened to use a genuinely active round 2. Intermediate logs remain in the temporary working directory and are not final passing evidence.

No independent PASS, founder B1-B acceptance, whole-B1 completion, deployment, push or release is claimed. The frozen packet and all excluded milestones remain unchanged.
