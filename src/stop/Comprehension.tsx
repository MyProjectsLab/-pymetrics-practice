import { useEffect, useRef, useState } from 'react'
import { questionsForKey, shuffle } from './preparation'
import type { PreparationRecorder, ResponseBinding } from './preparation'

export function Comprehension({ recorder, attempt, binding, onReview, onPassed }: {
  recorder: PreparationRecorder; attempt: number; binding: ResponseBinding; onReview: () => void; onPassed: () => void
}) {
  const [order] = useState(() => shuffle(questionsForKey(binding.label)))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<boolean | null>(null)
  const submitted = useRef(false)
  const nextAction = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (result !== null) nextAction.current?.focus() }, [result])
  const complete = order.every(question => answers[question.id])
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete || submitted.current) return
    submitted.current = true
    for (const question of order) {
      recorder.record('comprehension_answered', {
        itemId: question.id, answerId: answers[question.id], correct: answers[question.id] === question.answer, attempt,
      })
    }
    const passed = order.every(question => answers[question.id] === question.answer)
    setResult(passed)
  }
  return <>
    <p className="eyebrow">Stop · Understanding the rule</p>
    <h1 tabIndex={-1}>Check your understanding</h1>
    <p>Answer all three questions, then check your answers.</p>
    <form onSubmit={submit}>
      {order.map(question => <fieldset key={question.id} disabled={result !== null}>
        <legend>{question.prompt}</legend>
        {question.choices.map(choice => <label className="choice" key={choice.id}>
          <input type="radio" name={question.id} value={choice.id} required
            checked={answers[question.id] === choice.id}
            onChange={() => setAnswers(previous => ({ ...previous, [question.id]: choice.id }))} />
          <span>{choice.label}</span>
        </label>)}
      </fieldset>)}
      {result === null && <button type="submit" disabled={!complete}>Check answers</button>}
    </form>
    <div role="status">{result !== null && <p className="feedback">{result
      ? 'You have the rule. Next, check your device and begin the warm-up.'
      : 'Review the rule and try again. This check is not scored.'}</p>}</div>
    {result !== null && <div className="actions"><button ref={nextAction} onClick={result ? onPassed : onReview}>
      {result ? 'Check your setup' : 'Review the rule'}
    </button></div>}
  </>
}
