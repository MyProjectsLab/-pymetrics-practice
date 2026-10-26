import { Stimulus } from './Stimulus'
import type { StopVisualProfile } from './contracts'

export function Guide({ onNext, onTouch }: { onNext: () => void; onTouch?: () => void }) {
  return <>
    <p className="eyebrow">How it works</p>
    <h1 tabIndex={-1}>Learn the Stop task</h1>
    <p className="lead">A symbol will appear briefly. Press your response key when you see GO. Do nothing when you see NO-GO. The symbol disappears quickly, but you can still respond until the response window closes.</p>
    <p className="note">The standard timed Stop game requires a physical keyboard. On a phone, you can play a separate touch practice by tapping anywhere on its play screen for GO. Touch results are page-only and cannot be compared with keyboard results.</p>
    <p>Space is the default key for this Stop exercise. You can choose another physical key.</p>
    <p className="note">This is an original TraitGame exercise. Real assessment details can vary. Follow the instructions in your invitation.</p>
    <div className="actions"><button onClick={onNext}>See the rule</button>{onTouch && <button className="secondary" onClick={onTouch}>Play touch practice</button>}</div>
  </>
}

export function Rule({ onNext, review = false, responseLabel = 'Space', profile = 'standard' }: {
  onNext: () => void; review?: boolean; responseLabel?: string; profile?: StopVisualProfile
}) {
  return <>
    <p className="eyebrow">Stop · Rules and controls</p>
    <h1 tabIndex={-1}>One rule, two actions</h1>
    <p>Space is the default key for this Stop exercise. You can choose another physical key during setup.</p>
    <div className="rule-grid">
      <section className="rule-card" aria-labelledby="go-rule">
        <Stimulus kind="GO" profile={profile} /><h2 id="go-rule">GO — press {responseLabel}</h2>
        <p>The {profile === 'standard' ? 'red GO symbol' : 'GO symbol'} means press {responseLabel} once.</p>
      </section>
      <section className="rule-card" aria-labelledby="no-go-rule">
        <Stimulus kind="NO_GO" profile={profile} /><h2 id="no-go-rule">NO-GO — do nothing</h2>
        <p>The {profile === 'standard' ? 'green NO-GO symbol' : 'NO-GO symbol'} means do not press.</p>
      </section>
    </div>
    <p>No response to GO is a miss. A response to NO-GO is a false alarm. These names describe what happened in the task; they are not personality labels.</p>
    <p>You can still respond after the symbol disappears, until the response window closes.</p>
    <div className="actions"><button onClick={onNext}>{review ? 'Try the check again' : 'Try examples'}</button></div>
  </>
}
