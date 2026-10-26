# Balloons V1.0 form and drill review

These are founder-approved fixed forms and drill data for development, not calibrated alternate forms or qualified release forms. Amounts are simulated cents. A fixed-`k` policy attempts up to `k` pumps on every balloon and collects after `k` successes; a burst before then banks zero. This is a difficulty probe, not candidate advice.

| Form | Family | Seed | A/B/C sums | C T>32 | k=3 | k=6 | k=12 | k=24 | k=32 | SHA-256 |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| BL1 | baseline | 1 | 76/171/304 | 4 | 465 | 810 | 960 | 720 | 640 | 9e5744f3c65cdd60256787da63ab13628cb90eac9b926a792b01da01e949b97e |
| BL2 | baseline | 3 | 92/159/250 | 3 | 495 | 750 | 840 | 600 | 480 | ec91d8c3944b92f607bb74954e24e3d3a69576e7857cf78be56796640493881d |
| BL3 | baseline | 15 | 92/162/348 | 5 | 570 | 810 | 1140 | 720 | 800 | 9f1c356991a1dd4493698c32a0150c9cc21d1674629347de72fb8febd8071239 |
| RP1 | replay | 16 | 79/176/277 | 3 | 480 | 780 | 1020 | 720 | 480 | 4425f093e748a4036184b72f3f9b17a68776a03ccc38ac5b05eef5fc49537621 |
| RP2 | replay | 20 | 87/148/345 | 6 | 525 | 870 | 840 | 960 | 960 | a4b1ac4393e3f836362cc6e1cb2afb45fd89e5b2736b92f2460c67d5a350a5ce |
| RP3 | replay | 23 | 69/143/328 | 6 | 420 | 690 | 900 | 720 | 960 | 107a47a641ad7f131b1ea20a63c218d863d8ce0cc4776f9d07884852a1d96ec3 |
| RT1 | retest | 24 | 66/133/267 | 2 | 465 | 720 | 780 | 600 | 320 | 009ca6aa68806d997f12f23f2a1015ae7942d7fa4dcf233c8bb942af961eba39 |
| RT2 | retest | 33 | 91/139/286 | 4 | 510 | 750 | 900 | 480 | 640 | e1d93ad34f6f52cb0b57a436e04803b446a9ee0eaffbd9e6e1c5722a112d23e1 |
| RT3 | retest | 34 | 87/165/300 | 3 | 480 | 780 | 960 | 840 | 480 | 49a78684cd10a770079c1a10ec980815f7f5eb12fb2a12aa54f53394390e5b38 |

## Playable differences and difficulty

All 36 pairs differ at **35–39 of 39 positions** after normalizing thresholds above cap as `min(T,33)`. The nearest pair, BL3/RT1, differs at 35 positions (19 profile-order differences and 16 effective threshold differences at matching profiles). The farthest pair, BL1/RP2, differs at 39 positions. Each manifest has 13 rounds per profile, the rotating 4/4/5 block counts, no barred run or alternation, inclusive low/high quartiles, and its required threshold-sum band.

Fixed-policy payout ranges: k=3: 420–570 cents, k=6: 690–870 cents, k=12: 780–1140 cents, k=24: 480–960 cents, k=32: 320–960 cents. C cap-survival counts range from 2 to 6 of 13.

The k=12 spread is 360 cents: BL3 yields 1140 and RT1 780 under identical actions. These are materially different sampled difficulties. The nine forms are structurally valid and behaviorally distinct, but are **not calibrated equivalent**. Baseline/retest reporting must keep the sequence-difficulty limitation. The founder accepted this exact inventory and limitation for development after the focused independent specification PASS.

Retest allocation is **dynamic** after abandonment or an exposed invalid attempt. Any of the three BL forms may therefore be compared with any still-unexposed RT form. Independently calculating all nine possible BL→RT pairs from the fixed manifests gives the following RT-minus-BL ranges under identical fixed-`k` actions; the initially numbered BL1→RT1, BL2→RT2 and BL3→RT3 pairs are not guaranteed.

| Fixed attempted pumps `k` | Smallest difference | Largest difference |
|---:|---:|---:|
| 3 | −105 cents | +45 cents |
| 6 | −90 cents | +30 cents |
| 12 | −360 cents | +120 cents |
| 24 | −240 cents | +240 cents |
| 32 | −480 cents | +160 cents |

These figures strengthen the case for descriptive-only comparisons. They are illustrative policies, not a difficulty correction or a candidate benchmark. The app must record the actual form pair and cannot interpret a payout change as a training effect.

## Drill checks

| Drill | Seed | A/B/C counts | Block rule | A/B/C sums | SHA-256 |
|---|---:|---|---|---|---|
| D-outcome | 22 | 6/6/6 | 2/profile/block | 41/85/142 | 89925bd177a61aa943b7a8d90d36ee5a1771f44fa27d781dc2e42ef880e6c564 |
| D-information | 7 | 6/6/6 | 2/profile/block | 41/70/137 | 6a4d6942171d3922d3784df24b9203e0ae9896c3c9fb5fd09ca079ddc24ca875 |
| D-updating | 5 | 6/6/6 | 2/profile/block | 32/69/157 | 0772f8be9d7dd20cf373e778a2bbc0223ea35781a5ce5ec39d71b4a2a1263ee7 |
| D-consistency-A | 0 | 18/0/0 | 18 in one profile | 107/0/0 | 0488906b7aa1b8338b2def71a5d8f2be36527a526b0440fd36c1eb7048195513 |
| D-consistency-B | 0 | 0/18/0 | 18 in one profile | 0/186/0 | 4c97b353b7503f204099cd02d36505de732c6d6a9cebd69d02818118a1f4caf2 |
| D-consistency-C | 0 | 0/0/18 | 18 in one profile | 0/0/456 | 8fa1d8e5070193759df88eb018abf5aaad176991345aefa46896d1381e95fdd1 |
| D-maintenance | 1 | 6/6/6 | 2/profile/block | 41/79/156 | 8869b5c978c0b3fe88c0e00559ac17650eebd59c35bcfd485e8568b50d8634ab |

## Focused independent specification PASS checks

1. Regenerate scored seed candidates 0–34 and drill candidates through seed 22 from the packet algorithm. Compare every accepted seed, ordered profile, threshold and manifest hash.
2. Recompute 13-per-profile and block counts, order exclusions, inclusive quartiles and integer threshold sums. Probe T=1, T=32 and T=33 arithmetic.
3. Recompute playable signatures, all 36 pairwise differences, fixed-k payouts and C cap-survival counts in this table.
4. Independently evaluate all legal router fixtures, including action outcomes, conservation, trigger flags, evidence selection, primary route, equality and one-unit misses, denominator suppression, overlaps, caps and priority ties.
5. Review whether the measured payout spread is acceptable for uncalibrated descriptive retests. Do not add a new generator cutoff without founder approval.

JSON file SHA-256: `a207284cfb5332d5814a8e3d5e85a24114bbfe93f8d27b9b55f21d0a37d9dd70`.
