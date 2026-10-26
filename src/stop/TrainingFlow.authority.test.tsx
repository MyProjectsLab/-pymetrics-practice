import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrainingFlow } from './TrainingFlow'
import * as training from './training'
import type { TrainingChain } from './training'

vi.mock('./comparison', () => ({ compareStop: () => ({ lines: ['Checked numerical comparison'], details: [], limitation: 'Descriptive only', formWarning: 'Sequence variation' }) }))
const chain = { id: 'complete-chain', status: 'complete', baseline: {}, retest: {} } as TrainingChain
const props = { onChain: () => {}, onLibrary: () => {}, onRetest: () => {}, onNewBaseline: () => {} }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('C5 comparison display authority', () => {
  it('withholds numerical comparison until checked, and clears it immediately on focus resume', async () => {
    let deliver!: (ok: boolean) => void
    vi.spyOn(training, 'checkTrainingChain').mockImplementation(() => new Promise(resolve => { deliver = resolve }))
    render(<TrainingFlow chain={chain} {...props} />)
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    await act(async () => deliver(true))
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
    fireEvent.focus(window)
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    await act(async () => deliver(false))
    expect(screen.getByRole('status')).toHaveTextContent('Comparison unavailable')
  })
  it('removes comparison after failed periodic authority read and restores it only after a fresh successful check', async () => {
    vi.useFakeTimers()
    const check = vi.spyOn(training, 'checkTrainingChain').mockResolvedValue(true)
    render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
    check.mockResolvedValue(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    check.mockResolvedValue(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
  })
  it('withdraws an already-open comparison for the full duration of a stalled periodic read', async () => {
    vi.useFakeTimers()
    let deliver!: (ok: boolean) => void
    const check = vi.spyOn(training, 'checkTrainingChain').mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise(resolve => { deliver = resolve })).mockResolvedValue(true)
    render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    expect(screen.getByText(/Checking comparison availability/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    expect(check).toHaveBeenCalledTimes(2)
    await act(async () => deliver(false))
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
  })
  it('keeps successful checks between paints from committing checking or unavailable content', async () => {
    vi.useFakeTimers()
    vi.spyOn(training, 'checkTrainingChain').mockResolvedValue(true)
    const view = render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    const numerical = screen.getByText('Checked numerical comparison')
    const mutations: string[] = []
    const observer = new MutationObserver(() => mutations.push(view.container.textContent ?? ''))
    observer.observe(view.container, { childList: true, subtree: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(5040) })
    expect(screen.getByText('Checked numerical comparison')).toBe(numerical)
    expect(mutations.some(text => /Checking comparison|Comparison unavailable/.test(text))).toBe(false)
    observer.disconnect()
  })
  it('withdraws a pending periodic read after one complete rendering cycle and ignores success after unmount', async () => {
    vi.useFakeTimers()
    let deliver!: (ok: boolean) => void
    vi.spyOn(training, 'checkTrainingChain').mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise(resolve => { deliver = resolve }))
    const frames = new Map<number, FrameRequestCallback>()
    let next = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++next, callback); return next })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    const paint = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(0) }
    const view = render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    act(paint) // aligns with rendering; the periodic read is already running
    expect(screen.getByText('Checked numerical comparison')).toBeInTheDocument()
    act(paint) // unresolved after the complete cycle: withdraw before paint
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    view.unmount()
    await act(async () => deliver(true))
    expect(frames.size).toBe(0)
  })
  it('keeps the unavailable status mounted while a recovery check is held or fails', async () => {
    vi.useFakeTimers()
    let deliver!: (ok: boolean) => void
    vi.spyOn(training, 'checkTrainingChain').mockResolvedValueOnce(false)
      .mockImplementationOnce(() => new Promise(resolve => { deliver = resolve })).mockResolvedValue(false)
    render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    const status = screen.getByRole('status')
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.getByRole('status')).toBe(status)
    await act(async () => deliver(false))
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(screen.getByRole('status')).toBe(status)
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
  })
  it('cancels scheduled periodic frames when a comparison is replaced or exited', async () => {
    vi.useFakeTimers()
    const check = vi.spyOn(training, 'checkTrainingChain').mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise(() => {}))
    const frames = new Map<number, FrameRequestCallback>()
    let next = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++next, callback); return next })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    const view = render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(frames.size).toBe(1)
    view.rerender(<TrainingFlow chain={{ ...chain, id: 'replacement' }} {...props} />)
    await act(async () => {})
    expect(frames.size).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(frames.size).toBe(1)
    view.unmount()
    expect(frames.size).toBe(0)
    expect(check).toHaveBeenCalledTimes(4)
  })
  it('does not use a pending pre-focus success to restore the comparison', async () => {
    vi.useFakeTimers()
    let deliver!: (ok: boolean) => void
    const check = vi.spyOn(training, 'checkTrainingChain').mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise(resolve => { deliver = resolve })).mockResolvedValue(false)
    render(<TrainingFlow chain={chain} {...props} />)
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    fireEvent.focus(window)
    await act(async () => deliver(true))
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1040) })
    expect(check).toHaveBeenCalledTimes(3)
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
  })
  it('does not apply a delayed successful check to a replacement comparison', async () => {
    let deliver!: (ok: boolean) => void
    vi.spyOn(training, 'checkTrainingChain').mockImplementationOnce(() => new Promise(resolve => { deliver = resolve })).mockResolvedValue(false)
    const view = render(<TrainingFlow chain={chain} {...props} />)
    view.rerender(<TrainingFlow chain={{ ...chain, id: 'replacement' }} {...props} />)
    await act(async () => deliver(true))
    expect(screen.queryByText('Checked numerical comparison')).not.toBeInTheDocument()
  })
})
