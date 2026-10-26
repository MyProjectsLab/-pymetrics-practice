import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CheckedHistory, StopLocalStore } from './storage'
import type { StopResult } from './run'
import { StopReport, InvalidReport } from './Report'
import { ReportBoundary } from './LiveRun'
import { compareStop, compatibilityKey } from './comparison'
import { displayFirstPartyBrand } from '../design/brandDisplay'
import { retainedTrainingAttempts, deleteTrainingResult } from './training'
import { round } from './scoring'

export const INDIVIDUAL_WARNING = 'This removes the result and its event record from your history. A minimal form-exposure marker will remain so this browser does not describe a sequence you already started as unseen. To remove that marker too, use Delete all Stop data.'
export const DELETE_ALL_WARNING = 'This removes Stop results, events, settings, training chains and practice-history markers from this browser. Other assessments are unaffected. It cannot be undone. Earlier sequence use becomes unknown, so a later sequence may repeat one you have already seen.'
const pct = (value: number) => `${round(value * 100)}%`
const profile = (result: StopResult) => `${result.setup.visualProfile === 'standard' ? 'Standard' : 'High-distinction shape accommodation'} · ${result.setup.binding.label} · physical keyboard · standard timing`
export function StopHistory({ history, store, onRefresh, onLibrary, onPractice, onDeleteAll, onTraining }: {
  history: CheckedHistory; store: StopLocalStore; onRefresh: () => Promise<void>; onLibrary: () => void
  onPractice: () => void; onDeleteAll: () => Promise<void>; onTraining?: (result: StopResult, signal: AbortSignal) => Promise<void>
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | 'all' | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const trainingAbort = useRef<AbortController | null>(null)
  useEffect(() => () => trainingAbort.current?.abort(), [])
  const content = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    content.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [selected, deleting])
  const record = history.valid.find(item => item.sessionId === selected)
  const draft = history.invalid.find(item => item.sessionId === selected)
  const durableDrills = [
    ...history.chains.flatMap(chain => chain.drillAttempts.map(item => ({ item, retired: false, temporary: false }))),
    ...history.retiredChains.flatMap(chain => chain.drillAttempts.map(item => ({ item, retired: true, temporary: false }))),
  ]
  const drills = [...new Map([...durableDrills,
    ...retainedTrainingAttempts().filter(a => !durableDrills.some(d => d.item.id === a.id &&
      JSON.stringify(d.item) === JSON.stringify(a))).map(item => ({ item, retired: true, temporary: true })),
  ].map(entry => [entry.item.id, entry])).values()]
  const drill = drills.find(entry => entry.item.id === selected)
  const groups: Record<string, StopResult[]> = {}
  for (const item of history.valid.filter(value => value.storageMode === 'persistent_local')) {
    const goCount = item.specificationVersion === '1.3' ?
      item.summarySnapshot.counts.hits + item.summarySnapshot.counts.misses : null
    const group = `${compatibilityKey(item)}:${goCount ?? 'legacy'}`
    ;(groups[group] ??= []).push(item)
  }
  async function remove() {
    try {
      if (deleting === 'all') await onDeleteAll()
      else if (deleting) { await deleteTrainingResult(store, deleting); await onRefresh() }
      setSelected(null); setDeleting(null); setError('')
    } catch { setError('Local deletion did not complete. The records were not intentionally replaced. Try again.') }
  }
  async function startSavedTraining(result: StopResult) {
    if (!onTraining || startingRef.current) return
    startingRef.current = true; setStarting(true); setError('')
    const controller = new AbortController()
    trainingAbort.current = controller
    try { await onTraining(result, controller.signal) }
    catch { if (!controller.signal.aborted) setError('Training could not start from this saved result. Review the current history and try again.') }
    finally { if (trainingAbort.current === controller) trainingAbort.current = null; startingRef.current = false; setStarting(false) }
  }
  if (deleting) return <section ref={content} className="panel" role="alertdialog" aria-labelledby="delete-heading"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setDeleting(null); setError('') } }}>
    <h1 id="delete-heading" tabIndex={-1}>{deleting === 'all' ? 'Delete all Stop data?' : 'Delete this Stop result?'}</h1>
    <p>{deleting === 'all' ? DELETE_ALL_WARNING : INDIVIDUAL_WARNING}</p>
    {error && <p role="alert">{error}</p>}
    <div className="actions"><button onClick={() => void remove()}>{deleting === 'all' ? 'Delete all Stop data' : 'Delete this result'}</button>
      <button className="secondary" onClick={() => { setDeleting(null); setError('') }}>{deleting === 'all' ? 'Keep my data' : 'Keep this result'}</button></div>
  </section>
  if (record) return <section ref={content} className="journey">{error && <p role="alert">{error}</p>}<ReportBoundary onRetry={() => { void onRefresh() }}>
    <StopReport result={record} onReplay={onPractice} onLibrary={onLibrary}
      onTraining={onTraining && record.storageMode === 'persistent_local' &&
        !history.chains.some(chain => chain.baseline.sessionId === record.sessionId) &&
        !history.retiredChains.some(chain => chain.baselineSessionId === record.sessionId) &&
        (!history.activeChain || history.activeChain.status === 'complete') ? startSavedTraining : undefined}
      trainingPending={starting} />
  </ReportBoundary></section>
  if (draft) return <section ref={content} className="journey"><InvalidReport draft={draft} onRestart={onPractice} onGuide={onPractice} /></section>
  if (drill) return <section ref={content} className="journey"><div className="panel">
    <h1 tabIndex={-1}>Stop drill attempt</h1><p>{drill.item.valid ? 'Valid drill' : 'Invalid drill attempt'} · {drill.item.drillId} · {drill.item.completedBlocks} completed blocks.</p>
    {drill.temporary && <p role="status">This attempt is retained only in this tab until saving succeeds. Keep this tab open.</p>}
    <p>{drill.item.events.length} original events are retained. {drill.retired ? 'Its training chain was retired after a history deletion and cannot be used for routing or comparison.' : drill.item.valid ? 'This attempt may support the active training chain.' : 'This attempt does not grant retest eligibility or count toward progress.'}</p>
    <details><summary>Review event journal</summary><ol>{drill.item.events.map(event => <li key={event.sequenceNumber}>{event.sequenceNumber}. {event.type} at {round(event.timestampMs)} ms</li>)}</ol></details>
    <button className="secondary" onClick={() => setSelected(null)}>Back to history</button>
  </div></section>
  return <section ref={content} className="journey"><div className="panel">
    <h1 tabIndex={-1}>Stop history</h1>
    {error && <p role="alert">{error}</p>}
    <p>Results are stored in this browser. Clearing site data or browser eviction can remove them. Earlier visits after cleared data cannot be reconstructed.</p>
    <div className="actions"><button onClick={onPractice}>Practise Stop</button><button className="secondary" onClick={onLibrary}>Back to library</button><button className="secondary" onClick={() => setDeleting('all')}>Delete all Stop data</button></div>
    <h2>Results and attempts</h2>
    {!history.valid.length && !history.invalid.length && !history.rejected.length && <p>No Stop results are saved in this browser.</p>}
    {history.valid.map(item => <article className="panel" key={item.sessionId}>
      <h3>{new Date(item.completedAtWall).toLocaleString()} · {item.mode} · {item.validity.replaceAll('_', ' ')}</h3>
      <p>Form {item.form.id} · {profile(item)} · {history.chains.find(chain => chain.baseline.sessionId === item.sessionId || chain.retest?.sessionId === item.sessionId)?.status ?? 'No active training chain'}</p>
      <p>Overall accuracy {pct(item.summarySnapshot.rates.overall)} · GO hit rate {pct(item.summarySnapshot.rates.hit)} · NO-GO correct-withhold rate {pct(item.summarySnapshot.rates.withhold)} · Median correct-GO response time {item.summarySnapshot.timing.median === null ? 'unavailable' : `${round(item.summarySnapshot.timing.median)} ms`}.</p>
      <button onClick={() => { setError(''); setSelected(item.sessionId) }}>Open original report</button><button className="secondary" onClick={() => setDeleting(item.sessionId)}>Delete this result</button>
    </article>)}
    {history.invalid.map(item => <article className="panel" key={item.sessionId}>
      <h3>{new Date(item.retainedAtWall).toLocaleString()} · {item.mode} · Invalid attempt</h3>
      <p>Form {item.form?.id ?? 'none'} · {item.setup.visualProfile} · Not included in progress or training routing.</p>
      <button onClick={() => setSelected(item.sessionId)}>Review attempt</button><button className="secondary" onClick={() => setDeleting(item.sessionId)}>Delete this result</button>
    </article>)}
    {drills.map(({ item, retired, temporary }) => <article className="panel" key={item.id}>
      <h3>{new Date(item.completedAtWall).toLocaleString()} · {item.drillId} drill · {item.valid ? 'Valid' : 'Invalid attempt'}{retired ? ' · Retired chain' : ''}</h3>
      <p>{item.completedBlocks} completed blocks · {item.events.length} retained events. {retired ? 'This chain cannot support routing, retest, or comparison.' : 'Invalid attempts are excluded from progress and retest eligibility.'}</p>
      {temporary && <p>Not yet saved. Keep this tab open to review this attempt.</p>}
      <button onClick={() => setSelected(item.id)}>Review drill attempt</button><button className="secondary" onClick={() => setDeleting(item.id)}>Delete this result</button>
    </article>)}
    {history.rejected.map(item => <article className="panel" key={item.sessionId}>
      <h3>Stored record unavailable for scoring</h3><p>{item.reason} Form {item.formId ?? 'unknown'}. It is excluded from progress and training.</p>
      <button className="secondary" onClick={() => setDeleting(item.sessionId)}>Delete this result</button>
    </article>)}
    <h2>Progress by compatible profile</h2>
    {Object.entries(groups).map(([name, items]) => {
      const ordered = [...items].sort((a, b) => a.completedAtWall.localeCompare(b.completedAtWall))
      const points = ordered.map((item, index) => `${ordered.length === 1 ? 150 : 10 + index * 280 / (ordered.length - 1)},${90 - item.summarySnapshot.rates.overall * 80}`).join(' ')
      return <section key={name}><h3>{profile(items[0])} · {items[0].setup.binding.code} · {items[0].specificationVersion} · {items[0].scoringVersion}{items[0].specificationVersion === '1.3' ? ` · ${items[0].summarySnapshot.counts.hits + items[0].summarySnapshot.counts.misses} GO` : ''}</h3>
        <svg className="stop-progress" role="img" aria-label={`Overall accuracy across ${ordered.length} compatible Stop ${ordered.length === 1 ? 'session' : 'sessions'} in this profile`} viewBox="0 0 300 100" width="300" height="100">
          <line x1="10" y1="90" x2="290" y2="90" stroke="currentColor" opacity="0.5" />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
          {ordered.length === 1 && <circle cx="150" cy={90 - ordered[0].summarySnapshot.rates.overall * 80} r="3" fill="currentColor" />}
        </svg>
        <ol>{ordered.map(item => <li key={item.sessionId}>{new Date(item.completedAtWall).toLocaleDateString()}: overall {pct(item.summarySnapshot.rates.overall)}, GO {pct(item.summarySnapshot.rates.hit)}, NO-GO {pct(item.summarySnapshot.rates.withhold)}.</li>)}</ol>
      </section>
    })}
    <h2>Baseline and retest comparisons</h2>
    {history.chains.filter(chain => chain.retest).map(chain => {
      const comparison = compareStop(chain.baseline, chain.retest!)
      return <section key={chain.id}><h3>Training chain {new Date(chain.baseline.completedAtWall).toLocaleDateString()}</h3>
        {comparison ? <><p>{comparison.lines.join(' ')}</p><p>{comparison.narrative} {comparison.categoryDisclosure}</p><p>{displayFirstPartyBrand(comparison.limitation)}</p><p>{displayFirstPartyBrand(comparison.formWarning)}</p></> : <p>These sessions have incompatible settings or versions. Their results are shown separately above.</p>}
      </section>
    })}
  </div></section>
}
