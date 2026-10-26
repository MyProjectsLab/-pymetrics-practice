# Cards observable contract — working draft

**Status:** Reference gate only. The prior 48-choice, three-card, zero-start draft and its six forms/fixtures are rejected. This document does not freeze a replacement packet or authorize product coding.

## Evidence and precedence

| Point | Saved JobTestPrep evidence | Replacement contract |
|---|---|---|
| Start | Instruction screenshot and recording: four decks, 80 questions, $2,000 starting loan; after instructions, a ready screen says to press Next before the 2,000-balance board | Four persistent deck choices; simulated starting balance 2,000; exactly 80 draws; a ready/Next action starts the scored run |
| Choice | Recording: select a deck, draw one card, switch decks freely | One choice of A/B/C/D per draw; any deck may be selected again or switched to |
| Outcome | Recording: immediate signed gain/loss, revealed card, live balance, separate gain/loss bars; a $0 win appears | Show the signed outcome and updated balance after each draw; retain a zero-outcome case in original schedules |
| Outcome scale | Recorded report: B has one $1,150 loss among 12 selections; D has $2,350 gains and $600 losses across 50 selections. This is one path, not a probability estimate | Original fixed schedules preserve the broad contrast of rare large B losses and frequent smaller D gains without copying the recorded hidden sequence |
| Pace | No per-choice countdown or separate Next button observed between draws in sampled play | Untimed; after committed feedback is displayed, the next deck selection is the next draw. No Next action between draws |
| End | Instruction says 80; recorded report counts 12+8+10+50=80 | After 80 choices and 80 confirmed feedback events, open a complete report only when the guarded terminal event and snapshot commit and authoritative readback verifies them |
| Report | Recorded report: total score, gains, losses, chronological selected outcomes, four deck counts/gains/losses | Reconcile `ending balance = 2,000 + gains − losses`; show four deck summaries and selected-choice trace |
| Positions | One recorded report displays B/C/A/D left to right; tips suggest order can change | Deck identity remains visible; form may set an original, versioned position permutation |

The [public JobTestPrep guide](https://www.jobtestprep.com/pymetrics-cards-game) corroborates four decks, switching, gain/loss feedback and a predetermined number of draws. [Harver's public overview](https://harver.com/gamified-assessments/) does not state Cards-specific counts, starting balance or outcome probabilities. These observations describe the saved practice reference, not a verified current Pymetrics implementation. First-person forum accounts are anecdotal and do not establish exact mechanics.

## Original implementation boundaries

- Create original deck art, text, outcome sequences and local descriptive reports. Do not copy JobTestPrep assets or claim provider-equivalent probabilities, norms or employer scores.
- A selected deck yields the **next card in that deck's own sequence**, not a global-turn outcome row. The original fixed forms must define all four deck sequences and visible deck positions. Only selected cards become observed journal events or appear in the candidate report.
- A native deck-button activation is one draw. Lock all decks until the outcome and balance are durably confirmed and visibly presented; then enable the decks for the next draw. Repeated activation cannot duplicate a draw. No additional candidate click is required to advance.
- Preserve the authoritative committed-choice prefix if the run is interrupted, including a saved outcome whose play-time feedback was unconfirmed; show separate committed-draw and confirmed-feedback counts. Only the guarded terminal event and snapshot, verified by readback under the V1.1 specification, make an 80-draw result complete. History/deletion/cross-tab rules from the Master Strategy still apply.
- Before packet freeze, attach new immutable forms, generator, exact arithmetic fixtures and independent numerical/fidelity review. The old 48-choice forms and fixtures are inapplicable.

**Remaining observation limit:** The saved video has not established an exact fixed feedback dwell or whether the card reveal animation must finish before the next selection. Do not invent a deadline. The accessibility-safe implementation may make decks available as soon as text feedback is confirmed visible and durable.
