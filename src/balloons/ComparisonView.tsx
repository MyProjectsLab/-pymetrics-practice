import type { ComparisonRow, Difference, MedianDifference, SavedComparison } from './comparison'

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`
function Change({ value, denominator, unit = '' }: { value: Difference; denominator?: number; unit?: string }) {
  return <>{value.baseline}{denominator ? `/${denominator}` : ''} → {value.retest}{denominator ? `/${denominator}` : ''}; RT − BL {signed(value.delta)}{unit}</>
}
function Median({ label, value }: { label: string; value: MedianDifference }) {
  return <p>{label}: BL {value.baselineCount} observed, RT {value.retestCount} observed (minimum {value.required} each). {value.difference
    ? <>BL {value.difference.baseline}, RT {value.difference.retest}; RT − BL {signed(value.difference.delta)} pumps.</>
    : 'Not enough voluntary collections for this measure.'}</p>
}
function Row({ row }: { row: ComparisonRow }) {
  return <section><h2>{row.label}</h2><p>{row.denominator} rounds in each sequence.</p>
    <ul>
      <li>Banked cents: <Change value={row.bankedCents} />.</li>
      <li>Lost cents: <Change value={row.lostCents} />.</li>
      <li>Collected: <Change value={row.collectedCount} denominator={row.denominator} />.</li>
      <li>Burst: <Change value={row.burstCount} denominator={row.denominator} />.</li>
      <li>Voluntary: <Change value={row.voluntaryCount} denominator={row.denominator} />.</li>
      <li>Automatic cap: <Change value={row.capCount} denominator={row.denominator} />.</li>
    </ul>
    {row.median && <><Median label="Median voluntary collection point" value={row.median} /><Median label="Early (rounds 1–13) median voluntary point" value={row.early!} /><Median label="Late (rounds 27–39) median voluntary point" value={row.late!} /></>}
  </section>
}
export function BalloonsComparison({ comparison, onHistory, onCheck }: { comparison: SavedComparison; onHistory: () => void; onCheck: () => void }) {
  return <section className="panel balloons-comparison"><p className="eyebrow">Balloons · saved comparison</p><h1 tabIndex={-1}>Baseline and retest</h1>
    <p role="status">Saved BL {comparison.baselineFormId} and RT {comparison.retestFormId} · same closed training chain.</p>
    <p>All differences below are retest minus baseline. Amounts are simulated cents. Counts use the stated number of rounds in each sequence.</p>
    {comparison.rows.map(row => <Row key={row.label} row={row} />)}
    <p>Bursts and automatic cap collections do not supply voluntary stopping points. Their observations are excluded only from the voluntary-point medians.</p>
    <p>These are differences between two TraitGame sequences. Sequence difficulty and ordinary variation may also explain them.</p>
    <p>These fixed forms are not calibrated equivalent forms. The differences do not establish that the exercise caused a change, a personality trait, or an employer outcome.</p>
    <button onClick={onCheck}>Recheck saved comparison</button><button className="secondary" onClick={onHistory}>Balloons history</button>
  </section>
}
