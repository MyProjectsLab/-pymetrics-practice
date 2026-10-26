# Lengths V1 support qualification status

Product SHA `fc7346fb3be89bfa0d1846b17f798ea4fe6d4925`: standalone development has a whole-game audit at its parent and a focused independent PASS closing the sole F1 blocker at this SHA. This is **not** browser/device/accessibility certification.

| Area | Current evidence | State |
|---|---|---|
| Headless Chromium production journey | 96 trials, three checkpoints, saved report/history/reload; independent arithmetic and journal reconciliation in the [whole-game audit](/private/tmp/lengths-independent-bdaf29e/AUDIT.md) | Bounded functional pass |
| Held callbacks, recovery, deletion, cross-tab ownership | Independent parent matrix plus [F1 repair audit](/private/tmp/lengths-independent-fc7346f/AUDIT.md) for resolution and neighboring watchdogs | Bounded fault-injection pass |
| Narrow layout and keyboard/pointer semantics | 320/550-pixel disabled Start, 519/520 measured boundary, selected-key hold and synthetic pointer checks; focus/header observations | Bounded automated pass |
| Native Chrome physical input and timing, 200% browser zoom, Safari/Firefox, tablet/touch hardware, native lifecycle, screen-reader speech | No qualifying physical/browser-device matrix evidence | Open |
| Full twelve-game mock | No Lengths mock integration | Open |

Automated input and synthetic timing do not measure hardware latency or certify natural lifecycle delivery. The open rows must be completed or explicitly excluded from a future support claim before deployment/release. This status record preserves the gates while development continues on the remaining games.
