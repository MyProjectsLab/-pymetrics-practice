# Money Exchange 2 packet root/controller redesign

Base: `2bf401da57dc0cad47cecd9c27198f6ab4ebd674`. Packet/reference-model work only; no product code or main integration.

## Design and failure closure

Independent design challenge: `/private/tmp/money2-packet-independent/POST-READY-ROUTE-DESIGN.md`. The replacement uses one durable root and one document owner-controller. Arm transfers active ownership atomically; no separate seal remains. Direct input binds an opaque current token and immutable request. Exit immediately fences old publication and then settles the same origin attempt or exact pending opening/Restart chain. Terminal derives its report from validated committed round facts.

The first uncommitted Astra preaudit found a pending Restart/old-attempt deletion counterexample: `/private/tmp/money2-packet-independent/ASTRA-CONTROLLER-PREAUDIT.md`. Outcomes now record their exact resulting route identity. Pending navigation survives unrelated root revisions only while that command and route remain current under the same owner/generation/lease. Final publication still requires current-revision readback. The added neighbors cover pending Try Again, later Close, current-attempt deletion and genuine successor replacement.

## Developer checks

- `node scripts/check-money-exchange-2-authority-v1.mjs`: **35 fixed root/controller cases PASS**. Expected summaries are authored literals; same-request replay, report-byte preservation and forbidden mutation checks supplement summaries.
- Independent Decimal reconciliation: **48 arithmetic cases / 96 round outcomes PASS**. Filmed candidate/candidate Give 200 cents and fairness 8 produces 800/700 cents and rating 8 on both report pages.
- Generator run in a separate temporary directory reproduces both JSON files byte-for-byte. Evidence: `/private/tmp/money2-controller-developer-check.json`.
- Original six-form file SHA256 unchanged: `ef829e4a736a3a8c7a0a24b1c1f2c8264ac796b6f74c2ab2104b38a8f186881a`.
- `git diff --check`: PASS.

The independent first preaudit also verified 54 supplemental terminal/report assertions over all six forms, but its verdict was NO-GO due the navigation finding. This record does not convert that historical verdict into PASS. The correction received independent GO to commit in `/private/tmp/money2-packet-independent/ASTRA-CONTROLLER-RECHECK.md`: 35 fixed cases, 8 independently authored navigation scenarios and 54 terminal/report assertions passed. A separate exact-SHA packet verdict is still required.

## Limits

Intermediate gameplay/rendering and native storage adapters are outside this reference model. Terminal fixtures seed an explicitly labeled complete two-round prefix; receipt identity is not proof of browser pixels or human attention. Source gameplay/form bytes remain unchanged. Browser play, durable IndexedDB/Web Lock behavior, lifecycle, accessibility, code audit, founder acceptance, environment qualification, mock and release remain separate and unclaimed. No product full-suite rerun, deployment or analytics activation occurred.
