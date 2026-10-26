# Stop M6-B F1 repair — developer verification

Date: 2026-10-02. Source: clean HEAD `f85018ce9c06d98a8813110a4079a0034bfc25b4`, whose independent read-only [audit](/private/tmp/stop-m6b-independent-f85018c/AUDIT.md) returned **FAIL solely on F1**. This record describes the narrow local repair for a new exact-SHA audit; it does not change that verdict or grant founder acceptance.

## Changed files

| File | Change |
|---|---|
| `server/analytics/collect.ts` | Separate malformed-request parsing and validation from the receipt-time/D1 operation. Preserve empty 400 responses for malformed requests; return an empty generic 503 if the D1 operation throws. No logging added. |
| `server/analytics/collect.test.ts` | Exact-status controls for malformed input and endpoint boundaries, plus four injected D1 failures and empty-body/no-log assertions. |
| `docs/qa/m6-b/repair-f1/built-pages-entry.mjs` | Local harness invoking the built Pages `onRequest` entry, with a SQLite adapter and failure injections. |
| `docs/qa/m6-b/repair-f1/built-pages-entry.json` | Exact-status and empty-body results from that built-entry run. |
| `docs/qa/m6-b/repair-f1/VERIFICATION.md` | This repair record. |
| `IMPLEMENTATION_TRACKER.md` | Current audit failure, repair status, and open gates; historical entries retained. |

## Reproduction and checks

Before editing the collector, new exact-status tests reproduced F1. `npx vitest run server/analytics/collect.test.ts -t 'F1:|never logs headers|D1 outage'` failed in six expected cases: `prepare`, `bind`, execution, missing table, and the two pre-existing D1-outage/no-log cases returned 400 where 503 was required. The malformed-input controls passed. This was a reproduction, not a passing verification run.

After the repair:

| Check | Result |
|---|---|
| `npx vitest run server/analytics/collect.test.ts` | Passed, 108 tests. |
| `npm run check` | Passed once, 640 tests across 35 files; lint had two inherited warnings; 14 standard forms and five drill manifests validated; TypeScript, Vite app, collector and purge Worker builds passed. |
| `node docs/qa/m6-b/repair-f1/built-pages-entry.mjs` | Passed against `dist-analytics/collector.js`; [result JSON](built-pages-entry.json) records default-disabled 503, valid 204, malformed JSON 400, prohibited field 400, and prepare/bind/execution/missing-table 503, all with empty bodies. |
| `git diff --check` and frozen-document SHA-256 | Clean; Master Strategy `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`, Stop V1.1 `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`. |

The first built-entry harness attempt used a future fixed receipt time relative to the host clock and failed its valid-admission assertion. The harness now uses its actual run time for the retention watermark and passed all eight cases. No product source changed for that harness correction. The built entry and D1 failure injections are local tests, not Cloudflare account or runtime verification. Client and gameplay files did not change, so no full browser journey was repeated.

## Limits and open gates

- This developer verification is **pending a focused independent read-only audit of the new exact commit SHA**. M6-B founder acceptance remains open. The prior audit's retention limitation L1 remains: old ready state can survive failure of both purge-status writes, so code alone does not guarantee total deletion.
- The §23.5 “browser session” interpretation as a consented page/document epoch remains for founder resolution. The [consent notice, withdrawal treatment and technical-event enums](../../../privacy/STOP_M6_B_REVIEW_PROPOSAL.md) remain proposals for founder and privacy review.
- Provider logging, backup/export expiry, actual endpoint rate limiting, retention monitoring, restore rehearsal, provider settings and operational disable procedures remain activation gates. No provider configuration was verified here. Collection remains disabled; no production project, deployment or collection was enabled.
- S70–S71 and full Stop/browser/device/accessibility/release acceptance remain open. No M6-C, other-game, push or release work is included.
