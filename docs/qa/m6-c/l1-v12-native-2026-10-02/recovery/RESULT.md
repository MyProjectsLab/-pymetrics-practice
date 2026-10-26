# Stop V1.2 — native warm-up recovery through saved-report reload

**Bounded journey observed successfully.** Starting QA HEAD: clean `8f3c9736e8c34fedbc8c188fd0bfc310365820f1`, branch `main`. Product remains exactly `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`. Local date: 2 October 2026 EDT; raw timestamps are 3 October UTC.

One new baseline session, `8a567c70-e988-46f6-b2e8-1ef2acb943d5`, completed the requested native recovery → save → reload → original-report route. It used `stop-baseline-01`, Space, and standard visuals. Chrome 154.0.8037.95 arm64 / macOS 26.6.2 build 25G83, MacBook Pro Mac17,2 / Apple M5 / 32 GB. [Exact source, build and device identities](IDENTITY.json), [running Chrome identity](chrome-version.txt).

## Retained chain of evidence

Times are `performance.now()` milliseconds in the original product document, `timeOrigin=1790996147809`. They establish browser/journal ordering only.

| Boundary | Independent browser observation | Product/storage/visible result |
|---|---|---|
| Live warm-up hide | Trusted hidden event at **156263.900**. Native Ctrl+Tab selected the helper tab. | Initial fixation had started at 155881.600; the hide occurred **before warm-up trial 0 was scheduled**. Stop visibility event **7** at 156264.900 → interruption **8** → restart required **9**. [Visible restart](warmup-restart.png). This attempt does not newly exercise a mid-stimulus warm-up interruption. |
| Fresh warm-up | Returned to the original live document and selected Restart warm-up. | Fresh indices **0–7**, eight presentations and resolutions, then warm-up completion **71** at **199037.700**. [Visible completion](warmup-complete.png). |
| Untimed pause | Trusted hidden at **225966.900**, then trusted visible return; the helper exported the same-origin state while the app document remained alive. | Pause retained [on return](pause-return.png). Pause exposures, reservations, saved results and old drafts are identical to the initial snapshot: **no form consumed by warm-up**. The same origin has two older consumed forms; they are not evidence from this new journey. |
| Accepted scored entry | Trusted Start scored task click with a visible, focused 1512 × 827 viewport. | Protection **72** at **268314.400**; first scored presentation **76** at **269328.100**. This is an accepted normal admission, not separate coverage of every rejection condition. |
| Full scored run and save | Window stayed visible and focused through protection. | **80 scheduled, presented, removed and resolved scored trials**, indices 0–79, matching the assigned form. Scored batch complete **636**; valid completion **638** at **445534.200**, protection ended **639**. Confirmed exposure belongs to this session. [Saved completion](completion.png), [valid report](report-before-reload.png). |
| Reload and reopen | Native Cmd+R creates a new document time origin **1790996662150.3**. Native Stop history → Open original report. | [Original valid report reopened](report-after-reload.png). Saved result, all **639 journal events**, summary and exposure are identical after reload. Visible report text matches; route-specific navigation buttons differ. |

The lifecycle run made **no scored key responses**: 60 misses, 20 correct withholds, no reaction-time summary. Validity here describes the product's completion/integrity rules, not performance or physical response accuracy. The physical-keyboard setup checkbox uses the founder's documented laptop setup; the actual setup/action inputs in this batch were dispatched by the native app bridge.

## Viewport and window accounting

The dedicated Chrome window was maximized with its native **zoom the window** action; the default-browser banner was dismissed before opening the app. The observer retains inner/outer dimensions, screen position, device pixel ratio, screen/available dimensions, visibility/focus, fullscreen indicators and visual viewport dimensions on lifecycle/resize events and every two seconds.

**From the I’m ready action through warm-up, recovery, pause and scored completion, all 172 captured window observations were 1512 × 827 CSS pixels**, outer window 1512 × 948 at (0, 34), DPR 2. There were **no resize events during this live journey**. The protected interval has 88 periodic samples, with maximum sample gap 2001.6 ms; all were visible/focused. These are sparse browser observations plus event coverage, not a physical display measurement. [Run window observations](viewport-during-run.json).

The complete raw trace also retains **earlier guide-screen resizing**, before any warm-up began:

- 02:56:16.790–02:56:17.718 UTC: width reduced to 1073.
- 02:56:20.475–02:56:21.751 UTC: width reached 682, then 696; height remained 827.
- 02:56:44.128–02:56:44.468 UTC: the explicit native maximize action restored width 1512. Subsequent samples show outer width settled to 1512 as well. Native resize event fields can reflect different instants of that animation.

The input tool reported “The user changed '/Applications/Google Chrome.app'” during two attempted preparation actions. That is retained as a tool observation, **not proof of which person/process caused the reduction**. The initiating actor is unknown; the explicit restoration is known. No live test was running then. The previous batch's unexplained 78-trial viewport failure remains intact in its own packet. [All preparation resize events](preparation-resizes.json). Viewport invalidation was not disabled, relaxed or patched.

## Reconciliation and limits

[Independent reconciliation](RECONCILIATION.json) passes trusted hide-to-journal linkage, ordered continuity, restart, pause exposure preservation, 80-trial/form agreement, valid saved storage, reload identity and viewport checks. The canonical JSON result SHA-256 before and after reload is:

`a10463465cd86c7f5d3514684c38eb72f330d086bbd6cc599463aed85364c906`

The original downloads are retained byte-for-byte: [before](before.raw.json), [pause](pause.raw.json), [saved](saved.raw.json), [reloaded](reloaded.raw.json). Separate [browser events](browser-events.json), [Stop journal](stop-journal.json), [exposure state](exposure-state.json), [saved record](saved-record.json) and [reopened record](reopened-record.json) are lossless selections from those exports. Raw-export hashes and all packet hashes are in [EVIDENCE-SHA256.json](EVIDENCE-SHA256.json).

No synthetic lifecycle event, clock override, frame delay, debugger attachment, product-handler patch or product-state injection was used. An independent QA observer was inserted before the unchanged production bundle in ignored preview output; its storage/observation overhead is unmeasured. Capture-phase focus/blur observations include descendant focus transitions; `hasFocus` and visibility state are retained, and the intentional tab-hide verdict uses the trusted document visibility event and matching Stop journal. Sampling callbacks have `isTrusted: null`; they are not browser-delivered lifecycle events.

This closes the **observed native recovery-to-original-report journey gap** at the stated live initial-fixation boundary. It does not establish physical input/display timing, 60 Hz timing accuracy, general browser delivery, Chrome certification, another device/browser/accessibility combination, or the full M6-C matrix. Earlier 60 Hz evidence is historical; no refresh-rate setting was changed or newly calibrated. Pre-onset/post-onset scored cases were not repeated. No reproduced product defect or product repair arose here.

`npm run build` passed; the JS/CSS match the accepted product build and all 119 recorded product/specification/configuration paths match f6b8ae0. Unaffected exact-SHA lint/unit/audit evidence was reused, not rerun as additional native evidence. The dedicated window was closed, local preview stopped, observer removed and original preview index restored; [cleanup](CLEANUP.json) confirms equality. Local test-origin records and downloads remain preserved. **M6-C and Stop remain incomplete.** Analytics activation, deployment and release are untouched; nothing was pushed.
