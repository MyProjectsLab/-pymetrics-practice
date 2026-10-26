# Digits V1.1 grouped F1–F3 repair — developer verification

**Scope:** One grouped repair starting at clean `8bcc91f80b3e151bcf70f0a4149c028701c820b1`, parent `a0956e971330651f1d9729169ff237af2b333254`, in `/private/tmp/digits-v11-impl`. The independent whole-milestone audit at the base is **FAIL F1–F3**; this record is developer evidence and does not change that historical verdict. Main is untouched by this repair. No independent audit was started or requested by the implementing agent.

## Outcome and acceptance criteria

Before editing, reproduce every reported finding using the independent audit's supplied production probes. Preserve the original journal/storage/ownership rules. A canceled committed arm must retain its first lifecycle observation as a zero-onset Invalid terminal; an uncommitted cancellation must not invent a scored journal; timeout alone must retain the same-request retry. Actual assisted input must be labeled separately from the setup declaration in live and reopened reports. Deletion must withdraw Saved, retries and durable eligibility while retaining factual in-tab review of the known prefix and confirmed successor onsets. Exercise both deletion orders and adjacent lifecycle, terminal delivery, report authority and history. Commit one repair only after the grouped checks finish.

## Reproduction before edits

`reproduce.mjs` is the independent audit's supplied probe copied unchanged, run on the untouched base production build. `independent-browser.json`, `arm-blur-root.json`, `paste-root.json`, `paste-report.txt`, and `deletion-after-onset.json` retain the raw baseline captures. Their probe `PASS` means collection completed, **not** that the product met acceptance:

- F1: committed arm ordinal 1 followed by blur, held-callback release and Start retry resumed the same session in Feedback, with no invalidation event.
- F2: real trusted Meta+V inserted `3668`. Durable trial/report assistance were true and declaration false, but the visible report omitted assistance.
- F3: post-successor-onset deletion correctly removed durable attempts but replaced factual review with the removal error screen.

The source audit is `/private/tmp/digits-v11-independent/AUDIT.md`; its SHA-256 is recorded in `identity-and-hashes.json`.

## Repair design

### F1: lifecycle cancellation has its own durable reconciliation

`DigitsAdmission` holds one immutable request and the **first** cancellation reason/time. Cancellation aborts that request's storage signal immediately and permanently fences `arm()` for that request. An ordered read then resolves retained authority without allocating another arm. A retained matching arm is extended with one Invalid event, copied before presentation ownership is released, and passed through the existing exact-byte terminal save/readback/report-publication flow. Failed authority verification keeps the canceled request fenced and retries only its reconciliation; failed terminal persistence uses the existing one exact-byte result retry. A proven absent/deleted arm has no invented writable journal; replacement authority is never restored.

Timeout alone preserves the request and its lifecycle observers. Retrying it can return the same arm without rotating twice. A later blur/hidden/freeze/page-exit/viewport/voice observation still cancels that pending request. Once cancellation resolves, a genuinely new Start uses a new session/request and the next consumed rotation position. Scoped observers are removed on completion/retirement/unmount; unmount attempts canceled-arm reconciliation before closing its store. A stale report publication cannot clear a newer operation's report-view request.

**Why absent read cannot be followed by an old commit:** the production IndexedDB backend registers an abort listener before issuing its transaction read. `cancel()` synchronously aborts that admission signal, which calls the native transaction's `abort()` before opening cancellation's read. IndexedDB serializes the new readonly transaction against the previous readwrite transaction: it sees the arm if the write already committed, or absence after abort. If cancellation occurs before the transaction opens, the existing signal checks prevent opening/writing it. A callback held after commit cannot undo the commit; the arm is recovered and invalidated. A callback held before `put` cannot write after the native abort. These are different cases, both exercised below.

### F2: actual use and declaration are separate facts

The report receives the current verified run facts, not only the arm profile. Accepted assisted draft input or a closed assisted trial adds **“assisted entry used”**. The original checkbox independently adds **“assisted entry declared”**. Actual accepted assistance is also used by history, including an unresolved draft in an Invalid terminal. No journal/scoring bytes are rewritten, and reopening a report preserves its snapshot exactly.

### F3: retirement removes authority, retains local facts

Retirement copies the runner's latest known state before fencing callbacks, removes persistence/retry/Saved state, releases ownership and stops authority polling. It retains that immutable state only in memory and presents a factual partial review with trial-by-trial confirmed digit/speech onset counts. It appends no invented invalidation to deleted data, exposes no aggregate performance or saved eligibility, and performs no restoring write. A historical incomplete prefix retains its explicit later-unknown limitation; a known terminal is not relabeled as having unknown later presentation. Replay from the retired view opens current installation authority, allowing individual deletion's next rotation or Delete all's fresh rotation without reusing the retired store.

The engine, timing rules, target constructor, form packet, scoring, storage schema/transactions, persistence coordination and lock names are unchanged. There is no migration, mock integration or analytics activation.

## Developer checks

- Whole repository `npm run check`: **87 test files / 1,479 tests PASS**, lint, all included manifest/reviewer checks, TypeScript and production build. `checks-final.txt` records this run. Lint has the same two inherited warnings (App history dependency and the older M5 harness unused parameter).
- Final settled-source lint/focused suite: **8 files / 59 Digits tests PASS**, in `focused-final.txt`. The twelve added tests cover four lifecycle observations, uncommitted cancellation, timeout-only retry versus subsequent cancellation, failed read/save, deletion/replacement, actual undeclared/unresolved assistance, and both factual onset orders. `build-final.txt` records the final production build after the last UI authority guard. Vite retains its existing chunk/dynamic-import warnings.
- `browser-repair.mjs` / `browser-repair-final.json`: **19/19 focused production Chromium cases PASS**, including native active-transaction abort, trusted clipboard and complete visible/durable captures.
- `browser-regression.mjs` / `browser-development.json`: **17/17 supplied production Chromium regression cases PASS**, rerun against the same final build, with raw roots/screenshots and logs under this repair directory.
- `identity-and-hashes.json` records the base, audit identity, final implementation/harness hashes, unchanged packets/scripts and exact production artifact hashes. `changed-files.txt` records the complete repair inventory. Frozen packet and packet-script bytes match the base and their original recorded SHA-256 values.

### Production matrix coverage

Focused cases exercise committed-but-undelivered arm cancellation for blur, hidden, freeze, page exit and a real browser viewport resize; new DV2 Start after the zero-onset Invalid; timeout then blur; pre-ownership cancellation; individual/Delete all before cancellation; undeclared trusted paste in live/reopened and unresolved Invalid reports; declaration without actual use; genuine canceled-terminal save failure and exact retry; failed cancellation read then Start reconciliation; and individual/Delete all versus Next in both orders, with no notifications and fresh Replay authority.

The native before-put probe keeps the actual arm readwrite transaction active with queued reads, holds the original `get` handler before its `put`, delivers blur, waits for the authoritative absent read, then releases the old handler. Durable bytes remain exactly unchanged with counter zero and no attempts; the fresh request starts DV1 ordinal 1. This directly tests **read-after-abort then old-handler delivery**, alongside the after-commit held-callback cases. It does not treat a UI timeout as evidence of aborted persistence.

The original regression covers the normal C/W/C/W/C/W variable-length run and exact reload, keyboard/keypad/repeat/trust handling, protected Feedback End/blur, failed and held checkpoints/terminals, all deletion/Next orders, conditional callback-injected auditory completion, auditory unavailability, missing frame, pending report authority, held terminal then deletion, keyboard/report focus and bounded 200% CSS zoom.

## Preliminary evidence and limits

`browser-repair-preliminary.json` retains the first development matrix. Its one F2 probe failure read history immediately after an asynchronous click, while the body was still the guide; it had already verified the live report's actual label. The final probe waits for the history heading before reading the label and verifies both reopened copy and exact snapshot bytes. The preliminary result is not presented as final acceptance. `browser-repair-before-observer-fix.json` preserves the subsequent 18/19 batch: the declaration-only probe called the observation-dependent answer helper without initializing its observer. Its corrected targeted rerun (`browser-declared-assistance-remains.json`) passed. The final matrix assembles those eighteen unchanged-source PASS captures and that one corrected probe; it does not claim a second whole focused-batch execution. Both runs use the same recorded final production artifact. The initial build rejected TypeScript constructor parameter properties under `erasableSyntaxOnly`; the explicit field constructor compiles. An initial sandbox Chromium launch was denied by macOS process permissions; the authorized local browser checks use the approved escalated launcher.

These are local developer checks with headless Chromium, browser-generated trusted keyboard/clipboard events, synthetic lifecycle observations, real IndexedDB transaction abort plus injected callback/write faults, injected speech callbacks and CSS zoom. They do not qualify physical timing/input/touch, actual acoustic output, native OS suspension/exit, screen-reader coexistence, native browser zoom or the full supported device matrix. Cumulative ending continues the frozen V1.1 contract and saved JobTestPrep footage observation; it is not claimed as verified current Pymetrics/employer mechanics. The previously documented conflicting online descriptions remain a limitation.

A new read-only whole-milestone audit at the exact repair SHA, founder personal acceptance, broader accessibility/browser/device qualification, mock integration, deployment and release remain open. No independent PASS is claimed here.
