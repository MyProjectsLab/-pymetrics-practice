import type { ActionSource, ActionTotals, CoreAction, CoreState, EventTime, FormId, Mapping, Profile, SessionIdentity } from './contracts'
import { BALLOONS_EVENT_VERSION, BALLOONS_FORM_VERSION, BALLOONS_ROUTER_VERSION, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION } from './contracts'
import { startScoredSession, transition } from './core'
import { reconcileSessionPrefix } from './integrity'
import { canonicalJson, verifiedScoredManifest } from './manifests'
import { basicReport } from './report'

export const DURABLE_VERSION = 'balloons-durable-v1'
export interface Settings { verbose: boolean; reducedMotion: boolean; informationProfile: 'type-pattern-v1'; controls: 'native-buttons-v1' }
export const RETEST_RESERVATION_MS = 30 * 60 * 1000
export interface RetestBinding { baselineSessionId: string; baselineFormId: FormId; drillAttemptId: string; issuedAtMs: number; expiresAtMs: number }
export interface Header {
  retest?: RetestBinding
  version: typeof DURABLE_VERSION
  identity: SessionIdentity
  formId: FormId
  repeat: boolean
  settings: Settings
  device: string
  created: EventTime
}
export type Exposure = 'pending_exposure' | 'exposure_uncertain' | 'form_exposed' | 'released_unseen'
export type Phase = 'pending_exposure' | 'awaiting_presentation' | 'presentation_armed' | 'active' | 'resolved' | 'completed' | 'paused' | 'released' | 'committing_action'
export interface Snapshot {
  core: CoreState
  phase: Phase
  exposure: Exposure
  confirmedRounds: number[]
  ownershipGeneration: number
  comparisonEligible: boolean
  interruptions: number
  pendingAction: CoreAction | null
}
export type Command = { kind: 'arm' | 'confirm' | 'pause' | 'recover' | 'release' | 'report'; reason?: string } | { kind: 'action' | 'action_pending'; action: CoreAction }
export interface DurableEvent {
  schemaVersion: typeof DURABLE_VERSION
  coreSchemaVersion: typeof BALLOONS_EVENT_VERSION
  specificationVersion: typeof BALLOONS_SPEC_VERSION
  formVersion: typeof BALLOONS_FORM_VERSION
  scoringVersion: typeof BALLOONS_SCORING_VERSION
  routerVersion: typeof BALLOONS_ROUTER_VERSION
  installationId: string; sessionId: string; chainId: string | null
  stage: SessionIdentity['stage']; manifestId: FormId; manifestSha256: string; mapping: Mapping
  sequenceNumber: number; round: number; actionId: number | null; source: ActionSource | null
  wallTimeMs: number; monotonicMs: number; clockEpochId: string; timeOriginMs: number | null
  ownershipGeneration: number; exposureGeneration: number
  pre: ActionTotals; post: ActionTotals; outcome: string | null
  validityCode: string; type: string; command: Command | null
  coreEventStart: number; coreEventEnd: number
}
export interface DurableRecord { header: Header; journal: DurableEvent[]; snapshot: Snapshot }
export function requireIntegrity(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Balloons durable integrity: ${reason}`)
}
function totals(core: CoreState): ActionTotals { return { ...core.current, bankedCents: core.bankedCents, lostCents: core.lostCents } }
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]))
}
export function mappingFor(formId: FormId): Mapping {
  const p: Profile[] = ['A', 'B', 'C'], offset = Number(formId.at(-1)) - 1
  return { 'Type 1': p[offset], 'Type 2': p[(offset + 1) % 3], 'Type 3': p[(offset + 2) % 3] }
}
function event(header: Header, before: Snapshot, after: Snapshot, command: Command | null, time: EventTime, n: number): DurableEvent {
  const a = command && 'action' in command ? command.action : null
  let type = !command ? 'pending_exposure' : command.kind === 'arm' ? 'presentation_armed' : command.kind === 'confirm' ? (before.exposure === 'form_exposed' ? 'round_presented' : 'form_exposed') : command.kind === 'pause' ? (after.exposure === 'exposure_uncertain' ? 'exposure_uncertain' : 'interrupted') : command.kind === 'recover' ? 'recovered' : command.kind === 'release' ? 'pre_display_released' : command.kind === 'report' ? 'report_viewed' : command.kind === 'action_pending' ? (before.core.events.findLast(e => e.source)?.source && before.core.events.findLast(e => e.source)?.source !== a?.source ? 'input_changed' : 'action_pending') : after.core.status === 'completed' ? 'session_completed' : 'action_committed'
  if (header.retest) type = type === 'pending_exposure' ? 'retest_reserved' : type === 'pre_display_released' ? 'retest_released' : type === 'form_exposed' ? 'retest_exposed' : type === 'session_completed' ? 'retest_completed' : type
  return {
    schemaVersion: DURABLE_VERSION, coreSchemaVersion: BALLOONS_EVENT_VERSION, specificationVersion: BALLOONS_SPEC_VERSION,
    formVersion: BALLOONS_FORM_VERSION, scoringVersion: BALLOONS_SCORING_VERSION, routerVersion: BALLOONS_ROUTER_VERSION,
    ...header.identity, manifestId: header.formId, manifestSha256: after.core.manifest.sha256,
    sequenceNumber: n, round: after.core.round, actionId: a?.actionId ?? null, source: a?.source ?? null,
    ...time, timeOriginMs: (time as EventTime & { timeOriginMs?: number }).timeOriginMs ?? null, ownershipGeneration: after.ownershipGeneration, pre: totals(before.core), post: totals(after.core),
    outcome: a ? after.core.events.at(-1)?.outcome ?? null : null,
    validityCode: after.comparisonEligible ? 'intact' : 'review_only', type, command,
    coreEventStart: command ? before.core.events.length : 0, coreEventEnd: after.core.events.length,
  }
}
export function createRecord(header: Header): DurableRecord {
  requireIntegrity(header.version === DURABLE_VERSION && /^(BL|RP|RT)[123]$/.test(header.formId), 'unsupported session')
  requireIntegrity(typeof header.repeat === 'boolean' && typeof header.device === 'string', 'invalid context')
  const s = header.settings
  requireIntegrity(s.informationProfile === 'type-pattern-v1' && s.controls === 'native-buttons-v1' && typeof s.verbose === 'boolean' && typeof s.reducedMotion === 'boolean' && Object.keys(s).length === 4, 'unsupported settings')
  const rt = header.retest
  requireIntegrity(!!rt === header.formId.startsWith('RT'), 'retest binding required')
  if (rt) requireIntegrity(/^BL[123]$/.test(rt.baselineFormId) && !!rt.baselineSessionId && !!rt.drillAttemptId && Number.isFinite(rt.issuedAtMs) && rt.issuedAtMs === header.created.wallTimeMs && rt.expiresAtMs === rt.issuedAtMs + RETEST_RESERVATION_MS && !header.repeat, 'invalid retest reservation')
  requireIntegrity(equal(header.identity.mapping, mappingFor(rt?.baselineFormId ?? header.formId)), 'mapping mismatch')
  requireIntegrity((header.identity.stage === 'mock' ? header.formId.startsWith('RP') && !rt :
    header.identity.stage === (rt ? 'retest' : header.formId.startsWith('BL') ? 'baseline' : 'replay')) &&
    (!!header.identity.chainId === !header.formId.startsWith('RP')) && !(header.repeat && header.formId.startsWith('BL')), 'chain/family mismatch')
  const form = verifiedScoredManifest(header.formId)
  requireIntegrity(form, 'unverified form')
  const core = startScoredSession(form, header.identity, header.created)
  const snapshot: Snapshot = { core, phase: 'pending_exposure', exposure: 'pending_exposure', confirmedRounds: [], ownershipGeneration: header.identity.ownershipGeneration, comparisonEligible: !header.repeat, interruptions: 0, pendingAction: null }
  return { header: structuredClone(header), journal: [event(header, snapshot, snapshot, null, header.created, 1)], snapshot }
}
/** Pure durable protocol; persistence, current ownership and actual DOM checks are separate authorities. */
export function advance(record: DurableRecord, command: Command, time: EventTime, generation = record.snapshot.ownershipGeneration): DurableRecord {
  const before = record.snapshot
  const prior = record.journal.at(-1)!
  const origin = (time as EventTime & { timeOriginMs?: number }).timeOriginMs
  requireIntegrity(origin === undefined || (Number.isFinite(origin) && origin >= 0), 'invalid clock origin')
  requireIntegrity(Number.isFinite(time.wallTimeMs) && Number.isFinite(time.monotonicMs) && time.monotonicMs >= 0 && !!time.clockEpochId && (time.clockEpochId !== prior.clockEpochId || time.monotonicMs >= prior.monotonicMs), 'invalid clock')
  let after: Snapshot = { ...before }
  const rt = record.header.retest
  const reservationInvalid = !!rt && (time.wallTimeMs >= rt.expiresAtMs || time.wallTimeMs < Math.max(rt.issuedAtMs, prior.wallTimeMs))
  if (command.kind === 'recover') {
    requireIntegrity(Number.isSafeInteger(generation) && generation > before.ownershipGeneration && before.phase !== 'released' && before.phase !== 'completed', 'recovery owner/state')
    // A missing intent/failure marker cannot prove that no action happened. New
    // recoveries require a durable pause checkpoint with no unresolved intent.
    // The explicit policy tag preserves replay of previously recorded v1 events.
    after = { ...after, ownershipGeneration: generation, interruptions: before.interruptions + 1,
      comparisonEligible: before.comparisonEligible && before.exposure !== 'exposure_uncertain' && !before.pendingAction && (command.reason !== 'checkpoint_required_v1' || before.phase === 'paused'),
      pendingAction: null, phase: before.core.status === 'resolved' ? 'resolved' : before.exposure === 'pending_exposure' ? 'pending_exposure' : 'awaiting_presentation' }
  } else {
    requireIntegrity(generation === before.ownershipGeneration, 'stale generation')
    if (command.kind === 'arm') {
      requireIntegrity(['pending_exposure', 'awaiting_presentation'].includes(before.phase), 'cannot arm')
      if (before.exposure === 'pending_exposure' && reservationInvalid) {
        // This transaction positively proves that no arm/mount was authorized.
        return advance(record, { kind: 'release', reason: 'reservation_expired_or_clock_changed' }, time, generation)
      }
      after.phase = 'presentation_armed'
      if (before.exposure === 'pending_exposure') after.exposure = 'exposure_uncertain'
    } else if (command.kind === 'confirm') {
      requireIntegrity(before.phase === 'presentation_armed', 'cannot confirm')
      after.phase = 'active'; after.exposure = 'form_exposed'
      after.confirmedRounds = [...new Set([...before.confirmedRounds, before.core.round])]
      if (before.exposure !== 'form_exposed' && reservationInvalid) {
        // Confirmed onset consumes this exact form even when its deadline was crossed.
        after.comparisonEligible = false; after.phase = 'paused'; after.interruptions++
      }
    } else if (command.kind === 'action_pending') {
      requireIntegrity(['active', 'resolved'].includes(before.phase) && !before.pendingAction, 'action already pending')
      requireIntegrity(transition(before.core, command.action).accepted, 'ineligible action intent')
      after.pendingAction = command.action; after.phase = 'committing_action'
    } else if (command.kind === 'action') {
      requireIntegrity(before.phase === 'committing_action' && equal(before.pendingAction, command.action), 'missing action intent')
      requireIntegrity(before.exposure === 'form_exposed' , 'action before durable presentation')
      requireIntegrity(time.wallTimeMs === command.action.time.wallTimeMs && time.monotonicMs === command.action.time.monotonicMs && time.clockEpochId === command.action.time.clockEpochId, 'action clock mismatch')
      const result = transition(before.core, command.action)
      requireIntegrity(result.accepted, 'stale or duplicate action')
      after.pendingAction = null
      after.core = result.state
      after.phase = command.action.kind === 'next' ? 'awaiting_presentation' : result.state.status
      if (after.phase === 'completed') { requireIntegrity(after.confirmedRounds.length === 39, 'missing presented rounds'); basicReport(after.core) }
    } else if (command.kind === 'pause') {
      requireIntegrity(before.phase !== 'released' && before.phase !== 'completed', 'cannot interrupt finished session')
      after.phase = 'paused'; after.interruptions++
      if (record.header.identity.stage === 'mock') after.comparisonEligible = false
      if (before.exposure === 'exposure_uncertain') after.comparisonEligible = false
      if (command.reason === 'write_failed' || command.reason === 'settings_changed') after.comparisonEligible = false
    } else if (command.kind === 'release') {
      requireIntegrity(before.exposure === 'pending_exposure' && ['pending_exposure', 'paused'].includes(before.phase), 'possible display cannot be released')
      after.phase = 'released'; after.exposure = 'released_unseen'; after.comparisonEligible = false
    } else {
      requireIntegrity(before.phase === 'completed', 'report before completion')
      basicReport(before.core)
    }
  }
  return { header: record.header, snapshot: after, journal: [...record.journal, event(record.header, before, after, command, time, record.journal.length + 1)] }
}
/** Replay every durable operation as well as B1-A core events. Never infer validity from headless_complete. */
export function reconcileDurable(record: DurableRecord): DurableRecord {
  let replay = createRecord(record.header)
  requireIntegrity(equal(record.journal[0], replay.journal[0]), 'assignment evidence mismatch')
  for (const e of record.journal.slice(1)) {
    requireIntegrity(e.command, 'missing command')
    replay = advance(replay, e.command, { wallTimeMs: e.wallTimeMs, monotonicMs: e.monotonicMs, clockEpochId: e.clockEpochId, ...(e.timeOriginMs === null ? {} : { timeOriginMs: e.timeOriginMs }) }, e.ownershipGeneration)
    requireIntegrity(equal(e, replay.journal.at(-1)), 'durable event mismatch')
  }
  requireIntegrity(equal(record, replay), 'snapshot/journal mismatch')
  reconcileSessionPrefix(replay.snapshot.core)
  return replay
}
export function recordFingerprint(record: DurableRecord): string { return canonicalJson(record) }
export function durableBaseline(record: DurableRecord): boolean {
  reconcileDurable(record)
  return record.header.formId.startsWith('BL') && !record.header.repeat && record.snapshot.phase === 'completed' && record.snapshot.comparisonEligible && record.snapshot.exposure === 'form_exposed' && record.snapshot.confirmedRounds.length === 39
}
