import { stopAnalytics } from '../analytics/client'
import { useCoarseEvent, useSessionAnalytics } from '../analytics/observations'
import { Component, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StopRun } from './run'
import { invalidReason } from './run'
import { RULE } from './engine/rules'
import { InvalidReport, StopReport } from './Report'
import { storageDisclosure, trainingSaveStatus } from './training'

export class ReportBoundary extends Component<{ children: React.ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  componentDidCatch() { stopAnalytics.emit({ event: 'stop_technical_error', error_class: 'report_render_failed' }) }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div role="alert"><h1>Result could not be shown</h1><p>Your recorded result is retained in this tab.</p><button onClick={() => { this.props.onRetry(); this.setState({ failed: false }) }}>Try showing the result again</button></div>
    return this.props.children
  }
}

export function LiveRun({ run, attach, restartWarmup, onRestart, onGuide, onLibrary, onReplay, onTraining, onRetestResult, onRetestInvalid, mockReady, mockError, onMockContinue }: {
  run: StopRun; attach: (element: HTMLDivElement | null) => void
  restartWarmup: () => void; onRestart: () => void; onGuide: () => void; onLibrary: () => void; onReplay: () => void
  onTraining?: (result: import('./run').StopResult) => void; onRetestResult?: (result: import('./run').StopResult) => void
  onRetestInvalid?: (draft: import('./run').DevelopmentDraft) => void
  mockReady?: boolean; mockError?: string; onMockContinue?: () => void
}) {
  const { screen, engine, setup, result, draft, mode, storageFailure, saveStatus, reviewOnly, admissionMessage } = run.snapshot()
  const content = useRef<HTMLDivElement>(null)
  const [reportKey, setReportKey] = useState(0)
  const live = screen === 'live' || screen === 'checking'
  const notified = useRef(false)
  useEffect(() => {
    if (mode === 'retest' && draft && screen === 'invalid' && !notified.current) {
      notified.current = true
      onRetestInvalid?.(draft)
    }
  }, [mode, draft, screen, onRetestInvalid])
  useLayoutEffect(() => {
    if (live) content.current?.querySelector<HTMLElement>('[data-game-focus]')?.focus({ preventScroll: true })
    else content.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [screen, live, reportKey])
  const technical = (draft?.invalidRule ?? engine.invalidRule) === RULE.integrity
  const warmupOnly = screen === 'invalid' && engine.invalidRule === RULE.warmupTiming && !draft?.form
  const latestRestart = engine.events?.findLast(event => event.type === 'warmup_restart_required')
  const warmupInterruption = latestRestart && engine.events?.find(event => event.type === 'warmup_interrupted' &&
    event.sequenceNumber === latestRestart.payload.triggerSequenceNumber)
  useSessionAnalytics(mode, result ? 'completed' : draft ? (technical ? 'technical_failure' : 'invalid') : null, saveStatus === 'pending')
  useCoarseEvent(storageFailure ? { event: 'stop_storage_failure', error_class: 'write_failed' } : null)
  return <div ref={content}>
    <div className="stop-live" hidden={!live} data-game-focus tabIndex={-1} aria-label="Timed Stop task">
      <p className="stop-reminder">GO: press {setup.binding.label} · NO-GO: do nothing</p>
      <div className="stop-presentation" ref={attach} aria-hidden="true" />
    </div>
    {screen === 'warmup_complete' && <>
      <h1 tabIndex={-1}>Warm-up complete</h1>
      <p>You can pause here. When you select ‘Start scored task,’ keep this tab active until Stop ends. Switching away during the scored task makes the attempt invalid.</p>
      {admissionMessage && <p role="status">{admissionMessage}</p>}
      <button onClick={() => void run.startScored()}>Start scored task</button>
    </>}
    {screen === 'warmup_restart' && <>
      <h1 tabIndex={-1}>Warm-up needs to restart</h1>
      <p>{warmupInterruption ? 'Live warm-up was interrupted. Return to this tab, then restart all eight warm-up trials from trial 1.' :
        'Browser timing moved outside the allowed range. Keep this tab visible, close other demanding applications, and restart the warm-up.'}</p>
      {admissionMessage && <p role="status">{admissionMessage}</p>}
      <button onClick={restartWarmup}>Restart warm-up</button>
    </>}
    {screen === 'invalid' && <>
      <h1 tabIndex={-1}>{warmupOnly ? 'Warm-up could not finish' : technical ? 'Stop could not finish this session' : 'This run cannot continue as a valid session'}</h1>
      {warmupOnly ? <p>A second warm-up timing problem ended preparation. No scored task began and no scored form was consumed. Check your browser environment, then start a new attempt.</p> : technical ? <p>A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.</p> :
        <p>{invalidReason(engine.invalidRule)} Your completed events are preserved locally for review. Restarting will use another available form.</p>}
      <p>Not eligible for comparison</p>
      {storageFailure && <p role="alert">This attempt was retained in this tab, but saving it in this browser could not be confirmed. Keep this tab open to review or retry it.</p>}
      {!storageFailure && trainingSaveStatus() === 'failed' && <p role="alert">{storageDisclosure()}</p>}
      <div className="actions"><button onClick={onRestart}>{warmupOnly ? 'Start a new attempt' : 'Restart with a new form'}</button>
        <button className="secondary" data-mock-return-intent={onMockContinue && technical ? "" : undefined} onClick={technical ? onLibrary : onGuide}>{technical ? onMockContinue?'Return to mock':'Return to library' : 'Return to the guide'}</button>
        {draft && <button className="secondary" onClick={run.viewInvalidReport}>Review this attempt</button>}</div>
    </>}
    {screen === 'exhausted' && <>
      <h1 tabIndex={-1}>No unused form is available for this activity in the current beta.</h1>
      {onMockContinue ? <><p>The mock cannot use a replay, retest or older Stop form. Return to the mock, check this launch, then omit Stop or end early.</p><button data-mock-return-intent onClick={onLibrary}>Return to mock</button></> : <>{mode === 'baseline' && <button onClick={onReplay}>Practise another sequence</button>}<button onClick={onGuide}>Return to the guide</button></>}
    </>}
    {screen === 'reservation_expired' && <>
      <h1 tabIndex={-1}>{mode === 'retest' ? 'Retest reservation expired' : 'Form reservation expired'}</h1>
      <p>{mode === 'retest' ? 'The unexposed reservation was released. Reopen the retest explanation to reserve an available sequence. No form was silently substituted.' : 'This tab’s form reservation expired. Restart Stop to reserve an available sequence. No form was silently substituted.'}</p>
      <button onClick={onRestart}>{mode === 'retest' ? 'Reopen retest explanation' : 'Restart Stop'}</button>
    </>}
    {(screen === 'complete' || screen === 'report') && <>
      {saveStatus === 'pending' && <p role="status">Saving this result. It is not yet confirmed saved. Keep this tab open to review it.</p>}
      {saveStatus === 'saved' && <p role="status">This result is saved in this browser.</p>}
      {saveStatus === 'review_only' && <p role="status">This result is retained only in this tab for review. It is not saved in this browser.</p>}
      {reviewOnly && saveStatus !== 'deleted' && <p>This training chain was broken by deletion. This result cannot be used for training, a retest, or baseline comparison.</p>}
      {storageFailure && <p role="alert">Your task data were recorded in this tab but could not be saved in this browser. Keep this tab open to review the result or continue the current training chain.</p>}
    </>}
    {saveStatus === 'deleted' && <><h1 tabIndex={-1}>Stop result deleted</h1><p>This result is no longer retained. A new baseline is required to start training.</p><button data-mock-return-intent={onMockContinue ? "" : undefined} onClick={onLibrary}>{onMockContinue?'Return to mock':'Back to library'}</button></>}
    {screen === 'complete' && saveStatus !== 'deleted' && <>
      <h1 tabIndex={-1}>Stop complete</h1>
      <p>Your result is ready. Review what happened on this TraitGame sequence.</p>
      <button onClick={run.viewReport}>View my result</button>
    </>}
    {screen === 'report' && result && <ReportBoundary key={reportKey} onRetry={() => { run.recoverReport(); setReportKey(value => value + 1) }}>
      <StopReport result={result} onReplay={onReplay} onLibrary={onLibrary} returnToMock={!!onMockContinue} onTraining={saveStatus === 'pending' || reviewOnly ? undefined : onTraining} onComparison={saveStatus === 'pending' || reviewOnly ? undefined : onRetestResult} />
      {mockError && <p role="alert">{mockError}</p>}{mockReady && onMockContinue && <button data-mock-return-intent onClick={onMockContinue}>Continue mock</button>}
    </ReportBoundary>}
    {screen === 'invalid_report' && <InvalidReport draft={draft} onRestart={onRestart} onGuide={onGuide} onMockReturn={onMockContinue?onLibrary:undefined} />}
  </div>
}
