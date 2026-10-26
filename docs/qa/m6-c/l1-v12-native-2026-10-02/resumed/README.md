# Stop V1.2 native lifecycle resumption

Product target: `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`. QA base: `09f4bfa84379f9bceb48fba76b6ede382f808ada`. Local date: 2 October 2026, America/New_York. Raw exports use UTC (3 October UTC during this evening run).

This packet resumes the four cases in the parent RESULT.md. The original locked-Mac preparation note remains historical. Product source, specifications, configuration and dependencies are unchanged. IDENTITY.json records all 119 checked paths and the exact build/probe identities.

Method: native Chrome app bridge only; no DevTools, CDP, extension browser attachment, synthetic lifecycle event, altered clock, frame delay or patched product handler. Actions are tool-dispatched native OS inputs, not an independent physical-keyboard/latency calibration. The existing independent capture-phase recorder is inserted before the unchanged production bundle in ignored preview output. It writes browser events to a separate localStorage QA key. The export helper reads IndexedDB and downloads local JSON; it writes no product state and sends no analytics. Its download filename is changed only to label exports. Instrumentation overhead and physical display timing are not qualified.

The warm-up restart and untimed-pause cases share one attempt, with separate boundary captures. Their full durable journal is captured after the later scored run ended; its separate viewport interruption is retained; the pre-scored exposure snapshot is captured separately at the pause. Pre-onset and post-onset invalidation use new attempts. Export navigation events are retained and distinguished from the intended switches.

Read RESULT.md for the final observations and limits. REPAIR-AUDIT-f6b8ae0.md is an unchanged retained copy of `/private/tmp/stop-v12-independent-G75vr7/AUDIT.md`; it PASSED the bounded repair scope at the target SHA. The original FAIL remains tied to its parent SHA. This native follow-up does not certify Chrome, M6-C, accessibility, physical timing, analytics, deployment or release.
