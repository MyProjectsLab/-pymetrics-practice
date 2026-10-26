import { useEffect, useRef, useState } from 'react'
import { exampleOrder, isPlainResponse } from './preparation'
import type { PreparationRecorder, ResponseBinding } from './preparation'
import { Stimulus } from './Stimulus'
import type { StopVisualProfile } from './contracts'

export function Examples({ recorder, binding, profile = 'standard', held, onComplete }: {
  recorder: PreparationRecorder; binding: ResponseBinding; held: boolean; onComplete: () => void
  profile?: StopVisualProfile
}) {
  const [index, setIndex] = useState(0)
  const [pressed, setPressed] = useState(false)
  const [checked, setChecked] = useState(false)
  const response = useRef(false)
  const resolved = useRef(false)
  const kind = exampleOrder[index]
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== binding.code || resolved.current) return
      // The selected response key must not also activate the focused button.
      event.preventDefault()
      if (held || response.current || !isPlainResponse(event, binding)) return
      response.current = true
      setPressed(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === binding.code && !resolved.current) event.preventDefault()
    }
    document.addEventListener('keydown', down, true)
    document.addEventListener('keyup', up, true)
    return () => {
      document.removeEventListener('keydown', down, true)
      document.removeEventListener('keyup', up, true)
    }
  }, [binding, held])
  function check() {
    if (resolved.current) return
    resolved.current = true
    recorder.record('example_resolved', {
      exampleId: `example-${index + 1}`, observedAction: response.current ? 'press' : 'withhold',
    })
    setChecked(true)
  }
  function next() {
    if (index === 3) { onComplete(); return }
    const nextIndex = index + 1
    recorder.record('example_presented', {
      exampleId: `example-${nextIndex + 1}`, expectedAction: exampleOrder[nextIndex] === 'GO' ? 'press' : 'withhold',
    })
    response.current = false
    resolved.current = false
    setPressed(false)
    setChecked(false)
    setIndex(nextIndex)
  }
  const feedback = kind === 'GO'
    ? pressed ? 'Correct. You responded to GO.' : `This was GO. Press ${binding.label} when it appears.`
    : pressed ? 'This was NO-GO. Do not press when it appears.' : 'Correct. You withheld your response.'
  return <>
    <p className="eyebrow">Stop · Coached examples</p>
    <h1 tabIndex={-1}>Try the rule</h1>
    <p>These four examples are untimed. Select Check example when you are ready to review your response.</p>
    <p>While an example is active, {binding.label} records your response. Use Tab to reach Check example and Enter to activate it.</p>
    <section className="example" aria-label={`Example ${index + 1} of 4`}>
      <h2>Example {index + 1} of 4</h2>
      <p>{kind === 'GO' ? `Press ${binding.label} for GO.` : 'Do nothing for NO-GO.'}</p>
      <Stimulus kind={kind} profile={profile} />
    </section>
    <div role="status" aria-live="polite">
      {checked ? <p className="feedback">{feedback}</p> : pressed ? <p>Response recorded. Select Check example.</p> : null}
    </div>
    <div className="actions">{checked
      ? <button onClick={next}>{index === 3 ? 'Check my understanding' : 'Next example'}</button>
      : <button onClick={check}>Check example</button>}</div>
  </>
}
