# Stop native keyboard check

Run `npm run test:e2e`. It builds the project, starts an isolated production preview, and runs the Playwright browser checks. Install the browser engines first with `npx playwright install chromium webkit`.

The test answers both Stop questions, declares keyboard use through the real button, and sends browser-generated Space down/up events. Key-down alone must not reach readiness. Only after key-up can readiness appear and the real input receipt contain the native proof. No receipt, event trust flag, clock, or app function is mocked.

This is excluded from `npm test`; all existing unit/integration test discovery remains unchanged. It proves the browser input path, not physical keyboard hardware, screen latency, or a complete scored game. It uses a fresh browser context without personal history.

## Balloons continuous transition regression

`balloons-continuity.test.mjs` is included in `npm run test:e2e`. It plays all 39 native-button rounds at 1005×805 and 375×667 using disposable Chromium contexts and the real production build/IndexedDB journal. It pumps enough to exercise large late-game journals, waits through background authority checks in rounds 36–39, and also checks ten rapid pumps, 0/20/32-pump dimensions, setup actions and Start visibility.

A MutationObserver and animation-frame sampler watch continuously from the first mounted play frame until the report replaces it: Pump cannot disappear or be removed, play height cannot change, and the play area's and footer's document positions cannot move. A PerformanceObserver requires standard layout-shift sum <=0.01 (entries with `hadRecentInput` are excluded). Deliberate Start/report screen replacements are not play-frame geometry failures; raw shift values including recent input are logged separately. The test does not skip any intermediate Next/checking frames, mock action receipts, modify clocks or write fixture results into storage. `BALLOONS_SCREENSHOTS_DIR` optionally saves screenshots and per-size metrics. Phone size is touch emulation, not physical iPhone qualification.

At round 36 the Balloons test delays delivery of one **already completed native read-only transaction** by 180ms, without changing its data or clocks. It must observe the real controller’s checking mode, keep Pump mounted and disabled, and recover at the same geometry. This controlled delivery probe covers late checking deterministically; it is not a claim that every machine naturally has that delay.

## Money Exchange 1 Safari SVG regression

`money1-webkit.test.mjs` completes native-input $2 exchanges in Chromium and WebKit at desktop, compact, phone and short-landscape sizes. It observes closed shadow roots without changing their mode or fabricating input receipts. The regression rejects WebKit incorrectly rounding laid-out SVG natural dimensions: source dimensions are decoded detached and remain strictly bound to the displayed image, URI and render epoch. Separate controlled probes hold the detached decode, reject wrong source/dimensions and invisible pixels, and check Close/Restart plus late callback cancellation. WebKit engine coverage does not establish physical iPhone or all Safari-version qualification.

Money1 optional captures (`TRAITGAME_MONEY1_OUTPUT`) are Chromium only. Playwright's WebKit screenshot preparation inserts/removes a HEAD stylesheet even with `caret: initial`, triggering the owned-document guard by design. Do not capture an active protected WebKit journey with `page.screenshot()` and then claim its rejection is a product fault; use external native screen capture instead. The negative tests explicitly retain rejection of that HEAD mutation.
