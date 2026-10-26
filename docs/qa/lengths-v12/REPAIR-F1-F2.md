# Lengths Mouth V1.2 grouped paint and Space repair

The first independent product audit **failed** at `a988789e5d62442aa3857361fc8ce885d19f7a8d`; see [the read-only audit](/private/tmp/lengths-v12-independent/AUDIT-a988789.md). This repair addresses both blocking findings and its adjacent history observation. It is developer evidence only until a separate exact-SHA re-audit.

| Finding | Grouped change | Developer check |
|---|---|---|
| F1: invisible or altered SVG paint could earn factual presentation | Check effective fill/stroke opacity, filters and other paint alterations on the SVG and ancestors; verify face/cross positions, not only widths; require the round mouth cap and undashed, opaque stroke. | A production-browser style fault hiding the mouth with `stroke-opacity:0` stopped before any `face_presented`. A separate `filter:opacity(0)` stage fault also stopped at zero presented. A healthy run with a Space binding advanced through five trials. Both temporary fault styles were removed from the candidate. |
| F2: Space binding suppressed native readiness button activation | Setup key checking intercepts selected keys only on noninteractive targets. A key still needs a fresh press/release for readiness. | In a production browser, remapping Short to Space, checking both keys, then pressing Space on the focused Review readiness button opened the ready screen. Enter remained available. |
| OBS-1: V1.2 history lacked repeat disclosure | Added cross-version repeat and noncomparison text beside the saved list. | Browser history displays the disclosure with existing records. |

Focused TypeScript, 53 old/new tests, lint and production build pass. Lint retains the inherited `App.tsx` hook warning. The first candidate already completed a 90-trial production run and same-origin V1.1 historical review; the repaired build received bounded onset/fault/Space checks. Final artifact browser/device/accessibility qualification, cross-tab UI matrix and founder acceptance remain open.
