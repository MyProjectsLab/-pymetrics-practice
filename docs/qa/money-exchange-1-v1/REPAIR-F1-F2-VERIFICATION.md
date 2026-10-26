# Money Exchange 1 V1.0 F1/F2 grouped developer repair

Status: developer-tested repair candidate. The first whole-standalone independent audit **failed** at `aa4c72e5c6ae09aede9bc2c8b30d86510187ecf8`; a changed product SHA needs a new independent read-only audit. Founder acceptance, device/accessibility qualification, mock, deployment and release remain open.

## Baselines and repairs

- **F1, false visible result:** the independent production-browser case applied zero opacity to the game panel; the parent saved `captured_visible` and `return_presented`. The result check now examines every ancestor, viewport/clipping and hit-test ownership, and compares the three displayed amounts with the saved form's expected amounts. If confirmation fails, it retains at most `possibly_revealed` and an Incomplete attempt. A 320px check then exposed a healthy-result false negative: the original tall pair put the final return below the viewport. The result layout is compact at narrow widths so all three amounts are visible without relaxing the check.
- **F2, silent reset of damaged storage:** the independent case removed the only root record from an existing IndexedDB database; the parent silently initialized a new installation. Initialization now creates a root only in the database-creation upgrade transaction. A missing root in an existing database blocks play and reports a storage error; its old form history is not misrepresented as unseen.

## Bounded evidence

- `scripts/dev-money-audit-repair.mjs`: healthy desktop and 320px results, zero-opacity/hidden/clipped ancestors, covering overlay, fresh database and damaged existing database all passed in the production Chromium bundle. The exact independent F1 reproduction now writes an Incomplete `possibly_revealed` run; the exact F2 reproduction's old post-reset read cannot find a new root.
- `scripts/dev-money-browser.mjs`: filmed $5 transfer/$6.15 return, $11.15/$8.85 balances and saved report/reload passed.
- `scripts/dev-money-matrix.mjs`: eight existing restart/zero/deletion/lifecycle cases passed. `npx vitest run src/money-exchange-1`: 22 focused tests passed. Build and lint passed; lint emitted only three existing warnings outside this milestone.
- Frozen source, specification, forms, fixtures and generator bytes remain unchanged.

## External evidence discipline

The founder-supplied Game Assessment Prep research-method PDF separates official claims, single-source reports and anecdotes; its Money Exchange 1 guide describes **its own reconstruction**. Its $10 start, tripling, one-shot exchange, 0–10 fairness and non-scored preference framing support the broad construct. Its one-dollar transfer steps and seeded 30–70% return describe that site's implementation and do not establish current Pymetrics rules. The saved JobTestPrep recording remains this product's observable gameplay benchmark. No gameplay or scoring change was inferred from the PDFs. This grouped repair addresses engineering failures, which the PDFs do not diagnose.
