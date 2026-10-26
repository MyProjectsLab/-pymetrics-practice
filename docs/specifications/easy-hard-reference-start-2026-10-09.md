# Easy or Hard reference inspection started 2026-10-09

Status: source inspection completed for the seven saved guide and four game/report screenshots and sampled video frames. This is a reference record, not an approved game packet or evidence of current-provider exactness.

## Source order

- Official [Harver pymetrics overview](https://harver.com/gamified-assessments/) confirms that the assessment family evaluates effort, risk tolerance and decision making, but does **not** specify this game's press counts, timeouts, probabilities, visuals or report arithmetic. Do not present the captured practice run as current-provider exactness.
- Saved JobTestPrep `private-research/Pymetric /Easy or Hard/Easy or Hard Game/Easy or hard Video.mov` was opened directly in QuickTime, 2:15 duration. Observations below are from the saved practice footage; times are playback positions, not necessarily game-clock seconds.
- Dated Reddit first-person comments [2020 internship thread](https://www.reddit.com/r/internships/comments/j4husn) and [2020 csMajors thread](https://www.reddit.com/r/csMajors/comments/iq776r) describe the spacebar/probability effort game and confusion about what it measures. These are usability anecdotes, not mechanics authority.

## Video observations

| Position | Visible observation |
|---|---|
| 00:00 | Ready screen has a separate Next button. White central panel, dark text, teal accents, purple action buttons. |
| 00:10 | Easy task screen shows 88% chance of $1.00, large central outlined vertical rounded bar, Space instruction, earnings top left and a small number top right. |
| 00:20 | Completion feedback says task succeeded, just earned $1.00, total earnings $1. |
| 00:24 | Choice screen shows "Probability of winning Low (12%)", $1 Easy and $1.24 Hard in two adjacent rounded buttons, visible five-second auto-random-selection notice and countdown. |
| 00:35 | Hard task screen shows 12% chance of $1.24, central bar partly teal-filled and countdown. |
| 00:48 | Another Hard task screen shows 12% chance of $4.30. |
| 02:10 | Score report shows total earned $4.77 and 7/8 tasks finished on time; per-task table includes completion, probability, time and money earned. |

## Next evidence work

The saved guide/game screenshots establish the following observable contract. The game instructions say **5 Space presses within 3 seconds** for Easy and **60 within 12 seconds** for Hard, with a **2-minute** game clock. The guide screenshot says “mouse taps,” but the game instruction and played task screen both say Space; use Space as the supported primary control. The choice window is **5 seconds** and then selects a task at random. Easy offers **$1.00**; shown Hard offers are **$1.24, $2.77 and $4.30**. Shown probabilities are **Low 12%, Med 50%, High 88%** and apply after timely task completion, so a completed task can pay $0. The report separates timely completion from money earned. Its captured 8-task run shows 7/8 on time and $4.77 earned: $1+$1 Easy and $2.77 Hard. The report tables show five Hard attempts and three Easy attempts, including a failed Easy task.

| Source / stage | Directly observed behavior | Design parity requirement or uncertainty |
|---|---|---|
| Game instruction screenshot | 2-minute run; Easy 5/3 seconds, Hard 60/12 seconds; 5-second choice with random fallback; completed task still may pay $0 | Keep these distinct clocks and the lottery distinct from completion. |
| Guide overview and task screenshots | Guide's “mouse taps” conflicts with video/game instruction's Space; Easy always $1, Hard varies $1.24–$4.30 | Space is primary. Do not copy guide strategy claims as scoring rules. |
| Video ready and choice at 00:00 and 00:15 | Separate ready Next; adjacent Easy/Hard rounded choices, probability above, earnings upper left, small countdown upper right; selected choice purple | Match order and grouping with original assets/copy. Choice timeout behavior is described but the captured run does not visibly prove a timeout choice. |
| Video task at 00:08, 00:18, 00:39, 00:52, 01:07 | One central tall rounded vertical bar, outline gray, teal fill rising with Space presses; title/probability/reward above and instruction below | Preserve one-at-a-time task flow, bar scale/contrast/spacing and countdown. The sampled video confirms fill motion but does not independently count all presses. |
| Continuous video feedback around 18.86–22.99 s | Success feedback is visible at 18.86 s, still visible at 22.10 s, and the next choice is visible by 22.99 s; it therefore lasts at least 3.24 s, with no mandatory Next | A 600 ms feedback dwell would be a material mismatch. Use a roughly four-second dwell while the overall clock runs. |
| Game report screenshots and video ~02:10 | Total earned, timely tasks/attempts, separate Hard and Easy rows with completion, probability, duration and money | Report each attempted task and keep completed-$0 distinct from timed-out-$0. Captured 8-task total reconciles to $4.77. |

Visual reference: wide white card on light gray shell; two large adjacent rounded choice buttons centered in the card, with purple selected state; one central tall gray-outline bar with turquoise fill; large centered task heading; earnings at upper left, timer at upper right; green/red summary marks on report rows. The reference files show desktop scale only. Exact proprietary artwork, logo, wording and color values are not for reuse.

Direct QuickTime frame measurements at playback 10.02 s (empty Easy bar), 17.68 s (partly filled Easy bar), and 23.87 s (choice), from a displayed 3024 × 1840 capture; boundaries are approximate to 10–20 px because the recording is scaled inside the player. The white game card spans about x=188–2948 and y=274–1774. The central task bar spans x=1427–1758 (about 12% of card width) and y=740–1232 (about 33% of card height), with rounded lower end, thin gray outline, white unfilled interior, and turquoise fill rising from the bottom. The task title sits centered above the chance/amount line; a one-line Space instruction sits below the bar. On the choice frame, the two large rounded controls occupy approximately x=1160–1520 and x=1665–2025, with a gap around 145 px (about 5% of card width); the choice title/chance are stacked above, and the five-second random-selection notice is centered below. Earnings remain toward the upper-left part of the card and the small countdown toward the upper-right. These are layout relationships to reproduce with original CSS, not an instruction to copy exact pixels, branding or artwork. Compare at a matched viewport and scale during browser qualification; mobile wrapping is a separate accessibility adaptation.

Unobserved in the available source: the exact overall-clock start, the precise incomplete-task transition, fallback RNG distribution, whether every feedback interval consumes the two-minute clock, and hidden lottery draws. The packet states original implementation choices for these rather than claiming provider facts; its independent review must assess whether any creates a material departure. The continuous feedback interval is bounded by the sampled frames above, not proven to be precisely four seconds. The video captures only one run and does not establish current Pymetrics values. Original fixed forms can model the observed offers/probabilities, but should not claim a provider distribution.

## Source-to-packet acceptance trace

The locators below refer to the saved JobTestPrep `Easy or hard Video.mov` unless named otherwise. The video positions are playback times. E1's clock onset, the exact E7 dwell, and hidden draws remain implementation choices rather than source facts. No row asserts current Pymetrics equivalence.

| ID | Source locator and evidence status | Packet value and section | Acceptance criterion | Disposition |
|---|---|---|---|---|
| E1 | 00:00 ready/Next observed; exact clock onset unknown | §2.2 ready/Next; confirmed first-offer clock onset | §7.1 ready sequence; §7.5 start/first-display recovery | Ready flow matched; clock onset is original and disclosed |
| E2 | Game instruction screenshot and ~02:10 report: two-minute game observed, eight tasks in this one run | §2.3–6 repeated offers until 120,000 ms; no eight-task limit | §7.1 order; §7.3 full timed traces | Matched; observed eight is not generalized to a fixed count |
| E3 | ~00:24 choice screen and game instruction screenshot: adjacent choices and five-second random-fallback notice observed; actual timeout selection not seen | §2.3 five-second choice and hidden fixed fallback bit | §7.1 choice UI; §7.3 timeout fixture | Visible rule matched; fallback sequence is original |
| E4 | Game instruction screenshot, ~00:10 Easy and ~00:35 Hard: 5 Space/3 s and 60 Space/12 s observed; guide says mouse taps | §2.4 Space and deadlines | §7.1 control conflict; §7.3 and §7.4 native input/deadline checks | Played Space governs; pointer accommodation separately labeled |
| E5 | ~00:24 $1.00/$1.24 and ~00:48 $4.30 observed; saved report/guide show $2.77 | §2.3 and §3 Easy 100 cents; original Hard support 124/277/430 cents | §7.1 amounts; §7.2 form support | Observed values matched; frequency/order original |
| E6 | ~00:10 and ~00:24 visible 88%/12%; guide/game screenshots show 50%; outcome report separates completion and earned money | §2.5 and §3 visible 12/50/88% with hidden fixed draw after timely completion | §7.1 chances; §7.2 lottery arithmetic; §7.3 report replay | Visible support matched; draw schedule original |
| E7 | 18.86–22.99 s transition: feedback visible at least 3.24 s, next choice by about 5.01 s | §2.5 four-second automatic dwell while global clock runs | §7.1 feedback interval; §7.3 complete traces | Approximate match; exact provider dwell and clock treatment unproved |
| E8 | ~02:10 report and saved game/report screenshots: $4.77, 7/8 on time, Easy/Hard task rows | §6 report counts, cents, task outcome/duration and context | §7.3 independent $4.77 arithmetic and full report reconciliation | Observed arithmetic matched; extra context from Master Strategy |
| E9 | 10.02/17.68/23.87 s frames at 3024 × 1840 display: measured card, choices and bar; dimensions estimated ±10–20 px | §1 E9 and §2.3–4 original CSS layout at stated card proportions | §7.1 visual comparison and §7.6 matched-viewport browser check | Source-grounded proportions; original art and responsive adaptation |
