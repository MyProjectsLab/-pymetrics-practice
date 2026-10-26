import '../onboarding/simple-start.css'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
import { stopAnalytics } from '../analytics/client'
import { useCoarseEvent } from '../analytics/observations'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Guide, Rule } from './Guide'
import { Examples } from './Examples'
import { Comprehension } from './Comprehension'
import { Preflight } from './Preflight'
import { NewInputCheck } from './NewInputCheck'
import type { StopSetup } from './Preflight'
import { createUnderstandingEvidence, createNewUnderstandingEvidence, currentNewPreparationBranch, spaceBinding, STOP_EXPERIENCE_VERSION, STOP_RULE_VERSION } from './preparation'
import { readInputReceipt } from '../core/inputCheckReceipt'
import type { KeyProof } from '../core/inputCheckReceipt'
import { inspectLocalState } from './storage'
import { Stimulus } from './Stimulus'
import { STOP_V13_SCORING_VERSION } from './versions'
import type { UnderstandingEvidence } from './preparation'
import type { PreparationRecorder } from './preparation'
import { useResponseKey } from './useResponseKey'
import { createBrowserCanvas, createBrowserScheduler, bindBrowserEvents } from './browser'
import { createStopRun } from './run'
import { stopExposure } from './exposure'
import { LiveRun } from './LiveRun'
import { TouchExamples } from './touch-practice/TouchExamples'
import { TouchSession } from './touch-practice/TouchSession'
import { ASSISTIVE_INPUT_DISCLOSURE } from './AssistiveInputNotice'
import { storageDisclosure, PERSISTENT_DISCLOSURE } from './training'
import { stopLocalStore } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'

type Step = 'guide' | 'new-guide' | 'new-question' | 'new-device' | 'reminder' | 'rule' | 'examples' | 'comprehension' | 'review' | 'device' | 'readiness' | 'reservation_expired' | 'handoff' | 'touch_examples' | 'touch_session'
type NewInputWitness = { origin: 'fresh' | 'reused'; code: string; visualProfile: StopSetup['visualProfile']; proof: KeyProof; receiptId: string | null; tabNonce: string | null }

export function StopJourney({ recorder, mode = 'baseline', specificationVersion = '1.3', reservedFormId, chainId, requiredSetup, onLibrary, onRestart, onReplay, onTraining, onRetestResult, onRetestComplete, onRetestInvalid, onStorageFailure, mock }: { recorder: PreparationRecorder; mode?: 'baseline' | 'replay' | 'retest'; specificationVersion?: '1.1' | '1.3'; reservedFormId?: string; chainId?: string; requiredSetup?: StopSetup; onLibrary: () => void; onRestart: () => void; onReplay: () => void; onTraining?: (result: import('./run').StopResult) => void; onRetestResult?: (result: import('./run').StopResult) => void; onRetestComplete?: (result: import('./run').StopResult) => void; onRetestInvalid?: (draft: import('./run').DevelopmentDraft) => void; onStorageFailure?: () => void; mock?: MockJourneyContext }) {
  const newExperience = specificationVersion === '1.3' && mode === 'baseline'
  const [step, setStep] = useState<Step>(newExperience ? 'new-guide' : 'guide')
  const [setup, setSetup] = useState<StopSetup>(requiredSetup ? { ...requiredSetup, physicalKeyboard: false } : { binding: spaceBinding, visualProfile: 'standard', physicalKeyboard: false })
  useEffect(() => {
    if (!recorder.snapshot().some(event => event.type === 'guide_opened')) recorder.record('guide_opened', { source: mode === 'retest' ? 'training' : 'library' })
  }, [recorder, mode])
  const [evidence, setEvidence] = useState<UnderstandingEvidence | null>(null)
  const [newAnswer, setNewAnswer] = useState('')
  const [newFeedback, setNewFeedback] = useState('')
  const newAttempt = useRef(0)
  const [newInput, setNewInput] = useState<NewInputWitness | null>(null)
  const [skipAvailable, setSkipAvailable] = useState(false)
  const newActionEpoch = useRef(0)
  const newActionPending = useRef(false)
  const newMounted = useRef(true)
  const newView = useRef<Step>(step)
  const newSetup = useRef(setup)
  useLayoutEffect(() => { newView.current = step; newSetup.current = setup }, [step, setup])
  useEffect(() => {
    const mounted = newMounted, epoch = newActionEpoch, pending = newActionPending
    mounted.current = true
    return () => { mounted.current = false; epoch.current++; pending.current = false }
  }, [])
  function retireNewAction() { newActionEpoch.current++; newActionPending.current = false }
  function moveNewStep(next: Step) { newView.current = next; setStep(next) }
  function newActionCurrent(token: number, expectedStep: Step, bindingCode: string, visualProfile: StopSetup['visualProfile']) {
    return newMounted.current && newActionEpoch.current === token && newView.current === expectedStep &&
      newSetup.current.binding.code === bindingCode && newSetup.current.visualProfile === visualProfile
  }
  const openedNew = useRef(false)
  useEffect(() => {
    if (!newExperience || openedNew.current) return
    openedNew.current = true
    recorder.record('onboarding_v13_opened', { ruleVersion: STOP_RULE_VERSION, visualProfile: setup.visualProfile })
  }, [newExperience, recorder, setup.visualProfile])
  const qualifyingBaseline = useCallback(async () => {
    try {
      const selected = stopLocalStore()
      if (!selected) return null
      const state = await selected.read()
      if (!selected.sameInstallation(state)) return null
      const result = inspectLocalState(state).valid.findLast(item => item.mode === 'baseline' && item.specificationVersion === '1.3' &&
        item.setup.visualProfile === setup.visualProfile && item.scoringVersion === STOP_V13_SCORING_VERSION)
      if (!result) return null
      return { installationId: state.installationId, sourceSessionId: result.sessionId, formId: result.form.id,
        formChecksum: result.form.checksum, specificationVersion: '1.3' as const, scoringVersion: result.scoringVersion,
        ruleVersion: STOP_RULE_VERSION, visualProfile: result.setup.visualProfile, sourceReadOutcome: 'verified_complete' as const }
    } catch { return null }
  }, [setup.visualProfile])
  useEffect(() => {
    if (!newExperience || step !== 'new-guide') return
    let live = true
    void qualifyingBaseline().then(value => { if (live) setSkipAvailable(!!value) })
    const dispose = stopLocalStore()?.subscribeDeletion(() => { void qualifyingBaseline().then(value => { if (live) setSkipAvailable(!!value) }) })
    return () => { live = false; dispose?.() }
  }, [newExperience, step, qualifyingBaseline])
  useEffect(() => {
    let active = true
    void stopLocalStore()?.currentUnderstandingEvidence(specificationVersion).then(value => { if (active) setEvidence(value) }).catch(() => undefined)
    return () => { active = false }
  }, [specificationVersion])
  useCoarseEvent(step === 'guide' || step === 'new-guide' ? { event: 'stop_guide_opened' } : null)
  useCoarseEvent(step === 'readiness' ? { event: 'stop_device_check_completed', passed: true, reason: 'none' } : null)
  const analyticsRelease = useRef<(() => void) | null>(null)
  const [attempt, setAttempt] = useState(0)
  const input = useResponseKey(setup.binding)
  const confirmed = useRef(false)
  const verifyingStart = useRef(false)
  const [, refresh] = useState(0)
  const [liveRun, setLiveRun] = useState<ReturnType<typeof createStopRun> | null>(null)
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef(false)
  const active = useRef<{
    run: ReturnType<typeof createStopRun>
    canvas: ReturnType<typeof createBrowserCanvas>
    listeners: ReturnType<typeof bindBrowserEvents>
  } | null>(null)
  useEffect(() => () => {
    active.current?.run.leave()
    active.current?.listeners.dispose()
    active.current?.canvas.clear()
    analyticsRelease.current?.()
  }, [])
  const attach = useCallback((element: HTMLDivElement | null) => {
    if (element) active.current?.canvas.attach(element)
  }, [])
  const content = useRef<HTMLElement>(null)
  const viewportOkay = input.viewport.width >= 768 && input.viewport.height >= 600
  useEffect(() => { content.current?.querySelector<HTMLElement>('h1')?.focus() }, [step])
  useEffect(() => {
    if (step !== 'readiness') return
    const prevent = (event: KeyboardEvent) => {
      if (event.code === setup.binding.code) event.preventDefault()
    }
    document.addEventListener('keydown', prevent, true)
    document.addEventListener('keyup', prevent, true)
    return () => {
      document.removeEventListener('keydown', prevent, true)
      document.removeEventListener('keyup', prevent, true)
    }
  }, [step, setup.binding.code])
  function examples() {
    recorder.record('example_presented', { exampleId: 'example-1', expectedAction: 'press' })
    setStep('examples')
  }
  function comprehension() { setAttempt(value => value + 1); setStep('comprehension') }
  function passedUnderstanding() {
    const store = stopLocalStore()
    if (store) {
      const installationId = store.installationIdentity()
      void createUnderstandingEvidence(recorder, specificationVersion).then(value => store.saveUnderstandingEvidence(value, installationId)).catch(() => undefined)
    }
    setStep('device')
  }
  async function skipIntroduction() {
    const current = await stopLocalStore()?.currentUnderstandingEvidence(specificationVersion).catch(() => null)
    if (!current) { setEvidence(null); return }
    setStep('reminder')
  }
  async function continueShortcut() {
    const current = await stopLocalStore()?.currentUnderstandingEvidence(specificationVersion).catch(() => null)
    if (!current) { setEvidence(null); setStep('guide'); return }
    recorder.record('shortcut_chosen', { sourceSessionId: current.sourceSessionId, ruleVersion: STOP_RULE_VERSION,
      experienceVersion: STOP_EXPERIENCE_VERSION, skipped: ['rule', 'examples', 'comprehension'] })
    setStep('device')
  }
  function preflightComplete() {
    if (setup.latencyAffectedInput) return
    if (requiredSetup && (setup.binding.code !== requiredSetup.binding.code || setup.visualProfile !== requiredSetup.visualProfile || !setup.physicalKeyboard)) return
    recorder.record('device_check_completed', {
      inputBinding: setup.binding.code, inputDeviceClass: 'physical_keyboard',
      visualProfile: setup.visualProfile, timingProfile: 'standard',
    })
    setStep('readiness')
  }
  async function afterNewUnderstanding(token: number, fromStep: 'new-guide' | 'new-question', bindingCode: string, visualProfile: StopSetup['visualProfile']) {
    if (!newActionCurrent(token, fromStep, bindingCode, visualProfile)) return
    const store = stopLocalStore()
    if (store) {
      const installationId = store.installationIdentity()
      void createNewUnderstandingEvidence(recorder).then(value => {
        if (newActionCurrent(token, fromStep, bindingCode, visualProfile)) return store.saveNewUnderstandingEvidence(value, installationId)
      }).catch(() => undefined)
    }
    const cached = await readInputReceipt([bindingCode], visualProfile)
    if (!newActionCurrent(token, fromStep, bindingCode, visualProfile)) return
    if (cached) {
      const proof = cached.entries.find(entry => entry.code === bindingCode)!
      setSetup(value => ({ ...value, physicalKeyboard: true, latencyAffectedInput: false }))
      setNewInput({ origin: 'reused', code: bindingCode, visualProfile, proof,
        receiptId: cached.receiptId, tabNonce: cached.tabNonce }); moveNewStep('readiness')
    }
    else moveNewStep('new-device')
  }
  async function skipNewIntroduction() {
    if (newActionPending.current || newView.current !== 'new-guide') return
    newActionPending.current = true
    const token = ++newActionEpoch.current, bindingCode = setup.binding.code, visualProfile = setup.visualProfile
    try {
      const source = await qualifyingBaseline()
      if (!newActionCurrent(token, 'new-guide', bindingCode, visualProfile)) return
      if (!source) { setSkipAvailable(false); return }
      recorder.record('onboarding_v13_skip_verified', source)
      await afterNewUnderstanding(token, 'new-guide', bindingCode, visualProfile)
    } finally { if (newActionEpoch.current === token) newActionPending.current = false }
  }
  async function checkNewAnswer() {
    if (!newAnswer || newActionPending.current || newView.current !== 'new-question') return
    newActionPending.current = true
    const token = ++newActionEpoch.current, bindingCode = setup.binding.code, visualProfile = setup.visualProfile
    const answerId = newAnswer, correct = answerId === 'press'
    try {
      recorder.record('onboarding_v13_answered', { questionId: 'go', answerId, correct, attempt: ++newAttempt.current })
      if (!correct) { setNewFeedback('For red GO, press once. Green NO-GO means wait. Choose again.'); return }
      setNewFeedback(''); await afterNewUnderstanding(token, 'new-question', bindingCode, visualProfile)
    } finally { if (newActionEpoch.current === token) newActionPending.current = false }
  }
  async function handoff() {
    if (verifyingStart.current) return
    verifyingStart.current = true
    try {
    if (newExperience) {
      const token = newActionEpoch.current
      const branch = currentNewPreparationBranch(recorder.snapshot())
      if (!branch) { if (newActionCurrent(token, 'readiness', setup.binding.code, setup.visualProfile)) moveNewStep('new-guide'); return }
      if (branch.kind === 'skip') {
        const source = await qualifyingBaseline()
        if (!newActionCurrent(token, 'readiness', setup.binding.code, setup.visualProfile)) return
        if (!source || JSON.stringify(source) !== JSON.stringify(branch.source)) {
          setSkipAvailable(false); setNewInput(null); moveNewStep('new-guide'); return
        }
      }
      if (!newInput || newInput.code !== setup.binding.code || newInput.visualProfile !== setup.visualProfile ||
        !setup.physicalKeyboard || setup.latencyAffectedInput) {
        if (newActionCurrent(token, 'readiness', setup.binding.code, setup.visualProfile)) {
          setNewInput(null); moveNewStep('new-device')
        }
        return
      }
      if (!newActionCurrent(token, 'readiness', setup.binding.code, setup.visualProfile)) return
      if (newInput.origin === 'reused') {
        const current = await readInputReceipt([setup.binding.code], setup.visualProfile)
        if (!newActionCurrent(token, 'readiness', setup.binding.code, setup.visualProfile)) return
        if (!current || current.receiptId !== newInput.receiptId || current.tabNonce !== newInput.tabNonce) {
          setNewInput(null); moveNewStep('new-device'); return
        }
      }
    }
    if (setup.latencyAffectedInput || confirmed.current || input.isDown(setup.binding.code) || !input.focused || !document.hasFocus() ||
      document.visibilityState !== 'visible' || window.innerWidth < 768 || window.innerHeight < 600) return
    if (mode === 'retest' && !stopExposure.reservation(recorder.sessionId, Date.now())) {
      stopExposure.release(recorder.sessionId)
      void stopLocalStore()?.release(recorder.sessionId, false).catch(() => undefined)
      setStep('reservation_expired')
      return
    }
    confirmed.current = true
    if (newExperience && newInput) {
      recorder.record('input_check_v13', { origin: newInput.origin, code: setup.binding.code, proof: newInput.proof,
        receiptId: newInput.receiptId, tabNonce: newInput.tabNonce, inputDeviceClass: 'physical_keyboard',
        physicalKeyboardDeclared: true, latencyAffectedInput: false, timingProfile: 'standard', visualProfile: setup.visualProfile })
    }
    recorder.record('readiness_confirmed', { focused: document.hasFocus(), visible: document.visibilityState === 'visible' })
    const clock = () => performance.now()
    const canvas = createBrowserCanvas(clock, setup.visualProfile, () => run.engine.technicalFailure('DOM presentation confirmation failed'), () => run.canPresentScored())
    const run = createStopRun({ preparation: recorder, setup, exposure: stopExposure, mode, specificationVersion,
      experienceVersion: newExperience ? 'stop_experience_v1_3' : undefined, reservedFormId, chainId, storageFailed: onStorageFailure,
      beforeScoredArm: mock?.beforeArm,
      completed: mode === 'retest' ? onRetestComplete : mock ? result => {
        if (result.storageMode !== 'persistent_local' || mockTerminalSeen.current) return
        mockTerminalSeen.current = true
        void mock.terminal().then(status => { if (status === 'ready') setMockReady(true); else setMockError('This native attempt is review only. Return to mock.') })
          .catch(cause => { mockTerminalSeen.current = false; setMockError(cause instanceof Error ? cause.message : 'Mock result acknowledgement could not be confirmed.') })
      } : undefined,
      admission: () => ({ visible: document.visibilityState === 'visible', focused: document.hasFocus(),
        held: input.isDown(setup.binding.code), width: window.innerWidth, height: window.innerHeight,
        compatible: !requiredSetup || setup.binding.code === requiredSetup.binding.code && setup.visualProfile === requiredSetup.visualProfile }),
      clock, scheduler: createBrowserScheduler(clock), frames: canvas.frames,
      clear: canvas.clear, changed: () => refresh(value => value + 1),
      initialFrame: (ready, current) => { const id = requestAnimationFrame(() => {
        if (!current()) return
        try { canvas.fixation(); ready() } catch { run.engine.technicalFailure('Initial fixation could not render') }
      }); return () => cancelAnimationFrame(id) },
      environment: { userAgent: navigator.userAgent, width: window.innerWidth, height: window.innerHeight },
    })
    analyticsRelease.current = stopAnalytics.hold(() => run.protectedNow() || run.snapshot().saveStatus === 'pending')
    const listeners = bindBrowserEvents(run.engine, setup.binding.code, run.activeNow,
      () => run.snapshot().screen === 'warmup_complete' || run.snapshot().screen === 'warmup_restart')
    active.current = { run, canvas, listeners }
    setLiveRun(run)
    run.begin(input.isDown(setup.binding.code))
    run.startWarmup()
    setStep('handoff')
    } finally { verifyingStart.current = false }
  }
  const menuLabel = mock ? 'Return to mock' : 'Main menu'
  function back() {
    if (newExperience) retireNewAction()
    if(step!=='guide' && step!=='new-guide')mock?.retireReturnIntent()
    if (step === 'guide' || step === 'new-guide') onLibrary()
    else if (step === 'reservation_expired') onRestart()
    else if (step === 'rule' || step === 'review' || step === 'reminder') setStep('guide')
    else if (step === 'touch_examples' || step === 'touch_session') moveNewStep(newExperience ? 'new-guide' : 'guide')
    else if (step === 'readiness') moveNewStep(newExperience ? 'new-device' : 'device')
    else if (step === 'new-question' || step === 'new-device') moveNewStep('new-guide')
    else setStep('rule')
  }
  return <section className="journey" ref={content}>
    <div className="journey-top">
      {step !== 'handoff' && step !== 'touch_session' && <button className="secondary" data-mock-return-intent={mock && (step === 'guide' || step === 'new-guide') ? "" : undefined} onClick={back}><span aria-hidden="true">← </span>{step === 'guide' || step === 'new-guide' ? menuLabel : 'Back'}</button>}
      <p>Stop · Practice</p>
    </div>
    <div className="panel">
      {step === 'new-guide' && <div className="simple-stop-guide">
        <p className="eyebrow">Stop · How it works</p><h1 tabIndex={-1}>Stop</h1>
        <div className="rule-grid"><div><Stimulus kind="GO" profile={setup.visualProfile}/><p>GO — press {setup.binding.label} once</p></div><div><Stimulus kind="NO_GO" profile={setup.visualProfile}/><p>NO-GO — wait</p></div></div>
        <p>You can respond after the signal disappears, until its response window closes.</p><button onClick={()=>{retireNewAction();moveNewStep('new-question')}}>Continue</button>
        <details className="start-options"><summary>Examples and previous practice</summary>
          {!mock&&<button className="secondary" onClick={()=>{retireNewAction();moveNewStep('touch_examples')}}>Try an untimed example</button>}
          {skipAvailable&&<button className="secondary" onClick={()=>{void skipNewIntroduction()}}>Skip instructions</button>}
          {storageDisclosure()===PERSISTENT_DISCLOSURE&&<p>{storageDisclosure()}</p>}<p>This exercise practises responding to a signal while holding back on another. It is not an employer score.</p>
        </details>
      </div>}
      {step === 'new-question' && <>
        <p className="eyebrow">Stop · Try the rule</p><h1 tabIndex={-1}>What do you do for GO?</h1>
        <fieldset><legend>Choose one answer</legend>
          <label className="choice"><input type="radio" name="stop-new-check" checked={newAnswer === 'press'} onChange={() => { retireNewAction(); setNewAnswer('press') }} />Press {setup.binding.label} once.</label>
          <label className="choice"><input type="radio" name="stop-new-check" checked={newAnswer === 'wait'} onChange={() => { retireNewAction(); setNewAnswer('wait') }} />Do nothing.</label>
          <label className="choice"><input type="radio" name="stop-new-check" checked={newAnswer === 'repeat'} onChange={() => { retireNewAction(); setNewAnswer('repeat') }} />Press repeatedly.</label>
        </fieldset><div role="status">{newFeedback}</div>
        <button disabled={!newAnswer} onClick={() => { void checkNewAnswer() }}>Check</button>
      </>}
      {step === 'new-device' && <NewInputCheck setup={setup} onCancel={retireNewAction} onChange={value => { retireNewAction(); newSetup.current = value; setSetup(value); setNewInput(null) }} onChecked={observation => {
        retireNewAction()
        setNewInput({ origin: 'fresh', code: observation.proof.code, visualProfile: setup.visualProfile, proof: observation.proof,
          receiptId: observation.receipt?.receiptId ?? null, tabNonce: observation.receipt?.tabNonce ?? null }); moveNewStep('readiness') }} />}
      {step==='new-guide'&&storageDisclosure()!==PERSISTENT_DISCLOSURE&&<p className="note" role="status">{storageDisclosure()}</p>}
    {step === 'guide' && <><Guide onNext={() => setStep('rule')} onTouch={!mock && mode === 'baseline' ? () => setStep('touch_examples') : undefined} />
        <p className="note">{storageDisclosure()}</p>
        {evidence && <div className="actions"><button className="secondary" onClick={() => void skipIntroduction()}>Skip introduction</button>
          <p>A saved, current Stop understanding check was verified in this browser. You can still review the full rule and examples.</p></div>}</>}
      {step === 'reminder' && <>
        <p className="eyebrow">Stop · Rule reminder</p><h1 tabIndex={-1}>Remember the Stop rule</h1>
        <p>Press {setup.binding.label} once for GO. Do nothing for NO-GO. You can respond until the response window closes, even after the symbol disappears.</p>
        <p>Space is the default key for this Stop exercise. You can choose another physical key during setup.</p>
        <div className="actions"><button onClick={() => void continueShortcut()}>Check your setup</button>
          <button className="secondary" onClick={() => setStep('rule')}>Review the full rule and examples</button></div>
      </>}
      {(step === 'rule' || step === 'review') && <Rule review={step === 'review'} responseLabel={setup.binding.label}
        profile={setup.visualProfile} onNext={step === 'review' ? comprehension : examples} />}
      {step === 'examples' && <Examples recorder={recorder} binding={setup.binding} profile={setup.visualProfile}
        held={input.held} onComplete={comprehension} />}
      {step === 'touch_examples' && <TouchExamples onComplete={() => { if (newExperience) retireNewAction(); moveNewStep('touch_session') }} />}
      {step === 'touch_session' && <TouchSession onMenu={newExperience ? () => { retireNewAction(); moveNewStep('new-guide') } : onLibrary} />}
      {step === 'comprehension' && <Comprehension key={attempt} recorder={recorder} attempt={attempt} binding={setup.binding}
        onReview={() => setStep('review')} onPassed={passedUnderstanding} />}
      {step === 'device' && <Preflight setup={setup} onChange={setSetup} held={input.held} lockedProfile={mode === 'retest'}
        requiredSetup={requiredSetup} viewport={input.viewport} onComplete={preflightComplete} />}
      {step === 'readiness' && <>
        <p className="eyebrow">Stop · Readiness</p>
        <h1 tabIndex={-1}>Ready to begin?</h1>
        <p>First, 8 warm-up signals. Then, 80 scored signals. Respond quickly and accurately.</p>
        <p>Keep this tab open and focused during play. You can pause at the end of the warm-up.</p>
        {setup.latencyAffectedInput && <p>{ASSISTIVE_INPUT_DISCLOSURE}</p>}
        <p>Response key: <kbd>{setup.binding.label}</kbd> · {setup.visualProfile === 'standard' ? 'Standard color-plus-marker symbols' : 'High-distinction shape accommodation'}</p>
        <div role="status">
          {input.held && <p>Release the response key before starting.</p>}
          {!viewportOkay && <p>The timed game needs a larger visible area. Enlarge the window or use a larger screen.</p>}
        </div>
        <div className="actions"><button disabled={input.held || !viewportOkay || !input.visible || !input.focused}
          onClick={() => { void handoff() }}>{newExperience ? 'Start' : 'I’m ready'}</button><button className="secondary" onClick={() => { if (newExperience) retireNewAction(); setNewInput(null); moveNewStep(newExperience ? 'new-device' : 'device') }}>Options</button></div>
      </>}
      {step === 'reservation_expired' && <>
        <h1 tabIndex={-1}>Retest reservation expired</h1>
        <p>The unexposed reservation was released. Reopen the retest explanation to reserve an available sequence. Waiting here did not create an invalid scored result or consume a form.</p>
        <button onClick={onRestart}>Reopen retest explanation</button>
      </>}
      {step === 'handoff' && liveRun && <LiveRun run={liveRun} attach={attach}
        restartWarmup={() => active.current?.run.startWarmup()} onRestart={onRestart}
        onGuide={onRestart} onLibrary={onLibrary} onReplay={onReplay} onTraining={onTraining} onRetestResult={onRetestResult} onRetestInvalid={onRetestInvalid}
        mockReady={mockReady} mockError={mockError} onMockContinue={mock ? () => void mock.continue().catch(cause => setMockError(cause instanceof Error ? cause.message : 'Continue could not be confirmed.')) : undefined} />}
      {step !== 'handoff' && step !== 'touch_session' && step !== 'guide' && step !== 'new-guide' && <div className="actions"><button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={onLibrary}>{menuLabel}</button></div>}
      {(step === 'guide' || step === 'new-guide') && <AssessmentUsageNotice />}
    </div>
  </section>
}
