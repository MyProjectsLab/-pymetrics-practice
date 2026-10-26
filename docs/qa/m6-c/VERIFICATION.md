# Stop M6-C — partial qualification and narrow repairs

Date: 2026-10-02. Base: `702a0fb956de2d76113f3a58c3474c9b24af3946`, branch `main`, initially clean including untracked files. Candidate: the commit containing this record; exact product source and distribution hashes are in [AFTER-IDENTITY.json](AFTER-IDENTITY.json). This is developer evidence, not an independent audit or founder acceptance.

## Outcome

Three reproduced defects were repaired within existing behavior: history-chart overflow, history/deletion focus and keyboard cancellation, and missing third-party license notices. Relevant lint, 26 component tests and production build pass. **M6-C qualification is incomplete. No desktop combination is certified by this evidence.** Native lifecycle delivery, physical timing, full accessibility, mobile content and originality gates remain open. No push, deployment or release occurred.

Both binding specifications were read completely and match the approved `36a5ef718602ff2c49fa60aaafc59a67d57eedd0` bytes. Their SHA-256 values are recorded before and after. Forms, scoring, engine, validity/timing thresholds, support boundaries and analytics activation configuration are unchanged. The twelve-game Practice, full mock and Stop/Balloons/Towers Advanced Training launch scope remains binding. S70–S71 stay open.

## Authority and evidence reuse

Read AGENTS.md, both specifications, the complete tracker, milestone reports T/R/D/P/A/B and B-F1, the M5 requirement map, provenance records and the [qualification plan](QUALIFICATION-PLAN.md). The plan was retrieved from **top M6-C Qualification Readiness**; its older “approval required” headings are preserved verbatim. The [exact founder instruction](codex://threads/01a0fafb-a94f-77a3-91f0-af8dcbc47745), opening turn `01a0fafb-b2a9-7990-8433-467bab06cf61`, refers to the “founder-approved” matrix and authorizes bounded M6-C work. No separate row-by-row approval record was located. The prior **Coordinate Assessment Practice** founder decision accepts the disabled M6-B development candidate and page/document-session semantics. Neither decision activates analytics.

Retained audit reports and original paths/hashes are under [accepted-audits](accepted-audits/INDEX.json). Historical verdicts are unchanged. Reuse preserves specific sound checks, not an inherited verdict for this commit. [REUSE.md](REUSE.md) explains the path/dependency review. The original production build was reproduced byte-for-byte against the 702 audit's 12-file build manifest ([BUILD-REUSE.json](BUILD-REUSE.json)). No exhaustive form, router, scoring, fault or storage fixture campaign was repeated.

## Environment and method

- Apple M5 / arm64 host; macOS 26.6.2, build 25G83. Chrome 154.0.8037.93; Safari 26.6.2 (21624.5.1.11.3). See [ENVIRONMENT.json](ENVIRONMENT.json) and [DISPLAYS.json](DISPLAYS.json).
- Node 24.13.1, npm 11.8.0; exact installed/locked package versions and package hashes in [DEPENDENCY-IDENTITY.json](DEPENDENCY-IDENTITY.json). No packages installed or updated.
- Production preview at loopback `http://127.0.0.1:5588/`. Native Chrome controlled through the browser extension and native app bridge; Safari through the native app bridge. Chrome displayed the automation debugger indicator. No headless browser, clock override, response generator or lifecycle-event injection was used for these new runs.
- Keyboard actions were tool-dispatched OS/browser inputs. The product's physical-keyboard checkbox is a self-declaration, not independent hardware evidence. Display model/refresh rate, physical keyboard and input latency could not be established. No camera, photodiode, Windows device, iPhone, Android or NVDA surface was available. This host therefore cannot certify the approved physical matrix.
- A test-only helper exposed loopback IndexedDB records through its own visible page. Its retained source is [helper.html](helper.html); it was copied only into ignored preview output and removed by the final production build. It is not a product route. The helper also loaded a separately labeled accepted historical fixture for presentation inspection after both new runs were exported.

## Failures recorded before repair

### F1 — populated history overflows 320 CSS pixels

On unchanged 702 product code, complete a baseline, open history and set 320 × 800 CSS pixels. The 300 px chart exceeded its padded content box; document width was **333 px**. The defect persisted on returning from cancellation. Evidence: `before-chrome-history-populated-320.{png,txt}`, `before-chrome-history-cancel-focus.{png,txt}`, and [browser-captures.json](browser-captures.json).

Repair: give only the history progress SVG `max-width: 100%; height: auto`. Same retained result after repair: viewport and document both **320 px**, with no horizontal body overflow (`after-chrome-history-320.*`). Chart values and accessible text remain unchanged. Later attempts to change viewport for seeded-history checks did not take effect; those captures are labeled desktop and do not count as 320 px evidence.

### F2 — history/deletion transitions lose keyboard focus

On unchanged product code, opening history, opening deletion confirmation and cancelling left the active element at BODY. The full-page confirmation claimed `aria-modal=true` while the page header remained navigable. Evidence: `before-chrome-delete-focus.*`, `before-chrome-history-cancel-focus.*`; the new behavioral regression failed against unchanged product code in [before-focus-tests.txt](before-focus-tests.txt).

Repair: focus the rendered history subview's heading when selection/confirmation changes, make the deletion heading programmatically focusable, remove the inaccurate modal claim, and let Escape perform the existing cancellation action. The confirmation remains a non-modal alertdialog; no focus trap or deletion behavior is added. After repair, heading focus and Escape return are shown in `after-chrome-delete-focus.*` and `after-chrome-cancel-focus.*`. The regression checks that cancellation calls no deletion callback. Existing warning copy and storage semantics are unchanged. Native screen-reader announcement behavior still requires qualification.

### F3 — distribution lacks dependency permission notices

Initial distribution had no accompanying MIT permission notice for bundled React, React DOM and Scheduler. Their package LICENSE files are byte-identical; the build also embeds Vite's module-preload helper. Before evidence: [before-dependency-notices.json](before-dependency-notices.json), original build inventory and installed package licenses. Repair: ship `public/THIRD_PARTY_NOTICES.txt` with the exact React package license and Vite core MIT license, versions and source links. Final build contains the same file bytes. This closes that distribution defect; it does not certify every originality question.

## New observations

### Journeys and journals

1. **Unchanged product:** library → guide → rule → untimed examples → all-three-correct comprehension → device/input check → readiness → 8 warm-up trials → 80 scored trials → complete → report → history. Standard profile / Space, baseline-03. No scored responses were entered. Raw data: [before-chrome-native-records.json](before-chrome-native-records.json). Reloading the repaired build retained the original immutable report.
2. **Repaired product:** selected high-distinction shape accommodation and remapped A before readiness, then completed warm-up/scored progression. Baseline-01. No scored responses were entered. This run also contains the unresolved native tab-switch probe below; do not use its recorded valid status as lifecycle qualification. Final raw data for both runs: [after-chrome-final-records.json](after-chrome-final-records.json).

[reconcile.py](reconcile.py) independently reads the exported events without importing product scoring. It verifies form order, 80 unique scored resolutions, 8 warm-up trials, counts, four blocks, percentages, empty RT sample and the requested `max(resolvedAt, confirmedOffset) + 1200 ms` transition anchor. Both show 0 hits / 60 misses / 20 withholds / 0 false alarms, 25% accuracy and no reported median. Results: [NATIVE-RECONCILIATION.json](NATIVE-RECONCILIATION.json).

The unchanged run's DOM-confirmed visibility was 200.5–209.2 ms; onset delay 1.2–10.5 ms; observed post-resolution intervals 1201.2–1210.5 ms. These are recorded browser-clock observations, not physical scanout or keyboard latency measurements. The zero-response runs do not qualify hit timing, hold/repeat or motor-input latency. No newly completed full drill → retest → comparison journey is claimed.

### L1 — unresolved native lifecycle qualification blocker

Creating a background helper tab did not hide the test tab; that preliminary probe is excluded. Native Chrome tab selection then visibly moved to the helper both during the warm-up break and during a scored interval. The product continued and later saved a valid shape/A result. Its retained journal contains initial `visibility_changed: true` but no hidden event recorded. `after-chrome-lifecycle-records.json`, final raw records and `unresolved-native-tab-switch-*.{png,txt}` preserve the outcome. The event adapter's visibility/blur listeners and timed engine are unchanged from base.

**This is an unresolved failed qualification observation, not a passed lifecycle check and not yet an isolated product-code defect.** The extension/debugger environment may affect page focus/visibility, but this cause was not established. Repeat on the approved physical setup without the browser automation attachment, retaining browser visibility/focus events alongside the product journal. If actual hidden state is delivered and ignored, repair that reproduced defect; if the environment suppresses delivery, it cannot provide qualification evidence. Do not weaken the policy to accommodate the outcome. Native lock, sleep/wake, minimize, brief/long blur, back/forward, discard and suspended comparison-return ordering remain open. Accepted C6/C7 evidence remains bounded to the second rendering cycle, with no wall-clock guarantee.

Post-audit L1 addendum: [the separate unattached diagnostic](L1-INVESTIGATION.md) captured trusted hidden events in Chrome 154.0.8037.95 and matching invalid Stop drafts in warm-up and confirmed scored play. That observation shows event delivery and handling in its diagnostic setup. The 60 Hz display and physical-keyboard input were not attested, so it does not certify the approved Chrome row or explain the earlier debugger-attached valid run. No product defect or code repair was established.

Physical L1 follow-up at clean `a84084a`: the user self-attested MacBook Pro built-in keyboard input and supplied a 60 Hz display-setting screenshot. The [raw physical packet](l1-physical-2026-10-02/RESULT.md) confirms an independent library event-capture control, trusted hidden events during warm-up and after **12 scored trials** were scheduled, and matching Stop hidden invalidations. No delivered hidden event was ignored. This bounded observation does not explain the earlier debugger-attached run or certify the Chrome row; other lifecycle, timing and accessibility checks remain open. No product fix is indicated by this run.

### Accessibility and responsive evidence

- At 320 CSS pixels, captured library, guide, rule, examples, comprehension, preflight, report, deletion and repaired populated history have no horizontal document overflow. Initial live canvas was inspected at 1280 × 800; no trial count/score/progress was exposed. Minimum 768 × 600 gameplay remains a separate open check.
- Actual Chrome **200% browser zoom** was confirmed through native browser UI and retained in `chrome-zoom200-native.txt`; history and report reflowed at 600 CSS pixels. Actual **400%** was confirmed in `chrome-zoom400-native.txt`; the report reflowed at 300 CSS pixels from a 1200 px viewport, with its table in a separate scroll container. This is useful narrow-report evidence; it is not the full 1280→320 protocol across every screen. A preliminary shortcut that did not change zoom is explicitly excluded.
- History now focuses its heading; opening/cancelling deletion focuses the appropriate heading. Guide/readiness native captures show semantic headings and labeled controls; input binding A and the shape-accommodation label were retained. These do not substitute for a complete keyboard or speech journey.
- [contrast.json](contrast.json): 11 calculated light-palette text/focus/marker pairs meet their listed 4.5:1 or 3:1 targets (minimum 5.152:1). The SVGs retain redundant vertical/horizontal markers and distinct accommodated shapes. Forced colors, dark/high-contrast presentation, apparent size, display scaling, native reduced-motion preference changes and full focus-obscuration review remain open.
- Seeded accepted M5 state displayed baseline, retest, detection drill journal and compatible-history comparison with its causal limitation/form warning. Those captures are desktop presentation checks only; they are neither new timed journeys nor new authority-race tests. The imported fixture's origin is documented in [REPRODUCTION.md](REPRODUCTION.md).
- Safari rendered the library with expected headings, buttons, disabled collection and invitation footer (`safari-library.*`). Native clipboard navigation initially timed out; address-field setValue succeeded. Subsequent AX click, observed-coordinate click and keyboard activation did not produce a guide transition. No Safari journey, keyboard, timing or VoiceOver pass is claimed. This input bridge limitation requires a reliable native/manual retest.

## Claims and provenance

See [CLAIMS-PROVENANCE.md](CLAIMS-PROVENANCE.md). Source inspection found no affirmative forbidden trait, employer-fit, hiring, percentile, pass-threshold, guarantee or proprietary-equivalence claim. The numerical `percentile` function computes within-session quartiles, not candidate norms. Rendered sampled copy preserves the approved result limits, invitation authority and uncalibrated-form warning. No extended-time entry point, registry, route or beta promise was found. Direct observed-reference sequence comparison and broader rights/visual acceptance remain open; no reference sequence exists in this repository for comparison.

## Verification and remaining gates

- `npm run lint`: pass, two existing warnings retained in [after-lint.txt](after-lint.txt).
- `npm test -- src/stop/History.test.tsx src/stop/Report.test.tsx src/App.test.tsx`: **26/26**, [after-focused-tests.txt](after-focused-tests.txt).
- `npm run build`: pass after final notice change, [after-build.txt](after-build.txt).
- `python3 docs/qa/m6-c/reconcile.py`: independent retained-journal arithmetic pass. No physical-timing conclusion.
- Source diff whitespace check: clean. The full staged check reports whitespace preserved in verbatim audit/tool output and the copied license notice; those raw bytes were retained.
- Source/build/specification identities, delta restrictions and evidence hashes: [AFTER-IDENTITY.json](AFTER-IDENTITY.json), [EVIDENCE-SHA256.json](EVIDENCE-SHA256.json).

The [per-ID S01–S75 map](S01-S75.md) is authoritative for this handoff's evidence limits. Remaining work: all five approved physical desktop combinations; full native journeys/five drills and lifecycle cases including L1/C6/C7; 60/120 Hz and physical scanout/input measurements; real mobile content checks; complete keyboard/VoiceOver/NVDA, all-state reflow/zoom, OS preferences and recovery checks; reference-sequence originality and founder visual acceptance; independent exact-SHA M6-C review and founder acceptance. S70–S71 and all privacy/provider activation gates remain separate and open. No support claim, timing policy or candidate meaning was changed to close a gate.
