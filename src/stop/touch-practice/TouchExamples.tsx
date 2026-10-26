import { useState } from 'react'
import { exampleOrder } from '../preparation'
import { Stimulus } from '../Stimulus'

export function TouchExamples({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)
  const [responded, setResponded] = useState(false)
  const [checked, setChecked] = useState(false)
  const kind = exampleOrder[index]
  const correct = kind === 'GO' ? responded : !responded
  function next() { if (index === 3) onComplete(); else { setIndex(index + 1); setResponded(false); setChecked(false) } }
  return <>
    <p className="eyebrow">Stop · Touch examples</p><h1 tabIndex={-1}>Try tap or withhold</h1>
    <p>These four examples are untimed. Tap the example area for GO. For NO-GO, do not tap it; select Check example.</p>
    <section className="example touch-example-play" aria-label={`Touch example ${index + 1} of 4`}
      onPointerDown={event => { if (event.pointerType === 'touch' && event.isPrimary && !checked && !responded) { event.preventDefault(); setResponded(true) } }}>
      <h2>Example {index + 1} of 4</h2><Stimulus kind={kind} /><p>{kind === 'GO' ? 'Tap this area for GO.' : 'NO-GO: do not tap this area.'}</p></section>
    <div className="actions"><button className="touch-example-response" disabled={checked || responded} onClick={() => setResponded(true)}>GO response (accessible button)</button>
      {!checked ? <button className="secondary" onClick={() => setChecked(true)}>Check example</button> :
        <button onClick={next}>{index === 3 ? 'Continue to touch readiness' : 'Next example'}</button>}</div>
    <div role="status">{checked ? <p>{correct ? 'Correct.' : kind === 'GO' ? 'GO needs one tap.' : 'NO-GO needs no tap.'}</p> : responded ? <p>Response recorded.</p> : null}</div>
  </>
}
