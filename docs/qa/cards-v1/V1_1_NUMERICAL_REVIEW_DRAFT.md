# Cards V1.1 developer numerical review

**Status:** Developer check only; independent packet audit and founder comparison of any material departures remain separate. No Cards product code was changed.

The [direct video review](V1_1_VIDEO_FIDELITY_REVIEW.md) confirms the observable 80-draw, four-deck, 2,000-start structure and recorded report arithmetic. The public guide corroborates four decks and a predetermined number of draws. Neither source establishes exact hidden probabilities. The revised V1.1 deck schedules are original design values with a comparable broad feedback scale and risk pattern, not a provider-equivalence claim.

Generator: `docs/qa/cards-v1/generate_v11.py`. Proposed forms: `docs/specifications/ASSESSMENT_PRACTICE_CARDS_FORMS_V1_1.json`. Acceptance fixtures: `docs/qa/cards-v1/ACCEPTANCE_FIXTURES_V1_1.json`.

- Manifest SHA-256: `6a347c41edec6e0f3eb3cc0a2dc55cfa399b2ead451ddcbbb67029fe8ecf48f1`.
- Fixture SHA-256: `fccfbeddab0cfbafe4c8c57fb8870fd6bca05045946820337e0dcbd662ab9f92`. Each case stores a digest of its complete 80-draw trace so reviewers can regenerate every selected outcome without carrying 2,880 verbose rows in the packet.
- Six distinct forms, each with four 80-value deck sequences, six valid four-deck position orders and 96 twenty-card segments. The 15 form pairs differ in 75–89 of their 320 hidden deck positions.
- Thirty-six fixed-policy fixtures cover all-A/B/C/D, four-deck cycling and D-for-40-then-A-for-40 on every form. Generator-side checks produced 2,880 selected outcomes, deck-local indices, balances, gains/losses and switches; independent regeneration of these revised bytes remains required.
- Identical 80-draw single-deck policies end at 5,200 (A), 400 (B), 3,400 (C) and 5,000 (D) simulated units. Four-deck cycling ends at 3,500 and D-for-40-then-A-for-40 ends at 5,100 on each form; ordering and trace still vary. These are QA counterfactuals, not candidate-facing recommendations or employer predictions.
- Zero outcomes occur in C; they count as draws and affect neither gain nor loss. Every fixture reconciles `endingBalance = 2,000 + gains − losses` and four deck counts sum to 80.

Before freeze, the independent reviewer should regenerate the seed stream without importing this generator, challenge six-form distinctness beyond manifest hashes, review whether the original hidden schedules support meaningful practice without implying a provider distribution, and verify the [source-to-design table](CARDS-OBSERVABLE-CONTRACT-DRAFT.md) against the direct video review. The exact feedback animation/dwell is not established by sampled frames; the packet uses no inferred deadline or extra Next control between draws.
