# Digits V1.0 draft packet — authoring numerical review

**Status:** Authoring checks only at the draft packet in this worktree. This is not an independent specification audit, a freeze, implementation verification, founder personal acceptance, browser/device qualification, deployment, or release.

## Inputs and reproducible commands

The constructor, fixed inventory, primitive expected-output fixtures and separate review scripts are:

* `scripts/generate-digits-forms.mjs`
* `docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_0.json`
* `docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FIXTURES_V1_0.json`
* `scripts/review-digits-forms.mjs`
* `scripts/review-digits-fixtures.mjs`

Run from the repository root:

```sh
node scripts/generate-digits-forms.mjs --check
node scripts/review-digits-forms.mjs
node scripts/review-digits-fixtures.mjs
```

The constructor's compact core-object SHA-256 is `9810f3106c7ed20efd31d11c7a012a3796bdfc2c1c72035c1bae804e38f595b1`. The form file's byte SHA-256 is `b29a5c12daaf6915f0aeded56c1dfdd74b338be23a61ef8efe7c57b7eff2af8f` at this authoring check. These are draft identities, not a freeze.

## Arithmetic and inventory observations

| Check | Observed | Contract |
|---|---:|---:|
| Mode-specific forms | 6 visual + 6 auditory | 12 |
| Trials | 12 × 18 = 216 | 18 per form |
| Trials per length per form | 3 each at lengths 3–8 | 3 each |
| Digit positions per form | 3 × (3+4+5+6+7+8) = 99 | 99 |
| Digit positions across inventory | 12 × 99 = 1,188 | 1,188 |
| Unique target strings | 216 of 216 | No repeated sequence |
| Digit appearances within each form | Nine digits × 10; one digit × 9 | 99 total |
| Serial-position denominators per completed form | 18, 18, 18, 15, 12, 9, 6, 3 | Sum 99 |
| Primitive error fixtures | 8 passed | Position conservation |
| Exact deadline fixtures | 3 passed | `< deadline` accepted; `= deadline` times out |
| Percentage fixtures | 1/3 = 33.3%; 2/3 = 66.7%; 1/12 = 8.3% | Half-up to one decimal |

The review script also rejects malformed form IDs/order, seed mismatch, non-ASCII digits, within-trial repetition, four-digit ±1 runs, duplicate sequences, incorrect trial/block/length schedule, wrong per-digit counts, and digest mismatch. The fixture review independently applies the packet's left-to-right adjacent-pair rule and verifies `matches + substitutions + 2×pairs + missingSuffix = targetLength` in all eight cases. A full matching draft submitted at the exact deadline is correctly classified as timed out and **not** scored exact. The three simple percentage cases cover the display rounding specified in the packet.

## Evidence and limits

The Master Strategy places Digits at Game 3 in the original mock and requires maximum recalled length, length accuracy and position/error breakdowns. The private reference inventory establishes only the general individually presented ordered-recall format; the fixed 18-trial forms, mode split, timing, scoring and wording here are original decisions. No proprietary asset is included. The auditory contract depends on browser speech callbacks and candidate-confirmed audibility, which are not verified by these numerical checks. Separate review must challenge its feasibility, accessibility and limitations before any implementation/freeze; real-browser tests and supported-device qualification remain later gates.
