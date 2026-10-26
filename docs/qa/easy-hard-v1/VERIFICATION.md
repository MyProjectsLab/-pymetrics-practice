# Easy or Hard V1.0 developer verification

Status: complete standalone candidate pending a separate exact-SHA read-only audit. This is developer evidence, not independent acceptance or device qualification.

## Frozen source and implementation

The implementation uses the independently reviewed V1.0 packet frozen at `3e63487d7ebf1d64c5949d70890cdba629cba880`. Its fixed EH1–EH4 form bytes and fixtures were not changed. It preserves the saved JobTestPrep observable sequence: ready/Next, two-minute repeated offers, five-second choice with fallback, five/three Easy or sixty/twelve Hard Space task, stated chance applied only after timely completion, signed outcome feedback, and a descriptive report. Offer order and hidden draws are original fixed training values, not claims about the provider.

## Checks

- 12 focused tests pass across forms, arithmetic, transitions and storage. The fixed full-session journal replays to a verified terminal snapshot. Half-open choice/task deadlines, duplicate action IDs, system provenance, deletion, Delete all, old installation writes and manifest binding are covered.
- The repository suite passed 1,634/1,634 tests after its library-card count was updated for the eighth game. TypeScript, production build, full lint and `git diff --check` pass. Lint reports only three inherited warnings outside new Easy or Hard source.
- Production Chromium: first choice, Easy Space task and payment, timeout/fallback, full 120-second zero-earnings completion, saved report/reload/history, explicit Back interruption, exclusive second-tab Start, individual and Delete all withdrawal of an open report, and starting a replacement attempt after deletion were observed. The full 120-second run preceded small report-format and preference-display changes; first-offer/ready flow was retested after them. An initial stale-anchor defect and an old-installation-after-Delete-all defect were fixed before this handoff and retested.
- The saved state is consulted and publication is ordered with deletion for scored onset, action confirmation, report and history. Canceled or unconfirmed writes remain in checking/review state rather than claiming payment or completion.

## Limits

The browser cases are bounded automation, not physical keyboard, assistive-technology speech, device, native lifecycle or cross-browser qualification. The 320-pixel layout and injected indefinitely held IndexedDB callback were not yet demonstrated in a production browser. No mock, account sync, analytics activation, deployment or release is claimed.
