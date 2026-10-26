import type { MouseEvent, ReactNode, SyntheticEvent } from 'react'

const actionable = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="radio"], [role="checkbox"], [role="switch"], [role="option"]'

/** Retire an older Return before an enabled React choice starts its own work. */
export function ReactGameActionBoundary({ children, onCompetingAction }: {
  children: ReactNode
  onCompetingAction: () => void
}) {
  function retireForChoice(event: SyntheticEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    const control = target.closest<HTMLElement>(actionable)
    if (!control || !event.currentTarget.contains(control)) return
    if (target.closest('[data-mock-return-intent]')) return
    if (control.matches(':disabled') || control.closest('[aria-disabled="true"], fieldset:disabled')) return
    if (control instanceof HTMLLabelElement &&
      (control.control?.matches(':disabled') || control.control?.closest('[aria-disabled="true"], fieldset:disabled'))) return
    onCompetingAction()
  }
  function clicked(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 0) retireForChoice(event)
  }
  function submitted(event: SyntheticEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLFormElement && !event.target.closest('[aria-disabled="true"]')) onCompetingAction()
  }
  return <div className="mock-game-action-boundary" onClickCapture={clicked} onChangeCapture={retireForChoice}
    onSubmitCapture={submitted}>{children}</div>
}
