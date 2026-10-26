import { useEffect, useRef, useState } from 'react'
import type { ResponseBinding } from './preparation'

/** Held state spans screens; only an observed keyup releases it, including after blur. */
export function useResponseKey(binding: ResponseBinding) {
  const down = useRef(new Set<string>())
  const [held, setHeld] = useState(false)
  const [visible, setVisible] = useState(document.visibilityState === 'visible')
  const [focused, setFocused] = useState(true)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    setHeld(down.current.has(binding.code))
    const onDown = (event: KeyboardEvent) => {
      down.current.add(event.code)
      setHeld(down.current.has(binding.code))
    }
    const onUp = (event: KeyboardEvent) => {
      down.current.delete(event.code)
      setHeld(down.current.has(binding.code))
    }
    const visibility = () => setVisible(document.visibilityState === 'visible')
    const blur = () => setFocused(false)
    const focus = () => setFocused(true)
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [binding.code])
  return { held, visible, focused, viewport, isDown: (code: string) => down.current.has(code) }
}
