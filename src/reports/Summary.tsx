import type {SimpleFeedback} from './feedback'
import './summary.css'
/** Receives only values already admitted by the owning report. */
export function ReportSummary({feedback:f}:{feedback:SimpleFeedback}) {
 return <section className="report-summary" aria-label="Result summary">
  <p className="report-purpose">{f.purpose}</p>
  <dl className="report-summary-metrics">{f.metrics.map(m=><div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}</dl>
  <div className="report-next-step"><h2>What to work on</h2><p>{f.observation}</p><h3>Try next</h3><p>{f.tip}</p></div>
 </section>
}
