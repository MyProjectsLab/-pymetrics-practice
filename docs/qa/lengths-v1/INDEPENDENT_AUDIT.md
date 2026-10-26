# Lengths V1.0 — separate read-only specification audit

Date: 2026-10-07 (America/New_York).
Audited worktree: `/private/tmp/lengths-v1-spec`.
Exact HEAD: `549cbed39cc5d46b495c3b9eddb578a3089817c7`.
Exact parent/base: `185a00ae81a199567a55dad327d0718a19e839ba`.

**Numerical readiness: PASS. Implementation-specification readiness: PASS.**
No concrete blocking discrepancy found in this original draft packet. These verdicts concern the specification and numerical artifacts at the exact SHA, not implemented software. The audit did not freeze or alter the packet.

## Identity and scope

HEAD and parent matched the requested identities. Repository status was clean before and after the audit, including untracked files. The commit adds exactly five files; their filesystem bytes match their committed blobs. AGENTS.md, Master Strategy, implementation tracker, and frozen Stop specification are unchanged from the parent. The complete changed packet was inspected, including all forms through independent regeneration. Current App AGENTS.md was also read. Existing tracker claims were treated as context, not independent proof for Lengths.

SHA-256 file digests:

| File | SHA-256 |
|---|---|
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_SPECIFICATION_V1_0.md` | `88a3938ce356b71115dd275fac057ca3f3adf27e824d88eb326cf87963040bd4` |
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FORMS_V1_0.json` | `f3e2865ab023e60f20bdd25b7fd2cc6f6fb618fc67b9d57d8e9d89bf82f88efc` |
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FIXTURES_V1_0.json` | `bdde5c7b2c6b58743dab02b827bfdd797b6d4b579907f8a909ea469916d1a31b` |
| `scripts/generate-lengths-forms.mjs` | `85d5651ac614e46ec71ae906edbb31f70c352fed327b4512b07f90da5cfa4f9e` |
| `docs/qa/lengths-v1/NUMERICAL-REVIEW.md` | `2054947731d1df5a42fd5afbf3d7822506598ec6ebadd7298015fe39ff962872` |

The recorded specification hash matches. The independently calculated compact payload hashes also match both declarations and embedded digests: forms `671b48c20e32daa886ce79e25a6265f4577a5dc069af8d5417328fd1ae0b39e7`; fixtures `84d38be93fa2a53674c1eb2ca0cfa2c40228a9f37a9892e7f12a84ee1794488d`.

## Independent numerical evidence

A separate Python standard-library calculation implemented the specified unsigned xorshift32, card enumeration, Fisher–Yates shuffle, rejection rules, and geometry mapping without importing or executing the author's constructor as its oracle. It reconstructed all 12 form records, including every trial and metadata field, and matched the committed records exactly. The author's `--check` mode was run separately and matched both artifact files byte-for-byte.

- 12 forms; 1,152 trials; 48 blocks. Each form has 96 trials in four blocks of 24.
- Every block contains each category/side/base-length tuple exactly once; therefore eight trials per category and twelve per correct side. Full forms contain 32 per category and 48 per correct side.
- All bar lengths are positive and fit their 240-unit bay. Maxima are 204 standard and 200 accommodation units. The specification's 204-unit maximum is the overall inventory maximum.
- Accepted-order candidate counts: 24, 58, 24, 22, 35, 28.
- Actual within-block switch range: 11–16, within the required 8–16. No side/category run exceeds three across block boundaries.
- Pairwise numbered-order differences: 91, 95, 90, 96, 93, 94, 93, 95, 93, 88, 92, 90, 91, 89, 91. Minimum 88 exceeds the required 70.
- Each accommodation form has the same categorical order as its numbered standard partner, with separately specified geometry.
- Nominal fixation plus response time is 96 × (600 + 1,400) = 192,000 ms, excluding frames and breaks.

All declared output fields in all 11 fixtures were independently recomputed from their primitive descriptions and the reconstructed LS1 manifest. The stored expected fields were used only for the final comparison. The first-wrong/second-omitted case yields 94 correct, one wrong, one omission, and category correct counts 32/32/30. All-correct selection counts are 48/48. The 80-ms response retains accuracy but loses timing eligibility; 1,399 ms is eligible and 1,400 ms is not. Timing lateness 50 is clean, 51 and 250 exclude the affected time, and 251 invalidates. Five times yield median 300 and suppressed variability; eight times yield median 450, Q1 250, Q3 650 and IQR 400. Additional arithmetic checks covered fractional boundaries 50.001/250.001 and RT 0/99.999/100/1,400.

The severe-onset fixture was evaluated against the specified event-order policy: confirmed presentation precedes invalidation, with aggregate metrics suppressed. It is not evidence of a running browser adapter. The two cell-statistic fixtures are cell-level checks, not complete event-journal fixtures.

## Implementation contract review

| Area | Finding |
|---|---|
| Scope, provenance and claims | Original generated rectangles and descriptive results; no proprietary scoring, employer conclusions or Lengths Advanced Training. Master Strategy's Lengths report and accommodation requirements are covered. |
| Versions and form assignment | Explicit specification/forms/timing/input/event/storage/scoring/activity/mock-adapter identities; fixed inventory admission; separate family rotation counters, deduplicated accepted arms and repeat labeling. |
| Display and timing | Connected visible fixation/onset/offset, original due-time lateness, fixed response deadline, strict threshold boundaries, missing-stage watchdog, protection/lifecycle rules and minimum layout predicate are stated. |
| Input | Explicit physical-code allowlist, selected-key release/rearming, modifier/repeat/composition rejection, first-response precedence, primary pointer handling and click duplication rejection. Frozen profiles and separately labeled alternative input prevent silent pooling. |
| Persistence and recovery | Atomic arm and exact readback before timing; synchronous live events; confirmed checkpoints before Continue; terminal snapshot before owner release; uncertain completion handling and immutable retries; no within-game reload resume. |
| Exposure and partial reports | Confirmed onset retained before same-frame invalidation. Read section 7's conservation counts over the known journal together with section 6's mandatory later-display/exposure-unknown disclosure after reload. The recovered prefix cannot establish that later trials were physically unseen. |
| Scoring/report/history | First eligible answer against manifest; exact denominators; clean correct-time thresholds and minimum cell sizes; median-of-halves IQR; rounding; aggregate suppression for Invalid/Incomplete; report context, limitations and separate activity events. |
| Deletion and compatibility | Per-session tombstones retain assignment counts; Delete all replaces only the Lengths installation; delayed writes check current authority; saved reports reread authoritative state. Unsupported historic versions remain review-only. |
| Mock adapter | Game 7 matches Master Strategy; route identity binds the arm, shared family rotation consumes interrupted arms, valid durable terminal readback gates advancement, and interruption restarts at the game boundary. |

No implemented shared mock orchestrator was available to certify; this is specification compatibility with the governing mock rules. The registry inspected supplies a generic immutable registry and introduces no conflicting Lengths contract. No unsupported extra behavior was assumed from it.

## Limits and preserved gates

This is a separate review of an agent-authored draft, not founder personal review. Readiness PASS does not itself freeze the packet, implement the game, validate actual display/input timing, establish human usability or device/accessibility qualification, certify persistence/mock integration, authorize analytics activation, deploy, or release anything. All those states remain separate. No product files, governing files, Git state, storage or deployments were changed. No broad application tests or browser tests were represented as necessary evidence for this documentation-only numerical/specification audit. Audit output is outside the repository.
