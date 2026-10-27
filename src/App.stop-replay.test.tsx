import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { StopJourney } from './stop/Journey'
import App from './App'
import { setStopLocalStore } from './stop/storage'
import { restoreStopRecords } from './stop/run'
import { restoreTrainingChain } from './stop/training'

vi.mock('./stop/Journey', async original => {
  const actual = await original<typeof import('./stop/Journey')>()
  return { StopJourney: (props: ComponentProps<typeof StopJourney>) => props.mode === 'baseline'
    // Only completion is controlled here; App's replay dispatch and replay UI are real.
    ? <button onClick={props.onReplay}>Practise another sequence</button>
    : <actual.StopJourney {...props} /> }
})
beforeEach(() => { window.history.replaceState(null, '', '/practice'); setStopLocalStore(null); restoreStopRecords([], []); restoreTrainingChain(null, true) })
afterEach(() => { cleanup(); setStopLocalStore(null); restoreStopRecords([], []); restoreTrainingChain(null, true) })
it('routes the completed-baseline replay action through App to the real 1.3 four-example preparation branch', () => {
  render(<App storagePolicy="temporary" />)
  fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
  fireEvent.click(screen.getByRole('button', { name: 'Practise another sequence' }))
  expect(screen.getByRole('heading', { name: 'Learn the Stop task' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'See the rule' }))
  fireEvent.click(screen.getByRole('button', { name: 'Try examples' }))
  expect(screen.getByRole('heading', { name: 'Try the rule' })).toBeVisible()
  expect(screen.getByText('Example 1 of 4')).toBeVisible()
})
