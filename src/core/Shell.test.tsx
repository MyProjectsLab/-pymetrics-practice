import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GameLibrary, Shell } from './Shell'

afterEach(cleanup)
it('provides reusable navigation, main landmark, and a content skip link', () => {
  const library = vi.fn()
  render(<Shell onLibrary={library}><h1>Test page</h1></Shell>)
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content')
  expect(screen.getByRole('link', { name: /TraitGame/ })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Full mock' })).toHaveAttribute('href', '/mock')
  expect(library).not.toHaveBeenCalled()
})

it('lists supplied games with bookmarkable links', () => {
  render(<GameLibrary entries={[{ id: 'one', name: 'One', description: 'Original exercise',
    metadata: 'Physical keyboard', action: 'Open One', availability: 'Guide available', href: '/practice/one' }]} />)
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByRole('link', { name: /Open One/ })).toHaveAttribute('href', '/practice/one')
})
