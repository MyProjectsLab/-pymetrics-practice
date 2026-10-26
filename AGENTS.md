# Assessment Practice repository instructions

## Authority

Read these files completely before product implementation:

1. `docs/specifications/ASSESSMENT_PRACTICE_MASTER_STRATEGY.md`
2. The founder-approved specification packet for the game or shared subsystem being changed.
3. `docs/specifications/ASSESSMENT_PRACTICE_STOP_SPECIFICATION_V1_1.md` for any Stop-related work.
4. `IMPLEMENTATION_TRACKER.md` for status and open gates.

The master strategy is binding for product scope and claims. A game specification is binding within its approved scope. The founder's newer workflow delegation below supersedes the earlier per-game approval procedure; it does not change substantive game rules. Escalate a substantive conflict with a direct founder decision.

## Founder delegation for completing the product

On 2026-10-05 the founder instructed Codex to carry the Assessment Practice product through the full process, including specification work, coding, verification, separate audits, and completion of all twelve Practice games, the full mock, basic reports, and the three approved Advanced Training loops. The founder does not want to relay prompts or grant a new routine implementation approval for each milestone. This direct instruction replaces the earlier per-game approval workflow below where that workflow would otherwise stop progress.

The founder subsequently confirmed authorization for Codex to code **all twelve games through deployment** without another routine implementation or deployment permission request. This authorizes preparing, pushing and deploying the qualified product when the applicable repository, privacy, accessibility, browser/device and operational gates are met. It is not a claim that those gates have already passed, and it does not by itself activate optional analytics or mark the product publicly released.

On 2026-10-09 the founder narrowed the gameplay-design delegation: use the captured JobTestPrep game as the **default observable gameplay contract** for each game. Match its demonstrated number and order of rounds, choices, starting state, controls, feedback, ending rule and result arithmetic wherever the saved video, screenshots or guide establish them. Check reliable public Pymetrics/Harver evidence as context and record any conflict; neither an unsupported assumption about the real provider nor a desire to be different overrides the observed reference. Any proposed material gameplay departure, even one judged to be an improvement, requires the founder's explicit approval **before** it is frozen or coded. The prior permission to author packets independently does not approve such departures. Preserve the Master Strategy's original code, wording, artwork, stimuli, form generation and independent descriptive scoring; do not copy proprietary assets, strategy text or employer models, and do not claim exact provider equivalence.

The founder additionally requires a visual-reference check for **every game**, including games already coded before qualification. Inspect all available saved gameplay videos and images before specification or code, and compare the actual played screen with the candidate implementation at comparable viewport and scale. Record stimulus size, color, shape, feature dimensions, spacing, position, contrast, display duration, transitions, and whether examples or scored stimuli appear together or separately. A mechanics or numerical PASS does not establish visual or perceptual fidelity. Record first-person accounts, including Pietro's, as valuable experience evidence without treating them as independent proof of exact provider artwork or rules. Resolve material visual or difficulty differences before claiming fidelity; use original assets.

- For a game without a frozen packet, author a complete, original, versioned game packet first. Review its mechanics, events, scoring, accessibility, claims, edge cases, and acceptance fixtures independently before coding. Include a source-by-source fidelity table comparing the packet with the saved gameplay video, screenshots and guide; label unobserved mechanics and any proposed departure. Do not freeze or implement a material departure until the founder approves that specific difference. Record the packet as **agent-authored under founder delegation** unless the founder separately approves it, and preserve later versions; do not silently change a packet to make code pass.
- Implement the packet in bounded milestones, run proportionate deterministic and real-browser checks, commit locally, and arrange a separate read-only exact-SHA audit. Repair demonstrated defects and repeat the audit at each changed SHA. Continue to the next approved-scope milestone without waiting for the founder to copy prompts.
- Continue working across scheduled task turns, with one concise daily status update. Keep implementation, developer tests, independent audit, founder acceptance, qualification, deployment, and release as separate recorded states. Delegation to work is not evidence of an independent PASS or a founder's personal review of a particular SHA.
- When deployment is ready, verify the exact artifact, environment, configuration and required gates, deploy under this authorization, and record the deployed version and result. Do not deploy a known failing or incomplete Public Beta as a completed product; label any bounded private preview honestly. Keep public release and optional analytics activation as separate decisions and states.
- Escalate only a genuine conflict with a direct founder decision, a material change to the twelve-game/Public Beta scope or claims, a rights/privacy/legal choice requiring the founder, or an external account/operational dependency that cannot be resolved from the workspace. Do not pause for ordinary implementation choices already within this delegation.
- Preserve the frozen Stop and Balloons contracts. New packets and code must remain within the Master Strategy's product, evidence, originality, accessibility, and privacy boundaries. This delegation does not itself activate analytics or establish release qualification.

## Delivery workflow (founder direction, 2026-10-07)

The [workflow record](docs/qa/DELIVERY_WORKFLOW.md) defines the current priority, brief, failure ledger, and handoff format. Apply these rules to new work and to the current Arrows repair:
- **Reference transcription gate:** Before a new or materially revised game packet, record and independently verify source-to-packet fidelity, obtain the founder’s explicit approval for each material gameplay departure before freeze or code, and feed milestone playtest evidence into the existing exact-SHA audit under [the reference transcription and gameplay fidelity gate](docs/qa/DELIVERY_WORKFLOW.md#reference-transcription-and-gameplay-fidelity-gate).

1. **One complete milestone per independent audit.** Write a bounded outcome and acceptance criteria before coding. Implement and developer-check the full related transition, including visible behavior and durable state, before submitting one exact-SHA read-only audit. Group all findings and adjacent edge cases into one repair; do not submit a sequence of one-line fixes and separate audits. Keep a repair's scope small enough to review as one coherent design.
2. **Architecture gate after repeated failure.** Count independent blocking product verdicts by milestone, not harness errors or test reruns. Allow at most two repair submissions after the first failed audit. If the third audited submission still fails, pause further patching of that milestone, document the root cause and an alternative design, and get a separate design challenge before another implementation. Three consecutive blocking product verdicts across milestones trigger the same workflow review. Continue unrelated work; do not halt the entire project or require routine founder approval.
3. **Atomic authority at the visible action.** Never rely on a positive authority read that another actor can invalidate before the action. Recheck and perform the visible action inside one ordered boundary with competing mutations, or use an equivalent atomic revision claim. A second asynchronous read alone does not close a race. Before commit, test both race orders, cancellation, late callbacks/writes, deletion or replacement, and visible versus durable status.
4. **Finish active games before opening packets.** Complete standalone Arrows and Lengths, including reports/history, independent development audit, and applicable qualification, before authoring another game packet. Existing Digits, Cards, Easy or Hard, and Money Exchange 1 drafts are parked. External physical/device gates must be recorded truthfully, not silently treated as passed.
5. **Bound each work cycle without stopping the project.** Choose one coherent deliverable for a run, state its done criteria, finish its developer checks and handoff, then continue to the next available work or scheduled wake. If an audit is pending, wait once for a bounded result and work on independent preparation; avoid idle polling and hourly status chatter. Send the founder the separate daily update and material blockers.
6. **Route models by judgment needed.** Use a strong model for coordination, architecture, race debugging, and independent functional audits; a capable workhorse for implementation; a cheaper model for deterministic inventories, hashes, checklists, and simple fixes with explicit tests. A checklist-only pass cannot certify behavior. Do not spend frontier-model effort on repeated routine document reads.
7. **Use short briefs and shared results.** Never relay whole chat outputs into another chat. A task brief names the task, exact base/target SHA, done criteria, source/evidence paths, and exclusions. Agents record results in shared QA files or an external read-only audit path and return only the verdict, path, and next action. Do not paste long logs into coordinator context.

## Scope control

- Do not implement a game without a complete versioned packet. For existing frozen packets, follow their approved scope. For remaining games, the founder's delegation above authorizes an agent-authored packet and implementation after independent specification checks; do not describe those packets as individually founder-reviewed.
- Stop V1.1 received its separate implementation instruction and is already implemented. Further in-scope development may proceed under the delegation above while preserving its frozen rules.
- Do not invent unsupported claims or proprietary mechanics. Specify the observed gameplay mechanics, counts, timing and controls from the reference evidence; define original stimuli, form data, descriptive scoring, drills where approved, report meaning and accessibility behavior explicitly in the game packet, with evidence and acceptance fixtures. Escalate any material gameplay difference to the founder before freeze or code.
- Keep setup, implemented, developer-tested, independently audited, founder-accepted, qualified, deployed, and released as separate statuses.
- Make the smallest complete change needed for the requested stage.

## Product boundaries

- Before specifying or materially changing **each** game, check reliable public Pymetrics/Harver information first. Then inspect the founder's saved JobTestPrep gameplay video, screenshots and guide, comparing the actual round sequence, error/ending rule, controls, timing and result screen; where the guide and footage differ, use the visible footage and record uncertainty. Also check dated first-person Reddit or other forum feedback for candidate confusion, usability and device issues. Treat those reports as anecdotes, never as proof of exact mechanics, probabilities or employer scoring. Use the captured JobTestPrep gameplay as the default wherever its behavior is observable; keep the candidate flow simple and all wording/assets original. A fidelity table and explicit founder approval for each material difference are required before freezing or implementing a packet. Do not reinterpret originality as a reason to change observed round counts, number of choices or starting values.
- Public Beta 0.1 is local-first candidate preparation, not a validated employment assessment.
- All twelve games require Practice Mode and basic descriptive reports. Advanced Training initially applies only to Stop, Balloons, and Towers.
- Reports may describe in-product accuracy, timing, consistency, choices, moves, outcomes, and differences between Assessment Practice forms.
- Never add proprietary scoring, employer pass thresholds, employer-fit or personality conclusions, hiring predictions, candidate rankings, unsupported percentiles, AI psychological interpretation, or guaranteed improvement.
- Candidate invitations are authoritative. Employer content must not change mechanics, scores, routing, or conclusions.
- Use original or rights-cleared code, copy, stimuli, layouts, forms, and assets. Record provenance where required.

## Engineering boundaries

- Keep trial timing and input resolution client-side and independent of network requests.
- Use one monotonic high-resolution clock within a timed session. Follow the approved specification for render confirmation, lifecycle events, and invalidation.
- Treat event records, scoring versions, form exposure, storage migrations, and result snapshots as versioned data.
- Do not add analytics before the applicable consent, payload, retention, and founder-approval gates are satisfied.
- Do not add accounts, cross-device sync, server-side candidate storage, or payments to Public Beta 0.1 unless the founder changes the approved scope.
- Preserve accessibility semantics and test keyboard behavior. Modified forms must be labeled and must not be silently compared with standard forms.

## Quality checks

Before handing off a code change, run the relevant subset of:

```sh
npm run lint
npm test
npm run build
```

For timing-sensitive work, add deterministic unit fixtures plus real-browser checks against the approved browser/device matrix. A jsdom test does not validate browser timing accuracy.

## Governing-document integrity

Preserve existing frozen specification files byte-for-byte unless the founder explicitly requests a revision. The full-product delegation above authorizes **new** agent-authored versioned packets and versioned addenda for unresolved rules; freeze each accepted implementation identity and do not rewrite it silently. When copying or validating a frozen governing document, compare its SHA-256 hash with the recorded source.
