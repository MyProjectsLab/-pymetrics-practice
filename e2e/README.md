# Stop native keyboard check

Run `npm run test:e2e`. It builds the project, starts an isolated production preview, and runs one Playwright Chromium test. If Chromium is not installed, first run `npx playwright install chromium`.

The test answers both Stop questions, declares keyboard use through the real button, and sends browser-generated Space down/up events. Key-down alone must not reach readiness. Only after key-up can readiness appear and the real input receipt contain the native proof. No receipt, event trust flag, clock, or app function is mocked.

This is excluded from `npm test`; all existing unit/integration test discovery remains unchanged. It proves the browser input path, not physical keyboard hardware, screen latency, or a complete scored game. It uses a fresh browser context without personal history.

## Balloons continuous transition regression

`balloons-continuity.test.mjs` is included in `npm run test:e2e`. It plays all 39 native-button rounds at 1005×805 and 375×667 using disposable Chromium contexts and the real production build/IndexedDB journal. It pumps enough to exercise large late-game journals, waits through background authority checks in rounds 36–39, and also checks ten rapid pumps, 0/20/32-pump dimensions, setup actions and Start visibility.

A MutationObserver and animation-frame sampler watch continuously from the first mounted play frame until the report replaces it: Pump cannot disappear or be removed, play height cannot change, and the play area's and footer's document positions cannot move. A PerformanceObserver requires standard layout-shift sum <=0.01 (entries with `hadRecentInput` are excluded). Deliberate Start/report screen replacements are not play-frame geometry failures; raw shift values including recent input are logged separately. The test does not skip any intermediate Next/checking frames, mock action receipts, modify clocks or write fixture results into storage. `BALLOONS_SCREENSHOTS_DIR` optionally saves screenshots and per-size metrics. Phone size is touch emulation, not physical iPhone qualification.

At round 36 the Balloons test delays delivery of one **already completed native read-only transaction** by 180ms, without changing its data or clocks. It must observe the real controller’s checking mode, keep Pump mounted and disabled, and recover at the same geometry. This controlled delivery probe covers late checking deterministically; it is not a claim that every machine naturally has that delay.
