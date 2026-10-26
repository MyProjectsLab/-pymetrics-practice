import schema from './schema.json'
import legacySchema from './schema-v1.json'
import registry from './native-identity-registry.json'

export const MOCK_VERSION = 'assessment-practice-full-mock/1.1.0' as const
export const AUTHORIZATION_PROTOCOL = 'ap-mock-authorized-put/1' as const
export const SEQUENCE_VERSION = 'ap-mock-sequence/1' as const
export const ADAPTER_VERSION = 'ap-mock-adapter/2' as const
export const GAMES = ['keypresses', 'stop', 'digits', 'arrows', 'balloons', 'towers', 'lengths', 'cards', 'easy_hard', 'money_1', 'money_2', 'faces'] as const
export type Game = typeof GAMES[number]
export type Classification = 'unknown' | 'normal_complete' | 'task_limit' | 'invalid' | 'incomplete' | 'no_arm'
export type Availability = 'unchecked' | 'available' | 'unavailable' | 'corrupt' | 'deleted' | 'replaced'
export type Resolution = 'pending' | 'normal_complete' | 'task_limit' | 'omitted'
export type Phase = 'preflight' | 'boundary' | 'launching' | 'in_game' | 'checking' | 'break' | 'finished' | 'ended_early'
export type Reason = 'none' | 'natural_limit' | 'technical_interruption' | 'user_exit' | 'unconfirmed' | 'no_inventory' | 'unsupported' | 'missing' | 'corrupt' | 'deleted' | 'replaced' | 'no_arm'
export type Preferences = {
  controls: 'physical_keyboard' | 'alternative'
  reducedMotion: boolean
  digitsMode: 'visual' | 'auditory'
  digitsEntryMs: 20000 | 35000
  lengthsVariant: 'standard' | 'visual_accommodation'
  facesMode: 'standard-v1' | 'extended-v1'
}
export type Setting = { revision: number; atWallMs: number; preferences: Preferences; changedKeys: (keyof Preferences)[] }
export type NativeArm = { requestId: string; attemptId: string | null; originTicketId: string | null; installationId: string; generation: number | null; requestKind: 'start' | 'arm' | 'reserve' | 'assign' | 'open'; nativeIdentity: { key: string; value: string }[] }
export type NativeReference = { adapterVersion: typeof ADAPTER_VERSION; game: Game; databaseFamily: string; installationId: string; generation: number | null; attemptId: string; armRequestId: string; originTicketId: string | null; versions: Record<string, string | null>; settingsRevision: number; resultRevision: number | null }
export type Attempt = { ordinal: number; launchId: string; phase: 'pending_launch' | 'arm_pending' | 'armed' | 'terminal_verified' | 'review_only' | 'canceled_no_arm' | 'accepted' | 'omitted'; ownerDocumentId: string | null; settingsRevision: number; nativeArm: NativeArm | null; reference: NativeReference | null; classification: Classification; availability: Availability; reason: Reason; startedWallMs: number; terminalAcknowledgedWallMs: number | null }
export type Slot = { index: number; game: Game; resolution: Resolution; acceptedLaunchId: string | null; attempts: Attempt[] }
export type BreakRecord = { id: string; kind: 'scheduled' | 'accommodation'; afterSlot: number; startWallMs: number; endWallMs: number | null; clockDocumentId: string; startMonoMs: number; endMonoMs: number | null; elapsedMs: number | null; durationBasis: 'open' | 'monotonic' | 'estimated_wall' | 'unknown' }
export type Receipt = { requestId: string; expectedRevision: number; kind: string; launchId: string | null; resultRevision: number; canonicalMetadata: Record<string, unknown> }
export type Mock = { id: string; ordinal: number; revision: number; version: typeof MOCK_VERSION | 'assessment-practice-full-mock/1.0.0'; protocolStartRevision: number; sequenceVersion: typeof SEQUENCE_VERSION; phase: Phase; cursor: number; createdWallMs: number; checkpointWallMs: number; continuity: 'uninterrupted' | 'resumed' | 'multi_session' | 'multi_session_time_uncertain'; goal: 'early_career_finance' | 'general_practice'; invitation: 'checked' | 'not_available'; localPrivacyAcknowledged: true; settings: Setting[]; slots: Slot[]; breaks: BreakRecord[]; scheduledBreak: 'not_due' | 'offered' | 'declined' | 'taken'; activeLaunchId: string | null; lastCommand: Receipt | null }
export type RootReceipt = { requestId: string; expectedRevision: number; kind: 'create' | 'delete_one' | 'delete_all'; targetMockId: string | null; oldInstallationId: string; newInstallationId: string; resultRevision: number; creationMetadata: { goal: Mock['goal']; invitation: Mock['invitation']; preferences: Preferences; createdWallMs: number } | null }
export type Root = { schema: 'ap-mock-root-v2'; authorizationProtocol: typeof AUTHORIZATION_PROTOCOL; protocolStartRevision: number; installationId: string; revision: number; nextMockOrdinal: number; mocks: Mock[]; lastRootCommand: RootReceipt | null }

type Rule = Record<string, unknown>
const mainSchema = schema as unknown as Rule
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const requestKinds:Record<Game,NativeArm['requestKind']>={keypresses:'start',stop:'reserve',digits:'arm',arrows:'start',balloons:'assign',
  towers:'start',lengths:'start',cards:'start',easy_hard:'start',money_1:'arm',money_2:'arm',faces:'open'}
const nativeIdentityKeys:Partial<Record<Game,readonly string[]>>={lengths:['sessionId'],money_1:['runId','documentId'],money_2:['ownerId'],faces:['routeId','leaseId']}

/** The packet uses this finite JSON Schema 2020-12 vocabulary. Unknown rules fail closed. */
function matches(value: unknown, rule: Rule, path: string, rootSchema = mainSchema): void {
  if (rule.$ref) {
    const ref = rule.$ref
    if (typeof ref !== 'string' || !ref.startsWith('#/$defs/')) throw new Error(`${path}: unsupported schema reference`)
    const resolved = (rootSchema.$defs as Record<string, Rule>)[ref.slice(8)]
    if (!resolved) throw new Error(`${path}: missing schema reference`)
    matches(value, resolved, path, rootSchema)
  }
  if (rule.const !== undefined && !same(value, rule.const)) throw new Error(`${path}: wrong constant`)
  if (rule.enum && !(rule.enum as unknown[]).some(item => same(item, value))) throw new Error(`${path}: outside enum`)
  if (rule.anyOf && !(rule.anyOf as Rule[]).some(candidate => { try { matches(value, candidate, path, rootSchema); return true } catch { return false } })) throw new Error(`${path}: no allowed shape`)
  if (rule.oneOf) {
    const count = (rule.oneOf as Rule[]).filter(candidate => { try { matches(value, candidate, path, rootSchema); return true } catch { return false } }).length
    if (count !== 1) throw new Error(`${path}: ambiguous or absent shape`)
  }
  if (rule.allOf) for (const candidate of rule.allOf as Rule[]) matches(value, candidate, path, rootSchema)
  if (rule.type) {
    if (rule.type === 'null' ? value !== null : rule.type === 'integer' ? !Number.isSafeInteger(value) : rule.type === 'array' ? !Array.isArray(value) : rule.type === 'object' ? !object(value) : typeof value !== rule.type)
      throw new Error(`${path}: wrong type`)
  }
  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < Number(rule.minimum) || rule.maximum !== undefined && value > Number(rule.maximum)) throw new Error(`${path}: number out of range`)
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < Number(rule.minLength) || rule.maxLength !== undefined && value.length > Number(rule.maxLength)) throw new Error(`${path}: string length`)
    if (rule.pattern && !new RegExp(String(rule.pattern)).test(value)) throw new Error(`${path}: pattern`)
    if (rule.format === 'uuid' && !uuid.test(value)) throw new Error(`${path}: UUID`)
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < Number(rule.minItems) || rule.maxItems !== undefined && value.length > Number(rule.maxItems)) throw new Error(`${path}: array length`)
    if (rule.items) value.forEach((item, index) => matches(item, rule.items as Rule, `${path}[${index}]`, rootSchema))
  }
  if (object(value)) {
    const properties = (rule.properties ?? {}) as Record<string, Rule>
    for (const name of (rule.required ?? []) as string[]) if (!(name in value)) throw new Error(`${path}.${name}: missing`)
    for (const [name, member] of Object.entries(value)) {
      if (!(name in properties)) { if (rule.additionalProperties === false) throw new Error(`${path}.${name}: extra`); continue }
      matches(member, properties[name], `${path}.${name}`, rootSchema)
    }
  }
}

export function validatePacketSchema(value: unknown): asserts value is Root { matches(value, mainSchema, 'root') }

export function validatePublicReference(reference: NativeReference): void {
  matches(reference, (mainSchema.$defs as Record<string, Rule>).nativeReference, 'reference')
  const entries = [...registry.current, registry.legacyFacesReview, ...registry.reviewOnly]
  const family = entries.find(item => item.game === reference.game && item.databaseFamily === reference.databaseFamily &&
    Object.entries(item.versions).every(([name, admitted]) => name === 'formId' || name === 'formHash' || reference.versions[name] === admitted))
  if (!family) throw new Error('Native public version tuple is not admitted')
  const formId = reference.versions.formId ?? null, formHash = reference.versions.formHash ?? null
  if (!family.forms.some(form => form.id === formId && form.hash === formHash)) throw new Error('Native public form identity is not admitted')
  if (reference.game === 'money_2' || reference.game === 'faces') {
    if (reference.generation === null) throw new Error('Native installation generation is required')
  } else if (reference.generation !== null) throw new Error('Ownership epoch is not an installation generation')
  if (reference.game !== 'lengths' && reference.resultRevision !== null) throw new Error('Native result revision mismatch')
}

export function validateRoot(value: unknown): asserts value is Root {
  validatePacketSchema(value)
  const root = value as Root
  for (const target of [root, ...root.mocks]) {
    if (!Number.isSafeInteger(target.revision + 1) || target.protocolStartRevision > target.revision + 1) throw Error('Invalid protocol cutover')
  }
  validateSemantics(root)
}
/** Frozen v1 closed shape and unchanged semantic ingress, used only for migration. */
export function validateLegacyRoot(value: unknown): void {
  matches(value, legacySchema as unknown as Rule, 'root', legacySchema as unknown as Rule)
  validateSemantics(value as Root)
}
export function migrateLegacyRoot(value: unknown): Root {
  validateLegacyRoot(value)
  const legacy = value as Root
  if (!Number.isSafeInteger(legacy.revision + 2) || legacy.mocks.some(mock => !Number.isSafeInteger(mock.revision + 1))) throw Error('Protocol migration revision overflow')
  const root: Root = { ...structuredClone(legacy), schema: 'ap-mock-root-v2', authorizationProtocol: AUTHORIZATION_PROTOCOL,
    revision: legacy.revision + 1, protocolStartRevision: legacy.revision + 2,
    mocks: legacy.mocks.map(mock => ({ ...structuredClone(mock), protocolStartRevision: mock.revision + 1 })) }
  validateRoot(root)
  return root
}
function validateSemantics(root: Root): void {
  if(root.lastRootCommand){const receipt=root.lastRootCommand
    if(receipt.expectedRevision+1!==receipt.resultRevision||receipt.resultRevision>root.revision||
      (receipt.kind==='create')!==(receipt.creationMetadata!==null)||
      (receipt.kind==='delete_all'?receipt.newInstallationId!==root.installationId:
        receipt.oldInstallationId!==root.installationId||receipt.newInstallationId!==root.installationId))
      throw new Error('Invalid root command receipt')
  }
  const mocks = new Set<string>(), ordinals = new Set<number>(), launches = new Set<string>()
  for (const mock of root.mocks) {
    if (mock.id !== `M${root.installationId}.${mock.ordinal}` || mock.ordinal >= root.nextMockOrdinal || mocks.has(mock.id) || ordinals.has(mock.ordinal)) throw new Error('Invalid or repeated mock identity')
    mocks.add(mock.id); ordinals.add(mock.ordinal)
    if (mock.slots.length !== 12 || mock.cursor < 1 || mock.cursor > 13) throw new Error('Invalid sequence cursor')
    if(mock.lastCommand&&(mock.lastCommand.expectedRevision+1!==mock.lastCommand.resultRevision||
      mock.lastCommand.resultRevision>mock.revision))throw new Error('Invalid mock command receipt')
    if(mock.phase==='preflight'&&(mock.cursor!==1||mock.activeLaunchId!==null)||
      ['boundary','break','finished','ended_early'].includes(mock.phase)&&mock.activeLaunchId!==null||
      ['launching','in_game','checking'].includes(mock.phase)&&mock.activeLaunchId===null)
      throw new Error('Invalid phase/active launch')
    if(mock.phase==='finished'&&mock.slots.some(slot=>slot.resolution==='pending')||
      mock.phase==='ended_early'&&mock.cursor===13||
      mock.phase==='preflight'&&mock.slots.some(slot=>slot.attempts.length>0))throw new Error('Invalid terminal phase topology')
    if (mock.settings.some((s, i) => s.revision !== i + 1 || (i === 0 ? s.changedKeys.length !== 0 :
      !same(s.changedKeys, Object.keys(s.preferences).filter(key => s.preferences[key as keyof Preferences] !== mock.settings[i - 1].preferences[key as keyof Preferences]).sort())))) throw new Error('Invalid settings revisions')
    if(mock.settings[0].atWallMs!==mock.createdWallMs)throw new Error('Invalid initial settings time')
    let active = 0
    for (const [index, slot] of mock.slots.entries()) {
      if (slot.index !== index + 1 || slot.game !== GAMES[index]) throw new Error('Invalid slot order')
      if (index < mock.cursor - 1 && slot.resolution === 'pending' || index >= mock.cursor && (slot.resolution !== 'pending'||slot.attempts.length>0)||
        index===mock.cursor-1&&slot.resolution!=='pending'&&mock.phase!=='finished') throw new Error('Invalid slot resolution topology')
      if (slot.resolution === 'omitted' ? slot.acceptedLaunchId !== null : slot.resolution !== 'pending' && slot.acceptedLaunchId === null) throw new Error('Invalid accepted launch')
      if(slot.resolution==='pending'&&slot.acceptedLaunchId!==null||slot.resolution==='task_limit'&&slot.game!=='towers')throw new Error('Invalid slot resolution')
      for (const [attemptIndex, attempt] of slot.attempts.entries()) {
        if (attempt.ordinal !== attemptIndex + 1 || launches.has(attempt.launchId) || attempt.settingsRevision > mock.settings.length) throw new Error('Invalid attempt identity')
        launches.add(attempt.launchId)
        if (['pending_launch','arm_pending','armed','terminal_verified'].includes(attempt.phase) &&
          (attempt.launchId!==mock.activeLaunchId || slot.index!==mock.cursor || slot.resolution!=='pending'))
          throw new Error('Unresolved attempt has no current launch authority')
        if (attempt.launchId === mock.activeLaunchId) active++
        if(attempt.phase==='pending_launch'&&(attempt.nativeArm!==null||attempt.reference!==null||attempt.classification!=='unknown'||attempt.terminalAcknowledgedWallMs!==null)||
          attempt.phase==='arm_pending'&&(attempt.nativeArm===null||attempt.reference!==null||attempt.classification!=='unknown')||
          attempt.phase==='armed'&&(attempt.nativeArm===null||attempt.reference===null||attempt.classification!=='unknown')||
          attempt.phase==='terminal_verified'&&(attempt.nativeArm===null||attempt.reference===null||!['normal_complete','task_limit','invalid','incomplete'].includes(attempt.classification)||attempt.terminalAcknowledgedWallMs===null)||
          attempt.phase==='accepted'&&(attempt.nativeArm===null||attempt.reference===null||!['normal_complete','task_limit'].includes(attempt.classification)||attempt.classification!==slot.resolution)||
          attempt.phase==='review_only'&&(attempt.nativeArm===null||!['normal_complete','task_limit','invalid','incomplete'].includes(attempt.classification))||
          attempt.phase==='canceled_no_arm'&&(attempt.reference!==null||attempt.classification!=='no_arm'||attempt.reason!=='no_arm'))
          throw new Error('Invalid attempt semantic state')
        if(attempt.nativeArm?.attemptId===null&&slot.game!=='money_2')throw new Error('Unexpected source allocated attempt identity')
        if(attempt.nativeArm?.requestKind!==undefined&&attempt.nativeArm.requestKind!==requestKinds[slot.game]||
          attempt.nativeArm&&slot.game==='money_2'&&(attempt.nativeArm.attemptId!==null||attempt.nativeArm.originTicketId===null)||
          attempt.nativeArm&&slot.game!=='money_2'&&attempt.nativeArm.originTicketId!==null||
          attempt.nativeArm&&!(same(attempt.nativeArm.nativeIdentity.map(item=>item.key).sort(),[...(nativeIdentityKeys[slot.game]??[])].sort()))||
          attempt.nativeArm&&slot.game==='lengths'&&attempt.nativeArm.nativeIdentity[0]?.value!==attempt.nativeArm.attemptId||
          attempt.nativeArm&&slot.game==='money_1'&&attempt.nativeArm.nativeIdentity.find(item=>item.key==='runId')?.value!==attempt.nativeArm.attemptId)
          throw new Error('Invalid source arm kind or allocation ticket')
        if(attempt.classification==='task_limit'&&slot.game!=='towers')throw new Error('Invalid native classification')
        if(attempt.availability==='available'&&['deleted','replaced','corrupt','missing'].includes(attempt.reason)||
          attempt.availability==='deleted'&&attempt.reason!=='deleted'||
          attempt.availability==='replaced'&&attempt.reason!=='replaced'||
          attempt.availability==='corrupt'&&attempt.reason!=='corrupt'||
          attempt.availability==='unavailable'&&!['missing','unconfirmed','unsupported'].includes(attempt.reason))
          throw new Error('Invalid source availability reason')
        if(attempt.classification==='task_limit'&&!['natural_limit','deleted','replaced','corrupt','missing','unconfirmed','unsupported','user_exit'].includes(attempt.reason)||
          attempt.phase==='accepted'&&slot.game==='stop'&&attempt.reference?.versions.report!== 'stop_report_v13'||
          attempt.phase==='accepted'&&slot.game==='lengths'&&(!attempt.reference?.resultRevision||attempt.reference.resultRevision<1)||
          attempt.phase==='accepted'&&attempt.classification==='task_limit'&&attempt.reason!=='natural_limit'&&attempt.availability==='available')
          throw new Error('Invalid native terminal tuple')
        if (attempt.nativeArm && attempt.reference && (attempt.nativeArm.installationId !== attempt.reference.installationId ||
          attempt.nativeArm.generation !== attempt.reference.generation || attempt.nativeArm.requestId !== attempt.reference.armRequestId ||
          attempt.nativeArm.attemptId !== null && attempt.nativeArm.attemptId !== attempt.reference.attemptId ||
          attempt.nativeArm.originTicketId !== attempt.reference.originTicketId)) throw new Error('Native arm/reference identity mismatch')
        if (attempt.reference) {
          if (attempt.reference.game !== slot.game || attempt.reference.settingsRevision !== attempt.settingsRevision) throw new Error('Reference slot/settings mismatch')
          validatePublicReference(attempt.reference)
        }
        if (attempt.phase === 'pending_launch' && (attempt.nativeArm || attempt.reference) || attempt.phase === 'arm_pending' && !attempt.nativeArm ||
          attempt.phase === 'accepted' && (slot.acceptedLaunchId !== attempt.launchId || !attempt.reference)) throw new Error('Invalid attempt phase topology')
        if(attempt.phase==='accepted'&&attempt.terminalAcknowledgedWallMs===null||
          attempt.phase==='armed'&&attempt.terminalAcknowledgedWallMs!==null||
          attempt.phase==='canceled_no_arm'&&attempt.terminalAcknowledgedWallMs!==null||
          attempt.phase==='omitted'&&slot.resolution!=='omitted')throw new Error('Invalid attempt acknowledgement')
      }
      if (slot.acceptedLaunchId && !slot.attempts.some(attempt => attempt.launchId === slot.acceptedLaunchId && attempt.phase === 'accepted')) throw new Error('Accepted launch missing')
    }
    if (mock.activeLaunchId === null ? active !== 0 : active !== 1) throw new Error('Invalid active launch topology')
    const current=mock.slots[mock.cursor-1],live=current?.attempts.find(item=>item.launchId===mock.activeLaunchId)
    if(mock.activeLaunchId!==null&&(!live||mock.phase==='launching'&&live.phase!=='pending_launch'||
      mock.phase==='in_game'&&!['arm_pending','armed'].includes(live.phase)||
      mock.phase==='checking'&&live.phase!=='terminal_verified'))throw new Error('Invalid live attempt phase')
    if(live&&current?.attempts.at(-1)!==live)throw new Error('Active attempt is not the latest launch')
    if (mock.cursor === 13 && mock.phase !== 'finished' || mock.phase === 'finished' && mock.cursor !== 13) throw new Error('Invalid terminal cursor')
    const openBreaks=mock.breaks.filter(record=>record.endWallMs===null)
    if(openBreaks.length>1||(mock.phase==='break')!==(openBreaks.length===1)||
      mock.breaks.filter(record=>record.kind==='scheduled').length>1||
      new Set(mock.breaks.map(record=>record.id)).size!==mock.breaks.length||
      openBreaks.length===1&&mock.breaks.at(-1)!==openBreaks[0])throw new Error('Invalid break topology')
    for(const record of mock.breaks){
      if(record.kind==='scheduled'&&record.afterSlot!==6||record.afterSlot<0||record.afterSlot>11||record.afterSlot>=mock.cursor)throw new Error('Invalid break position')
      if(record.endWallMs===null){if(record.endMonoMs!==null||record.elapsedMs!==null||record.durationBasis!=='open')throw new Error('Invalid open break')}
      else if(record.durationBasis==='open'||record.durationBasis==='monotonic'&&(!Number.isSafeInteger(record.endMonoMs)||record.endMonoMs!<record.startMonoMs||record.elapsedMs!==record.endMonoMs!-record.startMonoMs)||
        record.durationBasis==='estimated_wall'&&(record.endMonoMs!==null||record.endWallMs<record.startWallMs||record.elapsedMs!==record.endWallMs-record.startWallMs)||
        record.durationBasis==='unknown'&&(record.endMonoMs!==null||record.elapsedMs!==null||record.endWallMs>=record.startWallMs))throw new Error('Invalid closed break arithmetic')
    }
  }
}

export function initialPreferences(): Preferences { return { controls: 'physical_keyboard', reducedMotion: false, digitsMode: 'visual', digitsEntryMs: 20000, lengthsVariant: 'standard', facesMode: 'standard-v1' } }
export function freshRoot(installationId: string = crypto.randomUUID()): Root { return { schema: 'ap-mock-root-v2', authorizationProtocol: AUTHORIZATION_PROTOCOL, protocolStartRevision: 1, installationId, revision: 0, nextMockOrdinal: 1, mocks: [], lastRootCommand: null } }
