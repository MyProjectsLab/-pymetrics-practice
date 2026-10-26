import './simple-start.css'
export function QuickRules({rules,note}:{rules:readonly string[];note?:string}){return <div className="quick-rules"><ul>{rules.map(rule=><li key={rule}>{rule}</li>)}</ul>{note&&<p className="quick-note">{note}</p>}</div>}
