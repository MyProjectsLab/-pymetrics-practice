# Adversarial acceptance matrix — written before production edits

Target: 88b7ec53228d258f0048b27c1ca98d7cb76bf092; parent bcf319f05f8f371e39688ee51fc2fa8b7b6c1caa. Scope: R1/R2 only. Developer evidence; independent audit and founder acceptance required.

| Case | Attack / ordering | Required oracle |
|---|---|---|
| R1-D | Saved drill deleted while a chain snapshot is pending or failed | Deleted journal absent from memory, queue and durable store; chain retired; no retest UI, including reload |
| R1-T | Invalid retest attempt deleted while pending or failed | Attempt stays deleted; dependent chain retired; no retry eligibility |
| R1-B | Baseline deleted while pending or failed | Baseline stays absent, dependent chain retired; unrelated records and remaining attempt journals retained |
| R1-A | Delete all while pending or failed | Empty installation/history, no queued replay or later reactivation |
| R1-order | Automatic / explicit retry before deletion, after deletion, and a held write finishing after deletion | Deletion wins in every ordering, including the storage transaction; stale snapshots rejected |
| R1-other | Delete unrelated record during failed save | Unsaved chain and queue survive; warning remains truthful; later retry still saves it |
| R1-retired | Replay an old snapshot after deleting a retained attempt from an already retired chain | No journal resurrection or active-chain pointer |
| R2-lifecycle | Insert hidden, pagehide, freeze, resume, pageshow before completion without derived invalidation, in baseline and retest | Admission rejects result and dependent chain; report/progress/routing/retest excluded; source/exposure unchanged |
| R2-settings | Change binding, visual, timing, device, accessibility, zoom/panel setting during protection | Same rejection; no repair of source bytes |
| R2-focus | Blur >1000 ms, unmatched blur lasting >1000, contradictory duration | Reject; 999/1000 ms and repeated brief blur controls remain valid |
| R2-viewport | Below 768×600 during protection; valid boundary control | Reject undersize; retain boundary |
| R2-timing | Severe or two non-severe observations, warm-up second anomaly; tail evidence | Reject; genuine single non-severe scored note and one warm-up restart remain valid |
| R2-input | Three anticipatory, three scored fixation, five scored wrong, ten extra, held/repeat scoring evidence | Reject at specified boundaries; ignored repeat alone and permitted input-note controls remain valid |
| R2-interval | Evidence before protection versus during warm-up/scored/completion tail | Apply protected interval correctly; no blanket ban on permitted pre-start changes |
| B1 | Baseline/replay/retest pre-onset, exposed controls, deleted draft then form reuse | 4/6/4 versus 3/5/3 available; later exposure preserved |
| B2 | Setup/exposure identity contradictions and intact no-response result | Reject contradictions, preserve bytes; accept intact |
| B3 | All five drills, corrupt completion/timing, genuine timing/extra notes | Only intact/legitimate notes unlock retest |
| B4 | Same label different codes; same code different labels | Canonical history and comparison grouping |
| B5 | Two failures, auto retry, explicit retry, ordered drain, reload before success | Truthful pending/failure warning; same-tab buffer retained; only durable state reloads |
| N1 | Intro, actual Start/Back/Restart, reload | Zero intro starts; distinct linked attempt IDs; no invented reload starts |
| Journey | Bounded real guide → warm-up → 80 trials → report → reload → deletion | Original report recovered; exposure marker remains |

Run lint, all tests, both manifest checks, TypeScript/build, real IndexedDB/browser probes and normal completion. Retain failures before repair and case-level raw outputs afterward. Native lifecycle/physical timing, full supported browser/device matrix and accessibility certification remain limits. N2 abandoned-tab claims and S46 precision stay open. No specification/mechanic/scoring/routing/form/claim changes, M6, push or deployment.
