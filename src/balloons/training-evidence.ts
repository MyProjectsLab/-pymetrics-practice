import type { Profile, RoundResult } from './contracts'

export type DrillKind = 'outcome' | 'information' | 'updating' | 'consistency' | 'maintenance'
export const PROFILES: readonly Profile[] = ['A', 'B', 'C']
export function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutable)
    Object.freeze(value)
  }
  return value
}
export function median(points: readonly number[]): number {
  if (!points.length) throw new Error('Missing median denominator')
  const sorted = [...points].sort((a, b) => a - b), m = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2
}
export function quartiles(points: readonly number[]) {
  if (points.length < 2) throw new Error('Missing quartile denominator')
  const sorted = [...points].sort((a, b) => a - b), half = Math.floor(sorted.length / 2)
  const q1 = median(sorted.slice(0, half)), q3 = median(sorted.slice(-half))
  return { q1, q3, iqr: q3 - q1 }
}
export const voluntaryPoints = (rows: readonly RoundResult[]) => rows.flatMap(r => r.outcome === 'voluntary_collect' ? [r.voluntaryPoint!] : [])

/** Arithmetic-only evidence, not baseline admission or a personalized recommendation.
 * Thresholds never enter this calculation. Production admission is in router.ts. */
export function deriveRouterEvidence(rounds: readonly RoundResult[]) {
  if (rounds.length !== 39 || PROFILES.some(p => rounds.filter(r => r.profile === p).length !== 13)) throw new Error('Router needs 39/13 observations')
  rounds.forEach((r, i) => {
    const voluntary = r.outcome === 'voluntary_collect', burst = r.outcome === 'burst', cap = r.outcome === 'cap_collect'
    const max = { A: 12, B: 24, C: 48 }[r.profile]
    if (r.round !== i + 1 || !(voluntary || burst || cap) || !Number.isInteger(r.successfulPumps) || r.successfulPumps < 0 ||
      r.attemptedPumps !== r.successfulPumps + Number(burst) || r.successfulPumps >= max ||
      (cap ? r.successfulPumps !== 32 || r.profile !== 'C' : r.successfulPumps >= 32) ||
      r.voluntaryPoint !== (voluntary ? r.successfulPumps : null) || r.censored !== !voluntary ||
      r.bankedCents !== (burst ? 0 : r.successfulPumps * 5) || r.lostCents !== (burst ? r.successfulPumps * 5 : 0)) throw new Error('Illegal router observation')
  })
  const categories = PROFILES.map(profile => {
    const same = rounds.filter(r => r.profile === profile), early = same.filter(r => r.round <= 26), late = same.filter(r => r.round >= 27)
    const points = voluntaryPoints(same), latePoints = voluntaryPoints(late)
    return { profile, total: same.length, earlyRounds: early.length, earlyBursts: early.filter(r => r.outcome === 'burst').length,
      lateRounds: late.length, lateVoluntaryN: latePoints.length, lateMedian: latePoints.length >= 3 ? median(latePoints) : null,
      voluntaryN: points.length, sortedVoluntaryPoints: [...points].sort((a,b) => a-b),
      excludedBursts: same.filter(r => r.outcome === 'burst').length, excludedCaps: same.filter(r => r.outcome === 'cap_collect').length,
      quartiles: points.length >= 8 ? quartiles(points) : null,
      consistencyExclusions: points.length < 8 ? ['voluntary_denominator_below_eight'] : quartiles(points).iqr < 6 ? ['iqr_below_six'] : [] }
  })
  const windows = PROFILES.flatMap(profile => {
    const same = rounds.filter(r => r.profile === profile)
    return same.slice(0, -3).map((_, i) => {
      const rows = same.slice(i, i + 4), [a,b,c,d] = rows
      const pattern = a.outcome === 'voluntary_collect' && b.outcome === 'burst' && c.outcome === 'voluntary_collect' && d.outcome === 'voluntary_collect'
      const drop = pattern ? a.voluntaryPoint! - c.voluntaryPoint! : null, rebound = pattern ? d.voluntaryPoint! - c.voluntaryPoint! : null
      return { profile, rounds: rows.map(r => r.round), observations: rows.map(r => ({ round: r.round, outcome: r.outcome, voluntaryPoint: r.voluntaryPoint })),
        drop, rebound, exclusion: !pattern ? 'outcome_pattern' : drop! < 5 || rebound! < 5 ? 'below_five' : null }
    })
  }).sort((a,b) => a.rounds[3] - b.rounds[3] || a.rounds[0] - b.rounds[0] || a.profile.localeCompare(b.profile))
  const used = new Set<number>()
  const outcomeWindows = windows.map(w => {
    const exclusion = w.exclusion ?? (w.rounds.some(r => used.has(r)) ? 'overlap' : null)
    if (!exclusion) w.rounds.forEach(r => used.add(r))
    return { ...w, exclusion }
  })
  const outcomeSelected = outcomeWindows.filter(w => !w.exclusion)
  const pairs = categories.flatMap(high => categories.filter(low => low.profile !== high.profile).map(low => {
    const earlyDifference = high.earlyBursts - low.earlyBursts
    const lateDifference = high.lateMedian === null || low.lateMedian === null ? null : high.lateMedian - low.lateMedian
    return { high: high.profile, low: low.profile, earlyDifference, lateDifference,
      informationExclusions: [earlyDifference < 3 ? 'early_difference_below_three' : null, lateDifference === null ? 'late_denominator_below_three' : lateDifference < 3 ? 'late_difference_below_three' : null].filter(x => x !== null) }
  }))
  const alphabetical = (a: typeof pairs[number], b: typeof pairs[number]) => a.high.localeCompare(b.high) || a.low.localeCompare(b.low)
  const informationPairs = pairs.filter(p => !p.informationExclusions.length).sort((a,b) => b.earlyDifference-a.earlyDifference || b.lateDifference!-a.lateDifference! || alphabetical(a,b))
  const lateMedianRange = categories.some(c => c.lateMedian === null) ? null : Math.max(...categories.map(c => c.lateMedian!)) - Math.min(...categories.map(c => c.lateMedian!))
  const updatingPairs = pairs.filter(p => p.earlyDifference >= 2).sort((a,b) => b.earlyDifference-a.earlyDifference || alphabetical(a,b))
  const consistencyCategories = categories.filter(c => c.quartiles && c.quartiles.iqr >= 6).sort((a,b) => b.quartiles!.iqr-a.quartiles!.iqr || b.voluntaryN-a.voluntaryN || a.profile.localeCompare(b.profile))
  const flags = { outcome: outcomeSelected.length >= 2, information: informationPairs.length > 0,
    updating: updatingPairs.length > 0 && lateMedianRange !== null && lateMedianRange <= 2, consistency: consistencyCategories.length > 0 }
  const primary: DrillKind = flags.outcome ? 'outcome' : flags.information ? 'information' : flags.updating ? 'updating' : flags.consistency ? 'consistency' : 'maintenance'
  return immutable({ routerVersion: 'balloons-router-v1' as const, primary, flags, categories, outcomeWindows, outcomeSelected, outcomeRequired: 2,
    pairs, informationPair: informationPairs[0] ?? null, lateMedianRange,
    updatingPair: flags.updating ? updatingPairs[0] : null,
    updatingExclusions: [!updatingPairs.length ? 'early_difference_below_two' : null, lateMedianRange === null ? 'late_denominator_below_three' : lateMedianRange > 2 ? 'late_range_above_two' : null].filter(x => x !== null),
    consistencyCategory: consistencyCategories[0] ?? null })
}
export type RouterEvidence = ReturnType<typeof deriveRouterEvidence>
