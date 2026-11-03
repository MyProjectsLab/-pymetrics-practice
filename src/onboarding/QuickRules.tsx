import './simple-start.css'

export function QuickRules({ rules, note, purpose, example }: {
  rules: readonly string[]
  note?: string
  purpose?: string
  example?: string
}) {
  return <div className="quick-rules">
    {purpose && <p><strong>What this explores.</strong> {purpose}</p>}
    <ul>{rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
    {example && <p><strong>Example.</strong> {example}</p>}
    {note && <p className="quick-note">{note}</p>}
  </div>
}
