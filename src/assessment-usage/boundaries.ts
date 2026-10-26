import type { ResultAuthority, AuthorityStatus } from '../lengths-mouth-v13/authority'
import type { Profile } from '../digits/contracts'
import type { ValidReport } from '../digits/scoring'
import type { Metrics } from './contract'

export function confirmedLengthsMetrics(status:ResultAuthority|AuthorityStatus,armedOnly:boolean):Metrics<'lengths'>|null{
  if(armedOnly||status.kind!=='confirmed'||status.snapshot.kind!=='terminal')return null
  const r=status.snapshot.review
  return r.status==='complete_headless'&&r.metrics?{correct:r.metrics.overall.correct,trials:r.metrics.overall.denominator}:null
}
export function standardDigits(profile:Profile):boolean{
  return profile.mode==='visual'&&profile.entryWindow===20000&&profile.entryMethod==='keyboard'&&!profile.assistedEntryDeclared
}
export function unassistedDigitsMetrics(report:ValidReport):Metrics<'digits'>|null{
  return report.assistedEntry?null:{correct:report.exactCorrect,trials:report.closedTrials,maximum_length:report.maximumRecalledLength??0}
}
