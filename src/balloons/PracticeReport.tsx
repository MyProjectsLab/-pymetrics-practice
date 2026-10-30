import { money } from './format'
import { ReportSummary } from '../reports/Summary'
import { balloonsFeedback } from '../reports/feedback'
import type { DurableRecord } from './durable'
import { durableBaseline, reconcileDurable } from './durable'
import { basicReport } from './report'
import type { CountSummary } from './report'
import { displayFirstPartyBrand } from '../design/brandDisplay'
export function Counts({ rows }: { rows: readonly { label: string; summary: CountSummary }[] }) {
  return <div className="balloons-table" tabIndex={0} role="region" aria-label="Scrollable results table"><table><thead><tr>{['Group', 'Rounds', 'Collected', 'Burst', 'Banked', 'Lost', 'Attempted pumps', 'Successful pumps', 'Voluntary', 'Zero-pump', 'Cap'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead>
    <tbody>{rows.map(({ label, summary: s }) => <tr key={label}><th scope="row">{label}</th>{[s.rounds, s.collectedCount, s.burstCount, money(s.bankedCents), money(s.lostCents), s.attemptedPumps, s.successfulPumps, s.voluntaryCount, s.zeroPumpCount, s.capCount].map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table></div>
}
export function BalloonsReport({ record, comparisonText, onReplay, onHistory, onTraining, onComparison, readOnly, onBack }: { record: DurableRecord; comparisonText?: string; onReplay: () => void; onHistory: () => void; onTraining?: () => void; onComparison?: () => void; readOnly?: boolean; onBack?: () => void }) {
  reconcileDurable(record)
  const report = basicReport(record.snapshot.core)
  if (report.status !== 'headless_complete' || record.snapshot.phase !== 'completed' || record.snapshot.confirmedRounds.length !== 39) return <p role="alert">A complete saved report is unavailable.</p>
  const sources = [...new Set(record.snapshot.core.events.flatMap(e => e.source ? [e.source.replaceAll('_', ' ')] : []))]
  return <section className="panel balloons-report">
    <p className="eyebrow">Balloons · local report</p><h1 tabIndex={-1}>Your choices and outcomes</h1>
    <p role="status">Saved · 39 of 39 balloons complete{record.snapshot.comparisonEligible ? '' : ' · Review only'}.</p>
    <ReportSummary feedback={balloonsFeedback(report.total)} />
    <details><summary>Detailed numbers</summary>
    <p>{record.header.repeat ? 'This sequence may feel familiar. ' : ''}{record.header.identity.stage==='mock'?'This result belongs to your full mock.':durableBaseline(record) ? 'This saved practice can be used for an assigned exercise after a fresh check.' : record.header.retest ? 'Open the saved comparison to see this run alongside an earlier compatible run.' : 'Standalone practice result.'}</p>
    <p>Lost value was never deducted from money collected earlier. All money is simulated.</p>
    <p>{report.supportedObservation}</p>
    <p>{comparisonText??'Checking whether an earlier saved run is still available.'}</p>
    <p>This task is designed to show choices about pumping or collecting under uncertainty. It does not measure a stable trait.</p>

    <p>{record.header.identity.stage==='mock'?'Full mock practice result':record.snapshot.comparisonEligible ? 'Complete standalone result' : record.header.retest ? 'Review only; assigned comparison unavailable' : 'Review only; baseline unavailable'} · Form {report.formId} · {report.specificationVersion} · {report.formVersion} · {report.scoringVersion}.</p>
    <Counts rows={[{ label: 'All balloons', summary: report.total }, ...report.categories.toSorted((a, b) => a.visibleType.localeCompare(b.visibleType)).map(c => ({ label: c.visibleType, summary: c }))]} />
    <h2>Voluntary collection points</h2><p>Bursts are censored observations of intended attempts. Automatic cap collections are censored at 32 successful pumps. Neither supplies a voluntary stopping point.</p>
    {report.categories.toSorted((a, b) => a.visibleType.localeCompare(b.visibleType)).map(c => <section key={c.visibleType}><h3>{c.visibleType}</h3>
      <p>{c.voluntaryMedian.status === 'supported' ? `Median: ${c.voluntaryMedian.value} pumps (${c.voluntaryMedian.count} voluntary collections).` : c.voluntaryMedian.message}</p>
      <p>{c.earlyLate.status === 'supported' ? `Early median ${c.earlyLate.earlyMedian} (${c.earlyLate.earlyCount} voluntary); late median ${c.earlyLate.lateMedian} (${c.earlyLate.lateCount} voluntary). Late minus early: ${c.earlyLate.lateMinusEarly > 0 ? '+' : ''}${c.earlyLate.lateMinusEarly} pumps.` : c.earlyLate.message}</p>
    </section>)}
    <h2>By block</h2><p>Early: rounds 1–13. Middle: 14–26. Late: 27–39.</p><Counts rows={report.blocks.map(b => ({ label: b.label, summary: b.summary }))} />
    {report.postBurst.status === 'supported' && <section><h2>Observed choices around bursts</h2><p>In these two separate same-type windows, a lower voluntary collection point followed a burst and was followed by a higher voluntary point.</p>{report.postBurst.value.map((w, i) => <ul key={i}>{w.observations.map(o => <li key={o.round}>Round {o.round}: {o.outcome === 'burst' ? 'burst (no voluntary point)' : `voluntary collection at ${o.voluntaryPoint} pumps`}</li>)}</ul>)}</section>}
    <h2>Session context</h2><p>Input sources recorded: {sources.join(', ')}. Mixed sources do not invalidate this untimed task.</p>
    <p>{record.snapshot.interruptions} interruption/recovery records. Decision latency is not reported; no latency is calculated across pauses or reloads.</p>
    <p>Type text and stripe/dot/grid patterns. {record.header.settings.verbose ? 'Verbose pump announcements' : 'Round-start and outcome announcements'}. {record.header.settings.reducedMotion ? 'Reduced motion enabled' : 'Reduced motion not enabled'}. Settings were fixed at readiness.</p>
    <details><summary>Recorded browser context</summary><p>{record.header.device}</p></details>
    <h2>Round review</h2><div className="balloons-table" tabIndex={0} role="region" aria-label="Scrollable results table"><table><thead><tr>{['Round', 'Type', 'Attempts', 'Successes', 'Outcome', 'Banked', 'Lost'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{report.rounds.map(r => <tr key={r.round}><th scope="row">{r.round}</th><td>{r.visibleType}</td><td>{r.attemptedPumps}</td><td>{r.successfulPumps}</td><td>{r.outcome.replaceAll('_', ' ')}</td><td>{money(r.bankedCents)}</td><td>{money(r.lostCents)}</td></tr>)}</tbody></table></div>
    </details>
    <p>{displayFirstPartyBrand(report.limitation)}</p><p>These fixed sequences are not calibrated equivalent forms. Total collected is one sampled outcome, not a skill or personality measure.</p>
    {readOnly?<button data-mock-return-intent onClick={onBack}>Return to mock</button>:<>{durableBaseline(record) && onTraining && <button onClick={onTraining}>Open assigned exercise</button>}{record.header.retest && onComparison && <button onClick={onComparison}>Open saved comparison</button>}<button onClick={onReplay}>Practise again</button><button className="secondary" onClick={onHistory}>Balloons history</button></>}
  </section>
}
