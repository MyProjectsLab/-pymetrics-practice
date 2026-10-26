# Stop V1.1 standard form provenance and Milestone 1 audit

The release set in `src/stop/forms/manifests.json` contains 14 original, seeded, stored standard forms: four baseline, six replay/practice, and four retest. The JSON is release data. Runtime gameplay must read it without generating a new sequence.

`scripts/generate-stop-forms.mjs` is the immutable `stop_standard_generator_v1` recipe for this set. It hashes each documented seed identifier, uses that seed for a deterministic Fisher–Yates shuffle of 15 GO and 5 NO-GO trials in each of four blocks, and accepts only sequences that meet the approved run, context, endpoint, and pairwise constraints. The generator has no rule that increases NO-GO probability after a GO run. Candidate-facing copy must not suggest that a run predicts the next stimulus.

Each form stores a SHA-256 checksum over its schema version, form id, family, form and specification versions, generator version, seed id, block count and size, and ordered sequence. The checksum does not certify scientific equivalence or similarity to an employer assessment. `npm run forms:check` regenerates the release set and compares it byte for byte; the independent TypeScript validator checks the stored release data and all 91 form pairs.

| Form | Seed id | Longest GO run | Longest NO-GO run | NO-GO after 3+ GO |
|---|---|---:|---:|---:|
| stop-baseline-01 | ap-stop-v1.1-baseline-01-candidate-00001 | 8 | 3 | 9 |
| stop-baseline-02 | ap-stop-v1.1-baseline-02-candidate-00001 | 8 | 3 | 10 |
| stop-baseline-03 | ap-stop-v1.1-baseline-03-candidate-00003 | 8 | 2 | 9 |
| stop-baseline-04 | ap-stop-v1.1-baseline-04-candidate-00010 | 8 | 2 | 10 |
| stop-replay-01 | ap-stop-v1.1-replay-01-candidate-00001 | 7 | 2 | 11 |
| stop-replay-02 | ap-stop-v1.1-replay-02-candidate-00008 | 8 | 3 | 10 |
| stop-replay-03 | ap-stop-v1.1-replay-03-candidate-00009 | 8 | 3 | 8 |
| stop-replay-04 | ap-stop-v1.1-replay-04-candidate-00003 | 8 | 3 | 10 |
| stop-replay-05 | ap-stop-v1.1-replay-05-candidate-00002 | 8 | 2 | 8 |
| stop-replay-06 | ap-stop-v1.1-replay-06-candidate-00004 | 7 | 3 | 10 |
| stop-retest-01 | ap-stop-v1.1-retest-01-candidate-00009 | 8 | 2 | 11 |
| stop-retest-02 | ap-stop-v1.1-retest-02-candidate-00005 | 7 | 3 | 10 |
| stop-retest-03 | ap-stop-v1.1-retest-03-candidate-00007 | 7 | 3 | 10 |
| stop-retest-04 | ap-stop-v1.1-retest-04-candidate-00001 | 8 | 2 | 8 |

Every form has exactly 80 trials, 60 GO and 20 NO-GO overall, and 15 GO and 5 NO-GO in each 20-trial block. Neither endpoint pair consists of two NO-GO trials. Across all 91 pairs, the minimum difference is 24 positions and the maximum match count is 56.

These sequences were created from the documented seeds and original generator; no observed competitor sequence was used as input. Direct comparison against the observed reference sequences remains a separate originality review before Stop release because those sequences are not stored in this repository.
