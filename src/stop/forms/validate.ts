import type { StopFormManifest, StopStimulus } from '../contracts'
import {
  STOP_FORM_GENERATOR_VERSION,
  STOP_FORM_SCHEMA_VERSION,
  STOP_SPECIFICATION_VERSION,
  STOP_STANDARD_FORM_VERSION,
} from '../versions'

export interface StopFormIssue {
  readonly code: string
  readonly formId: string
  readonly detail: string
}

export interface StopFormStatistics {
  readonly goCount: number
  readonly noGoCount: number
  readonly noGoAfterThreeGo: number
  readonly longestGoRun: number
  readonly longestNoGoRun: number
}

export interface StopFormAudit {
  readonly issues: readonly StopFormIssue[]
  readonly statistics: Readonly<Record<string, StopFormStatistics>>
  readonly minimumPairwiseDifference: number
  readonly maximumPairwiseMatches: number
}

function canonicalForm(form: StopFormManifest): string {
  const sequence = form.sequence.map((stimulus) => stimulus === 'GO' ? 'G' : 'N').join('')
  return [
    form.schemaVersion,
    form.id,
    form.family,
    form.formVersion,
    form.specificationVersion,
    form.generatorVersion,
    form.seedId,
    String(form.blockCount),
    String(form.blockSize),
    sequence,
    '',
  ].join('\n')
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isStimulus(value: string): value is StopStimulus {
  return value === 'GO' || value === 'NO_GO'
}

function statistics(sequence: readonly StopStimulus[]): StopFormStatistics {
  let goCount = 0
  let noGoCount = 0
  let noGoAfterThreeGo = 0
  let longestGoRun = 0
  let longestNoGoRun = 0
  let previous: StopStimulus | null = null
  let runLength = 0

  for (const stimulus of sequence) {
    if (stimulus === 'NO_GO' && previous === 'GO' && runLength >= 3) {
      noGoAfterThreeGo += 1
    }
    if (stimulus === previous) runLength += 1
    else {
      previous = stimulus
      runLength = 1
    }
    if (stimulus === 'GO') {
      goCount += 1
      longestGoRun = Math.max(longestGoRun, runLength)
    } else {
      noGoCount += 1
      longestNoGoRun = Math.max(longestNoGoRun, runLength)
    }
  }

  return { goCount, noGoCount, noGoAfterThreeGo, longestGoRun, longestNoGoRun }
}

export async function validateStopForm(form: StopFormManifest): Promise<readonly StopFormIssue[]> {
  const issues: StopFormIssue[] = []
  const add = (code: string, detail: string) => issues.push({ code, formId: form.id, detail })

  if (form.schemaVersion !== STOP_FORM_SCHEMA_VERSION ||
      form.formVersion !== STOP_STANDARD_FORM_VERSION ||
      form.specificationVersion !== STOP_SPECIFICATION_VERSION ||
      form.generatorVersion !== STOP_FORM_GENERATOR_VERSION) {
    add('version', 'Manifest, form, specification, or generator version differs from frozen Milestone 1 versions')
  }
  if (!['baseline', 'replay', 'retest'].includes(form.family) ||
      !form.id.startsWith(`stop-${form.family}-`) ||
      !form.seedId.startsWith(`ap-stop-v1.1-${form.family}-`)) {
    add('family_identity', 'Form id or seed id does not belong to its declared family')
  }
  if (form.blockCount !== 4 || form.blockSize !== 20) {
    add('block_structure', 'A standard form must have four blocks of twenty')
  }
  if (form.sequence.length !== 80) add('trial_count', 'A standard form must have 80 scored trials')
  if (!form.sequence.every(isStimulus)) add('stimulus', 'Sequence contains a stimulus other than GO or NO_GO')

  if (form.sequence.length === 80 && form.sequence.every(isStimulus)) {
    const counts = statistics(form.sequence)
    if (counts.goCount !== 60 || counts.noGoCount !== 20) {
      add('total_distribution', 'A standard form must have 60 GO and 20 NO_GO trials')
    }
    for (let block = 0; block < 4; block += 1) {
      const blockCounts = statistics(form.sequence.slice(block * 20, (block + 1) * 20))
      if (blockCounts.goCount !== 15 || blockCounts.noGoCount !== 5) {
        add('block_distribution', `Block ${block + 1} must have 15 GO and 5 NO_GO trials`)
      }
    }
    if (counts.longestGoRun > 8 || counts.longestNoGoRun > 8) {
      add('run_limit', 'GO and NO_GO runs must be at most eight trials')
    }
    if (counts.longestGoRun < 4) add('go_run_context', 'At least one GO run must reach four trials')
    if (counts.noGoAfterThreeGo < 4) {
      add('no_go_context', 'At least four NO_GO trials must follow three or more consecutive GO trials')
    }
    if ((form.sequence[0] === 'NO_GO' && form.sequence[1] === 'NO_GO') ||
        (form.sequence[78] === 'NO_GO' && form.sequence[79] === 'NO_GO')) {
      add('endpoint', 'Neither the first nor last two trials may both be NO_GO')
    }
  }

  const actualChecksum = `sha256:${await sha256Hex(canonicalForm(form))}`
  if (form.checksum !== actualChecksum) add('checksum', 'Stored SHA-256 checksum does not match manifest identity and sequence')
  return issues
}

export async function auditStopForms(forms: readonly StopFormManifest[]): Promise<StopFormAudit> {
  const issues: StopFormIssue[] = []
  const statisticsById: Record<string, StopFormStatistics> = {}
  const expected = { baseline: 4, replay: 6, retest: 4 } as const
  const count = { baseline: 0, replay: 0, retest: 0 }
  const seenIds = new Set<string>()
  const seenSeeds = new Set<string>()

  if (forms.length !== 14) {
    issues.push({ code: 'inventory', formId: '*', detail: 'The release inventory must contain exactly 14 standard forms' })
  }
  for (const form of forms) {
    issues.push(...await validateStopForm(form))
    statisticsById[form.id] = statistics(form.sequence)
    if (seenIds.has(form.id)) {
      issues.push({ code: 'duplicate_id', formId: form.id, detail: 'Form id is repeated' })
    }
    if (seenSeeds.has(form.seedId)) {
      issues.push({ code: 'duplicate_seed', formId: form.id, detail: 'Seed id is repeated' })
    }
    seenIds.add(form.id)
    seenSeeds.add(form.seedId)
    if (form.family in count) count[form.family] += 1
  }
  for (const family of Object.keys(expected) as (keyof typeof expected)[]) {
    if (count[family] !== expected[family]) {
      issues.push({ code: 'family_inventory', formId: family, detail: `Expected ${expected[family]} ${family} forms, found ${count[family]}` })
    }
  }

  let minimumPairwiseDifference = 80
  let maximumPairwiseMatches = 0
  for (let left = 0; left < forms.length; left += 1) {
    for (let right = left + 1; right < forms.length; right += 1) {
      const difference = forms[left].sequence.reduce(
        (total, stimulus, index) => total + Number(stimulus !== forms[right].sequence[index]),
        0,
      )
      const matches = 80 - difference
      minimumPairwiseDifference = Math.min(minimumPairwiseDifference, difference)
      maximumPairwiseMatches = Math.max(maximumPairwiseMatches, matches)
      if (difference < 24 || matches > 56) {
        issues.push({ code: 'pairwise_difference', formId: `${forms[left].id}/${forms[right].id}`, detail: `${difference} differences and ${matches} matches` })
      }
    }
  }
  return {
    issues,
    statistics: Object.freeze(statisticsById),
    minimumPairwiseDifference,
    maximumPairwiseMatches,
  }
}
