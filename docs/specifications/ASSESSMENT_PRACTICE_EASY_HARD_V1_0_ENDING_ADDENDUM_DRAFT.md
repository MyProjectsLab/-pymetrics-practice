# Easy or Hard V1.0 ending addendum — source fidelity repair draft

**Status:** agent-authored draft, not frozen. The original V1.0 packet, forms, fixtures and hashes remain unchanged. This addendum resolves an omission in the original source-to-design table; it does not claim current-provider exactness.

## Source observation and decision

The saved JobTestPrep `Easy or hard Video.mov` shows a white **Test Complete** screen with one **Next** control at approximately 128 seconds, followed by the result at approximately 130 seconds. The original V1.0 packet covered the timed run and report but omitted this observed intervening screen. The existing implementation therefore moves straight to the report. Under the founder's source-fidelity rule, show an original completion screen and require its Next control before displaying the saved report. The wording and visual design must be original; no JobTestPrep art or text beyond generic task labels is copied.

## Normative behavior

1. At the 120,000-ms global deadline, durably resolve any pending eligible action, append the correct terminal event and verify the complete snapshot before showing any completion claim.
2. The completion screen states that the **practice run has ended** and offers one **Next** button to view the report. It shows no earnings, task count or score. It cannot appear after an unconfirmed or failed terminal write.
3. The two-minute scored clock and event journal do not advance while this screen waits. Next is a report-view action, not a scored response. Confirm the report-view activity and recheck the exact complete result under the shared deletion order before displaying numbers. A delayed read or Delete all cannot restore the report.
4. History may open the same saved report after reload without replaying the completion screen. A browser reload before Next retains the complete result in history; it does not resume timed play.
5. Interrupted and invalid attempts do not display the completion screen. They remain review-only in history. No existing form, reward, fixture, scored timing or report arithmetic changes.

## Acceptance

- Full normal run: terminal snapshot is complete at 120,000 ms; candidate sees the completion screen, then Next opens the same report, including after a delay.
- Failed or undelivered terminal write: no completion claim until authoritative readback confirms the exact terminal snapshot.
- Delete individual or Delete all before/while Next is pending: neither completion nor report numbers reappear after deletion.
- Reload on completion screen: history reopens the exact saved report; no fresh form is consumed merely by viewing it.
