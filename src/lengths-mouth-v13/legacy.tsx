import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { RecordedReview } from './legacy-report'
import { openLegacy } from './legacy-access'
import type { LegacyAccess, LegacyFamily, LegacyReview, RecordAttempt } from './legacy-access'

const historyNow = () => performance.now()
const labels: Record<LegacyFamily, string> = { v12: 'V1.2 mouth', v11: 'V1.1 mouth', bar: 'Legacy bar' }
export function LegacyHistory({ family, onBack, mount }: { family: LegacyFamily; onBack: () => void; mount: HTMLElement | Document }) {
  const [access, setAccess] = useState<LegacyAccess | null>(null), [absent, setAbsent] = useState(false)
  const [attempts, setAttempts] = useState<readonly RecordAttempt[]>([])
  const [selected, setSelected] = useState<{ attempt: RecordAttempt; review: LegacyReview } | null>(null)
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false)
  const [loaded, setLoaded] = useState(false), [verified, setVerified] = useState(false), [retry, setRetry] = useState(0)
  const epoch = useRef(0), active = useRef(false), accessRef = useRef<LegacyAccess | null>(null)
  const controller = useRef<AbortController | null>(null), selectedTarget = useRef<string | null>(null)
  const mutating = useRef(false), monitorBlocked = useRef(false), deletionProblem = useRef('')

  function retire() {
    active.current = false
    epoch.current++
    controller.current?.abort(Error('Historical screen closed'))
    controller.current = null
  }
  async function refresh(a = accessRef.current, automatic = false) {
    if (!a || !active.current || mutating.current || (automatic && (controller.current || monitorBlocked.current || a.deletionOnly))) return
    controller.current?.abort(Error('Historical verification superseded'))
    const owner = new AbortController(), generation = ++epoch.current, deadline = historyNow() + 2000
    controller.current = owner
    const current = () => active.current && epoch.current === generation && !owner.signal.aborted && historyNow() < deadline && a === accessRef.current
    const timer = setTimeout(() => owner.abort(Error('Historical history verification timed out')), 2000)
    // If verification crosses a frame, withdraw the preceding publication.
    // Automatic checks coalesce rather than repeatedly canceling a slow read.
    const frame = requestAnimationFrame(() => { if (current()) { setAttempts([]); setSelected(null); setVerified(false) } })
    try {
      await a.ordered(async signal => {
        const next = await a.list(signal)
        if (!current()) throw Error('Historical history publication retired')
        const attempt = next.find(item => item.sessionId === selectedTarget.current)
        const nextSelected = attempt ? { attempt, review: a.review(attempt) } : null
        flushSync(() => { setAttempts(next); setSelected(nextSelected); setVerified(true); setError(deletionProblem.current) })
        if (!mount.querySelector('[data-legacy-history]')) throw Error('Historical history publication unavailable')
        if (!attempt) selectedTarget.current = null
        monitorBlocked.current = false
      }, owner.signal)
    } catch (e) {
      if (active.current && epoch.current === generation) {
        monitorBlocked.current = true
        setAttempts([]); setSelected(null); setVerified(false)
        setError(`${deletionProblem.current ? `${deletionProblem.current} ` : ''}History unavailable: ${String(e)}`)
      }
    } finally {
      clearTimeout(timer); cancelAnimationFrame(frame)
      if (controller.current === owner) controller.current = null
    }
  }
  function open(id: string) {
    selectedTarget.current = id
    setSelected(null)
    void refresh()
  }
  async function remove(id?: string) {
    const a = accessRef.current
    if (!a || mutating.current) return
    controller.current?.abort(Error('Historical deletion started'))
    const generation = ++epoch.current
    controller.current = null; mutating.current = true; selectedTarget.current = null
    setSelected(null); setAttempts([]); setVerified(false)
    try {
      if (id) await a.deleteOne(id); else await a.deleteAll()
      if (!active.current || epoch.current !== generation) return
      deletionProblem.current = ''; monitorBlocked.current = false
      setConfirm(false); mutating.current = false
      await refresh(a)
    } catch (e) {
      if (active.current && epoch.current === generation) {
        monitorBlocked.current = true
        deletionProblem.current = `Deletion is not yet confirmed. Verify or retry before treating these records as removed. ${String(e)}`
        setError(deletionProblem.current)
      }
    } finally { if (epoch.current === generation || accessRef.current === a) mutating.current = false }
  }
  const checkHistory = useEffectEvent(() => { void refresh(accessRef.current, true) })
  const begin = useEffectEvent(() => {
    active.current = true; mutating.current = false; monitorBlocked.current = false; deletionProblem.current = ''; selectedTarget.current = null
    const opening = new AbortController()
    let current = true, opened: LegacyAccess | null = null
    setLoaded(false); setAbsent(false); setAccess(null); setAttempts([]); setSelected(null); setError(''); setVerified(false); setConfirm(false)
    void openLegacy(family, opening.signal).then(a => {
      if (!current) { a?.close(); return }
      opened = a; accessRef.current = a; setAccess(a); setAbsent(!a); setLoaded(true)
      if (a) void refresh(a)
    }).catch(e => { if (current) { setLoaded(true); setError(String(e)) } })
    return () => { current = false; retire(); opening.abort(); opened?.close(); accessRef.current = null }
  })
  useEffect(() => {
    let canceled = false, close: (() => void) | undefined, timer: ReturnType<typeof setInterval> | undefined
    queueMicrotask(() => {
      if (canceled) return
      close = begin()
      timer = setInterval(() => checkHistory(), 250)
    })
    return () => { canceled = true; clearInterval(timer); close?.() }
  }, [family, retry])

  return <section className="panel" data-legacy-history="true">
    <h2>{labels[family]} history and deletion</h2>
    <p>Original {labels[family]} results are read without adding V1.3 activity or recalculating historical scores.</p>
    {error && <p role="alert">{error}</p>}
    {absent ? <p>No {labels[family]} database is present.</p> : !access ? (loaded ? <>
      <p>History unavailable. Its installation identity could not be verified. Retry or use browser site-data controls if removal is needed.</p>
      <button onClick={() => setRetry(value => value + 1)}>Retry history</button>
    </> : <p>Checking local history…</p>) : <>
      <button onClick={() => void refresh()}>Refresh history</button>
      {attempts.length ? <ul>{attempts.map(a => <li key={a.sessionId}>
        {a.state && typeof a.state === 'object' && 'form' in a.state ? String((a.state as { form: { id: string } }).form.id) : 'Recorded form'} · {a.variant} · {new Date(a.createdAtWallMs).toLocaleString()}
        <button onClick={() => open(a.sessionId)}>Open recorded review</button>
        <button onClick={() => void remove(a.sessionId)}>Delete this {labels[family]} attempt</button>
      </li>)}</ul> : verified ? <p>No retained attempts.</p> : !error ? <p>Checking local history…</p> : null}
      {selected && <RecordedReview family={family} attempt={selected.attempt} review={selected.review} />}
      {confirm ? <>
        <p>Delete all {labels[family]} attempts, events, reports and form counters in this browser? Other versions and games remain separate.</p>
        <button onClick={() => void remove()}>Confirm delete all {labels[family]} data</button>
        <button onClick={() => setConfirm(false)}>Cancel</button>
      </> : <button onClick={() => setConfirm(true)}>Delete all {labels[family]} data</button>}
    </>}
    <button onClick={() => { retire(); onBack() }}>Back to saved results</button>
  </section>
}
