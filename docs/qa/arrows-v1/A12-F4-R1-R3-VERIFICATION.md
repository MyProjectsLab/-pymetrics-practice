# Arrows A12 F4 grouped recovery/cancellation repair — developer verification

**Basis:** the separate [exact-SHA audit](/private/tmp/arrows-f4-audit-9c1118d/AUDIT.md) failed at `9c1118d6d6942abb77014d4b6b44f2b975ebb1aa` on R1–R3. Its original deletion/report ordering cases passed. This repair preserves that shared lock design and changes only the report surface's recovery, navigation, and lifecycle behavior. This record is developer evidence, not an independent PASS.

## One grouped repair

- R1: a terminal or break-prefix publication timeout keeps the immutable in-tab draft visible with an **unconfirmed** save claim and a reachable same-attempt verification retry. A late canceled read cannot turn that claim into saved status. Deletion retirement still withdraws the result.
- R2: every preparation-screen navigation cancels an older publication and advances its generation. A history callback cannot replace a newer worked example, quiz, setup or readiness screen.
- R3: page exit and hidden visibility suspend publication across history opening, report opening, live save promotion and periodic saved-report checks. The currently saved report hides its numbers; a hidden interval cannot reauthorize them. A visible return permits a fresh current read.

## Checks and limits

The pre-repair independent reproductions are retained in the audit packet. On the repaired production build, bounded Chromium with native IndexedDB/Web Locks and injected completion delivery reproduced the same held terminal and 24-trial prefix boundaries. After their two-second deadlines, the visible report retained its factual Invalid or Incomplete draft, explicit uncertain save status and its retry control; the old callback did not promote it. Held history → **See examples** retained the example after late delivery. Injected pagehide during initial report opening kept history visible; a hidden saved-report poll stayed hidden through late and later interval reads. Healthy checks kept the same table node with no flicker. Raw results are in `/private/tmp/arrows-f4-repair-r1r3/browser.jsonl`, `terminal-timeout-raw.json`, and `break-prefix-timeout-raw.json`.

The original F4 individual/Delete all × timeout/read-first browser matrix passed again on this repair, with BroadcastChannel unavailable. No deleted result table or saved claim reappeared. Raw results are `/private/tmp/arrows-f4-repair-r1r3/f4-*.json` and the four adjacent case logs. Two added component tests cover stale history navigation and page exit during report opening. A separate native-timer run closed 24 trials, held prefix verification past its deadline, then used **Verify or retry saved prefix**. The browser read back one saved attempt and one report-view activity event; all 24 known closures remained reviewable (`break-prefix-retry-raw.json`).

`npm run check` passed once on the final source: **65 test files, 1,283 tests**, lint with two inherited warnings, both Stop manifest checks, Arrows/Lengths manifest checks and production TypeScript/build. The final client bundle is `index-B-tqlgMm.js`, SHA-256 `b9251a650ce83d095e89de8cbd0cc6d04a21fc2518f2fe05eedae72d79fa4adf`. That bundle passed the held terminal, lifecycle/navigation, healthy-poll, saved-prefix retry and all four original F4 deletion-order cases. The final four case logs are `final-f4-*.log` alongside the raw JSON.

Browser lifecycle events and delayed storage delivery in these probes were injected. They do not certify native BFCache, physical input/display timing, screen readers, other browsers/devices, mock integration, A11 N1, founder personal acceptance, deployment or release. The frozen specification and forms are unchanged.
