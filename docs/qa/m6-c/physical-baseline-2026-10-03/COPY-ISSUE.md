# Candidate comparison copy issue for later review

The observed [native comparison](../l1-v12-native-2026-10-03/full-chain/VISIBLE-SCREENS.md) displayed `+1 percentage points`. With a displayed magnitude of one, candidate copy should read `+1 percentage point`. The current unconditional wording is in `src/stop/comparison.ts` near line 46. This is a minor wording candidate, not a scoring or rounding finding: the stored exact difference was 1.25 percentage points, displayed as `+1`.

This evidence-only task makes no product-copy or specification edit. Review and any change remain separate.
