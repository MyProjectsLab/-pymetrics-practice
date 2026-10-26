# Money Exchange 1 V1.0 standalone developer verification

Status: complete local implementation candidate; separate exact-SHA whole-game audit pending. This is not founder acceptance, physical/device/accessibility qualification, mock integration, deployment or release.

## Scope and frozen inputs

- One original standalone exchange, guide/example/check/ready, observed staged transfer and result, 0–10 fairness, Test Complete/Next, arithmetic report/help, local history/reload/delete and Try Again.
- Versioned IndexedDB run journal, one owned play lock, ordered data operations, bounded read/write delivery, same-request recovery and deletion tombstones. No account or remote candidate storage.
- Frozen source parity, specification, forms, fixtures, generator and independent oracle hashes still match `FREEZE.md`; no packet bytes changed.

## Developer evidence

- `npx vitest run src/money-exchange-1`: 22 focused tests passed, including exact arm/transfer/terminal retries, exposure preservation, late callbacks, replacement, deletion and the case where one replacement listener closes the store before the UI listener runs.
- `npm run build` and `npm run lint` passed. Lint reports three pre-existing warnings outside this milestone.
- Production Chromium: full filmed $5 transfer/$6.15 return path, $11.15/$8.85 balances, report and reload; zero transfer; all six form rates and familiar rotation; seven-row history; 320px keyboard/reflow and help/back; falsey corrupt root rejection; held database opening watchdog.
- Production Chromium `dev-money-matrix.mjs`: prearm and armed Restart, captured return/Restart, zero terminal, individual deletion, pagehide settlement, second-tab report deletion and Delete all against active play without BroadcastChannel passed.
- Production Chromium `dev-money-final-boundaries.mjs`: history-only deletion without BroadcastChannel, Test Complete Close/reopen, report publication versus deletion in both lock orderings, and Start versus Delete all in both lock orderings passed with visible screen and complete IndexedDB root assertions.

## Precommit finding and grouped correction

The Start/Delete all matrix initially left a prearm screen visible after replacement, and an own Delete all could move a history screen into uncertain review. The first store subscriber closed and cleared the listener set during notification, so the UI subscriber never saw replacement. An in-flight history poll could also report its old read failure after deletion. Notification now dispatches a snapshot of subscribers; replacement puts the UI in a checking state until the new complete root is read; polls are fenced by navigation epoch and a pending local action. Both race orders passed after the correction. The original positive/zero and deletion cases were rerun.

No whole-game independent PASS has been issued. Remaining audit challenge: operation/visibility authority under unusual browser lifecycle and storage failures, source screen fidelity, report claims, and deletion versus late publication.
