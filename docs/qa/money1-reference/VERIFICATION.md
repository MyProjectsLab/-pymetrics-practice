# Money Exchange 1 presentation — developer verification

Base `42aea16ee5fc8d85ed8d324d94c656b9f77f4b9b`; branch `preview/money1-reference`. The founder authorized starting the seven-game review's Money 1 work, with preview before main. This is presentation and a viewport-fit defect repair, not new mechanics or provider-equivalence certification.

## Defect and repair

A new native Chromium regression on the unmodified production build reproduced the 375×667 result failure: a normal $5 exchange reached `Checking your exchange` instead of a confirmed allocation. The saved attempt had a technical incomplete terminal, not a falsely completed score. The old narrow result was a 320×450 vertically stacked image below a heading and an in-card site menu; it could not fit the viewport. The existing `resultReady` requires the complete decoded, owned image to be within the visual viewport and hit-test correctly.

The new result retains every amount in original path-only glyphs and the accessible semantics, but uses a compact side-by-side participant composition (320×260 narrow; 320×180 compact; 680×240 wide). The site menu now sits outside the fieldset, in an explicitly owned main wrapper. Its exact attributes, children and descendants remain checked; a damaged header/main/result still rejects. No visibility predicate, amount calculation, receipt, decode promise or storage/ownership protocol was relaxed. The native phone test now completes and saves exactly $5 sent, $6.15 returned, $11.15/$8.85 final balances and rating 10, with one return event and one completion.

## Visual/copy changes

- Original participant circles, silhouettes and balance pills, paired horizontally on phones as well as desktop. Native amount field between participants on desktop, underneath on phones, with an explicit visible underline focus cue.
- Next on the right; secondary Restart/Close under More options, using their unchanged handlers. While result confirmation is pending, More options is disabled and both exits remain directly reachable, preventing a toggle from replacing the image being decoded. Late decode cannot restart a closed/restarted attempt.
- In-place same-stage focus restoration uses `preventScroll`; new-stage heading focus remains. Main wrapper/site menu are included in the exact owned tree.
- Report heading shortened to “Your exchange”; prominent self and partner balances, concise sent/returned/rating summary, Detailed numbers with original arithmetic help, one filled Try Again and quiet History/Main menu. All version/context/arithmetic information and the limitation remain available. Current report/history authority and saved bytes are unchanged.
- Replay still shows the single starting participant, then the pair at the existing connection/rules stages. All source stage order, Next boundaries, forms, zero/N/A rule, fixed return schedule, rating admission and journal definitions are unchanged.
- Connection delay remains **300ms**, transfer motion remains **350ms/0 reduced motion**. The review's connection readability concern is not silently treated as authorization to change timing.

## Tests and evidence

External evidence: `outputs/money1-reference-20261102/` under the project mirror, including before/after captures and retained logs. Reference frames and the eight-clip/seven-game review remain in `outputs/game-fidelity-20261102/`.

Changed tests:
- `src/money-exchange-1/result-art.test.ts`: retain independent pixel reconstruction of every numeric glyph for all six rates × six boundary transfers × three layouts; update coordinates for the approved original composition, retain path-only content rejection and exact semantics, verify paired participants and bounded height. Add a single-participant $10 replay-image check.
- `e2e/money1-presentation.test.mjs`: new before/after phone regression; native $5/zero complete flow at 1005×805, 1920×1080, 375×667 and 800×400; exact journal/report reconciliation, right-hand Next, separate exits, external site header, complete result/Next viewport fit, one primary report action, help/history/reload and immutable saved-run parity. Native keyboard and touch Next activations are included. Controlled slow-decode tests verify pending exits and no false receipt after opacity/source tamper, Close or Restart.

The initial full unit run had one unrelated Stop C4 delayed-success test failure (`result` was null at its fixed synthetic-time checkpoint): 2,371 passed, 1 failed, 13 skipped. Its unchanged 95-test file then passed alone. Both results are retained; no Stop code or test was changed and no cause/flakiness verdict is inferred solely from the later pass. Final full-suite result is recorded at handoff.

The full unit suite writes Money 2 historical evidence JSON as a side effect. Those generated files are restored to their pre-run bytes and excluded from this change.

## Limits

Browser input is trusted automation in isolated profiles, not physical iPhone/Safari or screen-reader certification. No test proves human perception/reading. Exact current-provider timing and hidden partner policy remain unknown. No production push or deployment is authorized by this preview milestone. Separate exact-SHA audit and founder preview acceptance remain distinct from developer checks.

## Source-contract disposition

| Packet item | Candidate disposition |
| --- | --- |
| M1–M8, M13 | Starting amount, one transfer/rating, tripling, fixed original returns, amounts, untimed task and separate result/complete/report Next boundaries unchanged. |
| M9 | Sparse original pair, central typed field and bottom-right Next restored; no traced/provider assets. Narrow result geometry is deliberately compact so the unchanged visibility proof can succeed. |
| M10 | Award/connection/connected/explanation order unchanged. Replay keeps the one-participant award and subsequent pair. Exact connection readability remains a separately recorded timing concern. |
| M11/M14 | Existing Restart/Close handlers remain available under More options; directly exposed while result proof is pending. Test Complete retains Next and Close without Restart. |
| M7/M12 | Both final balances and transfer/return/rating remain prominent; original full arithmetic/context and help are retained under Detailed numbers. No morality, trust, employer or personality score is introduced. |

## Final developer checks (same product bytes)

- `npm run lint`: exit 0; 38 inherited warnings, no Money 1 warning.
- `npm test`: **2,373 passed, 0 failed, 13 skipped**; 168 passed files and one skipped file. This final run followed the initial Stop failure recorded above; the passing run does not establish the earlier failure's cause.
- `npm run build`: TypeScript, production game bundle and analytics bundle pass; inherited large-chunk warning remains.
- `npm run test:e2e`: **33 passed, 0 failed, 0 skipped**, including the three new Money 1 groups and all pre-existing browser checks. Money 1's eight positive/zero full journeys, five controlled proof/cancel faults and the original phone regression pass. The all-game diagnostic table is not whole-game qualification: existing Stop/Arrows phone timed-route restrictions and Faces SVG `viewBox` console warnings are still recorded outside this scope.
- `git diff --check`: pass. Seven mechanics/runtime/storage/mock/frozen-packet files independently hashed byte-identical to base; external `preserved.json` records each digest.
- Screenshots inspected at 1005×805, 1920×1080, 375×667 and compact 800×400. The phone report now fits on one page in the captured 375×667 view, and allocation plus Next fit the same viewport. The reference/default-feature/evidence limits from the seven-game review remain explicit.

Full logs and before/after evidence are retained outside Git in `outputs/money1-reference-20261102/`. No user history was changed; all browser runs used isolated profiles.
