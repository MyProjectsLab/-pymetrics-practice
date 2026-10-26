# Arrows A12 F4 recovery controller — developer verification

Base: exact clean `f43a726bef383a9f760aa354ed3f8d8b3616abc3`. This record belongs to the single candidate commit reported in the handoff. Implementation and developer verification only; separate exact-SHA functional audit remains required.

## Bounded outcome and authority

Implement the independently challenged [replacement contract](/private/tmp/arrows-f4-design-challenge/REVIEW.md): one immutable exact-target recovery controller for released prefixes and terminal results; absorbing retirement delivered before operation freshness; bounded recovery; navigation ownership independent of persistence; preserve the existing ordered read-to-DOM/deletion boundary. Exclude mechanics, frozen packets, other games, mock integration, analytics, qualification, deployment and release.

The preceding independent submissions `9c1118d`, `f13e7c9`, `f43a726` remain FAIL at their own identities. The third failure triggered the architecture gate. The separate challenge issued DESIGN PASS, allowing this coherent replacement; that verdict is not an implementation PASS. A11 N1 remains open.

## Change

`ArrowsRecovery` owns installation/session/request/ordinal/clock identity, the exact original arm and frozen result, and one immutable uncertain/confirmed/retired outcome. One adapter maps definitive legacy storage/entry errors to typed evidence; timeout, abort, cancellation and revision conflict remain uncertainty. Definitive late observations enter retirement before operation ownership is checked, invalidate pending work and notify the attached subscriber immediately.

Requests coalesce until a two-second deadline; expiry aborts where possible, resolves the operation and permits a fresh read without waiting on the old delivery. Automatic terminal writes use this same settlement path. Pre-exit checkpoint failures are also forwarded to the target controller after release. Break exit captures/releases only; it launches no hidden second recovery.

Journey subscribes using controller identity plus navigation generation and immediately consumes the current outcome. Retirement synchronously clears selected result, live draft, original draft arm, activity retry and publication; the render projection also rejects every fallback source. A retry's publication epoch cannot suppress delivery to the current subscriber. Returning/hidden publication, deletion and ongoing saved-report validation retain the existing shared Web Lock boundary through synchronous DOM publication. Terminal opening deduplicates by browser identity, including reused session IDs.

## Precommit evidence

Evidence directory: `/private/tmp/arrows-f4-controller-evidence/final/`; scripts, exact source/build SHA-256 inventory, native DOM/root captures and callback/lock traces are retained there. Earlier development runs and the reload-wait harness error are retained separately under `pre-final-identity/`; they are not product failures or final-bundle evidence.

| Boundary | Developer evidence |
|---|---|
| Both actual read-start orders × both positive/negative delivery orders | Controller fixtures cover terminal and prefix; real Entry/Store/component barriers cover prefix with both deletion types. DOM is asserted at negative delivery before any remaining positive/publication callback is released. |
| Native digest and transaction delivery | Four fresh native 24-trial prefix runs independently hold SHA-256 completion before read and native IndexedDB completion after observation. Initial duplicate requests coalesce; deadlines free recovery; delivered fresh negative withdraws immediately while old positive remains held. Both deletion types; reload proves no resurrection. |
| Live Invalid terminal and 24-trial prefix | `retirement.mjs`: both deletion types, absent BroadcastChannel, held ordered publication, two queued retries, real DOM and durable attempt/activity/tombstone/counter/installation bytes. |
| Ordered publication | `browser-final.mjs`, `promotions.mjs`: publication-first, deletion-first, timeout while acquiring/holding the boundary, late history/report openings, terminal promotion and healthy table continuity. |
| Operational controls | `extra.mjs`, `break.mjs`: no deletion, timeout, pagehide, draft/events/retry retained, immutable snapshot recovery, one start count and one actual report-view event. Controlled tests additionally cover transient read/write failures, abort and revision conflict. Old success alone creates no saved claim. |
| Cancellation/replacement | Native guide/examples/quiz/setup/readiness/library, hidden/pagehide/resume; controlled unmount followed by late negative delivery; component replacement controller reuses session ID with new request/clock/installation and survives old retirement. |
| Late writes | `late-write.mjs`: native committed-but-undelivered terminal writes, both deletions, callback release and reload; no attempt/activity resurrection. A late definitive pre-exit checkpoint failure also retires the subscribed controller. |

All exercised individual deletions retain counter 1, one tombstone and the original installation; Delete all leaves counter/tombstones/attempts/activity zero with a replacement installation. Operational recovery retains the exact snapshot and uses one idempotent opening ID. Healthy polling preserves the same table node without checking/hidden flicker.

Verification: 162 Arrows tests passed in the bounded subsystem run; subsequent changed-path checks reverified the entry adapter, browser/controller and Journey/component cases after the final adjacent authority and reused-identity changes. One additional unmount/late-negative test passes (163 unique Arrows tests covered). Lint passes with the two inherited warnings; TypeScript and production build pass; diff hygiene passes. No repeated repository-wide suite. All 15 specification files and the Arrows generator remain byte-identical to base (`frozen-integrity.json`). Final client: `index-Bwwbypps.js`, SHA-256 `78b4dae4af38f2ad6c18d45e3f070f3728fe761f3f980afbe49bd317a42a5173`. The final source/build inventory and 154-check browser reconciliation across 48 native captures are included in the external evidence directory.

## Limits and next action

macOS headless Chromium, native IndexedDB/Web Locks/timers, 1512×900. Input, lifecycle, digest and transaction callback barriers are scripted/injected; deterministic memory backends and DOM tests are labeled above. No physical input/display timing, native BFCache, full browser/device/screen-reader qualification or new full-120-trial numerical certification. No founder acceptance, whole-game development PASS, deployment or release claim. Next: separate read-only functional audit of the exact candidate SHA, preserving all earlier FAIL records.
