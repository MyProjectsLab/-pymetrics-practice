# C5 case outcomes

| Case | Evidence | Result |
|---|---|---|
| Untouched-parent full C5 reproduction | `pre-edit/REPRODUCTION.json` | Reproduced stale comparison after baseline deletion; two failed writes; 643-event journal unchanged; reload clears chain |
| delivered / baseline | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delivered / drill | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delivered / all | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delivered / unrelated | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delayed / baseline | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delayed / drill | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delayed / all | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| delayed / unrelated | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / baseline | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / drill | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / all | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / unrelated | `resume-matrix.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / read-unavailable | `extra-boundaries.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| unavailable / visible-deletion | `extra-boundaries.json` | PASS: actual UI, immutable retest, durable state and reload reconciled; seeded post-fallback boundary |
| Final full C5 | `final-full-after/` | PASS: two failures, library exit, actual baseline deletion, rejected Resume, original temporary report and exact warning, no durable retest or reload resurrection |
| Final full C2 | `final-c2-drill/` | PASS: delayed notification, required-drill deletion before completion save, exit, one typed rejection, review-only report, no comparison or reload resurrection |
| Full retry success / unrelated deletion | `retry-control/` | PASS: unavailable notifications, one failure then success, exactly two calls, saved comparison and original report restore |
| Full C4 replacement installation | `c4-all/` | PASS: completion committed before Delete all, delayed success/messages, replacement reservation and activity unchanged, no deleted result or chain restored |
| Deterministic C2–C4 and C5 | repository tests and focused logs | PASS: late ownership, same-tab replacement state, absent/stalled authority, revision fencing, temporary chains, buffered drill and display/navigation gates |

All full journals were reconciled separately from driver pass flags by `journal.py`, `verify-after.py` and `verify-final.py`. Full no-response retests contain 643 events with 60 misses, 20 correct withholds and 25% accuracy. The source-hash distinction for retry/C4 versus the final review-copy adjustment is recorded in VERIFICATION.md. These are developer verification results, not an independent whole-M5 audit.

One early browser launch encountered Vite module identity after HMR; it stopped before fixture setup. Its output remains in `harness-failures/` and is excluded. An initial new deterministic test fixture omitted a form ID; its failure log is retained and the corrected fixture passes. Core matrix captures before the final review-copy adjustment remain separately labeled.
