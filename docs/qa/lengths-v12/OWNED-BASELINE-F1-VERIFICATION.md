# Lengths Mouth V1.2 owned-baseline F1 repair

The independent audit of `83554383f634be811fbb09757f93dcec2c0253a3` found that a Start-click capture listener could apply `filter: opacity(0)` to `<html>` before the owned document saved its baseline. The face was blank while `face_presented` was retained. Evidence: `/private/tmp/lengths-v12-owned-independent/AUDIT-8355438.md`.

The repair pins the new `<html>` attributes during document construction and compares the host with an independently built canonical attribute set for the selected contrast. It does not learn either paint baseline from the Start callback or a resumed block. The scored form, timing, SVG, input rules, storage and report arithmetic are unchanged.

Developer verification on the repaired production bundle:

- The auditor's native Chrome control still recorded one visible presentation. The same-click `<html>` opacity filter, `<html>` clipping, response-button filter, host filter and host paint containment each stopped before a saved arm or presentation. The fault run retained no attempted result after reload. Bounded probe: `/private/tmp/lengths-v12-owned-repair/probe.mjs` and `probe-results.json`.
- A native Chrome run reached trial 31 through the first durable checkpoint with 30 presented and 30 closed. Deliberate exit at the start of the second block retained a factual incomplete review; this checks the second `enter()` path after the stricter baseline comparison. Probe: `/private/tmp/lengths-v12-owned-repair/continuation.mjs`.
- Five focused V1.2 tests, TypeScript/production build, lint and `git diff --check` passed. Lint retains inherited warnings outside this repair.

This is developer evidence only. A separate exact-SHA read-only audit must decide F1 closure. Physical timing, browser/device/accessibility qualification, founder acceptance, mock, deployment and release remain open.
