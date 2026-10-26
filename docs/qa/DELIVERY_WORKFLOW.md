# Assessment Practice delivery workflow

Effective 2026-10-07 under the founder's full-product delegation. This file governs work organization, not frozen game mechanics or release approval.

## Reference transcription and gameplay fidelity gate

This gate implements the founder’s 2026-10-09 gameplay direction. It applies before authoring a new game packet or materially revising an existing one, and feeds the milestone and precommit gate below.

Captured JobTestPrep observable gameplay is the default gameplay contract. The Master Strategy continues to govern product scope, originality, accessibility, privacy and claims. Matching observable mechanics does not establish exact current Pymetrics equivalence or authorize copying proprietary content.

### 1. Record the reference before designing

Maintain one reference record at `docs/qa/reference-<game>.md`, or link that path to an existing equivalent QA record rather than duplicating evidence.

Check reliable public Pymetrics/Harver information first, then directly inspect the saved JobTestPrep videos, screenshots and guide. Check dated first-person forum accounts for candidate confusion and usability/device issues; label them anecdotal.

For each material mechanic, record:

| Item | Observed behavior | Source and locator | Evidence status |
|---|---|---|---|
| Stable item ID | Concrete rule or observation | Video filename/time, screenshot, guide page or dated URL | Observed, estimated, conflicting or unknown |

Cover starting state and values; task/stimulus format; number and order of rounds; available choices; difficulty or adaptive progression; controls and timing; feedback and available outcome history; errors and ending rules; result fields and arithmetic.

For every distinct image or animated stimulus, inspect **all** saved screenshots and videos, not just guide text or sampled example frames. Record displayed size at the captured viewport, colors, shapes, component dimensions, spacing and screen position, contrast, exposure duration, and transitions. Distinguish side-by-side teaching examples from the scored presentation sequence. Compare the candidate at a comparable viewport and scale, retain source-frame and candidate-screen locators, and label estimates when pixels or timing cannot be measured. A gameplay or numerical PASS alone cannot close this visual comparison. Apply this check to previously implemented games before claiming visual fidelity or qualification.

Inspect relevant transitions closely enough to establish their behavior. Review all supplied variants and recordings relevant to the proposed contract. Do not treat sampled frames as proof of an unobserved transition, or one run’s counts as proof of a fixed distribution.

Where guide text and footage differ, use the visible footage for the captured-game baseline and record the discrepancy. Record conflicts with reliable provider evidence without silently substituting another contract. Hidden probabilities, employer scoring and unobserved persistence remain unknown; a visible report does not prove what the provider stores. Inaccessible required references are an evidence gap, not a completed check.

### 2. Compare the proposed packet and resolve departures

Extend the reference record with the proposed packet value, packet section, matching acceptance criterion and disposition for each item. Use one row per mechanic rather than duplicating the entire specification.

A material difference includes changes to task format, starting values, round counts/order, choices, difficulty, timing, controls, feedback, information available during play, ending behavior or result arithmetic. A color or visual change is material when it changes a cue, discrimination demand or accessibility. Purely decorative changes are not material.

For each proposed material departure, record its reason and the founder’s explicit approval of that exact difference before freeze or implementation. Reuse an existing applicable approval; routine conforming work needs no new founder permission.

Keep unobserved behavior distinct from observed departures. Define necessary original implementation choices explicitly within existing delegation and subject them to independent packet review; do not present them as provider facts. Resolve material evidence conflicts before freezing or coding the affected behavior.

Use original code, wording, artwork, stimuli, outcome schedules and form generation. Preserve required accessibility and independent descriptive reporting. Do not copy proprietary strategies, personality interpretations or employer scoring. Originality is not a reason to change established gameplay counts, choices or starting values.

### 3. Include fidelity in the independent packet audit

Before freeze or product implementation, the separate read-only specification/numerical audit must check the reference record against the cited sources, the proposed packet and any departure approvals. Author summaries and expected fixture outputs are claims to verify.

The audit must distinguish gameplay fidelity, numerical correctness and implementation-specification readiness. Passing arithmetic cannot compensate for an unapproved gameplay departure, missing material source verification or an ambiguous interaction contract.

Review mechanics, events, scoring, accessibility, claims, edge cases and acceptance fixtures together. Regenerate and independently reconcile forms and fixtures when mechanics change; earlier numerical evidence does not transfer automatically.

Preserve frozen documents and historical results. A substantive revision requires a separately versioned packet or authorized addendum, reviewed identities and explicit treatment of affected forms, reports, storage and integrations. Never rewrite the baseline merely to make existing code pass.

### 4. Use the reference in milestone developer checks

Select one complete bounded milestone under the current priority and work-in-progress limit. Put the reference-record path and applicable item IDs in the existing short brief; retain its exact base/target SHA, done criteria, allowed paths and exclusions.

For a playable milestone, include a bounded production-browser journey through normal play, ending and results. Compare the visible behavior with the reviewed packet and applicable reference items. Record pass/fail, evidence and any untested or out-of-scope items in the existing milestone verification artifact.

For stateful behavior, apply the existing precommit failure matrix: save and report reload, interruption, failed or undelivered writes, retry, cancellation, late callbacks, ownership, deletion/replacement in both relevant orders, and visible-versus-durable reconciliation. Recovery must follow the packet; it does not automatically mean resuming scored play after reload. Include the applicable keyboard, assistive activation, focus and accessibility checks.

Resolve known in-scope failures before committing the audit candidate. A headless milestone verifies its applicable rules and arithmetic and explicitly leaves browser playtesting pending; this gate does not enlarge its scope.

### 5. Feed one independent implementation audit

Submit one complete candidate SHA and its evidence to the existing separate read-only functional audit. The developer playtest is audit input, not an independent verdict or an additional audit stage.

The auditor verifies exact identity, parent, clean state, changed scope and frozen hashes; checks the applicable fidelity items; and independently exercises the existing acceptance checklist. Reconcile visible results with recorded events and durable state, challenge neighboring failure cases, and record what was independently rerun versus carried forward unchanged.

Keep auditor artifacts outside the repository and return the existing concise handoff: exact SHA, verdict and scope, evidence path, limits and next action. Any changed candidate SHA requires its own scoped verdict. Developer checks, independent audit, founder acceptance, qualification, deployment and release remain separate.

### 6. Preserve the existing work cycle and failure circuit breaker

This gate adds evidence to the current workflow; it does not create a second failure counter, extra routine approval or hourly status report.

Apply the Failure circuit breaker below: the first failed candidate may receive at most two repair submissions; a third failed audited submission requires an independent design challenge before further patching that milestone. Preserve the cross-milestone trigger and exclusions for harness errors, unfinished audits and repeated probes. Where fidelity is implicated, recheck the source-to-packet comparison as part of that challenge. Continue unrelated permitted work.

Hourly runs continue one coherent milestone or grouped repair, retaining evidence across wakes. Reinspect sources when evidence, mechanics or a finding warrants it—not simply because another hour has elapsed. Use the existing Model routing and Short task brief and result sections; a checklist-only pass cannot certify behavior. Routine founder updates remain daily, with material completions, failures and required decisions reported separately.

### Cards example: the failure this gate must prevent

The October 2026 Cards draft specified 48 choices, three cards and a zero-token start. The saved JobTestPrep instructions and report establish 80 draws, four decks and a $2,000 starting balance. The report’s deck counts are 12 + 8 + 10 + 50 = 80; its balance reconciles as 2,000 + 4,275 − 2,075 = 4,200. These observed amounts illustrate the arithmetic, not a payoff sequence to copy.

The draft also imposed a separate Next action. None was visible at the sampled choice/feedback points; the exact transition and feedback dwell still required closer inspection. The report’s B/C/A/D positions also show why deck identity must not be inferred from alphabetical screen position.

The original independent audit at `2f99577` passed numerical reconstruction but failed specification readiness on assistive activation, completion-versus-interruption precedence and available outcome history. It did not establish reference fidelity. The later fidelity review blocked the draft before freeze or product implementation.

The corrective lesson is to verify the gameplay contract before investing in its forms, fixtures and implementation. Correct calculations for a different task do not satisfy this gate.

## Current priority and work-in-progress limit

1. Stop V1.3, Digits V1.1, Lengths Mouth V1.1 and Arrows V1.1 have bounded standalone development audit evidence; founder acceptance, environment qualification and full mock remain separate.
2. Revise the Cards draft before freeze or code. Its 48-choice/three-card/zero-start rules conflict with the captured JobTestPrep 80-draw/four-deck/$2,000-start gameplay and have no founder departure approval. Reconcile the saved video and screenshots, regenerate original forms and fixtures, and obtain a separate specification/numerical audit.
3. Keep other new game packets parked until the Cards packet is handed off. Preserve their existing evidence.

Keep at most one implementation milestone and its independent audit active for the same game. Independent preparation may continue only if it does not change the audit target or create another unfinished game packet.

## Milestone and precommit gate

Define one complete outcome and its durable state, when applicable, before editing. The milestone brief must list its exact starting SHA, done criteria, and excluded later work. Before committing, run the relevant deterministic checks and, when the milestone has browser behavior, a bounded production-browser journey. For a stateful or timed path, select the applicable cases from both authority/deletion orders, missing notifications, held callbacks, canceled work, failed/undelivered transactions, late writes, reload, held input, and visible-versus-durable claims. Record which cases are simulated and which use the production browser/IndexedDB. Do not rerun the full suite merely to repeat a passing result.

Submit one complete candidate SHA to a separate read-only functional audit. If it fails, collect **all** blocking findings, reproduce them, test neighboring boundaries, and submit one coherent repair SHA. Each changed SHA needs its own verdict; a scoped PASS never implies whole-game qualification.

## Failure circuit breaker

Count one failure when an independent audit identifies a reproducible blocking product defect. Harness errors, an unfinished audit, and repeat probes of the same SHA do not add failures. The first failed candidate may receive two repair submissions. A third failed audited submission pauses patches to **that milestone**. Record the causal state/ordering model, why prior patches missed it, a replacement design, and adversarial cases; obtain an independent design challenge before another candidate. If three blocking verdicts occur consecutively across different milestones, review the common workflow before submitting more audit targets. Continue unrelated useful work. Founder escalation remains limited to the existing substantive decision and external-access gates in `AGENTS.md`.

The Arrows A12 stale-authority series reached this gate: adding a second read moved the race. The replacement design shares an ordering boundary between Start and deletion through first confirmed onset. Its focused independent audit passed at `097b55a`; whole-game qualification remains separate.

Maintain a compact row for each active milestone; update it after each independent verdict:

| Milestone | Failed audited SHAs | Repair submissions | Current state |
|---|---|---:|---|
| Arrows A12 | `0b9b1e1`, `e25046d`, `e28003f` | 2 before architecture review | Shared-ordering redesign received focused independent PASS at `097b55a`; broader qualification remains open. |
| Arrows V1.1 F1 | `12b078d`, `16383f9`, `fb0c9ac`, `377690d` | 2 before circuit review; static redesign also failed | The static-resource candidate failed on an unowned native closed-shadow host, exposing an unproved ownership premise in the general-document scanner. Independent architecture review accepted a dedicated same-origin entry document with fresh owned body/root and exact topology denial. Mandatory 15-case native ownership feasibility passed before implementation. One grouped exclusive-document candidate has completed developer verification (including ownership, owned effects, navigation/recovery and full135); [brief](arrows-v11/EXCLUSIVE-DOCUMENT-BRIEF.md), [verification](arrows-v11/EXCLUSIVE-DOCUMENT-VERIFICATION.md). All prior failures and A11 N1 remain recorded; exact-SHA independent audit is next, not PASS or release. |

## Model routing

| Work | Default tier |
|---|---|
| Coordination with consequential gate decisions; architecture and race debugging; independent functional audit | GPT-6 Astra High |
| Product implementation and normal integration | GPT-6 Sol High |
| Hash inventories, link/manifest checks, routine status, and simple isolated fixes with deterministic acceptance tests | GPT-6 Luna Medium |

Use the least costly tier that can make the required judgment. A routine checklist audit may use Luna, but it must be labeled checklist-only and cannot issue a functional PASS. If the named tier is unavailable, use the nearest capable model and disclose the substitution in the result, not in repeated status chatter.

## Short task brief and result

Use direct task dispatch rather than copying chat transcripts. Keep the brief to these fields:

```text
Task: one bounded outcome
Base/target SHA: exact Git identity and clean-state requirement
Done criteria: observable behavior, durable evidence, and specific failure matrix
Read: authoritative spec, changed paths, prior failure/evidence paths
Write: allowed implementation paths or external read-only audit directory
Exclusions: later milestones and approval/qualification gates
```

The worker writes its verification to a shared QA path; an independent auditor writes outside the repository. Its handoff is limited to exact SHA, PASS/FAIL and scope, evidence path, limits, and next action. The coordinator reads that artifact and the changed files rather than the full chat transcript. Each work cycle handles one milestone or one grouped repair, then hands off or advances without waiting for a founder prompt relay. The daily update remains the founder's routine notification.
