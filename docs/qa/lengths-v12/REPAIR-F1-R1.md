# Lengths Mouth V1.2 clipping repair

The independent repair audit at `2eb7ccdef16383a810138dfcb463ad08ff36ff86` found F1-R1: an `overflow:hidden` 120px stage could cut a 240px task SVG in half while the run recorded `face_presented`. F2 and the history disclosure were closed in that audit.

The presentation gate now requires the entire fixed SVG bounds to fit every ancestor that clips by overflow, paint containment or CSS clip. This is checked before fixation or face onset is recorded. It preserves the frozen face art and task mechanics.

Developer production-browser checks:

- Injecting `.mouth-stage {overflow:hidden;width:120px}` before Start produced an invalid viewport report with **0 presented** and **90 unpresented**; no scored onset was admitted.
- Injecting `.mouth-stage {overflow:hidden;width:240px}` allowed a fully contained face to advance through three presented trials before a deliberate page exit. The recorded reason was page exit, not viewport.
- The fault CSS and local Vite config were removed from the committed candidate.

The focused old/new 53 tests, TypeScript check, lint and production build passed before the temporary CSS controls. The candidate's final source was additionally built with Vite after removing the fault CSS. The first V1.2 candidate's 90-trial/reload and version-isolation evidence remains scoped to its earlier SHA. Physical/device/accessibility qualification, founder acceptance, mock and release are open. A separate exact-SHA read-only audit is required for F1-R1.
