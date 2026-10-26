# Balloons B1-B R1 independent audit

**Verdict: PASS, focused R1 repair only.** Target `ae0a52a61595e0a881274ab4d8b02117c609178e`; parent `31d8bd60914fa487a68082c743d6501538dc3127`. No reproducible R1 blocker remains in the tested scope. This does not complete whole B1 or certify a browser or device.

## Identity and scope

- Verified exact HEAD and parent, clean index/worktree before and after, and `git diff --check`.
- Reviewed all 15 changed paths and the full product delta in `src/balloons/storage.ts`, `controller.ts`, and `Journey.tsx`; no frozen specification, manifest, Stop, or excluded feature changed. The six governing/fixed-packet hashes match the approved source values.
- Ran checks in an isolated exact-SHA Git archive, leaving the app checkout unchanged.

## Independent findings

1. **Committed final action, callback timeout:** completed BL1 remained a verified, 39-round, baseline-eligible saved result. The screen showed “Saved completion verified: all 39 rounds”; reload opened the same saved report. A nonzero final Collect retained its five cents. This reproduces and closes the prior audit's R1 contradiction.
2. **Final intent only, callback timeout:** recovered 38 committed rounds on the same form, with no baseline eligibility. This preserves the conservative incomplete-attempt boundary.
3. **Failed intent plus cleanup writes:** while durable storage still showed an active attempt, the visible screen said save status needed checking. After reload, recovery made that same BL1 attempt ineligible. The prior auditor's older driver stopped on its obsolete expectation of the literal word “Unsaved”; a corrected independent probe passed. That driver failure was a harness mismatch, not a product failure.
4. **Further boundaries:** the submitted seven-scenario R1 browser driver passed against the exact archive, including unavailable and held authority reads. Independently adapted prior regression drivers passed full BL/RP arithmetic and reload, eight no-notification deletion/lock cases, native keyboard source and repeat/focus controls, and delayed report-read recovery.
5. **Repository checks:** `npm run check` passed: 821 tests across 44 files, lint with two inherited warnings, Stop forms and drills, TypeScript, and production build. `npm run balloons:check` passed nine fixed Balloons forms and their arithmetic constraints.

Browser evidence: [independent R1 results](evidence/additional-results.json), [corrected F1 recovery](evidence/persistent-intent-failure-recovery-current-copy.json), [submitted R1 rerun](evidence/r1-results.json), and [report-read regression](evidence/timeout-results.json). The regression drivers and raw captures are in this audit directory; all test/build artifacts were outside the repository.

## Limits and open states

- Browser runs used automated Chromium and injected fault timing. They do not certify physical input, native lifecycle behavior, accessibility, Safari, or the wider device matrix.
- **N1 remains open:** the earlier delayed-notification robustness observation was not established as natively reachable or repaired here.
- This is an independent PASS for the R1 repair and affected regressions. Founder B1-B acceptance, whole B1 including mock integration, broader qualification, deployment, and release remain separate and open.
- No app files were edited, committed, pushed, or deployed by this audit.
