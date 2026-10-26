Read-only readiness plan retrieved from chat `top M6-C Qualification Readiness`, turn `01a0faf5-a1e3-7250-80bf-c6d273a7941b`. The current M6-C instruction authorizes qualification under this plan. This retained copy is not a frozen specification revision.

The [exact founder instruction in **Qualify Stop M6-C support**](codex://threads/01a0fafb-a94f-77a3-91f0-af8dcbc47745), opening turn `01a0fafb-b2a9-7990-8433-467bab06cf61`, message `01a0fafb-b595-7052-94f9-e6b3e758d31d`, says to work under the “founder-approved M6-C support matrix and qualification plan.” That authorizes bounded qualification. No separate approval enumerating each proposed row or the version policy was located; this link must not be read as a row-by-row approval record or as certification of any environment.

## Recommendation

Proceed with **bounded M6-C qualification**, followed by repairs only where qualification exposes a reproducible defect. Stop remains a **development slice**, not a released game.

### Verified starting state

- Branch: `main`; index and working tree clean, including untracked files.
- HEAD: `702a0fb956de2d76113f3a58c3474c9b24af3946`.
- Parent: `f85018ce9c06d98a8813110a4079a0034bfc25b4`.
- Both governing documents match approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`.
- M5 and M6-A are founder-accepted development milestones.
- The later founder message in **Coordinate Assessment Practice** also accepts the disabled M6-B candidate at HEAD and approves **page/document-session** analytics semantics. The tracker has not yet incorporated those decisions.
- M6-B’s independent verdict remains **focused F1 PASS**, not a whole-M6-B qualification PASS. Collection remains disabled.

No files were changed, tests rerun, or deployment/analytics settings altered during this review.

## 1. Proposed support matrix — founder approval required

Approve these **five desktop combinations** for qualification:

| OS/device | Browsers | Physical setup |
|---|---|---|
| Windows 11 laptop/desktop | Chrome, Edge, Firefox | Physical built-in or wired USB keyboard; 60 Hz display |
| Apple Silicon Mac on macOS 26 | Safari, Chrome | Physical built-in or wired USB keyboard; 60 Hz display |

**Version policy:** qualify the stable browser build installed when testing begins; record its complete version and OS build. That tested build becomes the initial supported minimum. Do not claim older-version coverage or automatic qualification of later releases.

Additional boundaries:

- Timed viewport: **at least 768 × 600 CSS pixels**, as already approved.
- Add a **120 Hz timing/lifecycle check on each OS** before advertising high-refresh support. Other refresh rates remain unqualified.
- Use ordinary native browsers, not headless Chromium or Playwright WebKit as substitutes.
- Non-timed screen-reader coverage: **NVDA with Windows Chrome and Firefox; VoiceOver with Safari**.
- Content-only mobile checks: one real iPhone/Safari and Android/Chrome, plus 320 CSS-pixel responsive checks. No timed touch gameplay.
- Virtual machines, remote desktops, mobile keyboards and latency-affected assistive timed input receive no standard-timing qualification.

This is a proposed support boundary, not evidence that these environments already pass.

## 2. S01–S75 evidence map

### Reusable evidence anchors

Each linked report identifies its full exact SHA and evidence limits.

| Key | Evidence |
|---|---|
| F | M1 at `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`: [form provenance](/Users/renzo/Documents/Assessment%20Practice/App/docs/STOP_FORM_PROVENANCE.md). Standard manifests, generator and public stimuli remain unchanged. |
| T | [M2B-2 audit — `9127249`](/private/tmp/stop-m2b2-audit-9127249/AUDIT.md): input, timing adapters, exposure and interruption development evidence. |
| R | [M3 correction audit — `d386d5b`](/private/tmp/stop-m3-b2r-audit-d386d5b/AUDIT.md), with its identified earlier scoring/recovery evidence. |
| D | [M4 repair audit — `0c5f984`](/private/tmp/stop-m4-repair-audit-0c5f984/AUDIT.md), with the earlier routing/drill/comparison evidence it preserves. |
| P | [Whole-M5 audit — `33400f5`](/private/tmp/stop-m5-audit-33400f5-20261001/AUDIT.md) and [requirement map](/private/tmp/stop-m5-audit-33400f5-20261001/REQUIREMENTS.md). |
| A | [M6-A audit — `1c716a5`](/private/tmp/stop-m6a-independent-1c716a5/AUDIT.md): S46, claim leases, initial-frame watchdog and pre-start access. |
| B | [M6-B audit — `f85018c`](/private/tmp/stop-m6b-independent-f85018c/AUDIT.md), followed by [focused F1 PASS at HEAD](/private/tmp/stop-m6b-independent-702a0fb/AUDIT.md). |

**Reuse means preserving specific sound evidence, including sound checks within historically failed audits. It does not transfer an old verdict to HEAD.** M6-B changed UI composition; its independent audit tested that integration. Engine, scoring, router, storage and manifests remain unchanged from M6-A.

| Acceptance IDs | Reuse | Genuine remaining qualification |
|---|---|---|
| S01–S02 | T/R/D/P/A/B journey and copy evidence | One integrated journey per supported desktop combination; complete rendered-copy review. |
| S03–S05 | T preparation and binding checks | Native keyboard/browser confirmation; self-declaration remains distinct from hardware detection. |
| S06 | T/A start gating | Real touch-only devices: Start blocked and untimed content usable. |
| S07–S14 | T input/default-action fixtures and browser probes | Physical Space, remapping, held/repeat, shortcuts and ordinary-page scrolling across the matrix. |
| S15–S18 | T timing/M2B-02; A initial-frame handling | Physical presentation/input measurement and native browser timing. |
| S19–S20 | T warm-up and live-canvas evidence | Observe during the new native journeys; no separate repeated fixture campaign. |
| S21–S24 | F standard forms; D drill validation | Retain mathematical checks. Close S24’s outstanding reference-sequence originality review. |
| S25–S26 | P durable exposure; A leases/onset races | Native exit, suspension and recovery composition on supported browsers. |
| S27–S34 | R and its earlier independent arithmetic, quartile, denominator and narrative oracles | Reuse arithmetic; reconcile newly captured native journals without repeating exhaustive sweeps. |
| S35–S38 | T/P/A delivered-event logic | Native tab switch, minimize, blur, lock, sleep/wake, navigation and restoration. |
| S39–S43 | T/R/P/A anomaly, input, settings and integrity fixtures | Browser/device delivery and observable setting changes; preserve exact thresholds. |
| S44 | R report fixtures; P recovery | Accessibility and responsive review of every report state. |
| S45, S47 | D routing and maintenance oracles | Reuse unchanged rules. |
| S46 | A strict comparator and historical-router PASS | Closed within accepted development scope; no repeat precision audit. |
| S48–S52 | D drills/reservations/exhaustion; P/A later integrity work | Native drill timing and interrupted-run recovery; distribute five drill variants across the matrix. |
| S53–S54 | D comparison arithmetic; P compatibility/authority | Native comparison display, speech behavior and lifecycle return. |
| S55–S60 | P persistence/deletion/temporary-mode matrix; A leases | Native IndexedDB, cross-tab and restore behavior on newly supported browsers. |
| S61–S62 | F assets; T/D/P profile behavior | Contrast, non-color distinction, actual high-distinction play and labeling. |
| S63 | Existing registries/router/report evidence | Final HEAD-wide entry-point/content check for absent extended-time functionality. |
| S64 | Targeted T/P/A keyboard checks | Complete non-timed keyboard and native screen-reader journey. |
| S65–S67 | Partial responsive/resize/motion evidence | All content at 320 px and 200% zoom; minimum canvas; native resize and OS preference changes. |
| S68–S69 | R/P report recovery; T/A technical recovery/watchdog | Supported-browser recovery UI and accessible error paths. |
| S70–S71 | B default-off, consent, payload and local purge evidence | Privacy approval and provider operational proof remain open; no M6-C closure. |
| S72–S73 | R/P reproducibility and history separation | Reconcile fresh native records; inspect accessible history/progress presentation. |
| S74–S75 | Partial copy review and provenance records | Complete claims, rights, originality and dependency-license review. |

## 3. Minimum new qualification work

### Native lifecycle and physical timing

For each desktop combination, complete one ordinary **guide → baseline → assigned drill → unseen retest → comparison → history/reload** journey using the production build and native timers. Cover all five drills across those journeys; use focused checks for distinct timing/reset behavior.

Retain:

- Exact commit/build, browser/OS/device, keyboard, display refresh rate, viewport and zoom.
- Raw local journals, independent arithmetic reconciliation and screenshots/video.
- Explicit labels distinguishing ordinary operation, seeded states and injected faults.

Measure physical stimulus onset/offset using an external high-speed camera or photodiode setup. Measure keyboard/input latency with an appropriate physical reference; human reaction speed alone is not a latency calibration. State measurement resolution and uncertainty. DOM/rAF confirmation and screen recordings alone cannot establish physical scanout.

Apply the existing timing rules, including the approved **`max(response resolution, confirmed offset)`** transition anchor. Do not invent new millisecond tolerances.

Native lifecycle checks must include:

- Brief and long blur, tab hiding, minimization, screen lock and sleep/wake.
- Back/forward restoration and browser suspension/discard where available.
- No restoration of an interrupted timed run as valid.
- Comparison open during other-tab prerequisite deletion, including suspended/occluded return.

For C6/C7, retain the accepted rendering-cycle boundary and its lack of a wall-clock guarantee. Record native event/paint ordering; unresolved behavior blocks qualification of that environment rather than silently strengthening the contract.

### Keyboard, accessibility and responsive content

Inspect every non-timed screen, including temporary results, storage errors, deletion confirmation, exhausted inventory, recovery and unavailable comparison.

Check focus order/visibility, headings, labels, announcements, keyboard table access, remapping and exit routes. Native speech must not repeatedly announce healthy comparison polling.

Test **200% zoom separately from 320 CSS-pixel reflow**. For the WCAG 2.2 AA claim, include the equivalent 320-pixel reflow condition at 400% from a 1280-pixel viewport. Data-table exceptions do not excuse clipped surrounding copy. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).

At zoomed sizes below the timed minimum, the correct result is accessible preparation plus the approved size warning—not a smaller timed canvas.

Complete documented contrast checks for text, controls, focus and stimulus markers; inspect forced colors/high contrast, reduced motion and the required light/dark/high-contrast asset presentation. The existing provenance document explicitly leaves these unverified.

### Claims and provenance

Review rendered screens and source strings for:

- Invitation authority, independence and development/beta status.
- Descriptive task results, uncalibrated-form warning and non-causal comparison.
- No trait, employer-fit, pass, prediction, guarantee or proprietary-equivalence claims.

Extend provenance beyond the five SVGs: strings, layouts, reports, standard/drill generators, code, shipped dependencies and any fonts/assets. Record versions, origins, licenses and required notices. Complete the explicitly outstanding comparison against reference sequences; unavailable reference evidence remains an open gate.

## 4. Keep these work categories separate

| Category | Disposition |
|---|---|
| **Product defects requiring code** | This planning review establishes no new reproducible M6-C defect. Repair only demonstrated failures in the checks above. Missing qualification evidence is not itself proof of faulty code. |
| **Real-device/browser tests** | Timing, native lifecycle, physical input, screen readers, zoom/reflow, contrast and new-browser persistence behavior. |
| **Founder decisions** | Approve support/version matrix, high-refresh boundary, visual acceptance and physical-measurement protocol. Approve any candidate-meaning change before implementation. |
| **Privacy/analytics activation** | Notice, withdrawal treatment, enums, L1 response, provider logging, rate limits, backup/export expiry, monitoring and restore rehearsal remain open. Page-session meaning is already approved. |
| **Stop completion gate** | All applicable S01–S75 evidence, provenance, accessibility and supported-environment qualification, then independent review and founder acceptance. |
| **Public launch gate** | All twelve Practice games, full mock, descriptive reports/history, and Advanced Training for **Stop, Balloons and Towers** remain mandatory. M6-C cannot authorize a Stop-only release. |

Analytics can remain disabled while M6-C proceeds. That does **not** silently mark S70–S71 passed or remove them from Stop’s completion criteria.

## 5. Smallest ordered prompts

Use **Astra High** for timing-sensitive qualification/repairs and the independent verification.

### Prompt 1 — bounded M6-C qualification and necessary repairs

> Starting from clean `702a0fb956de2d76113f3a58c3474c9b24af3946`, verify HEAD/status and follow AGENTS.md. Read both governing specifications, the tracker, the accepted milestone audits and the founder-approved M6-C support matrix and qualification plan.
>
> Complete only the remaining Stop M6-C browser/device, native lifecycle, physical timing, accessibility, responsive, claims and provenance qualification. First record failures against unchanged product code. Reuse accepted exact-SHA evidence after checking affected source/dependency paths; do not repeat accepted exhaustive fixtures merely to repeat them.
>
> Implement only the smallest repairs for reproduced failures within the existing approved behavior. Obtain a founder decision before changing candidate-facing meaning, support boundaries or timing/validity policy. Keep unsupported or unavailable device evidence explicitly open.
>
> Preserve the frozen specifications, forms, scoring, twelve-game Practice scope, full mock and Stop/Balloons/Towers Advanced Training scope. Analytics remains disabled; do not change its activation configuration or resolve privacy policy through implementation.
>
> Retain a per-ID S01–S75 evidence map, before/after reproductions, exact source/build/environment identities, raw evidence and limitations. Run relevant lint/tests/build after code changes. Update current status without rewriting historical audit verdicts. Return the final commit SHA and remaining gates. No push, deployment or release.

### Prompt 2 — independent exact-SHA verification

> Independently review the submitted M6-C SHA against its named base, read-only. Verify clean status, complete diff, governing hashes and source/build/evidence identity. Treat developer results as claims.
>
> Reuse sound prior evidence only where the delta cannot affect it. Independently reproduce each repaired defect and inspect the genuinely new native-browser/device, physical timing, accessibility, zoom/reflow, claims and rights evidence. Perform fresh checks where necessary to support those conclusions; do not replace physical or native evidence with synthetic events or headless tests.
>
> Reconcile S01–S75 individually as supported, partial, failed or blocked, with exact evidence and limits. Preserve the C6/C7 rendering-boundary limitation. Keep S70–S71, privacy/provider activation, founder acceptance, deployment and public launch separate.
>
> Return an exact-SHA verdict for the submitted M6-C scope, actionable defects and remaining gates. Do not edit product files, enable analytics, deploy or claim Stop or the twelve-game beta released.
