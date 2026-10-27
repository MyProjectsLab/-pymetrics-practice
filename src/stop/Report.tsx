import { ReportSummary } from '../reports/Summary'
import { stopFeedback } from '../reports/feedback'
import { useCoarseEvent } from '../analytics/observations'
import { useEffect, useRef, useState } from 'react'
import type { DevelopmentDraft, StopResult } from './run'
import { invalidReason } from './run'
import { round } from './scoring'
import { STOP_REPORT_VERSION, STOP_V13_REPORT_VERSION } from './versions'
import { RULE } from './engine/rules'
import { TEMPORARY_DISCLOSURE, PERSISTENT_DISCLOSURE } from './training'
import { inspectLocalState, recordLocalActivity, stopLocalStore } from './storage'
import { compatibilityKey } from './comparison'

const percent = (rate: number) => round(rate * 100)
const memoryCopy = TEMPORARY_DISCLOSURE
const responseDefinitions = 'A miss means not responding to GO; a false alarm means responding to NO-GO.'

export function StopReport({ result, onReplay, onLibrary, onTraining, onComparison, trainingPending = false, returnToMock = false }: {
  result: StopResult; onReplay: () => void; onLibrary: () => void; onTraining?: (result: StopResult) => void; onComparison?: (result: StopResult) => void
  trainingPending?: boolean; returnToMock?: boolean
}) {
  useCoarseEvent({ event: 'stop_report_viewed' })
  const viewId = useRef(crypto.randomUUID())
  const [comparisonText,setComparisonText]=useState('No comparable earlier run is currently verified.')
  useEffect(()=>{
    let active=true,pending=false,dirty=false,revision=0
    const selected=stopLocalStore()
    const unavailable='No comparable earlier run is currently verified.'
    if(!selected||result.storageMode!=='persistent_local'){setComparisonText(unavailable);return}
    const visible=()=>document.visibilityState==='visible'&&document.hasFocus()
    const check=async()=>{
      if(!active||!visible())return
      if(pending){dirty=true;return}
      pending=true;const ticket=++revision
      try{
        const state=await selected.read()
        if(!active||ticket!==revision||!visible())return
        if(!selected.sameInstallation(state)){setComparisonText('The saved results could not be verified for this view.');return}
        const retained=inspectLocalState(state).valid
        const current=retained.find(item=>item.sessionId===result.sessionId)
        if(!current||JSON.stringify(current)!==JSON.stringify(result)){setComparisonText('This saved result changed or was deleted. A comparison is unavailable.');return}
        const previous=retained.filter(item=>item.sessionId!==current.sessionId&&item.completedAtWall<current.completedAtWall&&compatibilityKey(item)===compatibilityKey(current)).sort((a,b)=>b.completedAtWall.localeCompare(a.completedAtWall))[0]
        setComparisonText(previous?`Previous compatible saved run: ${previous.summarySnapshot.counts.hits+previous.summarySnapshot.counts.withholds} of 80 cues handled correctly; this run: ${current.summarySnapshot.counts.hits+current.summarySnapshot.counts.withholds} of 80.`:unavailable)
      }catch{if(active&&ticket===revision)setComparisonText('The saved results could not be verified for this view.')}
      finally{pending=false;if(active&&dirty){dirty=false;void check()}}
    }
    const invalidated=()=>{revision++;setComparisonText(unavailable);if(pending)dirty=true;else void check()}
    const focusChanged=()=>{if(!visible()){revision++;setComparisonText(unavailable)}else if(pending)dirty=true;else void check()}
    void check()
    const timer=window.setInterval(()=>{if(visible())void check()},1000),unsubscribe=selected.subscribeDeletion(invalidated)
    document.addEventListener('visibilitychange',focusChanged);window.addEventListener('focus',focusChanged);window.addEventListener('blur',focusChanged)
    return()=>{active=false;revision++;window.clearInterval(timer);unsubscribe();document.removeEventListener('visibilitychange',focusChanged);window.removeEventListener('focus',focusChanged);window.removeEventListener('blur',focusChanged)}
  },[result])
  const v13 = result.specificationVersion === '1.3'
  const reportVersion = v13 ? STOP_V13_REPORT_VERSION : STOP_REPORT_VERSION
  useEffect(() => { void recordLocalActivity({ key: `report_viewed:${result.sessionId}:${viewId.current}`, sessionId: result.sessionId,
    chainId: null, type: 'report_viewed', payload: { reportVersion } }) }, [result.sessionId, reportVersion])
  const { summarySnapshot: s, form } = result
  const profile = result.setup.visualProfile === 'standard' ? 'Standard colors and markers' : 'High-distinction shape accommodation'
  const goTotal = s.counts.hits + s.counts.misses
  const noGoTotal = s.counts.withholds + s.counts.falseAlarms
  return <article aria-labelledby="stop-report-heading" data-report-version={reportVersion}>
    <h1 id="stop-report-heading" tabIndex={-1}>Your Stop practice result</h1>
    <p>{result.validity === 'valid' ? 'Valid' : 'Valid with timing note'} · {profile}</p>
    <ReportSummary feedback={stopFeedback(s)} />
    <details><summary>Detailed numbers</summary>
    <p>{comparisonText}</p><p>Form {form.id}.</p>
    <p>Scoring version: {result.scoringVersion}. Response key: {result.setup.binding.label}. Physical keyboard self-confirmed; standard timing.</p>
    <h2>Your responses</h2>
    <p>{responseDefinitions}</p>
    {v13 ? <>
      <p>Correct on {s.counts.hits + s.counts.withholds} of 80 trials ({percent(s.rates.overall)}%).</p>
      <p>GO: you responded to {s.counts.hits} of {goTotal} ({percent(s.rates.hit)}%); {s.counts.misses} misses.</p>
      <p>NO-GO: you withheld on {s.counts.withholds} of {noGoTotal} ({percent(s.rates.withhold)}%); {s.counts.falseAlarms} false alarms.</p>
    </> : <>
      <p>You responded to {s.counts.hits} of 60 GO symbols ({percent(s.rates.hit)}%). You missed {s.counts.misses}.</p>
      <p>You withheld your response to {s.counts.withholds} of 20 NO-GO symbols ({percent(s.rates.withhold)}%). You made {s.counts.falseAlarms} false alarms.</p>
      <p>Overall, {s.counts.hits + s.counts.withholds} of 80 trials were correct ({percent(s.rates.overall)}%).</p>
    </>}
    <h2>Your response timing</h2>
    {s.timing.count === 0 ? <p>There were no eligible correct GO responses for a response-time summary.</p>
      : s.timing.count === 1 ? <p>Your one eligible correct GO response took {round(s.timing.median!)} ms. One response is not enough to describe response-time variability.</p>
        : <p>Your median response time on correct GO trials was {round(s.timing.median!)} ms. The middle half of those responses spanned {round(s.timing.iqr!)} ms. Based on {s.timing.count} eligible responses.</p>}
    <p>Response-time results exclude anticipatory responses and trials with timing anomalies.</p>
    <h2>What happened over the task</h2>
    {!v13 && <>
      <p>From Block 1 to Block 4, overall accuracy changed by {round((s.blocks[3].accuracy - s.blocks[0].accuracy) * 100)} percentage points, GO hit rate by {round((s.blocks[3].hitRate - s.blocks[0].hitRate) * 100)} points, and false-alarm rate by {round((s.blocks[3].falseAlarmRate - s.blocks[0].falseAlarmRate) * 100)} points.</p>
      {s.blocks[0].timing.count >= 10 && s.blocks[3].timing.count >= 10 && <p>Median correct-GO response time changed by {round(s.blocks[3].timing.median! - s.blocks[0].timing.median!)} ms.</p>}
      {s.blocks[0].timing.count >= 12 && s.blocks[3].timing.count >= 12 && <p>Response-time IQR changed by {round(s.blocks[3].timing.iqr! - s.blocks[0].timing.iqr!)} ms.</p>}
    </>}
    <p>{s.speedAccuracy}</p>
    <div className="table-scroll" role="region" aria-label="Block results" tabIndex={0}><table><caption>Four hidden 20-trial blocks</caption><thead><tr><th scope="col">Block</th><th scope="col">GO correct</th><th scope="col">NO-GO correct</th><th scope="col">Median GO response time</th><th scope="col">Data note</th></tr></thead>
      <tbody>{s.blocks.map(b => <tr key={b.number}><th scope="row">{b.number}</th><td>{b.counts.hits} of {v13 ? b.counts.hits + b.counts.misses : 15}{v13 ? ` (${percent(b.hitRate)}%)` : ''}</td><td>{b.counts.withholds} of {v13 ? b.counts.withholds + b.counts.falseAlarms : 5}{v13 ? ` (${percent(b.withholdRate)}%)` : ''}</td><td>{b.timing.count ? `${round(b.timing.median!)} ms` : 'Unavailable'}</td><td>{v13 ? b.timing.count < 5 ? 'Too few eligible GO responses for median comparison' : b.timing.count < 7 ? 'Too few eligible GO responses for variability comparison' : 'Eligible for timing comparison' : b.timing.count < 10 ? 'Too few eligible GO responses for a timing comparison' : b.timing.count < 12 ? 'Too few eligible GO responses for variability comparison' : 'Eligible for block comparison'}</td></tr>)}</tbody>
    </table></div>
    <h2>After errors</h2>
    <p>{s.postError.narrative}</p>
    <h2>After GO runs</h2>
    <p>{s.sequence.narrative}</p>
    <h2>Data quality</h2>
    <p>{result.validity === 'valid' ? 'This session met the completion, focus, input, and timing rules for a valid result.' : 'This session was complete. One timing anomaly was excluded from response-time analysis; accuracy outcomes remain available.'}</p>
    {result.events.some(e => e.type === 'quality_note' && e.payload.ruleId === RULE.extraNote) && <p>Five or more extra response-key presses were recorded after trials had resolved. They did not change the recorded trial outcomes.</p>}
    <p>{result.storageMode === 'persistent_local' ? 'This result is saved in this browser until you delete it, clear site data, or the browser evicts it.' : memoryCopy}</p>
    </details>
    <p>Practice feedback, not an employer score or hiring prediction. Device and sequence can affect results.</p>
    <div className="actions">{result.mode === 'baseline' && onTraining && <button disabled={trainingPending} onClick={() => onTraining(result)}>{trainingPending ? 'Starting training…' : 'Start recommended training'}</button>}{result.mode === 'retest' && onComparison && <button onClick={() => onComparison(result)}>View baseline comparison</button>}<button onClick={onReplay}>Practise another sequence</button><button className="secondary" data-mock-return-intent={returnToMock ? "" : undefined} onClick={onLibrary}>{returnToMock?'Return to mock':'Back to library'}</button></div>
  </article>
}

export function InvalidReport({ draft, onRestart, onGuide, onMockReturn }: {
  draft: DevelopmentDraft | null; onRestart: () => void; onGuide: () => void; onMockReturn?: () => void
}) {
  useCoarseEvent({ event: 'stop_report_viewed' })
  let scored = false
  const outcomes: string[] = []
  let presented = 0
  for (const event of draft?.events ?? []) {
    if (event.type === 'trial_scheduled') scored = event.payload.trial.phase === 'scored'
    if (scored && event.type === 'stimulus_presented') presented++
    if (scored && event.type === 'trial_resolved') outcomes.push(event.payload.outcome.kind)
  }
  const invalidation = draft?.events.find(e => e.type === 'session_invalidated')
  const mismatch = draft?.events.some(e => e.type === 'integrity_checked' && !e.payload.valid && /manifest|journal mismatch/i.test(e.payload.detail))
  const reason = draft?.invalidRule === RULE.integrity && !mismatch ? 'A technical problem interrupted the task.' : invalidReason(draft?.invalidRule ?? null)
  return <article aria-labelledby="stop-invalid-heading">
    <h1 id="stop-invalid-heading" tabIndex={-1}>Stop session not valid for comparison</h1>
    <p>{reason} The attempt is retained in this tab for review, but it will not be used as a baseline, retest, or progress result.</p>
    <p>Not eligible for comparison</p>
    <p><strong>What this kind of task is generally designed to observe:</strong> following a response rule while balancing quick reactions with accuracy. This invalid attempt cannot be compared with a completed saved run.</p>
    <details><summary>Detailed numbers</summary>
    {invalidation && <p>The issue was recorded at {round(invalidation.timestampMs)} ms on this session’s clock.</p>}
    <h2>Available evidence</h2>
    <p>{presented} scored stimuli were presented; {outcomes.length} scored trials resolved.</p>
    <p>Of those resolved trials: {outcomes.filter(x => x === 'hit').length} hits, {outcomes.filter(x => x === 'miss').length} misses, {outcomes.filter(x => x === 'correct_withhold').length} correct withholds, and {outcomes.filter(x => x === 'false_alarm').length} false alarms.</p>
    <p>{responseDefinitions}</p>
    <p>Available counts may help you review the task, but timing and change conclusions are suppressed.</p>
    </details>
    <p>{draft?.storageMode === 'persistent_local' ? PERSISTENT_DISCLOSURE : memoryCopy}</p>
    <div className="actions">{onMockReturn&&<button data-mock-return-intent onClick={onMockReturn}>Return to mock</button>}<button onClick={onRestart}>Restart with a new form</button><button className="secondary" onClick={onGuide}>Review the guide</button></div>
  </article>
}
