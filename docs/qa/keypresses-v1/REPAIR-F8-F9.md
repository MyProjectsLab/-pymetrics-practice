# Keypresses F8/F9 repair — developer verification

Base: `d8e74ffb955ed97aad1c15978d6883414e9dc428`, whole-game independent audit FAIL. Target: the commit containing this record. Audit: `/private/tmp/keypresses-whole-audit-8HwU63/AUDIT.md`.

## Corrections

- **F8:** A history view keeps its idempotency ID from the Review action, but captures wall time only after the authority check and verified report render. The browser regression withheld real IndexedDB read completion for 600 ms: no metrics appeared during the hold, and the durable view time followed first metrics insertion by 22 ms. A canceled pre-display view cannot append. Post-completion event sequence numbers remain the authoritative order. Each view's wall timestamp now retains its factual observation time even when another tab appends views in a different order; tests include a later append with an earlier observation time. Timed events and scoring are unchanged.
- **F9:** The report derives its invalidation reason from the reconciled timed journal. Plain-language copy distinguishes focus loss, missing GO or END, timing gaps and other defined reasons. Valid attempts say no interruption was recorded. Every Keypresses report states that Advanced Training is unavailable for Keypresses in this beta and offers Practice Mode instead. No training route or employer claim was added.
- The prior report-view QA claim now distinguishes a rejected delivery callback, which is reconciled, from an indefinitely pending one, which remains an open nonblocking observation.

## Checks and limits

- Focused Keypresses tests: **16 passed**. New fixtures cover factual out-of-order view times and valid, blur and technical invalidation reasons. Lint passed with the two inherited warnings.
- Production Chromium `145.0.7632.6`: all **15 bounded browser scenarios passed**. The valid report shows both new context lines. Injected blur, missing GO and delayed END show their specific reasons. The saved 40-press result reopened after reload, retained its exact timed state, and recorded two ordered report views. `browser-development.mjs` and `browser-development.json` are the retained driver and results.
- Full repository `npm run check` passed: lint with two inherited warnings, **1,115 tests across 55 files**, all 14 Stop form checks, all five Stop drill checks, TypeScript and both production builds. `git diff --check` passed. Keypresses V1.0 and V1.0.1 specification SHA-256 values remained `47ededa969ed46c56c21abf976ff54c65d4f8d4b975257db712723d85c4b4749` and `685cf93865f0c1cf9fcd36a7cf2f643d24e7031198f4e7820021b1cda70ad56c`.

The browser input was scripted; held reads, blur and frame delays were injected. Physical timing, native lifecycle, other browsers, screen-reader speech and broader accessibility qualification remain open. Mock integration, whole-game independent PASS, founder acceptance, deployment and release remain separate. Frozen specifications and optional analytics were unchanged.
