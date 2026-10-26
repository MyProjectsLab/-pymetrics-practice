# Balloons V1.0 router fixture review

The JSON contains **25** full, legal 39-round synthetic forms (**975** rounds): profile order, threshold, intended pumps, observed outcome, attempts, successes, voluntary point, banked/lost cents and expected router evidence for every round. It borrows only BL1’s profile order; its thresholds are synthetic and are **not** BL1 or release forms. Negative boundary cases may correctly fall through to a lower-priority route. The original 18 fixtures remain; seven focused additions cover the prior numerical audit's missing retained cases. The additions passed focused independent specification review.

| Fixture | Expected primary | True triggers | Boundary or exclusion |
|---|---|---|---|
| outcome_min2 | outcome | outcome, updating, consistency | Two disjoint outcome windows, with lower-priority triggers too |
| outcome_only1 | consistency | consistency | One outcome window only |
| outcome_delta4 | updating | updating, consistency | First window misses five-pump boundary by one |
| outcome_overlap | updating | updating, consistency | Two raw windows overlap at a collection |
| information_exact3 | information | information | Early and late differences both exactly three |
| information_early2 | maintenance | none | Early difference two |
| information_median2 | updating | updating | Late median difference two |
| information_late2 | maintenance | none | Only two late A voluntary collections |
| information_pair_tie | information | information | A-C and B-C tie; A-C chosen |
| updating_exact2 | updating | updating | Early burst difference and median range both exactly two |
| updating_early1 | maintenance | none | Early difference one |
| updating_range3 | maintenance | none | Last median range three |
| updating_late2 | maintenance | none | Only two C late voluntary collections |
| consistency_exact6 | consistency | consistency | IQR exactly six |
| consistency_iqr5 | maintenance | none | IQR five |
| consistency_n7 | maintenance | none | Seven voluntary points despite wide spread |
| consistency_caps_excluded | maintenance | none | Four cap points excluded |
| maintenance_all_zero | maintenance | none | Complete all-zero voluntary baseline |
| maintenance_zero_voluntary | maintenance | none | Zero voluntary points; 38 bursts and one cap remain in totals |
| consistency_n8_fractional | consistency | consistency | Exactly eight A voluntary points; IQR is 6.5 pumps |
| information_fractional_median_2_5 | maintenance | none | Last B median is 0.5; A–B difference 2.5 stays below three |
| consistency_competing_categories | consistency | consistency | A and B qualify; B's seven-pump IQR wins over A's six |
| consistency_category_tie | consistency | consistency | A and B tie in IQR and count; alphabetical A wins |
| information_over_consistency | information | information, consistency | Both trigger; information wins router priority |
| pump32_burst_cap_and_loss | maintenance | none | T=32 loses 155 cents, T=33 caps at 160, another burst loses 25 |

Independent review should recompute, rather than trust the stored `expected` fields: (1) each profile’s 13 thresholds, low/high quartile and 40–60% sum band; (2) every burst, cap, voluntary point and five-cent conservation identity; (3) early burst and late voluntary denominators; (4) consecutive same-category outcome windows with greedy disjoint selection; (5) high/low pair ordering and chosen evidence; (6) median-of-halves IQR and cap exclusion; and (7) the first true route in priority order.

The one-unit misses show why trigger tests must retain all flags. `outcome_only1` falls to consistency; `outcome_delta4` and `outcome_overlap` fall to updating; `information_median2` falls to updating. These are not failures of their named route boundary.

All 25 fixtures were recalculated from their intended actions during the drafting pass. Whole-form and per-category conservation, category counts, run/alternation constraints, threshold bands, route flags and expected evidence reconciled. The focused independent specification PASS covers the seven new cases. Implementation tests must recompute them without trusting the stored `expected` fields.

JSON SHA-256: `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30`.
