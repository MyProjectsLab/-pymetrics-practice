# Arrows A11 F1 — counter/history admission repair

Parent: `c55a3df8c9fa3b8b15d7c117365ac926194cce64`. The independent A11 audit reproduced two impossible roots: a committed arm absent from both live attempts and tombstones, and a tombstoned arm with a decremented counter. Both were accepted by the shared validator.

The validator now requires `scoredStartCount === live attempt count + tombstone count`. Every committed arm is represented exactly once until Delete all replaces the installation. The original per-record form, journal, snapshot and revision checks remain. The two corrupt roots reject before history listing or a new Start; no storage data are repaired or discarded automatically.

Focused storage tests pass **23/23**, including both audit F1 cases, normal deletion/rotation, replacement, stale saves, lost delivery and precommit failure. The affected Arrows suite passes **87/87**. TypeScript, lint, fixed-form regeneration and production/analytics builds pass; lint retains two warnings in untouched files. An exact-SHA independent audit is still required. N1 never-delivered deletion callback and candidate UI/activity/qualification remain open.
