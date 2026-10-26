# Money Exchange 2 source-to-screen record — 2026-10-12

Status: reference transcription only. No packet frozen, product code, or new audit. Main was `44e2f40126fa43e90551a3ee288412b528db6e5e`; unrelated dirty AGENTS/workflow/Lengths-reference files preserved. This record supersedes `/private/tmp/money-exchange-2-source-start-2026-10-12.md`, whose video-access limitation was resolved.

## Sources and limits

- Official [Harver gamified assessments](https://harver.com/gamified-assessments/) identifies fairness, generosity and decision making among constructs, but does not publish exact Money Exchange 2 mechanics or scoring.
- Saved JobTestPrep recording `Money Exchange 2 Game/Money Exchange 2 Video .mov`, duration 196.025 seconds, in `/Users/renzo/Documents/Assessment Practice/private-research/Pymetric /Money Exchange 2/`. Reviewed sampled frames at five-second intervals across the full recording, with every-second frames at 140–154 seconds to resolve the second choice. The saved recording is the captured practice baseline, not proof of the current provider game.
- All six saved game screenshots and nine available guide screenshots in the same directory were inspected. The guide's practice-question scale is 1–10 while played footage has 0–10; the footage controls the observed gameplay contract.
- Dated first-person [Reddit account, February 2025](https://www.reddit.com/r/recruitinghell/comments/1iozlxm) recalls a give/take-money choice; it does not establish amounts, sequence or scoring. Other first-person reports raise general interpretation/confusion concerns, so the candidate guide should stay clear and the report descriptive.
- Any JobTestPrep claim that a money choice reveals altruism, job fit or the correct hiring strategy is its own interpretation and is excluded by the Master Strategy.

## Played-screen sequence

| ID | Captured observation | Video time / screenshot | Evidence status |
|---|---|---|---|
| ME2-01 | An instructions page leads to a separate ready/Next page. Restart and Close are present during play. | Game `download.png`, `download-1.png`; video 00:00 | Observed; exact pre-recording intro not filmed |
| ME2-02 | Player gets $5 on a candidate-alone award screen, then connecting shows partner at $0 with disabled Next. Connected still shows partner $0 but enables Next. Only the separate partner/rule screen first shows the stable $5/$5 pair. The second mini-game repeats this sequence. | Video 00:05, 00:10–00:30, 00:40 and 01:45–01:50; game `download-2.png` | Observed sequence; $0 is a screen placeholder, not a starting allocation. Exact animation dwell unknown. |
| ME2-03 | One person is described as randomly selected for an additional $5. In the captured run the player receives it in **both** mini-games, showing $10 player / $5 partner before each decision. | Video 00:35–01:00 and 01:50–01:55; guide `download-1.png`/`download-2.png` | Observed run; random selection rule is an on-screen claim, not a proven distribution |
| ME2-04 | First decision asks how much of the extra $5 to transfer. A horizontal control runs from $0 to $5; preview shows **$1.50** at 01:15, then the player submits **$2**. | Video 01:05–01:20; extracted frame `075.png`, final amount and report | Observed values support half-dollar stepping, but do not prove the control admits no smaller step. |
| ME2-05 | First outcome displays $8 player / $7 partner, then Next. This matches $10 − $2 and $5 + $2. | Video 01:20; game report `download-3.png` | Observed and arithmetically reconciled |
| ME2-06 | Candidate rates the first transaction on an **0–10** fairness scale and proceeds with Next. The first report later shows fairness **8**. | Video 01:25–01:35; report at 02:40 | Observed. Guide practice question `download-6.png` uses 1–10, a documented conflict. |
| ME2-07 | Interstitial announces another similar game with a different participant, then a second $5 joining/connection/bonus sequence. | Video 01:35–02:00 | Observed two mini-games in this capture |
| ME2-08 | Second decision explicitly offers Give **or** Take up to $5 in **$0.50 increments**, initially Give $0. Player explores Take and Give then submits **Give $2**. | Video 02:00–02:30; every-second frames 02:20–02:29 | Observed; intermediate Give $1.50 at 02:25 is not the submitted choice; Give $2 persists 02:26–02:29. |
| ME2-09 | Second outcome is $8 player / $7 partner, then second 0–10 fairness rating; cursor selects 8 before Test Complete/Next. | Video 02:30–02:35; screenshot `download-4.png` | Observed and arithmetically reconciled |
| ME2-10 | Report has two pages/dots and left/right controls: page one for first partner, page two for second. Each displays final $8/$7, $2/Give $2 and fairness 8. Solving Tips and Try Again follow; tips has Back Report. | Video 02:40–03:15; game `download-3.png` through `download-5.png` | Observed. Report trait labels are not adopted. |

## Visual presentation observed

The gameplay video captures a roughly 2668×1704 desktop with a large white central panel and pale gray exterior. The player is a large turquoise circular person icon at left; the partner is pale lilac at right, with both names beneath and charcoal rounded amount badges above. Transition screens retain this wide separation. Decision text sits in the upper center. The amount is a green rounded tile above a green horizontal bar, with endpoint labels; the second decision explicitly names Take on the left and Give on the right. Fairness is eleven narrow green vertical columns numbered 0–10 with circular markers across the top, centered below the prompt. Next and Restart are purple rectangles, bottom-right and top-right. Report uses paired icons and two white data cards with mint value tiles and purple page arrows. Recreate the structure with original art/colors and accessible text, rather than copying icons or exact CSS. Source images `download.png` through `download-5.png` provide clear static visual locators; compare candidate at a matched viewport and zoom before claiming visual fidelity.

## Unobserved or conflicting

- The 196-second recording includes pauses and other desktop activity; the in-product claim of “about two minutes” is not an observed enforced timer.
- Both captured partners show the player winning the bonus; a fixed assignment or probability cannot be inferred. Any original practice schedule for the bonus must be labeled and independently reviewed against the recorded path.
- The captured video only demonstrates giving, though the second control visibly allows taking. Use the stated Take/Give range, and derive outcome arithmetic without claiming provider choice frequencies.
- The guide says 1–10 for its *practice question*, while the played game shows 0–10. Use 0–10 in candidate gameplay.
- Exact provider scoring and trait interpretation are not public; report only money, action, rating and simple comparison.

## Before packet or code

Prepare a screen/control parity matrix that names each Next, Restart, Close, choice, result, rating, Test Complete, report-page, Solving Tips and Try Again transition. Freeze the authority/presentation claim and its failure cases before implementation: start/arm, choice before terminal, visible final amounts, pagehide, failed/held write, deletion/replacement both orders, history/report reload and cross-tab. Have an independent preflight challenge neighboring counterexamples before coding, per `/private/tmp/assessment-practice-cross-game-failure-pattern-2026-10-11.md`.

## Proposed V1.0 packet disposition (not independently approved yet)

Packet: `docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_SPECIFICATION_V1_0_DRAFT.md`. Exact screen/control graph and acceptance: packet §2; source row mapping below. Original local authority/presentation: packet §4. Visual acceptance: packet §5. Forms and fixtures are separate versioned companions. The agent-authored proposal does not establish provider equivalence or founder personal acceptance.

| Source item | Proposed packet value | Acceptance criterion and disposition |
|---|---|---|
| ME2-01 | Instructions → Ready → first pairing; precompletion Restart/Close | `instructions`/`ready`/active graph §2; matches shown controls; unplayed recovery behavior is original and labeled. |
| ME2-02 | Candidate-alone $5 award → connecting with disabled Next and temporary partner $0 → Connected with enabled Next and still temporary partner $0 → partner-rules screen first showing stable 500/500 | Separate screens in packet §2, including round 2; no `$0` journal allocation. Original 600 ms nonscored animation dwell is disclosed. |
| ME2-03 | One 500-cent bonus each round; fixed original form recipient, including candidate/candidate filmed fixture | `ME2-1` must show 1000/500 twice. Partner-winner branches are guide-supported but unfilmed; independent review must inspect their actor choice, report and arithmetic. No provider probability claim. |
| ME2-04/05 | Round 1 Give-only 0–500 cents in original 50-cent steps; filmed $1.50 preview and +200 → 800/700 | Match choice, result and Next. Half-dollar steps are the closest source-grounded interpretation of observed values and Round 2; the film does not prove smaller first-round increments impossible. |
| ME2-06 | Fairness 0–10, submitted on Next | Zero, eight and ten fixtures; film controls guide's conflicting practice question. |
| ME2-07 | Different-partner interstitial and fresh 500/500 | Round-1 terminal before Round-2 arm; two distinct partner IDs per form. Match. |
| ME2-08/09 | Round 2 signed −500…+500, steps 50; Give +200 → 800/700; fairness 8 | Negative/zero/positive endpoint fixtures and filmed path; previewed Take must not commit. Match. |
| ME2-10 | Two report pages, partner-specific values, page navigation, original tips, Try Again | Each committed round reconciles 1,500 cents; no trait/strategy language; incomplete history cannot masquerade as two-round complete. Match fields/control structure with original copy. |
| Visual V01/V02 | Large separated participants, white panel, dark amount badges, green decision/fairness, purple navigation, two paired report cards | Compare production candidate at roughly 2668×1704 source viewport, 320px and 200% zoom. Shape/size/spacing/color are relative source targets, not measured provider pixel constants. Original assets only. |

The independent prepacket challenge `/private/tmp/money2-preflight-review-2026-10-12.md` identified additional zero/endpoints, rapid double controls, possible paint before receipt, partner-bonus and view/deletion cases. Packet §§2–5 and generated fixtures incorporate them; review must verify substance rather than accept this cross-reference as proof.
