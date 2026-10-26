import { stopAnalytics } from '../analytics/client'
import { useCoarseEvent } from '../analytics/observations'
import { AssistiveInputNotice } from './AssistiveInputNotice'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { StopSetup } from './Preflight'
import { createBrowserCanvas, createBrowserScheduler, bindBrowserEvents } from './browser'
import { createDrillRun } from './drill-run'
import type { DrillBlockSummary } from './drill-run'
import { drillById } from './drills'
import type { DrillId } from './drills'
import { round } from './scoring'
import { createPreparationRecorder } from './preparation'
import type { PreparationRecorder } from './preparation'
import { stopExposure } from './exposure'
import type { TrainingChain, DrillAttempt } from './training'
import { pendingRetestCompletion, comparisonExposure, retestExhaustion, retestExplanation, storageDisclosure, canRetainTrainingAttempt, checkTrainingChain, currentTrainingChain, recordDrillStarted, retainDrillAttempt, updateTrainingChain } from './training'
import { compareStop } from './comparison'
import { displayFirstPartyBrand } from '../design/brandDisplay'
import { useResponseKey } from './useResponseKey'
import { Stimulus } from './Stimulus'
import { recordLocalActivity, stopLocalStore } from './storage'

const introductions: Record<DrillId, string> = {
  withholding: 'This exercise gives you more chances to practise withholding. A run of GO symbols does not predict the next symbol.',
  detection: 'This exercise narrows the response window across three blocks. Respond to each GO symbol; do not press for NO-GO.',
  consistency: 'This longer exercise focuses on keeping your responses consistent from the first block to the last.',
  stability: 'This exercise focuses on repeatable timing while preserving both GO and NO-GO accuracy. There is no ideal reaction time to chase.',
  maintenance: 'No targeted threshold was reached in your valid baseline. This mixed exercise lets you practise the full rule on a new sequence.',
}
function blockCopy(id: DrillId, summary: DrillBlockSummary) {
  if (id === 'withholding') return `Block complete. GO correct: ${summary.hits}. NO-GO correct: ${summary.withholds}. Keep using the symbol, not the preceding run, to decide.`
  if (id === 'detection') return `Block complete. You responded to ${summary.hits} of 18 GO symbols and withheld on ${summary.withholds} of 6 NO-GO symbols.`
  if (id === 'consistency') return `Block complete. Accuracy: ${round(summary.accuracy * 100)}%. When the next block begins, keep the same response rule.`
  if (id === 'stability') return `Block complete. Median correct-GO response time: ${summary.medianMs === null ? 'unavailable' : `${round(summary.medianMs)} ms`}. IQR: ${summary.iqrMs === null ? 'unavailable' : `${round(summary.iqrMs)} ms`}. GO correct: ${summary.hits} of 18. NO-GO correct: ${summary.withholds} of 6.`
  return `Block complete. GO correct: ${summary.hits}. NO-GO correct: ${summary.withholds}. Median correct-GO response time: ${summary.medianMs === null ? 'unavailable' : `${round(summary.medianMs)} ms`}.`
}
function completionEvidence(id: DrillId, summaries: readonly DrillBlockSummary[]) {
  const median = (summary: DrillBlockSummary) => summary.medianMs === null ? 'unavailable' : `${round(summary.medianMs)} ms`
  const iqr = (summary: DrillBlockSummary) => summary.iqrMs === null ? 'unavailable' : `${round(summary.iqrMs)} ms`
  if (id === 'withholding') return [
    `NO-GO false-alarm rate by block: ${summaries.map(item => `${round(item.falseAlarms / (item.falseAlarms + item.withholds) * 100)}%`).join(', ')}.`,
    `Median correct-GO response time by block: ${summaries.map(median).join(', ')}.`,
  ]
  if (id === 'detection') return [
    `GO miss rate by deadline block (1,200 ms, 1,100 ms, 1,000 ms): ${summaries.map(item => `${round(item.misses / (item.hits + item.misses) * 100)}%`).join(', ')}.`,
    `NO-GO false-alarm rate by block: ${summaries.map(item => `${round(item.falseAlarms / (item.falseAlarms + item.withholds) * 100)}%`).join(', ')}.`,
    `Median correct-GO response time by block: ${summaries.map(median).join(', ')}.`,
  ]
  if (id === 'consistency') return [
    `GO hit rate by block: ${summaries.map(item => `${round(item.hits / (item.hits + item.misses) * 100)}%`).join(', ')}.`,
    `NO-GO false-alarm rate by block: ${summaries.map(item => `${round(item.falseAlarms / (item.falseAlarms + item.withholds) * 100)}%`).join(', ')}.`,
    `Median correct-GO response time by block: ${summaries.map(median).join(', ')}. Response-time IQR by block: ${summaries.map(iqr).join(', ')}.`,
  ]
  if (id === 'stability') return [
    `Response-time IQR by block: ${summaries.map(iqr).join(', ')}. ${summaries[0].iqrMs === null || summaries.at(-1)!.iqrMs === null ? 'First-to-last IQR change is unavailable.' : `First-to-last IQR change: ${round(summaries.at(-1)!.iqrMs! - summaries[0].iqrMs!)} ms.`}`,
    `Median correct-GO response time by block: ${summaries.map(median).join(', ')}.`,
    `GO hit rate by block: ${summaries.map(item => `${round(item.hits / (item.hits + item.misses) * 100)}%`).join(', ')}. NO-GO false-alarm rate by block: ${summaries.map(item => `${round(item.falseAlarms / (item.falseAlarms + item.withholds) * 100)}%`).join(', ')}.`,
  ]
  return []
}

function DrillActivity({ chain, onAttempt, onRetain }: { chain: TrainingChain; onAttempt: (attempt: DrillAttempt) => void; onRetain: (attempt: DrillAttempt) => void }) {
  const manifest = drillById(chain.recommendation.drillId)
  const setup: StopSetup = chain.baseline.setup
  const input = useResponseKey(setup.binding)
  const [latencyAffectedInput, setLatencyAffectedInput] = useState(false)
  const [, refresh] = useState(0)
  const [activity] = useState(() => {
    const clock = () => performance.now()
    let run: ReturnType<typeof createDrillRun>
    const canvas = createBrowserCanvas(clock, setup.visualProfile, () => run.engine.technicalFailure('Drill presentation failed'))
    run = createDrillRun({ id: crypto.randomUUID(), manifest, setup, clock, scheduler: createBrowserScheduler(clock), frames: canvas.frames,
      started: id => recordDrillStarted(chain.id, id),
      clear: canvas.clear, changed: () => refresh(value => value + 1),
      initialFrame: (ready, current) => { const id = requestAnimationFrame(() => {
        if (!current()) return
        try { canvas.fixation(); ready() } catch { run.engine.technicalFailure('Drill initial fixation failed') }
      }); return () => cancelAnimationFrame(id) },
    })
    return { run, canvas }
  })
  const analyticsRelease = useRef<(() => void) | null>(null)
  const analyticsStarted = useRef(false)
  const listeners = useRef<ReturnType<typeof bindBrowserEvents> | null>(null)
  const retain = useRef(onRetain)
  useEffect(() => { retain.current = onRetain }, [onRetain])
  const content = useRef<HTMLDivElement>(null)
  const snapshot = activity.run.snapshot()
  useEffect(() => {
    if (snapshot.screen !== 'intro' && !analyticsStarted.current) {
      analyticsStarted.current = true
      stopAnalytics.emit({ event: 'stop_drill_started' })
    }
    stopAnalytics.kick()
  }, [snapshot.screen])
  useCoarseEvent(snapshot.screen === 'complete' ? { event: 'stop_drill_completed' } : null)
  useLayoutEffect(() => {
    if (snapshot.screen === 'live') content.current?.querySelector<HTMLElement>('[data-game-focus]')?.focus({ preventScroll: true })
    else content.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [snapshot.screen])
  useEffect(() => () => {
    const attempt = activity.run.leave()
    if (attempt) retain.current(attempt)
    listeners.current?.dispose(); activity.canvas.clear()
    analyticsRelease.current?.()
  }, [activity])
  async function begin() {
    if (latencyAffectedInput || input.held || !input.focused || !input.visible || input.viewport.width < 768 || input.viewport.height < 600) return
    analyticsRelease.current ??= stopAnalytics.hold(() => activity.run.protectedNow())
    listeners.current = bindBrowserEvents(activity.run.engine, setup.binding.code, activity.run.protectedNow)
    try {
      const started = activity.run.begin(input.isDown(setup.binding.code))
      activity.run.engine.visibility(document.visibilityState === 'visible')
      activity.run.engine.focus(document.hasFocus())
      activity.run.engine.resize(window.innerWidth, window.innerHeight)
      await started
    } catch { listeners.current.dispose(); listeners.current = null }
  }
  const last = snapshot.summaries.at(-1)
  return <section ref={content} className="panel">
    <div className="stop-live" hidden={snapshot.screen !== 'live'} data-game-focus tabIndex={-1} aria-label="Timed Stop drill">
      <p className="stop-reminder">GO: press {setup.binding.label} · NO-GO: do nothing</p>
      <div className="stop-presentation" ref={element => { if (element) activity.canvas.attach(element) }} aria-hidden="true" />
    </div>
    {snapshot.screen === 'intro' && <>
      <h1 tabIndex={-1}>Start {manifest.id === 'maintenance' ? 'mixed exercise' : `${manifest.id} drill`}</h1>
      <p>{manifest.id === 'withholding' && chain.baseline.specificationVersion === '1.3'
        ? 'Practise withholding while GO symbols become more frequent across this exercise.' : introductions[manifest.id]}</p>
      <p>Rule: press {setup.binding.label} once for GO. Do nothing for NO-GO.</p>
      <div className="rule-grid"><div><Stimulus kind="GO" profile={setup.visualProfile} /><p>Untimed example: GO — press {setup.binding.label} once.</p></div>
        <div><Stimulus kind="NO_GO" profile={setup.visualProfile} /><p>Untimed example: NO-GO — do nothing.</p></div></div>
      <p>{manifest.blocks.length} blocks · {manifest.blocks.reduce((sum, block) => sum + block.sequence.length, 0)} drill trials. No trial-level correctness feedback appears.</p>
      <AssistiveInputNotice affected={latencyAffectedInput} onChange={setLatencyAffectedInput} />
      <button disabled={latencyAffectedInput || input.held || !input.focused || !input.visible || input.viewport.width < 768 || input.viewport.height < 600} onClick={() => void begin()}>Start drill</button>
    </>}
    {snapshot.screen === 'summary' && last && <>
      <h1 tabIndex={-1}>Drill block {last.block} complete</h1>
      <p>{blockCopy(manifest.id, last)}</p>
      {manifest.id === 'consistency' && <p>Take the mandatory 15-second neutral reset before the next block.</p>}
      <button disabled={snapshot.resetRemainingMs > 0} onClick={() => activity.run.continue()}>Continue to next block</button>
    </>}
    {snapshot.screen === 'complete' && <>
      <h1 tabIndex={-1}>Drill complete</h1>
      {snapshot.summaries.map(summary => <p key={summary.block}>Block {summary.block}: {blockCopy(manifest.id, summary)}</p>)}
      {completionEvidence(manifest.id, snapshot.summaries).map(line => <p key={line}>{line}</p>)}
      <p>This exercise describes only behavior on this TraitGame task. It is not a diagnosis or employer profile.</p>
      <button onClick={() => snapshot.attempt && onAttempt(snapshot.attempt)}>Continue to retest</button>
    </>}
    {snapshot.screen === 'invalid' && <>
      <h1 tabIndex={-1}>Drill needs to restart</h1>
      <p>This drill was interrupted or did not meet its timing and input rules. Restart from the beginning. No retest form was consumed.</p>
      <button onClick={() => snapshot.attempt && onAttempt(snapshot.attempt)}>Restart drill</button>
    </>}
  </section>
}

export interface Reservation { readonly recorder: PreparationRecorder; readonly formId: string; readonly expiresAtMs: number }
type ComparisonAuthority = { status: 'checking' | 'unavailable' } | { status: 'verified'; chain: TrainingChain }
export function TrainingFlow({ chain, restoredReservation, onChain, onRetest, onLibrary, onNewBaseline }: {
  chain: TrainingChain
  restoredReservation?: Reservation | null
  onChain: (chain: TrainingChain) => void
  onRetest: (reservation: Reservation) => void
  onLibrary: () => void
  onNewBaseline: () => void
}) {
  const [step, setStep] = useState<'recommendation' | 'drill' | 'drill_result' | 'retest' | 'comparison'>(restoredReservation ? 'retest' : chain.status === 'complete' ? 'comparison' : ['drill_complete', 'retesting'].includes(chain.status) ? 'drill_result' : chain.status === 'drilling' ? 'drill' : 'recommendation')
  useCoarseEvent(step === 'recommendation' ? { event: 'stop_training_recommendation_shown' } : null)
  const [reservation, setReservation] = useState<Reservation | null>(restoredReservation ?? null)
  const [expired, setExpired] = useState(false)
  const transferred = useRef(false)
  const mountedReservation = useRef(false)
  const [, tick] = useState(0)
  const heading = useRef<HTMLDivElement>(null)
  const [comparisonAuthority, setComparisonAuthority] = useState<ComparisonAuthority>({ status: 'checking' })
  useEffect(() => {
    if (step !== 'comparison') return
    let live = true, checking = false, request = 0
    let pendingFrame = 0
    const suppress = () => setComparisonAuthority(previous => previous.status === 'verified' ? { status: 'checking' } : previous)
    async function check(resumed = false) {
      if (resumed) { request++; suppress() }
      if (checking) return
      checking = true
      const currentRequest = request
      // Allow one complete rendering cycle for a periodic read to settle. The
      // first frame aligns with rendering; the second withdraws unresolved numbers
      // synchronously before paint. This is not a wall-clock authority grace period.
      if (!resumed) pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = window.requestAnimationFrame(() => {
          pendingFrame = 0
          if (live && checking) flushSync(suppress)
        })
      })
      const ok = await checkTrainingChain(chain)
      checking = false
      window.cancelAnimationFrame(pendingFrame)
      pendingFrame = 0
      if (live && currentRequest === request) setComparisonAuthority(ok ? { status: 'verified', chain } : { status: 'unavailable' })
    }
    const resume = () => { void check(true) }
    resume()
    // Untimed, independent of notifications. Hidden pages suppress on visibility
    // change; rendering-cycle coalescing applies only to ordinary periodic checks.
    const timer = window.setInterval(() => { if (!checking) void check() }, 1000)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      live = false
      window.clearInterval(timer)
      window.cancelAnimationFrame(pendingFrame)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [chain, step])
  useLayoutEffect(() => { heading.current?.querySelector<HTMLElement>('h1')?.focus() }, [step])
  useEffect(() => {
    mountedReservation.current = true
    return () => {
      mountedReservation.current = false
      queueMicrotask(() => { if (reservation && !mountedReservation.current && !transferred.current) {
        stopExposure.release(reservation.recorder.sessionId)
        void stopLocalStore()?.release(reservation.recorder.sessionId, false)
      } })
    }
  }, [reservation])
  function attemptCompleted(attempt: DrillAttempt) {
    retainAttempt(attempt)
    setStep(attempt.valid ? 'drill_result' : 'recommendation')
  }
  function retainAttempt(attempt: DrillAttempt) {
    if (!canRetainTrainingAttempt(chain.id)) return
    retainDrillAttempt(chain.id, attempt)
    const current = currentTrainingChain()
    if (current) onChain(current)
  }
  async function openExplanation() {
    if (pendingRetestCompletion(chain.id) || currentTrainingChain()?.retest || !['drill_complete', 'retesting'].includes(chain.status) || !await checkTrainingChain(chain)) return
    if (pendingRetestCompletion(chain.id) || currentTrainingChain()?.retest) return
    transferred.current = false
    setExpired(false)
    const recorder = createPreparationRecorder()
    const expiresAtMs = Date.now() + 30 * 60 * 1000
    let form
    const store = stopLocalStore()
    if (store) {
      try {
        const claim = await store.reserve(recorder.sessionId, 'retest', Math.random(), expiresAtMs, chain.id, chain, chain.baseline.specificationVersion)
        form = claim ? stopExposure.claim(recorder.sessionId, claim.formId, expiresAtMs) : null
      } catch { await checkTrainingChain(chain); form = null }
    } else {
      form = stopExposure.reserve(recorder.sessionId, Math.random, 'retest', expiresAtMs, chain.baseline.specificationVersion,
        chain.baseline.form.sequence.filter(value => value === 'GO').length)
      if (form) void recordLocalActivity({ key: `${chain.id}:retest_reserved:${recorder.sessionId}`, sessionId: recorder.sessionId,
        chainId: chain.id, type: 'retest_reserved', payload: { formId: form.id, chainId: chain.id, status: 'reserved' } })
    }
    setReservation(form ? { recorder, formId: form.id, expiresAtMs } : null)
    setStep('retest')
  }
  async function validReservation() {
    if (pendingRetestCompletion(chain.id) || currentTrainingChain()?.retest) return false
    if (!await checkTrainingChain(chain)) return false
    if (pendingRetestCompletion(chain.id) || currentTrainingChain()?.retest) return false
    if (!reservation) return false
    const valid = stopExposure.reservation(reservation.recorder.sessionId, Date.now())?.form.id === reservation.formId
    if (!valid) { stopExposure.release(reservation.recorder.sessionId); await stopLocalStore()?.release(reservation.recorder.sessionId, false); setReservation(null); setExpired(true); tick(value => value + 1) }
    return valid
  }
  const comparison = chain.retest ? compareStop(chain.baseline, chain.retest) : null
  if (pendingRetestCompletion(chain.id)) return <section className="panel">
    <h1 tabIndex={-1}>Retest complete</h1>
    <p role="status">Your completed retest is retained in this tab while saving finishes. This chain cannot start another retest.</p>
    <button onClick={onLibrary}>Back to library</button>
  </section>
  return <section ref={heading} className="journey"><div className="journey-top"><button className="secondary" onClick={() => { if (reservation) { stopExposure.release(reservation.recorder.sessionId); void stopLocalStore()?.release(reservation.recorder.sessionId, false) } onLibrary() }}><span aria-hidden="true">← </span>Main menu</button><p>Stop · Advanced training</p></div>
    {step === 'recommendation' && <div className="panel">
      <h1 tabIndex={-1}>Recommended Stop exercise</h1>
      <p><strong>Observed:</strong> {chain.recommendation.observed}</p>
      <p><strong>Possible task advantage:</strong> {chain.recommendation.possibleAdvantage}</p>
      <p><strong>Possible trade-off:</strong> {chain.recommendation.possibleTradeoff}</p>
      <p><strong>Next exercise:</strong> {chain.recommendation.drillId === 'maintenance' ? 'Balanced-maintenance exercise' : `${chain.recommendation.drillId} drill`}.</p>
      {chain.recommendation.exclusionDisclosure && <p className="note">{chain.recommendation.exclusionDisclosure}</p>}
      <p>This recommendation is based only on your TraitGame task data. It is not a diagnosis or employer profile.</p>
      <p>{storageDisclosure()}</p>
      <button onClick={() => { onChain(updateTrainingChain({ status: 'drilling' })); setStep('drill') }}>Start assigned drill</button>
    </div>}
    {step === 'drill' && <DrillActivity chain={chain} onAttempt={attemptCompleted} onRetain={retainAttempt} />}
    {step === 'drill_result' && <div className="panel">
      <h1 tabIndex={-1}>Your drill is complete</h1>
      <p>The assigned exercise was completed without an invalidating interruption. You may try one retest using the same setup.</p>
      <p>{storageDisclosure()}</p>
      <button onClick={() => void openExplanation()}>Try a new Stop sequence</button>
    </div>}
    {step === 'retest' && <div className="panel">
      <h1 tabIndex={-1}>Try a new Stop sequence</h1>
      {!reservation ? <>{expired ? <><p>The retest reservation expired before the scored sequence was shown. Reopen the explanation to reserve an eligible sequence for 30 minutes.</p><button onClick={() => void openExplanation()}>Reopen retest explanation</button></> : <><p>{retestExhaustion()}</p><button onClick={onNewBaseline}>Practise another sequence</button></>}<p>{storageDisclosure()}</p></> : <>
        <p>{retestExplanation()}</p>
        <p>{storageDisclosure()}</p>
        <p>Reservation expires 30 minutes after this explanation opened.</p>
        <button onClick={() => { void validReservation().then(valid => { if (valid) { transferred.current = true; onRetest(reservation) } }) }}>Start retest</button>
        <button className="secondary" onClick={() => { stopExposure.release(reservation.recorder.sessionId); void stopLocalStore()?.release(reservation.recorder.sessionId, false); setReservation(null); setStep('drill_result') }}>Leave retest explanation</button>
      </>}
    </div>}
    {step === 'comparison' && <div className="panel">
      <h1 tabIndex={-1}>Baseline and retest</h1>
      {comparisonAuthority.status === 'checking' || (comparisonAuthority.status === 'verified' && comparisonAuthority.chain !== chain) ? <p>Checking comparison availability. You can return to the library to review your retained retest.</p> : comparisonAuthority.status === 'unavailable' ? <p role="status">Comparison unavailable until the training dependencies and original installation can be confirmed. You can return to the library to review a retained temporary retest.</p> : comparison ? <>
        <p>This compares two valid TraitGame sessions with the same settings.</p>
        <p>{comparisonExposure()}</p>
        {comparison.accommodation && <p>{comparison.accommodation}</p>}
        {comparison.lines.map(line => <p key={line}>{line}</p>)}
        {comparison.narrative && <p><strong>{comparison.narrative}</strong> {comparison.categoryDisclosure}</p>}
        {!comparison.narrative && comparison.categoryDisclosure && <p>{comparison.categoryDisclosure}</p>}
        <p>{displayFirstPartyBrand(comparison.limitation)}</p><p>{displayFirstPartyBrand(comparison.formWarning)}</p>
        <h2>Additional outcomes</h2>{comparison.details.map(line => <p key={line}>{line}</p>)}
      </> : <p>These sessions do not have compatible settings or scoring versions for a change comparison. Their results can only be viewed separately in this tab.</p>}
      <p>{storageDisclosure()}</p>
      <button onClick={onNewBaseline}>Start a new baseline</button>
    </div>}
  </section>
}
