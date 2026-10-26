import * as training from './training'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StopJourney } from './Journey'
import { createPreparationRecorder, createUnderstandingEvidence, questions } from './preparation'
import { setStopLocalStore } from './storage'
import type { StopLocalStore } from './storage'
import * as inputReceipt from '../core/inputCheckReceipt'
import { storageDisclosure } from './training'

afterEach(() => { cleanup(); setStopLocalStore(null); vi.restoreAllMocks() })

it.each(['1.1', '1.3'] as const)('shows local data guidance on the first %s guide without repeating it on the next step', version => {
  const recorder = createPreparationRecorder(`disclosure-${version}`)
  render(<StopJourney recorder={recorder} specificationVersion={version} onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  const disclosure = storageDisclosure()
  expect(screen.getByText(disclosure)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: version === '1.3' ? 'Continue' : 'See the rule' }))
  expect(screen.queryByText(disclosure)).not.toBeInTheDocument()
})

async function priorEvidence() {
  const passed = createPreparationRecorder('prior-understanding')
  passed.record('guide_opened', { source: 'library' })
  for (const question of questions) passed.record('comprehension_answered', {
    itemId: question.id, answerId: question.answer, correct: true, attempt: 1,
  })
  return createUnderstandingEvidence(passed)
}

it('offers a verified shortcut while retaining current setup and journaling only the chosen path', async () => {
  const evidence = await priorEvidence()
  setStopLocalStore({ currentUnderstandingEvidence: async () => evidence } as StopLocalStore)
  const recorder = createPreparationRecorder('returning')
  render(<StopJourney recorder={recorder} specificationVersion="1.1" onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Skip introduction' }))
  const reminderHeading = await screen.findByRole('heading', { name: 'Remember the Stop rule' })
  await waitFor(() => expect(reminderHeading).toHaveFocus())
  fireEvent.click(screen.getByRole('button', { name: 'Check your setup' }))
  expect(await screen.findByRole('heading', { name: 'Check your setup' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Run input check' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  const events = recorder.snapshot()
  expect(events.filter(event => event.type === 'shortcut_chosen')).toHaveLength(1)
  expect(events.find(event => event.type === 'shortcut_chosen')?.payload).toEqual({
    sourceSessionId: evidence.sourceSessionId, ruleVersion: 'stop_rule_v1', experienceVersion: '1.2',
    skipped: ['rule', 'examples', 'comprehension'],
  })
  expect(events.some(event => event.type === 'example_presented' || event.type === 'example_resolved' ||
    event.type === 'comprehension_answered')).toBe(false)
})

it('rechecks shortcut evidence before use and falls back to the full guide after deletion', async () => {
  const evidence = await priorEvidence()
  let current: typeof evidence | null = evidence
  setStopLocalStore({ currentUnderstandingEvidence: async () => current } as StopLocalStore)
  const recorder = createPreparationRecorder('returning-deleted')
  render(<StopJourney recorder={recorder} specificationVersion="1.1" onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Skip introduction' }))
  expect(await screen.findByRole('heading', { name: 'Remember the Stop rule' })).toBeInTheDocument()
  current = null
  fireEvent.click(screen.getByRole('button', { name: 'Check your setup' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Learn the Stop task' })).toBeInTheDocument())
  expect(recorder.snapshot().some(event => event.type === 'shortcut_chosen')).toBe(false)
})

it('records the actually displayed initial shape profile in the new experience', async () => {
  const recorder = createPreparationRecorder('shape-new-guide')
  render(<StopJourney recorder={recorder} specificationVersion="1.3" mode="baseline"
    requiredSetup={{ binding: { code: 'Space', label: 'Space' }, visualProfile: 'shape_accommodation_v1', physicalKeyboard: true }}
    onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: /^Stop$/ })).toBeInTheDocument()
  expect(recorder.snapshot().find(event => event.type === 'onboarding_v13_opened')?.payload.visualProfile).toBe('shape_accommodation_v1')
})

it('keeps untimed Touch Practice reachable from the new guide and Back returns there', async () => {
  const recorder = createPreparationRecorder('touch-new-guide')
  render(<StopJourney recorder={recorder} specificationVersion="1.3" mode="baseline"
    onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  fireEvent.click(screen.getByText('Examples and previous practice'))
  fireEvent.click(await screen.findByRole('button', { name: 'Try an untimed example' }))
  expect(await screen.findByRole('heading', { name: 'Try tap or withhold' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('heading', { name: /^Stop$/ })).toBeInTheDocument()
  expect(recorder.snapshot().some(event => ['example_presented','example_resolved','comprehension_answered','device_check_completed'].includes(event.type))).toBe(false)
})

it('ignores a late input-cache read after Back from the new check', async () => {
  let release!: (value: null) => void
  vi.spyOn(inputReceipt, 'readInputReceipt').mockImplementation(() => new Promise(resolve => { release = resolve }))
  const recorder = createPreparationRecorder('back-during-new-read')
  render(<StopJourney recorder={recorder} specificationVersion="1.3" mode="baseline"
    onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Press Space once.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check' }))
  expect(recorder.snapshot().filter(event => event.type === 'onboarding_v13_answered')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  release(null)
  expect(await screen.findByRole('heading', { name: /^Stop$/ })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Test your keyboard' })).not.toBeInTheDocument()
})

it('does not count duplicate correct Check activation while its read is pending', async () => {
  let release!: (value: null) => void
  vi.spyOn(inputReceipt, 'readInputReceipt').mockImplementation(() => new Promise(resolve => { release = resolve }))
  const recorder = createPreparationRecorder('duplicate-new-check')
  render(<StopJourney recorder={recorder} specificationVersion="1.3" mode="baseline"
    onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Press Space once.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check' }))
  expect(recorder.snapshot().filter(event => event.type === 'onboarding_v13_answered')).toHaveLength(1)
  release(null)
  expect(await screen.findByRole('heading', { name: 'Test your keyboard' })).toBeInTheDocument()
})

it.each([training.TEMPORARY_DISCLOSURE,training.CHAIN_SAVE_FAILURE,'Training changes are retained in this tab while saving. Keep this tab open until saving finishes.'] as const)('keeps a consequential storage warning visible outside closed options: %s',notice=>{
 vi.spyOn(training,'storageDisclosure').mockReturnValue(notice)
 render(<StopJourney recorder={createPreparationRecorder('visible-storage-warning')} specificationVersion="1.3" onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()}/>);
 expect(screen.getByText(notice)).toBeVisible();expect(screen.getByText(notice).closest('details')).toBeNull();expect(screen.getByText('Examples and previous practice').closest('details')).not.toHaveAttribute('open')
})
