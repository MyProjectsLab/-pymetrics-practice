# Keypresses report-view journal — development verification

Base: `1d6f4f25183b5928affe46cf0b3e8f3d448aa9d3` (focused F7 audit PASS). Target: the commit containing this record. This record is developer evidence, not an independent audit or Keypresses acceptance.

## Contract and design

The frozen V1.0 §5 requires `report_viewed` in one ordered local journal. The timed `State.events` remains immutable and replayable. A completed `StoredAttempt` may have a versioned `journal` whose prefix is the exact timed event list and whose tail contains report-view events. Historical records without that optional continuation still load. Sequence numbers are contiguous; each view has an app-owned idempotency ID and `live` or `history` context. Report-view timestamps use wall time after timed events; the ordered sequence number is authoritative across the two clock domains. A view does not alter scoring, validity, the timed state, or the report.

The first visible live report is buffered until a durable completion is verified. Each history reopening records a new view after its authority check. The append uses the current IndexedDB installation and record in one transaction; a rejected delivery callback is resolved by an authoritative read. An indefinitely pending callback remains a known nonblocking limitation. Missing, deleted, replaced or corrupt records cannot accept a view. A failed append does not fabricate an event or change a verified result.

## Checks

- Focused storage tests cover legacy records, live/history ordering, idempotency, byte-identical timed state, lost callback reconciliation, deletion/replacement fencing and forged tails.
- Production Chromium `145.0.7632.6` completed a 40-press valid run, saved it, reloaded, reopened the report and deleted it. The journal had 87 contiguous events: 85 timed events and two `report_viewed` events. The timed state was byte-identical before and after history review. All 15 bounded browser scenarios passed; see `browser-development.json` and `browser-development.mjs`.
- One earlier browser run failed the existing 240 ms delayed-END watchdog fixture. That fixture sat only 10 ms inside the 250 ms tolerance and could exceed the boundary under scheduling overhead. The injected delay was changed to 180 ms; the subsequent complete run passed. This changes test stimulus, not product timing or the tolerance.
- Full repository check passed: lint (two inherited warnings), 1,114 tests across 55 files, 14 Stop forms, five Stop drills, TypeScript and production builds. `git diff --check` passed. Both frozen Keypresses hashes match their recorded values.

## Limits and open work

Browser events and faults are scripted or injected in headless Chromium. Native lifecycle, physical input/display timing, cross-browser behavior and screen-reader speech are not certified. Full mock integration and whole-Keypresses independent audit/acceptance remain open. Frozen specifications, Stop, Balloons and optional analytics behavior are unchanged. No push, deployment, analytics activation or release is included.
