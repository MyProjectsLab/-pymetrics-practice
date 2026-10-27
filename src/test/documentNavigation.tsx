import { Fragment, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

/** Model the document replacement that jsdom deliberately does not perform. */
export function renderDocument(ui: ReactNode) {
  const browserWindow = document.defaultView!
  let replaceDocument: (() => void) | undefined
  const navigate = (destination: string | URL) => {
    const next = new URL(String(destination), browserWindow.location.href)
    if (next.origin !== browserWindow.location.origin) throw new Error('Unexpected external test navigation')
    browserWindow.history.replaceState(null, '', next.pathname + next.search + next.hash)
    replaceDocument?.()
  }
  const location = new Proxy({} as Location, {
    get(_target, key) {
      if (key === 'assign' || key === 'replace') return navigate
      return Reflect.get(browserWindow.location, key, browserWindow.location)
    },
  })
  const bound = new Map<PropertyKey, unknown>()
  const facade = new Proxy(browserWindow, {
    get(target, key) {
      if (key === 'location') return location
      const value = Reflect.get(target, key, target)
      if (typeof value === 'function' && ['addEventListener', 'removeEventListener', 'dispatchEvent', 'getComputedStyle'].includes(String(key))) {
        if (!bound.has(key)) bound.set(key, value.bind(target))
        return bound.get(key)
      }
      return value
    },
    set: (target, key, value) => Reflect.set(target, key, value, target),
  })
  vi.stubGlobal('window', facade)
  function Document() {
    const [generation, setGeneration] = useState(0)
    useLayoutEffect(() => {
      replaceDocument = () => setGeneration(value => value + 1)
      const follow = (event: MouseEvent) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null
        if (!(link instanceof HTMLAnchorElement) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== '_self' || link.hasAttribute('download')) return
        const destination = new URL(link.href)
        if (destination.origin !== browserWindow.location.origin || destination.pathname === browserWindow.location.pathname && destination.search === browserWindow.location.search && destination.hash) return
        event.preventDefault()
        navigate(destination)
      }
      document.addEventListener('click', follow, true)
      return () => { replaceDocument = undefined; document.removeEventListener('click', follow, true) }
    }, [])
    return <Fragment key={generation}>{ui}</Fragment>
  }
  return render(<Document />)
}
