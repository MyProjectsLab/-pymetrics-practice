import { waitForInitialFrame } from './initial-frame'
import type { InitialFrame } from './initial-frame'
import { createStopEngine } from './engine/engine'
import type { EngineEvent, FrameAdapter, Scheduler } from './engine/contracts'
import { drillBlockTiming, drillBlockTrials, validateDrillManifest } from './drills'
import type { DrillManifest } from './drills'
import type { StopSetup } from './Preflight'
import type { DrillAttempt } from './training'
import { timing, round } from './scoring'

export interface DrillBlockSummary {
  readonly block: number
  readonly hits: number
  readonly misses: number
  readonly withholds: number
  readonly falseAlarms: number
  readonly accuracy: number
  readonly medianMs: number | null
  readonly iqrMs: number | null
}
export function createDrillRun(options: {
  readonly id: string
  readonly manifest: DrillManifest
  readonly setup: StopSetup
  readonly clock: () => number
  readonly scheduler: Scheduler
  readonly frames: FrameAdapter
  readonly initialFrame: InitialFrame
  readonly clear: () => void
  readonly changed: () => void
  readonly started?: (attemptId: string) => void
}) {
  const { manifest, setup, clock, scheduler } = options
  const events: EngineEvent[] = []
  const summaries: DrillBlockSummary[] = []
  let screen: 'intro' | 'live' | 'summary' | 'complete' | 'invalid' = 'intro'
  let blockIndex = 0
  let blockStart = 0
  let resetReadyAt: number | null = null
  let resetCancel: (() => void) | null = null
  let attempt: DrillAttempt | null = null
  let processing = false
  let startedAtWall = ''
  let queued = false
  let cancelInitial = () => {}
  const engine = createStopEngine({ sessionId: options.id, responseKey: setup.binding.code, clock, scheduler,
    frames: options.frames,
    sink(event) {
      events.push(event)
      if (event.type === 'session_invalidated') { cancelInitial(); options.clear() }
      if (!queued) { queued = true; queueMicrotask(() => { queued = false; void update() }) }
    },
  })
  const protectedNow = () => !['idle', 'invalid', 'closed'].includes(engine.snapshot().state)
  const show = (next: typeof screen) => { screen = next; options.changed() }
  function retain(valid: boolean) {
    if (attempt) return
    attempt = Object.freeze({ id: options.id, drillId: manifest.id, manifestChecksum: manifest.checksum,
      version: manifest.version, startedAtWall, completedAtWall: new Date().toISOString(),
      valid, completedBlocks: summaries.length, events: Object.freeze([...engine.snapshot().events]) })
  }
  function summarize() {
    const block = manifest.blocks[blockIndex]
    const segment = events.slice(blockStart)
    const outcomes = segment.filter(e => e.type === 'trial_resolved')
    if (outcomes.length !== block.sequence.length) throw new Error('Incomplete drill block')
    const anomalous = new Set(segment.filter(e => e.type === 'timing_anomaly').map(e => e.payload.trialIndex))
    const times = outcomes.flatMap(e => e.payload.outcome.kind === 'hit' && !anomalous.has(e.payload.trialIndex) &&
      e.payload.outcome.responseTimeMs >= 100 && e.payload.outcome.responseTimeMs <= block.deadlineMs ? [e.payload.outcome.responseTimeMs] : [])
    const statistics = timing(times)
    const hits = outcomes.filter(e => e.payload.outcome.kind === 'hit').length
    const misses = outcomes.filter(e => e.payload.outcome.kind === 'miss').length
    const withholds = outcomes.filter(e => e.payload.outcome.kind === 'correct_withhold').length
    const falseAlarms = outcomes.filter(e => e.payload.outcome.kind === 'false_alarm').length
    summaries.push(Object.freeze({ block: blockIndex + 1, hits, misses, withholds, falseAlarms,
      accuracy: (hits + withholds) / outcomes.length, medianMs: statistics.median,
      iqrMs: times.length > 1 ? statistics.iqr : null }))
  }
  async function update() {
    const state = engine.snapshot().state
    if (state === 'invalid') {
      resetCancel?.()
      if (screen !== 'invalid') { retain(false); show('invalid') }
      return
    }
    if (processing || state !== 'waiting' || screen !== 'live' || events.at(-1)?.type !== 'batch_finished') return
    processing = true
    try {
      const errors = await validateDrillManifest(manifest)
      if (!protectedNow()) return
      engine.verifyRetainedEvents(events.slice())
      if (!protectedNow()) return
      if (errors.length) { engine.technicalFailure('Drill manifest mismatch'); return }
      summarize()
      if (summaries.length === manifest.blocks.length) {
        const validity = engine.snapshot().notes.length ? 'valid_with_note' : 'valid'
        engine.recordCompletion({ eventCount: engine.snapshot().events.length + 1, validity, checksum: manifest.checksum, scoringVersion: 'stop_drill_scoring_v1' })
        if (!protectedNow()) return
        engine.endProtection()
        if (engine.snapshot().state !== 'closed') return
        retain(true); options.clear(); show('complete')
      } else {
        options.clear()
        resetReadyAt = manifest.id === 'consistency' ? clock() + 15000 : null
        if (resetReadyAt !== null) resetCancel = scheduler.at(resetReadyAt, () => options.changed())
        show('summary')
      }
    } catch { engine.technicalFailure('Drill completion could not be reconciled') }
    finally { processing = false }
  }
  function startBlock() {
    if (!protectedNow()) return
    blockStart = events.length
    const definitions = drillBlockTrials(manifest, blockIndex)
    show('live')
    cancelInitial()
    cancelInitial = waitForInitialFrame({ clock, scheduler, request: options.initialFrame,
      active: () => protectedNow() && screen === 'live',
      ready: () => engine.start(definitions, drillBlockTiming(manifest.blocks[blockIndex])),
      failed: () => engine.technicalFailure('Drill initial frame did not arrive within 2000 ms'),
    })
  }
  return Object.freeze({ engine, protectedNow,
    async begin(held: boolean) {
      if (screen !== 'intro') return
      startedAtWall = new Date().toISOString()
      engine.begin({ responseKeyHeld: held })
      if (protectedNow()) options.started?.(options.id)
      const errors = await validateDrillManifest(manifest)
      if (errors.length) { engine.technicalFailure(`Invalid drill manifest: ${errors.join(', ')}`); return }
      if (!protectedNow()) return
      startBlock()
    },
    continue() {
      if (screen !== 'summary' || !protectedNow() || resetReadyAt !== null && clock() < resetReadyAt) return false
      resetCancel?.()
      blockIndex++
      startBlock()
      return true
    },
    leave() {
      cancelInitial()
      if (protectedNow()) engine.lifecycle('pagehide')
      if (engine.snapshot().state === 'invalid') retain(false)
      return attempt
    },
    snapshot() { return Object.freeze({ screen, blockIndex, summaries: Object.freeze([...summaries]),
      resetRemainingMs: resetReadyAt === null ? 0 : Math.max(0, round(resetReadyAt - clock())),
      attempt, engine: engine.snapshot() }) },
  })
}
export type DrillRun = ReturnType<typeof createDrillRun>
