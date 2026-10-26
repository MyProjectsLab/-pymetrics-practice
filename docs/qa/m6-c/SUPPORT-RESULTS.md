# Referenced M6-C matrix — qualification results

No row is certified. Stable version coverage attaches only to an actually qualified build; this evidence does not establish a supported minimum or automatic future-version coverage.

The [founder instruction referencing the “founder-approved” matrix](codex://threads/01a0fafb-a94f-77a3-91f0-af8dcbc47745) authorizes bounded M6-C work. Its opening turn is `01a0fafb-b2a9-7990-8433-467bab06cf61`. A separate approval of each row/version rule was not located; the [readiness plan](QUALIFICATION-PLAN.md) retains its “approval required” heading. This evidence certifies no row.

| Referenced matrix environment | Available evidence | Status / missing evidence |
|---|---|---|
| Windows 11 + Chrome + physical keyboard + 60 Hz | Accepted development fixtures only | Blocked: no Windows device. Native journey, lifecycle, physical timing and accessibility open. |
| Windows 11 + Edge + physical keyboard + 60 Hz | Accepted development fixtures only | Blocked: no Windows device. All native/physical qualification open. |
| Windows 11 + Firefox + physical keyboard + 60 Hz | Accepted development fixtures only | Blocked: no Windows device. Native journey, lifecycle, physical timing and NVDA open. |
| Apple Silicon / macOS 26 + Chrome + physical keyboard + 60 Hz | Prior Chrome 154.0.8037.93 render/journals and focused repairs. [Chrome 154.0.8037.95 diagnostic and physical L1](L1-INVESTIGATION.md): physical built-in keyboard self-attested, 60 Hz setting pictured, trusted hidden events captured in library control, warm-up and after 12 scored trials; matching Stop invalidations. | Partial; observed physical L1 switches were handled, but the earlier debugger-attached valid run remains unexplained. Full chain, five-drill distribution, other lifecycle cases, physical timing and accessibility remain open. No row certified. |
| Apple Silicon / macOS 26 + Safari + physical keyboard + 60 Hz | Safari 26.6.2 (21624.5.1.11.3), native library render | Partial; input bridge activation unreliable. Native journey, lifecycle, physical timing and VoiceOver open. |
| Additional 120 Hz per OS | No physical measurements | Blocked; no high-refresh qualification claim. |
| Real iPhone / Safari, content only | No real device | Blocked. Chrome viewport checks do not substitute. |
| Real Android / Chrome, content only | No real device | Blocked. Touch-only start gate not newly qualified. |
| NVDA + Windows Chrome / Firefox | No Windows/NVDA device | Blocked. DOM/AX semantics do not prove speech. |
| VoiceOver + Safari, non-timed | No completed speech journey; unreliable native control bridge | Open. No VoiceOver claim. |

The 768 × 600 minimum, native keyboard requirement, content-only mobile boundary and unqualified remote/virtual/assistive timed-input boundaries are unchanged. 320 px content and browser zoom checks are scoped to the measured screens in browser-captures.json; the full all-state matrix remains open. Founder approval is required before any support boundary, candidate meaning or timing/validity policy change.
