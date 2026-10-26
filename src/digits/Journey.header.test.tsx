import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DigitsJourney } from './Journey'
import { DigitsStore } from './storage'
import type { ReportTarget } from '../mock/report-route'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('keeps one shared header and main while a linked Digits report loads or fails', async () => {
  vi.spyOn(DigitsStore, 'openForMock').mockRejectedValue(Error('controlled read failure'))
  const onLibrary = vi.fn()
  const view = render(<DigitsJourney onLibrary={onLibrary} reportTarget={{} as ReportTarget} />)
  const shared = () => {
    expect(view.container.querySelectorAll('header.site-header')).toHaveLength(1)
    expect(view.container.querySelectorAll('main')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'TraitGame home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Assessments' })).toHaveAttribute('href', '/practice')
    expect(screen.getByRole('link', { name: 'Full mock' })).toHaveAttribute('href', '/mock')
  }
  expect(screen.getByText('Checking the exact retained result…')).toBeInTheDocument()
  shared()
  expect(await screen.findByText('Local storage is unavailable. A scored Digits result cannot start.')).toBeInTheDocument()
  shared()
  fireEvent.click(screen.getByRole('button', { name: 'Return to mock' }))
  expect(onLibrary).toHaveBeenCalledOnce()
})
