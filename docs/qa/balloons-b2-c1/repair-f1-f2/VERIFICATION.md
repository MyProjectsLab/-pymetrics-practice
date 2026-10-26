# Balloons B2-C1 focused F1–F2 repair

2026-10-04, America/New_York. **Developer repair and verification only.** A separate read-only audit of the new local commit and founder C1 acceptance remain open. N1 and OBS-1 remain open. No comparison UI, mock, analytics activation, qualification, deployment, release or push.

## Authority and pre-edit reproduction

Started from clean `acece735e487c0a0bcea48faab2c36c064a11123`, immediate parent `d1a40ceded441491142dd1ccd6bb8b6c21afd796`. The supplied audit SHA-256 is `2c52e7a135f8dce93e62ad43a6187c6fb640557995c50a45dc005a27aa8f60ef`. The initial identity record includes SHA-256 for all 837 tracked files and empty status. Read the supplied `/private/tmp/balloons-c1-audit-acece73/AUDIT.md`, AGENTS.md, complete Master Strategy, Balloons V1.0 specification and both reviews, tracker, C1 verification and freeze record. Both JSON companions parse; all five frozen packet hashes match the approved freeze. Governing documents remain unchanged.

Before any repository edit, the audit's controller probes ran against this repository's exact source, with only import/output paths adapted in an external harness. Both failures reproduced: round 2 remained `presentation_armed` instead of `paused`; the canceled acquisition retained its browser lock. The complete external harness returned **28 passing and 2 failing tests**, including all nine full BL–RT pairings. The focused rerun returned exactly those two failures. Fresh production builds and the audit browser driver separately reproduced both failures, including the second tab's blocked exercise screen. The pre-edit production server was on localhost port 4217. Clean status was rechecked after the reproductions and before editing; HEAD remained the exact audited target.

## Focused behavior changes

Only `src/balloons/controller.ts` changes production behavior.

- **F1:** onset evidence contains its owner token, round and exact arm-event sequence. Every new presentation clears the prior evidence; cleanup captures its own evidence and can confirm only the matching armed presentation. A clean interruption of an already-exposed later round saves the intact committed prefix as paused without inserting a confirmation. The same session/form resumes and confirms that round through the normal frame path, retaining eligibility. First-round uncertainty, actual first-display consumption, expiry and immutable journals keep their existing rules.
- **Failed pause writes:** a proven failed pause write remains a write failure during subsequent disposal. The journey's controller replacement cannot turn it into a clean eligible checkpoint. The existing save-status/review-only route remains available. Unavailable authority and timeout behavior remain unchanged; a changed view is not replaced by stale failed-pause copy.
- **F2:** a new operation scope exists before the first asynchronous release/acquisition boundary. After acquisition, the controller checks that exact scope and its disposed state before binding ownership. A canceled late result is released, with no reservation, mount or action authorization. A genuine positive-onset cleanup retains ownership only for its existing bounded lifetime, then releases on success or deadline; stale cleanup cannot mutate a new owner or installation.

## Verification

- `npm run check`: **1,061 tests / 50 files PASS**, lint, Stop form/drill checks, TypeScript and both production builds. Only the two inherited lint warnings, experimental SQLite warning and bundle-size warning remain. The unchanged Stop focus assertion passes; OBS-1's cause remains unexplained.
- `npm run balloons:check`: all nine scored forms and seven fixed drill inventories PASS.
- Production Chromium: **41/41 scenarios PASS**, including all 12 prior audit browser PASSes and both repaired failures. No page errors in any scenario.
- Supplied audit harness rerun on final source: **30/30 tests PASS**, including all nine actual BL–RT pairings and current-authority admission rejections.
- Independent arithmetic algorithm rerun as developer verification: **18 completed sessions / 702 rounds PASS**. This counts nine adapter RT completions, three full browser RT forms, one fresh browser BL, one delayed-final-delivery RT and four interrupted-final-round resumptions completed successfully. Reused synthetic baseline seeds are excluded.
- `git diff --check` PASS. Frozen packet hashes and tracked-file scope verified. Final source/build hashes checked after execution; the frozen browser production output byte-matches the aggregate build.

The committed controller suite adds 28 regressions (36 retest-controller cases total): rounds 1, 2 and 39 before frames, after one frame, immediately after positive onset before its write, and after durable confirmation; failed pause writes before/after confirmation; exact immutable prefix/core preservation; same-session/form recovery; valid final completion and single chain closure; stale frames; Practice and RT exits before acquisition, after acquisition, after reservation delivery and after arming; retained-onset cleanup success and deadline.

The production driver retains all 14 audit scenarios, requiring the original F1 and F2 assertions to pass and preserving the 12 former PASS cases. It adds 18 round/failed-pause scenarios, eight actual-browser ownership scenarios spanning Practice/RT and four cancellation boundaries, and one held-cleanup deadline case. Another tab's real `navigator.locks.request(..., {ifAvailable:true})` must succeed after exit. Post-onset cleanup must exclude that tab while necessary, release by its deadline and leave storage byte-identical after late delivery. All browser cases check page errors. RT1–RT3 full completions, reservation release/reopen, expiry, uncertain exposure, failed action, exhaustion, ordinary resume, deletion/late delivery, R1 delayed final completion and the fresh 39-round BL + 18-round drill path remain in the matrix.

The external audit harness is rerun as developer regression evidence: 18 admission rejections, the two original controller cases, nine full actual BL–RT pairings and seed generation. Its original independent verdict is not converted into an independent PASS. The retained Python reconciler imports no product code; it hashes all nine scored manifests and reconstructs every accepted action, outcome, cents, action ID/revision, complete result, confirmed-round set, mapping/settings and chain closure from primitive records.

## Evidence and reproduction

Final raw artifacts are under `/private/tmp/balloons-c1-repair/final/`; pre-edit evidence is under `/private/tmp/balloons-c1-repair/pre/`. Earlier repair runs are retained separately under `interim/` and `post/` and are not final qualification evidence. The handoff retains check logs, browser results, independent arithmetic, frozen/source/build hashes and compressed raw evidence beside this file. Plain-text log copies normalize trailing whitespace; the archive retains the exact raw logs. Evidence hashes identify the files actually exercised; the local commit's immediate parent identifies the original failed target.

The production driver is adapted from the supplied audit, with explicit failure exit status and additional repair cases. It uses the host's existing Playwright/Chromium runtime. To rerun against a normal production preview, first generate the `pair-*.json` seed files with the external adapter harness retained in `evidence.tar.gz` (extract into `/private/tmp/balloons-c1-repair`; its imports target this checkout), then:

```sh
npm run check
npm run balloons:check
./node_modules/.bin/vitest run --config /private/tmp/balloons-c1-repair/final-audit/config.mjs
npm run preview -- --host 127.0.0.1 --port 4218
EVIDENCE_DIR=/private/tmp/balloons-c1-repair/final/ BASE_URL=http://127.0.0.1:4218 node docs/qa/balloons-b2-c1/repair-f1-f2/browser.mjs
EVIDENCE_DIR=/private/tmp/balloons-c1-repair/final/ python3 docs/qa/balloons-b2-c1/repair-f1-f2/reconcile.py
```

Set `AUDIT_CASE` to one exact scenario name for a focused browser run. The final browser run used a frozen production directory served on port 4218; its asset hashes are compared with the aggregate check's production output. Synthetic admitted BL/drill seeds are explicitly distinct from the fresh guide-to-report browser journey.

## Development corrections and limitations

The first added controller ownership harness omitted propagation of a rejected held callback; fixing its Promise bridge removed two harness timeouts/unhandled rejections. Browser owner snapshots were initially taken before asynchronous assigned-drill loading finished; the corrected driver waits for the actual retest explanation control before recording the pre-acquisition root. A post-frame browser probe polls for the paused state without requiring the removed scored element to remain mounted.

The first extended browser matrix found a real failed-pause recovery gap: a one-shot failed pause was followed by a clean navigation/disposal pause before resume, allowing eligibility at rounds 2 and 39. The focused repair now retains a proven write-failure reason across that disposal. An intermediate broader catch changed the existing stalled-read timeout view; the final catch is restricted to proven `WriteFailure`, preserving the existing timeout/authority behavior. All interim failures remain in external evidence and are not counted as final passes.

Chromium headless 145.0.7632.6 on this Mac, disposable contexts, automated native Space/button activation, injected blur/frame boundaries and bounded storage/lock delivery holds provide functional evidence only. No physical input/display timing, natural race frequency, native OS lifecycle, screen-reader speech, touch/Safari/other-device matrix or full accessibility qualification is established. Separate exact-SHA audit and founder acceptance are required. Historical parent PASSes retain their original scope; C1, whole B1/mock, full B2, B3, N1, OBS-1, deployment and release remain open.
