import type { CoreAction, CoreEvent, CoreState, SessionIdentity } from './contracts'
import { startScoredSession, transition } from './core'
import { verifiedScoredManifest } from './manifests'

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Balloons report integrity: ${reason}`)
}

/** Exact data equality: unlike JSON serialization, does not coerce NaN, omit undefined or ignore extra fields. */
function sameData(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual) && Array.isArray(expected) && actual.length !== expected.length) return false
  const left = actual as Record<string, unknown>, right = expected as Record<string, unknown>
  const keys = Object.keys(right)
  return Object.keys(left).length === keys.length && keys.every(key => Object.hasOwn(left, key) && sameData(left[key], right[key]))
}

function eventTime(event: CoreEvent) {
  assert(typeof event.clockEpochId === 'string' && event.clockEpochId.length > 0, 'missing clock epoch')
  return { wallTimeMs: event.wallTimeMs, monotonicMs: event.monotonicMs, clockEpochId: event.clockEpochId }
}

/**
 * Admit only an exact legal headless prefix, including incomplete recoverable states. The loaded immutable form is the authority,
 * including for detached snapshots. A stored hash string alone grants no trust.
 * No browser presentation, storage durability or chain eligibility is established here.
 */
export function reconcileSessionPrefix(state: CoreState): CoreState {
  const manifest = verifiedScoredManifest(state.manifest.id)
  assert(manifest && sameData(state.manifest, manifest), 'manifest bytes do not match a verified approved form')
  const saved = state.identity
  assert(typeof saved.installationId === 'string' && saved.installationId.length > 0 && typeof saved.sessionId === 'string' && saved.sessionId.length > 0, 'invalid session identity')
  assert(saved.chainId === null || (typeof saved.chainId === 'string' && saved.chainId.length > 0), 'invalid chain identity')
  // Select only contracted fields. Replay equality below also refuses extra snapshot fields.
  const identity: SessionIdentity = {
    installationId: saved.installationId, sessionId: saved.sessionId, chainId: saved.chainId,
    stage: saved.stage, mapping: {
      'Type 1': saved.mapping['Type 1'], 'Type 2': saved.mapping['Type 2'], 'Type 3': saved.mapping['Type 3'],
    },
    exposureGeneration: saved.exposureGeneration, ownershipGeneration: saved.ownershipGeneration,
  }
  const events = state.events
  assert(events.length > 0, 'missing journal')
  let replay = startScoredSession(manifest, identity, eventTime(events[0]))
  assert(sameData(events[0], replay.events[0]), 'initial event sequence/context/totals mismatch')
  let cursor = 1
  while (cursor < events.length) {
    const first = events[cursor]
    let kind: CoreAction['kind']
    if (first.type === 'pump_attempted') kind = 'pump'
    else if (first.type === 'voluntary_collected') kind = 'collect'
    else if (first.type === 'round_presented') kind = 'next'
    else throw new Error('Balloons report integrity: event sequence does not start a legal action group')
    assert(first.actionId !== null && first.source !== null, 'missing action identity/source')
    const step = transition(replay, {
      kind, actionId: first.actionId, source: first.source,
      expectedRound: replay.round, expectedRevision: replay.revision, time: eventTime(first),
    })
    assert(step.accepted, 'illegal action or non-unique action progression')
    // Each transition emits one complete, ordered group. Compare every field, not just counts.
    const emitted = step.state.events.slice(cursor)
    assert(sameData(events.slice(cursor, cursor + emitted.length), emitted), `event sequence/group mismatch at ${cursor + 1}`)
    cursor += emitted.length
    replay = step.state
  }
  // Includes outcome-specific cents/pumps/censoring, visible labels and every final-state field.
  assert(sameData(state, replay), 'final state or round results disagree with legal replay')
  return replay
}

/** Completed-report admission remains stricter than recoverable prefix admission. */
export function reconcileCompletedSession(state: CoreState): CoreState {
  const replay = reconcileSessionPrefix(state)
  assert(replay.status === 'completed' && replay.results.length === 39, 'journal is not a complete session')
  return replay
}
