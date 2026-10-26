import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'
import type { FormFamily, FormId, ManifestRound, Profile, ScoredManifest } from './contracts'
import { BALLOONS_FORM_VERSION } from './contracts'

const forms: readonly { id: FormId; family: FormFamily; seed: number }[] = [
  { id: 'BL1', family: 'baseline', seed: 1 }, { id: 'BL2', family: 'baseline', seed: 3 },
  { id: 'BL3', family: 'baseline', seed: 15 }, { id: 'RP1', family: 'replay', seed: 16 },
  { id: 'RP2', family: 'replay', seed: 20 }, { id: 'RP3', family: 'replay', seed: 23 },
  { id: 'RT1', family: 'retest', seed: 24 }, { id: 'RT2', family: 'retest', seed: 33 },
  { id: 'RT3', family: 'retest', seed: 34 },
]
const profiles: readonly Profile[] = ['A', 'B', 'C']
const maxima: Record<Profile, number> = { A: 12, B: 24, C: 48 }
const bands: Record<Profile, readonly [number, number]> = { A: [63, 93], B: [125, 187], C: [250, 374] }
const shaPattern = /^[0-9a-f]{64}$/
const approvedHashes = [
  '9e5744f3c65cdd60256787da63ab13628cb90eac9b926a792b01da01e949b97e',
  'ec91d8c3944b92f607bb74954e24e3d3a69576e7857cf78be56796640493881d',
  '9f1c356991a1dd4493698c32a0150c9cc21d1674629347de72fb8febd8071239',
  '4425f093e748a4036184b72f3f9b17a68776a03ccc38ac5b05eef5fc49537621',
  'a4b1ac4393e3f836362cc6e1cb2afb45fd89e5b2736b92f2460c67d5a350a5ce',
  '107a47a641ad7f131b1ea20a63c218d863d8ce0cc4776f9d07884852a1d96ec3',
  '009ca6aa68806d997f12f23f2a1015ae7942d7fa4dcf233c8bb942af961eba39',
  'e1d93ad34f6f52cb0b57a436e04803b446a9ee0eaffbd9e6e1c5722a112d23e1',
  '49a78684cd10a770079c1a10ec980815f7f5eb12fb2a12aa54f53394390e5b38',
] as const
const verified = new WeakSet<ScoredManifest>()
const verifiedById = new Map<FormId, ScoredManifest>()

export function isVerifiedScoredManifest(value: ScoredManifest): boolean {
  return verified.has(value)
}

/** Read-only authority for report replay; populated only by a successful hash-verified load. */
export function verifiedScoredManifest(id: FormId): ScoredManifest | undefined {
  return verifiedById.get(id)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Balloons manifest integrity: ${message}`)
}
function keys(value: object, expected: readonly string[]) {
  assert(Object.keys(value).sort().join('|') === [...expected].sort().join('|'), 'unexpected object fields')
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
/** Lexically sorted JSON object keys; arrays retain order, matching frozen §4. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function inspectRound(value: unknown, index: number): asserts value is ManifestRound {
  assert(object(value), 'round is not an object')
  keys(value, ['round', 'profile', 'threshold'])
  assert(value.round === index + 1, 'round index mismatch')
  assert(profiles.includes(value.profile as Profile), 'unknown profile')
  const max = maxima[value.profile as Profile]
  assert(Number.isInteger(value.threshold) && (value.threshold as number) >= 1 && (value.threshold as number) <= max, 'threshold outside support')
}
function inspectOrder(rounds: readonly ManifestRound[]) {
  for (let block = 0; block < 3; block++) {
    const counts = profiles.map(profile => rounds.slice(block * 13, block * 13 + 13).filter(round => round.profile === profile).length)
    // The caller checks the seed-specific extra profile below.
    assert(counts.reduce((a, b) => a + b, 0) === 13 && counts.every(count => count === 4 || count === 5), 'block composition')
  }
  for (let i = 0; i < rounds.length; i++) {
    if (i >= 3) assert(!(rounds[i].profile === rounds[i - 1].profile && rounds[i].profile === rounds[i - 2].profile && rounds[i].profile === rounds[i - 3].profile), 'profile run >3')
    if (i >= 5) {
      const p = rounds.slice(i - 5, i + 1).map(round => round.profile)
      assert(!(p[0] !== p[1] && p[0] === p[2] && p[0] === p[4] && p[1] === p[3] && p[1] === p[5]), 'six-position alternation')
    }
    if (i >= 8) {
      const p = rounds.slice(i - 8, i + 1).map(round => round.profile)
      assert(!(new Set(p.slice(0, 3)).size === 3 && p.every((profile, j) => profile === p[j % 3])), 'nine-position alternation')
    }
  }
}
function inspectStructure(manifest: ScoredManifest) {
  assert(manifest.rounds.length === 39, 'not 39 rounds')
  manifest.rounds.forEach(inspectRound)
  inspectOrder(manifest.rounds)
  for (let block = 0; block < 3; block++) {
    const extra = profiles[(block + manifest.candidateSeed) % 3]
    for (const profile of profiles) {
      const count = manifest.rounds.slice(block * 13, block * 13 + 13).filter(round => round.profile === profile).length
      assert(count === (profile === extra ? 5 : 4), 'seed-specific block composition')
    }
  }
  for (const profile of profiles) {
    const thresholds = manifest.rounds.filter(round => round.profile === profile).map(round => round.threshold)
    const max = maxima[profile]
    assert(thresholds.length === 13, 'profile count')
    assert(thresholds.some(t => t <= max / 4) && thresholds.some(t => t > 3 * max / 4), 'inclusive quartile coverage')
    const sum = thresholds.reduce((a, b) => a + b, 0)
    assert(sum >= bands[profile][0] && sum <= bands[profile][1], 'threshold sum band')
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Loads the committed data, validates every form/hash, and returns immutable objects. Never generates a played form. */
export async function loadScoredManifests(raw: unknown = committed): Promise<ReadonlyMap<FormId, ScoredManifest>> {
  // Hash and retain the same private snapshot even if the caller changes its input during an await.
  raw = structuredClone(raw)
  assert(object(raw), 'packet is not an object')
  keys(raw, ['status', 'schema', 'drawAlgorithm', 'scored', 'drills'])
  assert(raw.schema === 'balloons-fixed-manifests-v1' && raw.drawAlgorithm === 'SHA-256 counter rejection sampler and Fisher-Yates, defined in frozen V1.0 specification', 'generator/schema version mismatch')
  assert(Array.isArray(raw.scored) && raw.scored.length === 9, 'expected nine scored forms')
  const output = new Map<FormId, ScoredManifest>()
  const signatures = new Set<string>()
  for (let i = 0; i < forms.length; i++) {
    const item = raw.scored[i]
    assert(object(item), 'form is not an object')
    keys(item, ['id', 'family', 'candidateSeed', 'rounds', 'playableSignatureSha256', 'sha256'])
    const expected = forms[i]
    assert(item.id === expected.id && item.family === expected.family && item.candidateSeed === expected.seed, `${expected.id} identity/seed/version mismatch`)
    assert(Array.isArray(item.rounds), 'round list missing')
    assert(typeof item.sha256 === 'string' && shaPattern.test(item.sha256), 'manifest SHA format')
    assert(item.sha256 === approvedHashes[i], 'approved manifest hash mismatch')
    assert(typeof item.playableSignatureSha256 === 'string' && shaPattern.test(item.playableSignatureSha256), 'signature SHA format')
    const manifest = item as unknown as ScoredManifest
    inspectStructure(manifest)
    const signature = manifest.rounds.map(round => [round.profile, Math.min(round.threshold, 33)])
    assert(await sha256(canonicalJson(signature)) === manifest.playableSignatureSha256, 'playable signature hash mismatch')
    assert(!signatures.has(manifest.playableSignatureSha256), 'duplicate playable signature')
    signatures.add(manifest.playableSignatureSha256)
    const { sha256: _stored, ...hashInput } = manifest
    void _stored
    assert(await sha256(canonicalJson(hashInput)) === manifest.sha256, 'manifest hash mismatch')
    const immutable = freeze(structuredClone(manifest))
    verified.add(immutable)
    output.set(manifest.id, immutable)
  }
  assert(BALLOONS_FORM_VERSION === 'balloons-scored-v1', 'unsupported form generator')
  for (const [id, manifest] of output) verifiedById.set(id, manifest)
  return output
}
