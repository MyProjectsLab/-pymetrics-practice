import { useLayoutEffect, useState } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderDocument } from './documentNavigation'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

it('follows the actual link URL, replaces page state and retires old view callbacks', () => {
  const setters: ((value: number) => void)[] = []
  function Page() {
    const [count, setCount] = useState(0)
    useLayoutEffect(() => { setters.push(setCount) }, [])
    return <><p>Count {count}</p><button onClick={() => setCount(value => value + 1)}>Increment</button><a href="/practice/stop">Open Stop</a></>
  }
  window.history.replaceState(null, '', '/practice?practiceGame=keypresses')
  renderDocument(<Page />)
  fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
  expect(screen.getByText('Count 1')).toBeInTheDocument()
  const oldPage = setters[0]
  fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
  expect(window.location.pathname).toBe('/practice/stop')
  expect(window.location.search).toBe('')
  expect(setters).toHaveLength(2)
  expect(screen.getByText('Count 0')).toBeInTheDocument()
  act(() => oldPage(99))
  expect(screen.getByText('Count 0')).toBeInTheDocument()
})

it('models location.assign with the same document boundary as a link', () => {
  function Page() {
    const [count, setCount] = useState(0)
    return <><p>Count {count}</p><button onClick={() => setCount(1)}>Increment</button><button onClick={() => window.location.assign('/practice')}>Main menu</button></>
  }
  window.history.replaceState(null, '', '/practice/stop')
  renderDocument(<Page />)
  fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
  fireEvent.click(screen.getByRole('button', { name: 'Main menu' }))
  expect(window.location.pathname).toBe('/practice')
  expect(screen.getByText('Count 0')).toBeInTheDocument()
})
