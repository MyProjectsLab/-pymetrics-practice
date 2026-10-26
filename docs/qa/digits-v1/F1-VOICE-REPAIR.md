# Digits V1.0 draft F1 voice-admission repair

**Date:** 2026-10-07. **Starting draft:** `bfb8d943f4782ced77fd30600f8cf5065aa143e3`. The separate read-only specification audit reported numerical PASS and implementation-readiness FAIL F1: with English `a-remote` (`localService=false`) and `z-local` (`localService=true`), the previous default selected the remote voice. Explicit selection admitted the remote voice too. This was a contract counterexample, not an observed device test.

The revised draft admits an auditory voice only when its current browser metadata has `localService === true`, an English BCP-47 language, a nonempty unique URI, and a verified identity. Both explicit and default choice use that same set. The selected object is assigned to sample and scored utterances, and URI/language/local-service eligibility is rechecked before samples, arm/Start, Continue, each scored request and every sample/scored start/end callback. A remote or unavailable voice cannot trigger an automatic substitution. If no eligible voice remains, auditory Start/Continue is unavailable or an armed attempt is invalidated; visual Practice remains available.

The deterministic fixture supplement covers mixed remote/local default, remote-only inventory, explicit remote rejection, explicit local acceptance, a stable local recheck, local-to-remote change, disappearance and a duplicate URI with conflicting metadata. `scripts/review-digits-fixtures.mjs` derives selection and recheck eligibility from primitive voice records. This script is authoring evidence, not an independent audit.

| Draft input after repair | SHA-256 |
|---|---|
| Digits specification | `1e44e4875afdf6b5dedb50e1c9c015d53c642b88b79ae262d9f98704d2f88901` |
| Digits forms (unchanged) | `b29a5c12daaf6915f0aeded56c1dfdd74b338be23a61ef8efe7c57b7eff2af8f` |
| Digits fixtures | `2a34059ac3abd04bfa90a466803fc095f6c76f74b6369330e36094d512a6bf8b` |
| Fixture review script | `5a063a1c00045ce5f3d465222a52382b784473d8506f7c6b03d61441d47a8180` |

The forms constructor's compact payload digest remains `9810f3106c7ed20efd31d11c7a012a3796bdfc2c1c72035c1bae804e38f595b1`. The prior fixture byte hash was `954a90c389a0bc434a79292a5ddbcaeef90e7e9b0b667fcf055d0238eef7bf33`; this draft supplement intentionally changes those bytes.

**Author checks:** constructor byte check, independent-form review script, fixture review script (8 classification, 3 deadline, 8 voice cases), targeted oxlint via the existing repository dependency installation, JavaScript syntax, JSON parse and Git whitespace check. The worktree has no local `node_modules`, so the ordinary `npm run lint` wrapper could not resolve oxlint. No product code or frozen governing document changed. The repaired packet requires a new separate read-only exact-SHA audit before a freeze or implementation claim. Real browser voice enumeration, local synthesis behavior, audibility, assistive-technology coexistence, devices and release qualification remain open.
