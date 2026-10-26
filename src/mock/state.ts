import { GAMES, MOCK_VERSION, SEQUENCE_VERSION, initialPreferences, validateRoot } from './contract'
import type { Attempt, Availability, BreakRecord, Classification, Mock, NativeArm, NativeReference, Preferences, Reason, Root, Slot } from './contract'

export type MockCommand = {
  requestId: string
  expectedRevision: number
  kind: 'start' | 'launch' | 'arm_pending' | 'bind_arm' | 'terminal' | 'source_status' | 'accept' | 'cancel_no_arm' | 'review_only' | 'omit' | 'settings' | 'break_start' | 'break_end' | 'decline_break' | 'leave' | 'resume' | 'finish_early'
  launchId: string | null
  canonicalMetadata: Record<string, unknown>
}
const clone = <T>(value: T): T => structuredClone(value)
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,member])=>[key,canonical(member)]))
  return value
}
export const canonicalEqual = (a:unknown,b:unknown) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const exact = canonicalEqual
function assert(ok: unknown, reason: string): asserts ok { if (!ok) throw new Error(reason) }
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const metadataFields: Record<MockCommand['kind'], readonly string[]> = {
  start: ['checkpointWallMs'], launch: ['slot', 'settingsRevision'], arm_pending: ['slot', 'settingsRevision', 'nativeArm'],
  bind_arm: ['slot', 'reference'], terminal: ['slot', 'reference', 'classification', 'reason'],
  source_status: ['slot', 'reference', 'availability', 'reason'], accept: ['slot', 'reference', 'classification', 'checkpointWallMs'],
  cancel_no_arm: ['slot', 'reason'], review_only: ['slot', 'classification', 'reason'],
  omit: ['slot', 'reason', 'checkpointWallMs'], settings: ['settingsRevision', 'preferences', 'checkpointWallMs'],
  break_start: ['breakId', 'checkpointWallMs', 'breakRecord'], break_end: ['breakId', 'checkpointWallMs', 'breakRecord'],
  decline_break: ['checkpointWallMs'], leave: ['checkpointWallMs'], resume: ['checkpointWallMs', 'continuity'],
  finish_early: ['checkpointWallMs'],
}
function admittedMetadata(command: MockCommand) {
  const expected = metadataFields[command.kind]
  assert(Object.keys(command.canonicalMetadata).sort().join() === [...expected].sort().join(), 'Noncanonical command metadata')
  assert(uuid(command.requestId) && integer(command.expectedRevision), 'Invalid command identity')
}
function currentAttempt(mock: Mock, command: MockCommand): { slot: Slot; attempt: Attempt } {
  const slot = mock.slots[mock.cursor - 1]
  assert(slot && slot.index === command.canonicalMetadata.slot && mock.activeLaunchId && command.launchId === mock.activeLaunchId, 'Stale launch')
  const attempt = slot.attempts.find(item => item.launchId === mock.activeLaunchId)
  assert(attempt, 'Active attempt missing')
  return { slot, attempt }
}
function boundary(mock: Mock): void { assert(mock.phase === 'boundary' && mock.activeLaunchId === null && mock.cursor <= 12, 'Not at a settled boundary') }
function advance(mock: Mock, wall: unknown) {
  assert(integer(wall), 'Invalid checkpoint')
  mock.cursor++
  mock.checkpointWallMs = wall
  mock.activeLaunchId = null
  if (mock.cursor === 13) mock.phase = 'finished'
  else { mock.phase = 'boundary'; if (mock.cursor === 7 && mock.scheduledBreak === 'not_due') mock.scheduledBreak = 'offered' }
}
function continuityAt(mock:Mock,wall:number){
  const gap=wall-mock.checkpointWallMs
  const label=gap<0?'multi_session_time_uncertain':gap<=86_400_000?'resumed':'multi_session'
  const rank={uninterrupted:0,resumed:1,multi_session:2,multi_session_time_uncertain:3}
  return rank[label]>rank[mock.continuity]?label:mock.continuity
}
function assertReference(attempt: Attempt, reference: unknown): asserts reference is NativeReference {
  assert(reference && typeof reference === 'object', 'Missing native reference')
  const candidate = reference as NativeReference, arm = attempt.nativeArm
  assert(arm && candidate.installationId === arm.installationId && candidate.generation === arm.generation &&
    candidate.armRequestId === arm.requestId && (arm.attemptId === null || candidate.attemptId === arm.attemptId) &&
    candidate.originTicketId === arm.originTicketId && candidate.settingsRevision === attempt.settingsRevision, 'Native reference does not match the bound arm')
}
function assignReference(attempt: Attempt, reference: NativeReference) {
  assertReference(attempt, reference)
  if (attempt.reference) assert(exact(attempt.reference, reference), 'Reference replacement rejected')
  else attempt.reference = clone(reference)
}
export function makeMock(root: Root, goal: Mock['goal'], invitation: Mock['invitation'], preferences: Preferences, createdWallMs: number): Mock {
  assert(integer(createdWallMs), 'Invalid creation time')
  const ordinal = root.nextMockOrdinal
  return { id: `M${root.installationId}.${ordinal}`, ordinal, revision: 0, protocolStartRevision: 1, version: MOCK_VERSION, sequenceVersion: SEQUENCE_VERSION,
    phase: 'preflight', cursor: 1, createdWallMs, checkpointWallMs: createdWallMs, continuity: 'uninterrupted', goal, invitation,
    localPrivacyAcknowledged: true, settings: [{ revision: 1, atWallMs: createdWallMs, preferences: clone(preferences), changedKeys: [] }],
    slots: GAMES.map((game, index) => ({ index: index + 1, game, resolution: 'pending', acceptedLaunchId: null, attempts: [] })),
    breaks: [], scheduledBreak: 'not_due', activeLaunchId: null, lastCommand: null }
}
export function createMock(root: Root, args: { requestId: string; expectedRevision: number; goal: Mock['goal']; invitation: Mock['invitation']; preferences?: Preferences; createdWallMs: number }): Root {
  validateRoot(root)
  const preferences = args.preferences ?? initialPreferences()
  const creationMetadata = { goal: args.goal, invitation: args.invitation, preferences, createdWallMs: args.createdWallMs }
  const prior = root.lastRootCommand
  if (prior?.requestId === args.requestId) { assert(prior.resultRevision >= root.protocolStartRevision, 'Legacy receipt cannot be replayed');
    assert(prior.kind === 'create' && prior.expectedRevision === args.expectedRevision && exact(prior.creationMetadata, creationMetadata), 'Conflicting root request')
    return root
  }
  assert(uuid(args.requestId) && root.revision === args.expectedRevision && root.mocks.length < 50, 'Create retired, stale or at capacity')
  const next = clone(root), mock = makeMock(next, args.goal, args.invitation, preferences, args.createdWallMs)
  next.mocks.push(mock); next.nextMockOrdinal++; next.revision++
  next.lastRootCommand = { requestId: args.requestId, expectedRevision: args.expectedRevision, kind: 'create', targetMockId: mock.id,
    oldInstallationId: next.installationId, newInstallationId: next.installationId, resultRevision: next.revision, creationMetadata }
  validateRoot(next)
  return next
}
/** Target document admission is a CAS on the persisted launch, after global live ownership is acquired. */
export function claimLaunch(root: Root, args: { mockId: string; launchId: string; game: Slot['game']; documentId: string; expectedRevision: number }): Root {
  validateRoot(root)
  assert(uuid(args.documentId), 'Invalid document identity')
  const next = clone(root), mock = next.mocks.find(item => item.id === args.mockId)
  assert(mock && mock.activeLaunchId === args.launchId && mock.phase === 'launching', 'Launch retired')
  const slot = mock.slots[mock.cursor - 1], attempt = slot?.attempts.find(item => item.launchId === args.launchId)
  assert(slot?.game === args.game && attempt?.phase === 'pending_launch', 'Wrong game or launch state')
  if (attempt.ownerDocumentId === args.documentId) return root
  assert(attempt.ownerDocumentId === null && mock.revision === args.expectedRevision, 'Launch already claimed')
  attempt.ownerDocumentId = args.documentId
  mock.revision++; next.revision++
  validateRoot(next)
  return next
}
export function applyMockCommand(root: Root, mockId: string, command: MockCommand): Root {
  validateRoot(root); admittedMetadata(command)
  const next = clone(root), mock = next.mocks.find(item => item.id === mockId)
  assert(mock, 'Mock missing or retired')
  const old = mock.lastCommand
  if (old?.requestId === command.requestId) { assert(old.resultRevision >= mock.protocolStartRevision, 'Legacy receipt cannot be replayed');
    assert(old.kind === command.kind && old.launchId === command.launchId && old.expectedRevision === command.expectedRevision &&
      exact(old.canonicalMetadata, command.canonicalMetadata), 'Conflicting command retry')
    return root
  }
  assert(command.expectedRevision === mock.revision, 'Retired or superseded command')
  const data = command.canonicalMetadata
  switch (command.kind) {
    case 'start':
      assert(mock.phase === 'preflight' && integer(data.checkpointWallMs), 'Invalid start')
      mock.phase = 'boundary'; mock.checkpointWallMs = data.checkpointWallMs; break
    case 'launch': {
      boundary(mock)
      const slot = mock.slots[mock.cursor - 1]
      assert(data.slot === mock.cursor && data.settingsRevision === mock.settings.length && uuid(command.launchId) && slot.attempts.length < 16, 'Invalid launch or attempt cap')
      const attempt: Attempt = { ordinal: slot.attempts.length + 1, launchId: command.launchId, phase: 'pending_launch', ownerDocumentId: null,
        settingsRevision: mock.settings.length, nativeArm: null, reference: null, classification: 'unknown', availability: 'unchecked', reason: 'none',
        startedWallMs: Date.now(), terminalAcknowledgedWallMs: null }
      slot.attempts.push(attempt); mock.activeLaunchId = command.launchId; mock.phase = 'launching'; break
    }
    case 'arm_pending': {
      const { attempt } = currentAttempt(mock, command)
      assert(attempt.phase === 'pending_launch' && data.settingsRevision === attempt.settingsRevision && data.nativeArm && typeof data.nativeArm === 'object', 'Invalid arm pending')
      attempt.nativeArm = clone(data.nativeArm as NativeArm); attempt.phase = 'arm_pending'; mock.phase = 'in_game'; break
    }
    case 'bind_arm': {
      const { attempt } = currentAttempt(mock, command)
      assert(attempt.phase === 'arm_pending' && data.reference, 'Invalid arm binding')
      assignReference(attempt, data.reference as NativeReference); attempt.phase = 'armed'; break
    }
    case 'terminal': {
      const { attempt } = currentAttempt(mock, command)
      assert(['arm_pending', 'armed', 'terminal_verified'].includes(attempt.phase) && data.reference, 'Invalid terminal')
      assert(['normal_complete', 'task_limit', 'invalid', 'incomplete'].includes(String(data.classification)), 'Invalid terminal classification')
      assignReference(attempt, data.reference as NativeReference)
      if (attempt.phase === 'terminal_verified') assert(attempt.classification === data.classification, 'Terminal replacement rejected')
      attempt.classification = data.classification as Classification; attempt.reason = data.reason as Reason; attempt.availability = 'available'
      attempt.phase = 'terminal_verified'; attempt.terminalAcknowledgedWallMs = Date.now(); mock.phase = 'checking'; break
    }
    case 'accept': {
      const { slot, attempt } = currentAttempt(mock, command)
      assert(attempt.phase === 'terminal_verified' && attempt.availability === 'available' && attempt.reference && exact(attempt.reference, data.reference) &&
        attempt.classification === data.classification && ['normal_complete', 'task_limit'].includes(attempt.classification), 'Native terminal must be revalidated before acceptance')
      slot.resolution = attempt.classification as 'normal_complete' | 'task_limit'; slot.acceptedLaunchId = attempt.launchId; attempt.phase = 'accepted'
      advance(mock, data.checkpointWallMs); break
    }
    case 'source_status': {
      const slot = next.mocks.find(item => item.id === mockId)?.slots[Number(data.slot) - 1]
      const attempt = slot?.attempts.find(item => item.launchId === command.launchId)
      assert(attempt && attempt.reference && exact(attempt.reference, data.reference) && ['available', 'unavailable', 'corrupt', 'deleted', 'replaced'].includes(String(data.availability)), 'Invalid source status')
      attempt.availability = data.availability as Availability; attempt.reason = data.reason as Reason; break
    }
    case 'cancel_no_arm': {
      const { attempt } = currentAttempt(mock, command)
      assert(['pending_launch', 'arm_pending'].includes(attempt.phase) && data.reason === 'no_arm', 'Cannot infer missing native arm')
      attempt.phase = 'canceled_no_arm'; attempt.classification = 'no_arm'; attempt.reason = 'no_arm'; mock.activeLaunchId = null; mock.phase = 'boundary'; break
    }
    case 'review_only': {
      const { attempt } = currentAttempt(mock, command)
      assert(['arm_pending', 'armed', 'terminal_verified'].includes(attempt.phase) && ['normal_complete', 'task_limit', 'invalid', 'incomplete'].includes(String(data.classification)), 'Invalid review-only transition')
      if (attempt.classification !== 'unknown') assert(attempt.classification === data.classification, 'Cannot relabel source terminal')
      attempt.phase = 'review_only'; attempt.classification = data.classification as Classification; attempt.reason = data.reason as Reason
      if(['missing','unsupported','deleted','replaced','corrupt'].includes(String(data.reason)))attempt.availability=['missing','unsupported'].includes(String(data.reason))?'unavailable':data.reason as Availability
      mock.activeLaunchId = null; mock.phase = 'boundary'; break
    }
    case 'omit': {
      boundary(mock)
      assert(data.slot === mock.cursor && typeof data.reason === 'string', 'Invalid omission')
      mock.slots[mock.cursor - 1].resolution = 'omitted'; advance(mock, data.checkpointWallMs); break
    }
    case 'settings': {
      boundary(mock)
      const previous = mock.settings.at(-1)!
      assert(data.settingsRevision === previous.revision + 1 && mock.settings.length < 64 && data.preferences && integer(data.checkpointWallMs), 'Invalid settings revision')
      const preferences = data.preferences as Preferences
      const changedKeys = (Object.keys(preferences) as (keyof Preferences)[]).filter(key => preferences[key] !== previous.preferences[key]).sort()
      assert(changedKeys.length > 0, 'No-op settings')
      mock.settings.push({ revision: previous.revision + 1, atWallMs: data.checkpointWallMs, preferences: clone(preferences), changedKeys }); mock.checkpointWallMs = data.checkpointWallMs; break
    }
    case 'break_start': {
      boundary(mock)
      const record = data.breakRecord as BreakRecord
      assert(mock.breaks.length < 64 && record?.id === data.breakId && record.afterSlot === mock.cursor - 1 && record.endWallMs === null &&
        record.durationBasis === 'open' && (record.kind === 'accommodation' || mock.scheduledBreak === 'offered' && mock.cursor === 7), 'Invalid break start')
      mock.breaks.push(clone(record)); mock.phase = 'break'; mock.checkpointWallMs = data.checkpointWallMs as number
      if (record.kind === 'scheduled') mock.scheduledBreak = 'taken'
      break
    }
    case 'break_end': {
      const record = mock.breaks.at(-1), end = data.breakRecord as BreakRecord
      assert(mock.phase === 'break' && record && record.endWallMs === null && record.id === data.breakId && end?.id === record.id &&
        end.startWallMs === record.startWallMs && end.kind === record.kind && end.afterSlot === record.afterSlot &&
        end.startMonoMs===record.startMonoMs && end.clockDocumentId===record.clockDocumentId, 'Invalid break end')
      const sameDocument = record.clockDocumentId === end.clockDocumentId && integer(end.endMonoMs) && end.endMonoMs >= record.startMonoMs
      const elapsed = sameDocument ? end.endMonoMs! - record.startMonoMs : integer(end.endWallMs) && end.endWallMs >= record.startWallMs ? end.endWallMs - record.startWallMs : null
      assert(end.elapsedMs === elapsed && end.durationBasis === (sameDocument ? 'monotonic' : elapsed === null ? 'unknown' : 'estimated_wall'), 'Invalid break duration')
      assert(integer(data.checkpointWallMs),'Invalid break return checkpoint')
      // A break closed by its original document is ordinary continuous practice.
      // A reloaded break returns from the old durable checkpoint.
      if(end.durationBasis!=='monotonic')mock.continuity=continuityAt(mock,data.checkpointWallMs as number)
      mock.breaks[mock.breaks.length - 1] = clone(end); mock.phase = 'boundary'; mock.checkpointWallMs = data.checkpointWallMs as number; break
    }
    case 'decline_break':
      // Older sessions may retain the original offer after advancing past game 7.
      // Only an explicit present-tense decline settles that already recorded offer.
      boundary(mock); assert(mock.scheduledBreak === 'offered' && mock.cursor >= 7 && mock.cursor <= 12 && integer(data.checkpointWallMs), 'Break not offered')
      mock.scheduledBreak = 'declined'; mock.checkpointWallMs = data.checkpointWallMs; break
    case 'leave':
      boundary(mock); assert(integer(data.checkpointWallMs), 'Invalid leave checkpoint'); mock.checkpointWallMs = data.checkpointWallMs; break
    case 'resume': {
      boundary(mock); assert(integer(data.checkpointWallMs), 'Invalid resume')
      const escalated=continuityAt(mock,data.checkpointWallMs as number)
      assert(data.continuity === escalated, 'Continuity label mismatch')
      mock.continuity = escalated; mock.checkpointWallMs = data.checkpointWallMs; break
    }
    case 'finish_early':
      boundary(mock); assert(integer(data.checkpointWallMs), 'Invalid finish checkpoint'); mock.phase = 'ended_early'; mock.checkpointWallMs = data.checkpointWallMs; break
  }
  mock.revision++; next.revision++
  mock.lastCommand = { ...clone(command), resultRevision: mock.revision }
  validateRoot(next)
  return next
}
export function deleteMock(root: Root, args: { requestId: string; expectedRevision: number; targetMockId: string }): Root {
  validateRoot(root)
  const prior = root.lastRootCommand
  if (prior?.requestId === args.requestId) { assert(prior.resultRevision >= root.protocolStartRevision, 'Legacy receipt cannot be replayed'); assert(prior.kind === 'delete_one' && prior.expectedRevision === args.expectedRevision && prior.targetMockId === args.targetMockId, 'Conflicting delete'); return root }
  assert(uuid(args.requestId) && root.revision === args.expectedRevision, 'Delete retired or stale')
  const next = clone(root), index = next.mocks.findIndex(item => item.id === args.targetMockId)
  assert(index >= 0, 'Mock already deleted')
  assert(!['launching','in_game','checking'].includes(next.mocks[index].phase), 'Close the active mock before deleting its history')
  next.mocks.splice(index, 1); next.revision++
  next.lastRootCommand = { requestId: args.requestId, expectedRevision: args.expectedRevision, kind: 'delete_one', targetMockId: args.targetMockId,
    oldInstallationId: next.installationId, newInstallationId: next.installationId, resultRevision: next.revision, creationMetadata: null }
  validateRoot(next); return next
}
export function deleteAllMocks(root: Root, args: { requestId: string; expectedRevision: number; newInstallationId: string }): Root {
  validateRoot(root)
  const prior = root.lastRootCommand
  if (prior?.requestId === args.requestId) { assert(prior.resultRevision >= root.protocolStartRevision, 'Legacy receipt cannot be replayed'); assert(prior.kind === 'delete_all' && prior.expectedRevision === args.expectedRevision && prior.newInstallationId === args.newInstallationId, 'Conflicting reset'); return root }
  assert(uuid(args.requestId) && uuid(args.newInstallationId) && args.newInstallationId !== root.installationId && root.revision === args.expectedRevision, 'Reset retired or stale')
  assert(root.mocks.every(item => !['launching','in_game','checking'].includes(item.phase)), 'Close the active mock before deleting its history')
  const next: Root = { schema: 'ap-mock-root-v2', authorizationProtocol: root.authorizationProtocol, protocolStartRevision: root.protocolStartRevision, installationId: args.newInstallationId, revision: root.revision + 1, nextMockOrdinal: 1, mocks: [],
    lastRootCommand: { requestId: args.requestId, expectedRevision: args.expectedRevision, kind: 'delete_all', targetMockId: null,
      oldInstallationId: root.installationId, newInstallationId: args.newInstallationId, resultRevision: root.revision + 1, creationMetadata: null } }
  validateRoot(next); return next
}
