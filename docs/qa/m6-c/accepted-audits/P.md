# Stop M5 independent audit — PASS within development scope

**Target:** `33400f5e7ab79590381bd46ad6da3db14410932d`  
**Immediate parent:** `c604c0546a7a9e9f0e2f7e28a30f31042a776a79`  
**Date:** October 1, 2026 (America/New_York)  
**Verdict: exact-SHA whole-M5 development audit PASS, with the documented rendering-boundary limitation and the existing separate gates below.**

C7 is repaired in the independently exercised source and production build. Ordinary fast reads preserve numerical content and layout without unavailable-status churn or observed hidden compositor frames. C6 remains repaired under the documented boundary: a periodic read that is still pending at the second animation-frame callback synchronously withdraws numbers before that rendering update paints. Deleted comparisons did not return from stale reads or delayed notifications. The updated [whole-M5 requirement map](REQUIREMENTS.md) includes all rows from the supplied acceptance map.

This verdict does not certify a wall-clock withdrawal deadline, native lifecycle behavior, every browser/device, founder acceptance or release. The parent audit remains FAIL C7 at its own SHA.

## Fresh independent findings

### Ordinary fast reads

| Execution | Observation window | Result |
|---|---|---|
| Final source, three separate browser contexts | 12.1 seconds each; 36 periodic reads | Zero numerical DOM withdrawals, zero unavailable-status insertions, zero hidden-frame transitions; constant main height of 1201.703125 px |
| Production build, prior successful-retry durable state | 12.1 seconds | Zero numerical DOM withdrawals, unavailable-status insertions or hidden-frame transitions; stable layout |
| Production build, prior C3 newer-completion durable state | 12.1 seconds | Same stable result; normal App startup admits the current completed comparison |

The source reads took 1.7–6.2 ms in these runs. No authority delay, rejection, CPU throttling or lifecycle event was injected into healthy measurements. All five runs used DOM mutation observation, animation-frame observation and actual Chromium CDP compositor screencasts. Each screencast emitted one stable image with no subsequent changed image. The three source images are byte-identical. Source and production C3 images were independently reopened and visually inspected. Compositor evidence is supported by the stricter absence of numerical DOM withdrawal, avoiding the callback-order blind spot of relying on rAF observations alone.

Evidence: [source measurements](fast-periodic.json), [source compositor image](healthy-frame-0-0.png), [production measurements](production-boundaries.json), [production C3 image](production-c3-0.png). Both production startups leave the prior durable state deep-equal to the original JSON. These are restored completion states, not new timed sessions or new retry completions.

### Held periodic reads, deletion and late delivery

**Source: 12 cases.** Baseline deletion, required-drill deletion, Delete all and unrelated-result deletion, each with delivered, delayed or unavailable BroadcastChannel notifications. The audit holds an original-store read after it captures its old state. Actual history buttons and confirmation in another tab perform each deletion. Independent observers record numbers present initially and after the first frame, absent after the second frame. Observed boundary times were 11.5–17.0 ms from the instrumented authority operation, not a general deadline.

Numbers remain absent through at least 3.2 seconds after deletion and through delivery of the old snapshot. When authority has not already been permanently revoked, a subsequent fresh read is held for 1.1 seconds; numbers remain absent throughout. Only one comparison read runs while that read is held. Baseline/drill/Delete all do not regain comparison. Unrelated deletion recovers only after fresh successful authority. Late notifications do not reverse retirement. The retained temporary retest journal is unchanged. [Source matrix](open-stalled-matrix.json).

**Production build: 12 further cases.** The same deletion/notification combinations run on the unmodified built App. The audit seeds the prior C3 state plus one separately audited, genuinely unrelated retest record. It intercepts native IndexedDB request success delivery, retaining the captured old read while allowing its native transaction to finish; it does not replace product authority functions. The second tab uses the production history/deletion UI. Numbers are absent at the second independent frame observer, throughout the 2.2-second post-deletion hold, and after old delivery while subsequent reads are held. Deletion remains authoritative after releasing all reads and delayed notifications. Only unrelated deletion restores comparison. Final raw durable state equals the deletion tab's state, and every nondeleted current retest remains identical. [Production matrix](production-held.json).

The production interceptor can also hold notification-triggered history reads. Therefore its total native-read count is not presented as a count of concurrent comparison checks. The source probe independently establishes the single-comparison-read property.

### Recovery, focus/visibility, ownership and exit

- **Rejected read / recovery:** a rejected read removes numbers; repeated failed recovery checks preserve the same unavailable-status DOM node for over three seconds. Current successful authority restores the comparison.
- **Focus and visibility:** independently dispatched events suppress numbers during held authority. Deletion during the hold and late delivery cannot restore the comparison. These are synthetic browser events, not OS-native lifecycle certification.
- **Keyboard:** Tab/Enter can exit the held comparison and open the original retained temporary report. Late delivery does not reopen comparison, and the retained record is identical.
- **Ownership:** six fresh browser cases cover late pre-deletion authority, replacement chain/installation, original-store authority after writer rebinding, missing baseline, missing required drill and navigation during held Resume. No stale callback replaces the new chain or opens the wrong screen. Current deterministic tests additionally cover exact chain-object replacement, pre-focus request generations, frame cancellation and unmount.

Evidence: [five recovery/control cases](open-authority-keyboard-visibility.json), [six authority cases](authority-probes.json), [check log](check.log).

## Rendering-frame throttling: confirmed limitation

At `TrainingFlow.tsx:170–180`, the first callback aligns with rendering; the nested second callback calls `flushSync(suppress)` if authority is still pending. Successful authority before that callback cancels suppression. There is no elapsed-time fallback. The periodic poll itself is one second, so this is also not an instantaneous guarantee from the moment another tab deletes data.

A separate synthetic probe queues animation callbacks while holding the initial deletion-revision operation. After approximately 364–366 ms with no callback delivery, the numerical DOM is still present. Delivering the first queued callback leaves it present; delivering the second removes it synchronously. In two further cases, independently dispatched focus or visibility events remove the numbers despite the queued periodic callbacks. [Raw rendering-pause evidence](render-throttling.json).

This confirms the stated boundary and its limitation. It does **not** establish that a real suspended/occluded/frozen page will dispatch lifecycle events or repaint in any specific order or time. The queue intervention does not simulate a native compositor or OS suspension. Chromium headless and Playwright background settings are not a supported-device lifecycle qualification. A slow read crossing the rendering boundary is intentionally allowed to interrupt layout; C7's stable-display result applies to ordinary fast successful reads that settle before that boundary. No screen-reader speech, high-refresh display behavior, Safari/Firefox or native freeze/resume behavior was certified.

Within the supplied development acceptance map, this limitation is explicit and remains in the existing browser/device/native-lifecycle gate. No new reservation expiry, storage timeout or lifecycle policy is inferred.

## Whole-M5 evidence reuse

The supplied [parent audit](../stop-m5-audit-c604c05-20261001/AUDIT.md) and [parent requirement map](../stop-m5-audit-c604c05-20261001/REQUIREMENTS.md) were treated as the acceptance map. Their previous SHA verdict was not imported.

All five changed files were inspected: product display, its authority test, tracker, developer verification and developer evidence manifest. The manifest's 80 entries distinguish clean-base reproduction, a rejected intermediate attempt and final developer captures. Those captures remain claims; this verdict uses fresh independent display probes and selected independently audited prior records.

All 79 other tracked source/test files are byte-identical to the parent. App navigation/completion ownership, training authority, run engine, storage transactions, scoring, forms, event validators and history/report rendering are unchanged. Nine specifically relevant earlier whole-M5 files were rehashed against the previous audit's recorded digests; the two direct-parent acceptance documents and selected Resume/reconciliation captures were recorded separately. No archive inventory or unrelated full timed journey was repeated.

[Reuse record](reuse.json) and [independent raw reconciliation](reconciliation.json) confirm:

- **C2:** one typed rejection; unchanged retained temporary journal; no comparison or durable/reload resurrection.
- **C3:** newer retest selected; both immutable journals/summaries and exposure markers retained. The changed display is freshly checked in production.
- **C4:** replacement installation/state/activity unchanged by late old completion.
- **Successful retry:** exactly two writes; persistent journal/summary identical through reload. The changed display is freshly checked in production.
- **C5 Resume:** reuse the parent twelve-case Resume/review/reload evidence for unchanged App admission and authority functions. Fresh current ownership probes, numerical-display matrices, recovery and keyboard review cover the changed composition.

Every other M5 requirement retains only the sound evidence for the unchanged paths identified in [REQUIREMENTS.md](REQUIREMENTS.md). Current tests cover affected C2–C5 and retry fixtures, but mocked App completion tests are not treated as compositor evidence.

## Harness diagnostics

Three preliminary harness assumptions were corrected; their drivers/captures are preserved under `harness-attempt-*` and are excluded from pass counts:

1. The first production driver expected one total native read, overlooking notification-triggered history refreshes. It now records those reads without conflating them with comparison concurrency.
2. Its initial “unrelated” selection was the earlier C3 retest, which remains part of that chain's attempt history. Product retirement was correct. The final control uses a separately audited retest outside the current chain and verifies that identity explicitly.
3. The rendering-pause probe initially used Playwright's default rAF-based predicate polling, so pausing rAF also paused the observer. The corrected harness uses timer polling while rAF is queued.

Initial sandbox restrictions prevented a loopback listener and Chromium startup. Approved local execution allowed both. These startup restrictions are not product findings.

## Identity, checks and reproducibility

- Clean repository at entry and exit; exact target and immediate parent match the request. [Entry identity](identity.json), [exit identity](final-identity.json), [five-file diff](full.diff).
- An isolated `git archive` snapshot and independent copy of installed dependencies were used. Builds, test caches, seeded browser data and audit outputs are outside the repository. No source, tests, tracker, specifications or Git state were edited.
- `npm run check` passed: lint, **487 tests / 31 files**, 14 form and five drill regeneration checks, TypeScript and production build. Two inherited lint warnings remain. `git diff --check` passed.
- Fresh production asset: `source/dist/assets/index-BOiNcR3P.js`. Source/build and output digests are in [EVIDENCE-SHA256.json](EVIDENCE-SHA256.json).
- Frozen Master Strategy SHA-256: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`.
- Frozen Stop V1.1 SHA-256: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.
- Both governing files byte-match approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`.

Browser: Chromium headless shell 145.0.7632.6, macOS, 1200×800. Real IndexedDB transactions, timers and compositor captures; held deliveries, fixture seeding, notification modes and lifecycle events are explicit harness interventions. The production HTML/assets are served unchanged through the isolated Vite server. No deployment took place.

To reproduce, first preserve this directory's captures because drivers overwrite their own output names. From `source/`, run `npm run dev -- --host 127.0.0.1 --port 5553 --strictPort`. From the audit directory, run the desired named `.mjs` driver with Node. `fast-periodic.mjs` checks source stability; `production-boundaries.mjs` checks both production completion states; `open-stalled-matrix.mjs` and `production-held.mjs` check deletion; `open-authority-keyboard-visibility.mjs`, `authority-probes.mjs` and `render-throttling.mjs` cover the remaining boundaries. Run `python3 reconcile.py` after captures complete. The exact runtime and fixture paths are in each driver. Audit servers were stopped after verification.

## Separate gates

- **Independent whole-M5 development audit:** PASS at this exact SHA, under the documented rendering-boundary contract.
- **Founder M5 acceptance:** open.
- **N2** abandoned unarmed cross-tab reservation availability and **S46** router precision remain separate; no new policy is approved.
- Initial-frame handling and pre-start screen-reader disclosure remain open.
- Supported browser/device, physical timing, native lifecycle, full keyboard/accessibility/screen-reader and visual qualification remain open.
- **M6, deployment and release:** open. This audit does not approve the twelve-game beta.
