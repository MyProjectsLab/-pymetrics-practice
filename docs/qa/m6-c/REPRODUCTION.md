# M6-C reproduction notes

Use the named base for before results and the commit containing this file for repairs. Install from the unchanged lockfile in a disposable checkout if needed; build with `npm run build`. Serve only loopback with `npm run preview -- --host 127.0.0.1 --port 5588 --strictPort`. The retained run used native Chrome 154.0.8037.93 on macOS 26.6.2. Read VERIFICATION.md before interpreting browser/physical evidence.

## History layout and focus

1. Complete guide, rule, examples, comprehension and device check. Warm-up and baseline use ordinary product timers; allow all trials to time out. Enter no synthetic timing or response data.
2. Open report and history. At a measured `innerWidth` of 320, record `document.documentElement.scrollWidth`, screenshot and SVG bounding box. Base: 333 px document width; repair: 320 px.
3. On history entry, open individual/delete-all confirmation and cancel. Record activeElement and AX role. Base loses focus to BODY and claims modal isolation while header remains navigable. Repair focuses headings, removes the modal claim, and Escape cancels without deletion.
4. Run `npm test -- src/stop/History.test.tsx src/stop/Report.test.tsx src/App.test.tsx`. `before-focus-tests.txt` is the new regression against unchanged product, with failure at history heading focus; `after-focused-tests.txt` records all 26 passing.
5. Test browser zoom through native browser UI; confirm the displayed percentage and actual CSS viewport. Do not infer zoom from a shortcut attempt. The original failed shortcut and later ineffective viewport requests are excluded from qualification.

## Local record export / seeded presentation

For QA only, after building, copy `helper.html` to ignored `dist/m6-c-helper.html`. Its Download button opens only the local application's IndexedDB and renders the raw records in its own visible page. Save that JSON verbatim. No product event or engine function is patched. Rebuild to remove the helper before distribution.

The Load fixture button also requires copying `seeded-accepted-state.json` to ignored `dist/m6-c-seed.json`. It replaces this **disposable loopback test origin's** installation record with retained accepted state. Do not use on candidate data. The fixture is the `reload.state` value in `/private/tmp/stop-m5-full-audit-5e6b372-20261001/retry/unavailable-before-unrelated-report-retry.json`; it is a historical M5 fixture, not a newly recorded native journey. New journals were exported before import. Seeded captures here show normal-width history/comparison and drill-journal presentation only.

## Lifecycle investigation still required

Repeat actual tab hiding with an independently observed native page-visibility/focus trace on the approved physical setup, without the attached browser automation debugger. This run's native tab bar changed selection, yet no hidden/blur event appeared in the journal and the run completed. Retain browser events, product events and physical/tab evidence together; determine delivery versus handling before any code or policy repair. Do not count creating an inactive background tab as hiding the test page. No synthetic dispatchEvent substitute may close this gate.

[L1-INVESTIGATION.md](L1-INVESTIGATION.md) records the later unattached diagnostic and [completed bounded physical L1 follow-up](l1-physical-2026-10-02/RESULT.md). Both captured independent trusted hidden events and matching invalid Stop drafts in warm-up and scored play. The historical debugger-attached observation remains unexplained, and the Chrome row remains uncertified.

## Journal arithmetic

Run `python3 docs/qa/m6-c/reconcile.py`. It reads the retained raw records and derives counts, form order, block counts, rates and transition intervals independently of product modules. Its browser-clock ranges cannot calibrate physical scanout or input latency.

## Evidence naming

- `before-*`: unchanged product code at 702; only the deliberately failing new test was added before product repairs.
- `after-*`: repaired build. `after-chrome-final-records.json` includes both the preserved original run and later shape/A lifecycle-probe run.
- `unresolved-*`: native tab-switch attempts with no confirmed hidden/blur delivery; explicitly open.
- `preliminary-*`: ineffective test actions; excluded as positive evidence.
- `seeded-*`: accepted-state presentation checks, measured at 1200 × 727 despite ineffective viewport requests. Filename suffixes were corrected to avoid a false 320 px claim.
- `safari-library.*`: library render only, followed by an unreliable native activation bridge; no Safari journey pass.

Actual dimensions and active-element markup are in browser-captures.json. Screenshot dimensions and DOM measures, rather than attempted commands, determine what each capture supports. Native app AX snapshots may omit offscreen text; a truncated AX line is not a product-copy truncation finding.
