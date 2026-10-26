# Native Chrome visible-screen observations

These are native Google Chrome accessibility observations in the dedicated QA window. They describe rendered text and controls; they are not physical display-timing measurements. The 1512 × 827 CSS-pixel viewport was maintained for the timed baseline, drill, and retest.

| Journey point | Observed screen and decisive visible text |
|---|---|
| Library | “Learn the task. Practise with clarity.”; “Open Stop”; analytics consent off. |
| Preparation | “Learn the Stop task” → “One rule, two actions” → four coached examples. GO examples were checked after tool-dispatched Space; NO-GO examples were checked without a response. All four displayed “Correct.” The three selected understanding answers passed with “You have the rule. Next, check your device and begin the warm-up.” |
| Baseline setup | “Check your setup”; Standard color-plus-marker symbols and Space; laptop/desktop physical-keyboard checkbox selected as a product setup declaration; “Space detected.” after a tool-dispatched input check; “Ready to begin?” displayed eight warm-up and 80 scored trials. |
| Baseline pause | “Warm-up complete”; “You can pause here”; “Start scored task.” The pause export contained no standard-form exposure. |
| Baseline completion/report | “Stop complete”; “This result is saved in this browser.” The original report displayed Valid, `stop-baseline-03`, 0/60 GO, 20/20 NO-GO, 20/80 overall (25%), and no eligible correct-GO timing summary. It offered “Start recommended training.” |
| Assignment | “Recommended Stop exercise”; observed 60/60 GO misses and 0/20 false alarms; “Next exercise: detection drill”; “Start assigned drill.” |
| Detection drill | Introduction displayed three blocks and 72 trials. Block summaries displayed GO 1/18, 1/18, 0/18 and NO-GO correct 6/6, 6/6, 5/6. Completion displayed GO miss rates 94%, 94%, 100%; false-alarm rates 0%, 0%, 17%; median correct-GO RT 487 ms, 504 ms, unavailable; then “Continue to retest.” |
| Retest explanation | “Try a new Stop sequence”; local saved-record disclosure that no earlier scored start of the selected sequence was recorded; 30-minute reservation disclosure. The exported reservation named `stop-retest-02` and the form was absent from the exposure set at this point. |
| Retest preparation | “Skip introduction” was offered based on saved current understanding evidence; choosing it displayed the rule reminder, then the full device/accessibility check, “Space detected,” readiness, eight-trial warm-up, and “Warm-up complete.” |
| Retest completion/report | “Stop complete”; saved Valid original report for `stop-retest-02`: 1/60 GO (2%), 20/20 NO-GO (100%), 21/80 overall (26%), one eligible correct-GO response of 469 ms, with timing variability unavailable. It offered “View baseline comparison.” |
| Comparison | “Baseline and retest”; overall 25% to 26% (+1 displayed percentage point); GO 0% to 2%; NO-GO 100% to 100%; hits 0 to 1; the causal limitation and uncalibrated-form warning were visible. No cross-session timing number was shown because the baseline had no eligible correct-GO response. |
| History before reload | Two valid entries (`stop-baseline-03` and `stop-retest-02`), one valid detection drill with three blocks and 530 retained events, one compatible-profile progress group, and one baseline/retest comparison. No invalid attempt row appeared. |
| Native Chrome reload | `Cmd+R` returned to the library. “Stop history” reopened with the same two results, drill, progress group, and comparison. “Resume Stop training” reopened the same numerical comparison. |

No screenshot or accessibility observation here establishes human physical-keyboard participation, input latency, refresh rate, or physical scanout. The product's “physical keyboard self-confirmed” label records its checkbox; this QA run used tool-dispatched scored input.
