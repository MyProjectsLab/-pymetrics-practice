import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { BalloonsStore } from './storage'
import { withMutationGate } from './storage'
import { CHANGE_CHANNEL } from './controller'
import { drillDemo, drillFeedback } from './drills'
import type { DrillControl, DrillFeedback } from './drills'
import { acquireTrainingOwner, assignTraining, commitTrainingAction, pauseTraining, readTraining, restartInvalidTraining } from './training-storage'
import type { SavedTrainingView, TrainingOwner } from './training-storage'
import { installButtonInput } from './input'
import { typeFor } from './router'
import { verifiedDrillManifest } from './drill-manifests'
import { money } from './format'
import { BalloonIdentity } from './BalloonVisual'
import { displayFirstPartyBrand } from '../design/brandDisplay'
import type { ActionSource } from './contracts'

function Feedback({ value }: { value: DrillFeedback }) {
  if (value.kind === 'outcome') return <><p>{value.message ?? 'Matched transitions from completed rounds:'}</p><ul>{value.transitions.map(t => <li key={t.visibleType}>{t.visibleType}: round {t.fromRound} {t.fromOutcome.replaceAll('_', ' ')}; next same-type round {t.nextRound} collected at {t.nextVoluntaryPoint} pumps.</li>)}</ul>{'counts' in value && value.counts && <p>{value.counts.collected}/{value.counts.rounds} collected; {value.counts.burst}/{value.counts.rounds} burst.</p>}</>
  if (value.kind === 'information') return <ul>{value.categories.map(c => <li key={c.visibleType}>{c.visibleType}: {c.collected}/{c.denominator} collected; {c.burst}/{c.denominator} burst.</li>)}</ul>
  if (value.kind === 'updating') return <ul>{value.categories.map(c => <li key={c.visibleType}>{c.visibleType}: {c.voluntary}/{c.denominator} voluntary, {c.cap}/{c.denominator} cap, {c.burst}/{c.denominator} burst.</li>)}</ul>
  if (value.kind === 'consistency') return <p>{value.visibleType}: {value.voluntaryCount} voluntary collections. {value.message ?? `Range ${value.range!.min}–${value.range!.max} pumps; IQR ${value.iqr} pumps.`} {value.burst} bursts; {value.cap} cap collections.</p>
  return <p>{money(value.bankedCents)} banked; {money(value.lostCents)} lost; {value.collected}/{value.completed} collected and {value.burst}/{value.completed} burst.</p>
}
const time = (epoch: string) => ({ wallTimeMs: Date.now(), monotonicMs: performance.now(), clockEpochId: epoch })

export function TrainingJourney({ store, baselineSessionId, onHistory, onRetest }: { store: BalloonsStore; baselineSessionId: string; onHistory: () => void; onRetest?: (recordId?: string, freshAttempt?: boolean) => void }) {
  const [saved, setSaved] = useState<SavedTrainingView | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState('')
  const root = useRef<HTMLElement>(null), live = useRef<HTMLParagraphElement>(null), input = useRef<ReturnType<typeof installButtonInput> | null>(null)
  const alive = useRef(false), request = useRef(0), epoch = useRef(crypto.randomUUID()), current = useRef<SavedTrainingView | null>(null)
  const owner = useRef<TrainingOwner | null>(null), pending = useRef<AbortController | null>(null), blocked = useRef(true)
  const checking = useRef(false)
  const presented = useRef(''), restoreFocus = useRef<HTMLElement | null>(null)
  function show(next: SavedTrainingView) { current.current = next; setSaved(next) }
  function lock(value: boolean) { if (value && !blocked.current) restoreFocus.current = root.current?.contains(document.activeElement) ? document.activeElement as HTMLElement : null; blocked.current = value; setBusy(value) }
  function release() { const held = owner.current; owner.current = null; return held?.release() }
  async function open(resume = false, source: ActionSource = 'unknown_or_assistive') {
    if (document.visibilityState !== 'visible') return
    const id = ++request.current, scope = new AbortController(); pending.current?.abort(); pending.current = scope
    lock(true); setError('')
    const retainedOwner = resume && owner.current?.live ? owner.current : null
    if (!retainedOwner) await release()
    try {
      const acquired = retainedOwner ?? await acquireTrainingOwner(new AbortController().signal)
      if (!alive.current || id !== request.current) { acquired.release(); return }
      owner.current = acquired
      let next = await withMutationGate(signal => assignTraining(store, acquired, baselineSessionId, time(epoch.current), signal), scope.signal)
      if (resume && next.attempt.snapshot.phase === 'paused') next = await withMutationGate(signal => commitTrainingAction(store, acquired,
        next.chain.recommendation.chainId, next.attempt.header.attemptId, next.attempt, 'resume', source, time(epoch.current), undefined, signal), scope.signal)
      if (alive.current && id === request.current) { show(next); lock(false) }
    } catch (e) {
      if (alive.current && id === request.current) { release(); setSaved(null); setError(e instanceof Error ? e.message : 'Training unavailable'); lock(false) }
    }
  }
  // Fence synchronously, then pause the authoritative committed prefix, even if an
  // action's delivery was pending. Its aborted/late callback cannot re-enable input.
  async function interrupt() {
    const acquired = owner.current
    if (!acquired || !alive.current) return
    const id = ++request.current; pending.current?.abort(); input.current?.cancel(); lock(true)
    const scope = new AbortController(); pending.current = scope
    try {
      const next = await withMutationGate(signal => pauseTraining(store, acquired, time(epoch.current), signal), scope.signal)
      if (alive.current && id === request.current) { show(next); setError(''); lock(false); release() }
    } catch (e) {
      if (alive.current && id === request.current) { setSaved(null); setError(`Pause needs checking. ${e instanceof Error ? e.message : ''}`); lock(false); release() }
    }
  }
  useEffect(() => {
    alive.current = true
    void open()
    const installed = installButtonInput(root.current!, () => blocked.current)
    input.current = installed
    const blur = () => { void interrupt() }
    const visibility = () => { if (document.visibilityState === 'hidden') void interrupt() }
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility)
    return () => {
      // Mutable lifecycle refs intentionally cancel the latest operation on exit.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      alive.current = false; request.current++; pending.current?.abort(); installed.dispose(); release()
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility)
    }
    // One capability and key-cycle guard per mounted journey, never per save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, baselineSessionId])
  useEffect(() => {
    let active = true
    const check = async () => {
      const active = current.current
      if (!active || !alive.current || blocked.current || checking.current) return
      checking.current = true
      const id = ++request.current
      try {
        const next = await withMutationGate(() => readTraining(store, active.chain.recommendation.chainId, active.attempt.header.attemptId, owner.current ?? undefined))
        if (alive.current && id === request.current) {
          // An observer may read another owner's progress, but may never operate it.
          if (!owner.current && next.attempt.snapshot.phase !== 'paused' && !['completed','invalid'].includes(next.attempt.snapshot.phase)) throw new Error('Exercise changed in another tab. Reopen after it is released.')
          show(next)
        }
      } catch (e) { if (alive.current && id === request.current) { release(); setSaved(null); setError(e instanceof Error ? e.message : 'Saved training unavailable'); lock(false) } }
      finally { checking.current = false }
    }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANGE_CHANNEL) : null
    if (channel) channel.onmessage = () => {
      if (!active || !alive.current) return
      request.current++; pending.current?.abort(); input.current?.cancel(); release()
      current.current = null; setSaved(null); setError('Local history changed. Reopen to check the saved exercise.'); lock(false)
    }
    const timer = window.setInterval(() => { void check() }, 1500)
    return () => { active = false; channel?.close(); clearInterval(timer) }
  }, [store, baselineSessionId])
  async function command(kind: DrillControl, source: ActionSource = 'unknown_or_assistive') {
    if (kind === 'pause') { void interrupt(); return }
    if (kind === 'resume') { epoch.current = crypto.randomUUID(); void open(true, source); return }
    const active = current.current, acquired = owner.current
    if (!active || blocked.current || !acquired?.live || document.visibilityState !== 'visible') return
    const id = ++request.current, scope = new AbortController(); pending.current = scope
    lock(true); setError('')
    try {
      const next = await withMutationGate(signal => commitTrainingAction(store, acquired, active.chain.recommendation.chainId, active.attempt.header.attemptId,
        active.attempt, kind, source, time(epoch.current), undefined, signal), scope.signal)
      const verified = await withMutationGate(() => readTraining(store, next.chain.recommendation.chainId, next.attempt.header.attemptId, acquired), scope.signal)
      if (alive.current && id === request.current) { show(verified); lock(false) }
    } catch (e) {
      if (!alive.current || id !== request.current) return
      setSaved(null); setError(`Save status needs checking. ${e instanceof Error ? e.message : ''}`)
      try {
        const recovered = await withMutationGate(signal => pauseTraining(store, acquired, time(epoch.current), signal))
        if (alive.current && id === request.current) { show(recovered); setError('Saved drill state verified after an interrupted save.'); lock(false); release() }
      } catch { if (alive.current && id === request.current) { release(); lock(false) } }
    }
  }
  async function restart() {
    const active = current.current, acquired = owner.current
    if (!active || blocked.current || !acquired?.live || document.visibilityState !== 'visible') return
    const id = ++request.current, scope = new AbortController(); pending.current = scope; lock(true)
    try {
      const next = await withMutationGate(signal => restartInvalidTraining(store, acquired, active.chain.recommendation.chainId, active.attempt.header.attemptId, time(epoch.current), signal), scope.signal)
      if (alive.current && id === request.current) { show(next); lock(false) }
    } catch (e) { if (alive.current && id === request.current) { release(); setSaved(null); setError(e instanceof Error ? e.message : 'Restart unavailable'); lock(false) } }
  }
  useLayoutEffect(() => {
    if (!saved || busy) return
    const a = saved.attempt, s = a.snapshot, key = `${a.header.attemptId}:${s.revision}`
    if (presented.current === key) { if (restoreFocus.current?.isConnected) restoreFocus.current.focus(); restoreFocus.current = null; return }
    presented.current = key; restoreFocus.current = null
    const phase = s.phase, last = a.journal.at(-1)!, result = s.results.at(-1)
    const type = typeFor(a.header.recommendation.mapping, verifiedDrillManifest(a.header.manifestId)!.rounds[s.round - 1].profile)
    let message = '', selector = ''
    if (phase === 'active') {
      selector = '[data-control="pump"]'
      if (last.command?.kind !== 'pump' || a.header.recommendation.settings.verbose) message = `Round ${s.round}. ${type}. Current ${s.currentCents} cents. Banked ${s.bankedCents} cents.`
    } else if (['resolved','feedback','completed'].includes(phase) && result) {
      selector = phase === 'completed' ? '[data-history]' : '[data-next]'
      message = `${type}. ${result.outcome === 'burst' ? 'Balloon burst' : result.outcome === 'cap_collect' ? 'Automatic cap collection' : 'Collected'}. Current ${s.currentCents} cents. ${result.bankedCents} cents banked; ${result.lostCents} cents lost this round. Banked total ${s.bankedCents} cents.`
    } else { selector = '[data-next]'; message = phase === 'paused' ? 'Paused; confirmed choices are saved here.' : phase === 'ready' ? 'Ready to start the assigned exercise.' : phase === 'demo' ? `Unscored example ${s.demoIndex + 1} of 2.` : 'Invalid attempt.' }
    if (message && live.current) live.current.textContent = message
    if (selector) root.current?.querySelector<HTMLElement>(selector)?.focus()
  }, [saved, busy])
  const rec = saved?.chain.recommendation, attempt = saved?.attempt, snapshot = attempt?.snapshot
  const feedback = attempt && ['feedback', 'completed'].includes(attempt.snapshot.phase) ? drillFeedback(attempt) : null
  const demo = attempt?.snapshot.phase === 'demo' ? drillDemo(attempt) : null
  const row = attempt && snapshot && ['active', 'resolved', 'feedback', 'completed'].includes(snapshot.phase) ? (() => {
    // The displayed type is derived only from the verified inventory and bound mapping.
    const profile = snapshot.phase === 'active' ? verifiedDrillManifest(attempt.header.manifestId)!.rounds[snapshot.round - 1].profile : snapshot.results.at(-1)!.profile
    return typeFor(rec!.mapping, profile)
  })() : null
  function click(kind: DrillControl, e: ReactMouseEvent<HTMLButtonElement>) { const source = input.current?.source(e.nativeEvent); if (source) void command(kind, source) }
  return <section ref={root} className="panel balloons-training"><p className="eyebrow">Balloons · assigned exercise</p><h1 tabIndex={-1}>Your Balloons practice pattern</h1>
    <p ref={live} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
    {!saved && !busy && <button onClick={() => void open()}>Reopen saved exercise</button>}
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Checking saved training…</p>}
    {rec && attempt && snapshot && <>
      <p>{rec.card.observation}</p><p>Possible task advantage: {rec.card.possibleAdvantage}</p><p>Trade-off: {rec.card.tradeOff}</p>
      <p>Exercise purpose: {rec.card.purpose}</p><p>{displayFirstPartyBrand(rec.card.limitation)}</p>
      <h2>Assigned 18-round exercise</h2><p>{attempt.header.familiar ? 'Familiar exercise: this fixed inventory has been started before.' : 'First use of this fixed inventory in this installation.'} Money is simulated. Pump or Collect; the exercise is untimed.</p>
      <p role="status">{snapshot.results.length} of 18 rounds saved. {snapshot.phase === 'completed' ? saved.eligible ? 'First completed exercise saved. You can try the follow-up exercise.' : 'Completed exercise saved; a follow-up is unavailable.' : snapshot.phase === 'invalid' ? 'This attempt is invalid and does not qualify for a follow-up.' : snapshot.phase === 'paused' ? 'Paused; confirmed choices are saved here.' : 'Current exercise state saved.'}</p>
      {demo && <><BalloonIdentity type="Type 1" successfulPumps={demo.successfulPumps} outcome={demo.outcome === 'burst' ? 'burst' : 'voluntary_collect'} reducedMotion={rec.settings.reducedMotion} showIdentity={false} /><p>Unscored example {snapshot.demoIndex + 1} of 2: three successful pumps, then {demo.outcome === 'burst' ? 'attempt four bursts and 15 cents on this balloon is lost' : 'Collect banks 15 cents'}.</p><button data-next disabled={busy} onClick={e => click('demo_next', e)}>Next example</button></>}
      {snapshot.phase === 'ready' && <button data-next disabled={busy} onClick={e => click('start', e)}>Start assigned exercise</button>}
      {row && <><BalloonIdentity key={`${attempt.header.attemptId}:${snapshot.round}`} type={row} successfulPumps={snapshot.successfulPumps} outcome={snapshot.phase === 'active' ? null : snapshot.results.at(-1)!.outcome} reducedMotion={rec.settings.reducedMotion} /><p>Round {snapshot.round} of 18</p><p>Current: {money(snapshot.currentCents)}. Banked: {money(snapshot.bankedCents)}.</p>
        {snapshot.phase === 'active' ? <><button data-control="pump" disabled={busy} onClick={e => click('pump',e)}>Pump</button><button data-control="collect" disabled={busy} onClick={e => click('collect',e)}>Collect</button></> : <><p>{attempt.snapshot.results.at(-1)!.outcome === 'burst' ? 'Balloon burst' : attempt.snapshot.results.at(-1)!.outcome === 'cap_collect' ? 'Automatic cap collection' : 'Collected'} · {money(attempt.snapshot.results.at(-1)!.bankedCents)} banked; {money(attempt.snapshot.results.at(-1)!.lostCents)} lost this round.</p>{snapshot.phase === 'resolved' && <button data-next disabled={busy} onClick={e => click('next', e)}>Next balloon</button>}</>}</>}
      {feedback && <><h2>Observed exercise feedback · {feedback.completed}/18</h2><Feedback value={feedback} />{snapshot.phase === 'feedback' && <button data-next disabled={busy} onClick={e => click('next', e)}>Continue exercise</button>}</>}
      {snapshot.phase === 'paused' && <button data-next disabled={busy} onClick={e => click('resume', e)}>Resume saved exercise</button>}
      {snapshot.phase === 'invalid' && <button data-next disabled={busy} onClick={() => void restart()}>Restart at round one</button>}
      {!['completed','invalid','paused'].includes(snapshot.phase) && <button className="secondary" disabled={busy} onClick={() => void command('pause')}>Pause exercise</button>}
    </>}
    {saved?.chain.completedRetestSessionId && <p>One valid retest is saved. This training chain is closed.</p>}
    {saved?.eligible && onRetest && <div>
      {saved.retest && !['pending_exposure', 'released_unseen'].includes(saved.retest.snapshot.exposure) ? <>
        {saved.retest.snapshot.phase !== 'completed' && <button disabled={busy} onClick={async () => { await release(); onRetest(saved.retest!.header.identity.sessionId) }}>Resume the same retest</button>}
        {!saved.retest.snapshot.comparisonEligible && <button disabled={busy} onClick={async () => { await release(); onRetest(undefined, true) }}>Open explanation for a fresh retest attempt</button>}
      </> : <button disabled={busy} onClick={async () => { await release(); onRetest() }}>Open retest explanation</button>}
    </div>}
    <button data-history className="secondary" onClick={onHistory}>Balloons history</button>
  </section>
}
