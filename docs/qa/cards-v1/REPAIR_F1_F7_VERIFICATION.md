# Cards V1.1 independent-audit F1–F7 repair — developer verification

Base product candidate: `5489607fb38bb162c310b4c284aa00ba7c07dc41`. The independent audit at `/private/tmp/cards-v11-playable-independent/AUDIT.md` failed that candidate on F1–F7. This record covers the grouped repair in the isolated Cards worktree; it is developer evidence, not an independent PASS.

## Repair scope

- F1: report/history activity revisions are ordered within their own metadata journal, so a later play event does not invalidate an earlier view.
- F2: an unexpectedly lost browser owner lock closes local input immediately and attempts an atomic invalid/epoch advance. A pending Start is also retired if it committed before ownership was lost.
- F3: every post-read Start, readiness, choice, feedback and terminal retry checks the current document, navigation and owner lifetime before restoring play. Interrupting a pending Start closes any already committed run.
- F4: choice readback and synchronous outcome publication share the deletion/replacement data-order lock.
- F5: a delivered freeze event closes play; feedback frame confirmation has a bounded retry; Exit/interruption retains its exact closure request and exposes recovery in history.
- F6: negative event times and unpaired or reason-inconsistent terminal closure events fail journal validation.
- F7: report/history numbers withdraw on window blur and are read again under the shared data-order lock on focus.

## Checks

- The F1 and F6 audit challenges were added as failing baseline tests before their repairs; they now reject or continue as required. Focused Cards and app tests: 25 passing. Typecheck, lint, production build and `git diff --check` passed. Lint retains three inherited warnings.
- Production Chromium on the repaired build completed 80 B/C/A/D draws: 20 per deck, 80 confirmed feedback events, 79 switches, $4,550 gains, $3,050 losses and $3,500 ending balance. Reloaded local history retained the complete result.
- A second tab viewed the live attempt; the playing tab then committed another Deck A choice and advanced to the next draw, exercising F1 in the browser.
- A separate same-origin page used native `navigator.locks.request` with `steal: true`. The original tab disabled all deck controls and displayed ownership loss. A direct IndexedDB root read showed the run `invalid`, epoch 2, with `lifecycle_changed` and `run_invalid` after its readiness event. The prior complete run remained unchanged.

## Limits and next gate

The targeted browser checks do not certify physical lifecycle timing, screen-reader speech, touch devices or 200% zoom. Held callback and deletion/publication orders remain for the separate read-only exact-SHA audit. Frozen Cards specification, forms and fixtures were not edited. Main remains unchanged. No founder acceptance, full mock integration, deployment or release is claimed.

## Second audited repair: visible recovery claims

The independent exact-SHA audit of the first repair **FAILED** at `b2e0744f0d75823d1c2b8664686e27ee96b9cfbf` on two P2 visible-state contradictions; F1–F4/F6, other F5/F7 cases and the healthy 80-draw journey passed. Report: `/private/tmp/cards-v11-repair-independent/AUDIT-b2e0744.md`.

The grouped follow-up uses an explicit history evidence state. Blur or read failure withdraws numbers and says history is hidden until rechecked; only a confirmed authoritative empty read or completed Delete all may say there are no saved attempts. Successful same-request Exit/interruption recovery clears its provisional save-failure alert, whether the original write failed or committed with lost callback. Design note: `/private/tmp/cards-v11-visibility-design.md`.

Focused React tests cover failed and undelivered closure, blur, failed history read, and focus recheck after deletion (5/5 passing). Typecheck and lint pass; lint retains the three inherited warnings. A fresh exact-SHA functional audit must still test the visible and durable states of both closure-delivery variants and the previously passing authority and healthy-play paths. This section does not claim an independent PASS.
