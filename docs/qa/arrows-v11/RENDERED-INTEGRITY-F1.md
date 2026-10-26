# Arrows V1.1 rendered-symbol integrity repair

## Identity and scope

Parent: `12b078dffb5490ec300d3ba559bfbefa9e2ee5d4`. This repair changes only the V1.1 onset display guard. The independent parent audit reproduced two noncanonical rows that were recorded as canonical: a hidden SVG path and a mirrored enclosing SVG. Its raw reproduction and full verdict are at `/private/tmp/arrows-v11-independent/AUDIT-12b078d.md`.

The guard now checks effective visibility and paint on each SVG path and its containing SVG, symbol, and stage. It rejects hidden, transparent, clipped, masked, filtered, dashed-away or transformed symbols before recording `stimulus_presented`. The existing canonical path, stroke, color, cue and five-position checks remain. Historical V1.0 rendering and frozen contracts are unchanged.

## Developer verification

- TypeScript build and production build passed. The focused Arrows browser unit file passed 30 tests. Lint passed with three inherited warnings in other files.
- A fresh production Chromium probe admitted the untouched first row (`presented=1`). Five modified rows were rejected before onset (`presented=0`, `invalidReason=viewport`): path `display:none`, mirrored SVG, path opacity zero, mirrored symbol container, and a dashed-away path. The two original audit failures are included.
- The raw production probe, output, screenshots and roots are at `/private/tmp/arrows-v11-f1-evidence/`. The probe uses scripted browser mutation and input; it does not certify natural display behavior, physical devices or accessibility support.

An independent exact-SHA audit is required. Founder acceptance, full mock, device/browser/accessibility qualification, deployment and release remain open.
