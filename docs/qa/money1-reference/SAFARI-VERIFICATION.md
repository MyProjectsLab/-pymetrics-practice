# Money 1 Safari result confirmation: development evidence

Base: `faae53b4b1d4d4d8b0ea4e2b2c1ded9b96668235`. Preview branch only; main/production unchanged. External logs and captures: `outputs/money1-safari-20261103/` in the project mirror.

## Reproduced failure

The founder’s $2 transfer reaches “Your partner has received the money”, showing $8 retained/$6 pot. On the next screen WebKit rejected an unchanged, completely decoded and visible 680×240 SVG: the connected image reports natural dimensions 679×239. Detached decoding of exactly the same URI reports the declared 680×240. This was reproduced at 1512×830 and 1190×626; phone 320×260 art did not round. The before-fix regression fails because the ordinary result becomes incomplete. Native dimension probes and initial failure are retained, rather than inferred from a passing rerun.

## Repair boundary

Only `exclusive-document.ts` changes product behavior. Source dimensions are proved by decoding an exact-source detached image, as Money2 already does, then bound to the displayed image, URI and render epoch. Displayed image decoding/completeness, exact source/currentSrc, owned-tree proof, complete semantics, viewport containment and center hit testing stay required. Every same-stage rerender clears the old proof. There is no tolerance, user-agent exemption or fabricated success. Artwork, rules, Next boundaries, animation delays, rates, arithmetic, storage and events are unchanged; seven relevant files are independently hashed byte-identical to base in external `preserved.json`.

## Added browser regression

`e2e/money1-webkit.test.mjs` observes native closed shadow roots without changing closed mode, receipts, clocks or journal. Native input completes $2 transfers in Chromium and WebKit at 1512×830, 1190×626, 375×667 and 800×400, through the exact result, fairness and saved report. It reconciles sent200, returned246, self1046, partner354, rating4 and one return/completion event each.

Controlled WebKit probes hold only the detached decode, then exercise normal completion, wrong dimensions, wrong resource, invisible attached pixels, Close and Restart. Pending Next/options are disabled while both exits remain directly reachable; invalid/cancelled attempts have no return or completion receipt. These are labelled fault injections rather than native device behavior. Existing Money1 presentation, help/history/reload, zero/$5 and attached-decode/source/cancellation tests are unchanged.

The first after-fix test run passed the original size check but then observed an empty stage after Next. A following run passed without captures. A bounded stage wait preserved the exact expected assertion but did not resolve the later screenshot-enabled failure; independent mutation traces subsequently established Playwright screenshot-induced HEAD changes as its cause (below). No app timing or guard exemption was changed. Initial and subsequent logs remain external.

## Actual Safari check

A disposable private Safari window on the local production build completed the full native $2/4-rating exchange, including the previously failing Next. The drawn result stayed visible; report showed completed and saved, $10.46 player/$3.54 partner, return $2.46. Native AX text and screenshot were inspected in the computer-use tool. External `NATIVE-SAFARI.md` records the exact journey and tool limitation when closing the disposable window. This establishes this desktop Safari journey, not broad Safari/iPhone, screen-reader or physical timing qualification.

## Checks

Focused browser groups: 5 passed, 0 failed, 0 skipped (two new WebKit/Chromium groups plus three existing Money1 groups). Full suite and exact-SHA audit results are recorded at handoff. Build and lint pass; inherited non-Money1 warnings remain.

Final developer unit check: `npm test -- --maxWorkers=1` — 2,374 passed, 0 failed, 13 skipped; 168 passed files, one skipped (383.73s). No assertion, timeout or skip was changed. This uses the same serial execution as the preceding milestone because of its retained, unrelated parallel-run timing failures. Test-generated Money2 evidence files were restored, excluded from the change. Production build and lint exit0; `git diff --check` passes. A complete browser-suite rerun and independent exact-SHA audit are required before preview push; their final outcomes are external handoff records so the audited commit is not changed by its own verdict.

## Browser-suite harness correction

The first complete browser rerun exposed port collisions introduced by the new test:4973 belongs to Digits and4972 to Cards. Four Digits tests failed their shared server-start hook before gameplay. No Digits product/test change is made. The new Money1 test now owns unused4967/4968 and requires its own server startup output plus successful fetch, rejecting an early server exit instead of accidentally using another test's server. The failed complete log is retained externally; the complete suite is rerun after this harness-only correction. Product bytes and the2,374/0/13 unit result are unchanged.

The first full run ended28 passed/7 failed: four Digits server-start hook failures, one Money1 detached-test disconnected server from the Cards port collision, one WebKit functional failure after optional screenshot capture, and one unchanged Money2 history-control lookup failure. The WebKit failure is independently traced to Playwright screenshotter injecting/removing a HEAD `body {}` stylesheet. Protected DOM rejection is correct; no production exemption is added. Optional capture now skips WebKit (actual native Safari screenshots use the computer-use bridge), and a controlled HEAD stylesheet insertion/removal joins the negative proof cases. Functional browser checks run without that observer interference. The Money2 lookup is retained for the fresh complete rerun, without changing its code or check.
