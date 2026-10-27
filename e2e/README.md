# Stop native keyboard check

Run `npm run test:e2e`. It builds the project, starts an isolated production preview, and runs one Playwright Chromium test. If Chromium is not installed, first run `npx playwright install chromium`.

The test answers both Stop questions, declares keyboard use through the real button, and sends browser-generated Space down/up events. Key-down alone must not reach readiness. Only after key-up can readiness appear and the real input receipt contain the native proof. No receipt, event trust flag, clock, or app function is mocked.

This is excluded from `npm test`; all existing unit/integration test discovery remains unchanged. It proves the browser input path, not physical keyboard hardware, screen latency, or a complete scored game. It uses a fresh browser context without personal history.
