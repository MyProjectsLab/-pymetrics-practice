import { DIGITS_SCORING_VERSION } from './contracts'
import type { ClosedTrial, RunState } from './contracts'
import { isVerifiedDigitsForm } from './forms'
import { verifyDigitsRun, isReferenceDigits } from './engine'

export interface PositionClassification {
  readonly exact: boolean
  readonly positionMatches: number
  readonly substitutions: number
  readonly transpositionPairs: number
  readonly transpositionPositions: number
  readonly missingSuffix: number
  readonly errorPositions: readonly number[]
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Digits report: ${reason}`)
}
export function classifyPositions(target: string, response: string, allowLonger = false): PositionClassification {
  assert(/^[0-9]{2,16}$/.test(target) &&
    (allowLonger ? /^[0-9]{0,64}$/.test(response) : /^[0-9]{0,16}$/.test(response) && response.length <= target.length), 'invalid target or response')
  let matches = 0, substitutions = 0, transpositions = 0, missingSuffix = 0
  const errors: number[] = []
  const full = response.length === target.length
  for (let i = 0; i < target.length;) {
    if (i >= response.length) {
      missingSuffix++; errors.push(i + 1); i++; continue
    }
    if (target[i] === response[i]) { matches++; i++; continue }
    if (full && i + 1 < target.length &&
      response[i] === target[i + 1] && response[i + 1] === target[i] &&
      response[i + 1] !== target[i + 1]) {
      transpositions++; errors.push(i + 1, i + 2); i += 2; continue
    }
    substitutions++; errors.push(i + 1); i++
  }
  assert(matches + substitutions + 2 * transpositions + missingSuffix === target.length,
    'position conservation')
  return { exact: target === response, positionMatches: matches, substitutions,
    transpositionPairs: transpositions, transpositionPositions: transpositions * 2,
    missingSuffix, errorPositions: errors }
}
export function halfUpPercent(count: number, denominator: number): number {
  assert(Number.isSafeInteger(count) && Number.isSafeInteger(denominator) &&
    denominator > 0 && count >= 0 && count <= denominator, 'percent inputs')
  return Math.floor(count * 1000 / denominator + 0.5) / 10
}
export interface ValidReport {
  readonly status: 'valid'
  readonly scoringVersion: typeof DIGITS_SCORING_VERSION
  readonly formId: string
  readonly mode: string
  readonly exactCorrect: number
  readonly wrong: number
  readonly skipped: number
  readonly timedOut: number
  readonly assistedEntry: boolean
  readonly maximumRecalledLength: number | null
  readonly byLength: readonly { readonly length: number; readonly exact: number; readonly of: number;
    readonly percent: number }[]
  readonly closedTrials: number
  readonly completionReason: 'three_mistakes' | 'practice_limit_reached'
  readonly serialPositionErrors: readonly { readonly position: number;
    readonly errors: number; readonly opportunities: number; readonly percent: number }[]
  readonly positionMatches: number
  readonly substitutions: number
  readonly transpositionPairs: number
  readonly missingSuffix: number
  readonly fullMatchingTimeouts: number
}
export interface PartialReview {
  readonly status: 'invalid' | 'incomplete'
  readonly reason: string | null
  readonly presented: number
  readonly closed: number
  readonly unresolved: number
}
export type DigitsReview = ValidReport | PartialReview

function inspectClosed(item: ClosedTrial, reference: boolean) {
  return classifyPositions(item.target, item.answer, reference)
}

/** Recalculate all candidate-facing numbers from verified form and closed facts. */
export function scoreDigits(state: RunState): DigitsReview {
  assert(isVerifiedDigitsForm(state.form) && verifyDigitsRun(state), 'journal reconciliation failed')
  assert(state.scoringVersion === DIGITS_SCORING_VERSION, 'mixed scoring version')
  const classified = state.closed.map(item => inspectClosed(item, isReferenceDigits(state)))
  if (state.phase !== 'completed' || state.invalidReason !== null) {
    return { status: state.phase === 'invalid' ? 'invalid' : 'incomplete',
      reason: state.invalidReason, presented: state.presentedTrials,
      closed: state.closed.length, unresolved: state.presentedTrials - state.closed.length }
  }
  assert(state.closed.length === state.presentedTrials &&
    (state.completionReason === 'three_mistakes' ? state.wrongCount === 3 :
      state.completionReason === 'practice_limit_reached' && state.closed.length === 40 && state.wrongCount < 3),
  'false completion')
  const correct = state.closed.filter(item => item.exactCorrect)
  const byLength = [...new Set(state.closed.map(item => item.target.length))].sort((a, b) => a - b)
    .map(length => {
      const of = state.closed.filter(item => item.target.length === length).length
      const exact = correct.filter(item => item.target.length === length).length
      return { length, exact, of, percent: halfUpPercent(exact, of) }
    })
  const maxPresentedLength = Math.max(...state.closed.map(item => item.target.length))
  const serialPositionErrors = Array.from({ length: maxPresentedLength }, (_, index) => {
    const opportunities = state.closed.filter(item => item.target.length > index).length
    const errors = classified.filter(item => item.errorPositions.includes(index + 1)).length
    return { position: index + 1, errors, opportunities,
      percent: halfUpPercent(errors, opportunities) }
  })
  return { status: 'valid', scoringVersion: DIGITS_SCORING_VERSION,
    formId: state.form.id, mode: state.profile.mode, exactCorrect: correct.length,
    wrong: state.wrongCount, skipped: state.closed.filter(item => item.skipped).length,
    timedOut: state.closed.filter(item => item.timedOut).length,
    assistedEntry: state.closed.some(item => item.assistedEntry) || state.profile.assistedEntryDeclared,
    maximumRecalledLength: correct.length ? Math.max(...correct.map(item => item.target.length)) : null,
    byLength, closedTrials: state.closed.length, completionReason: state.completionReason!, serialPositionErrors,
    positionMatches: classified.reduce((n, item) => n + item.positionMatches, 0),
    substitutions: classified.reduce((n, item) => n + item.substitutions, 0),
    transpositionPairs: classified.reduce((n, item) => n + item.transpositionPairs, 0),
    missingSuffix: classified.reduce((n, item) => n + item.missingSuffix, 0),
    fullMatchingTimeouts: state.closed.filter((item, index) => item.timedOut && classified[index].exact).length }
}
