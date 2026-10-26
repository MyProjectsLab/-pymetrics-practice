# Easy or Hard V1.0 grouped repair — developer record

Base product: `f462ccdf6e2a0301a83b80107eac7c25cbbb390a`.
Independent failure: `/private/tmp/easy-hard-v1-independent/AUDIT.md`.
The repair remains developer work until a new exact-SHA read-only audit.

## Changes

- F1: native choice and key releases reserve an action token at capture time. A
  deadline waits for every previously captured native action to complete
  readback before resolving the task.
- F2: each task onset invalidates prior key-down state; modifier/chord changes,
  focus loss and held-key continuation cannot create a valid release.
- F3: a confirmed task onset creates an unpaid, review-only row when the task
  is interrupted or the journal is only a prefix.
- F4: a choice window cannot expire globally while its five-second fallback
  was due earlier. An earlier feedback deadline is likewise settled first.
- F5: material wall versus monotonic clock divergence interrupts the run and
  blocks optimistic payment.
- F6: the independently reviewed ending addendum adds a verified completion
  screen with Next before report-view activity and report publication.
- Adjacent exposure case: individual deletion releases its form ordinal for the
  next lowest-unexposed assignment; history remains ordered by creation time.
- Desktop presentation places Space instruction below the central bar and
  gives the task board room closer to the saved gameplay reference.

## Checks and limits

Focused transition, report and storage tests pass (15 tests across three
files). The repository suite passed 1,638 tests before the final extracted
clock-guard helper; its focused test, final TypeScript production build and
lint passed afterward. Stop/Arrows/Lengths/Digits form and manifest checks
passed. Lint retained three warnings outside this repair.

Bounded production browser on the isolated build observed a full two-minute
completion screen, Next/report, reload/history reopen, a five-press completed
task with a losing payout draw, a held key across automatic task onset with
zero accepted presses, interruption in a started task with one unpaid review
row, and deletion/replacement assigning the lowest now-unexposed EH3 form.
The browser input is automated; no physical-device timing is claimed.

Injected undelivered/delayed IndexedDB callbacks, wall-clock discontinuity,
all cross-tab deletion orderings, physical keyboard, device, assistive speech,
cross-browser, mock, founder acceptance, deployment and release remain open
for separate exact-SHA audit or later qualification as appropriate.
