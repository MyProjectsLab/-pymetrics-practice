import type { ActionSource } from './contracts'

/** Observers classify/suppress only; native click remains the only action entry. */
export function installButtonInput(root: HTMLElement, paused: () => boolean) {
  const held = new Map<string, { target: EventTarget | null; canceled: boolean; clicked: boolean }>()
  const seen = new WeakSet<Event>()
  let keyup: { target: EventTarget | null; canceled: boolean; key: string } | null = null
  let releaseTimer = 0
  let pointer: { target: EventTarget | null; source: ActionSource; at: number } | null = null
  let keyboard: { target: EventTarget | null; at: number } | null = null
  const key = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ' ? 'Space' : e.key === 'Enter' ? (e.code || 'Enter') : null
  const gameTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('[data-control], [data-next]')
  const down = (e: KeyboardEvent) => {
    const k = key(e); if (!k) return
    clearTimeout(releaseTimer); keyup = null; pointer = null
    const cycle = held.get(k)
    if (e.repeat || cycle || (paused() && gameTarget(e.target))) {
      e.preventDefault(); e.stopImmediatePropagation()
      if (!cycle) held.set(k, { target: e.target, canceled: true, clicked: false })
      return
    }
    held.set(k, { target: e.target, canceled: false, clicked: false })
    keyboard = { target: e.target, at: performance.now() }
  }
  const up = (e: KeyboardEvent) => {
    const k = key(e); if (!k) return
    const cycle = held.get(k)
    keyup = { key: k, target: cycle?.target ?? null, canceled: !cycle || cycle.canceled || cycle.target !== e.target || (paused() && gameTarget(e.target)) }
    if (keyup.canceled) { e.preventDefault(); e.stopImmediatePropagation() }
    held.delete(k)
    // Browser default Space click can follow a microtask checkpoint. Retain one
    // release through this task, then expire it; never label later assistive clicks.
    if (cycle?.clicked && !keyup.canceled) keyup = null
    clearTimeout(releaseTimer)
    releaseTimer = window.setTimeout(() => { keyup = null; keyboard = null }, 0)
  }
  const focus = (e: FocusEvent) => { if (keyup && keyup.target !== e.target) keyup.canceled = true; for (const cycle of held.values()) if (cycle.target !== e.target) cycle.canceled = true }
  const point = (e: PointerEvent) => { keyup = null; pointer = { target: e.target, source: e.pointerType === 'mouse' ? 'mouse' : e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch_or_pen' : 'unknown_or_assistive', at: performance.now() }; keyboard = null }
  const blur = () => { keyup = null; for (const cycle of held.values()) cycle.canceled = true; pointer = null; keyboard = null }
  const suppress = (e: MouseEvent) => {
    // detail=0 identifies a possible keyboard click, not an assistive-device identity.
    if (e.detail !== 0) return
    if (keyup?.canceled || [...held.values()].some(c => c.canceled || c.clicked || c.target !== e.target)) { e.preventDefault(); e.stopImmediatePropagation() }
  }
  document.addEventListener('keydown', down, true); document.addEventListener('keyup', up, true)
  document.addEventListener('focusin', focus, true); root.addEventListener('pointerdown', point, true)
  root.addEventListener('click', suppress, true); window.addEventListener('blur', blur)
  document.addEventListener('visibilitychange', blur)
  return {
    source(event: MouseEvent): ActionSource | null {
      if (seen.has(event) || paused()) return null
      seen.add(event)
      let source: ActionSource = 'unknown_or_assistive'
      if (event.detail === 0 && (keyboard?.target === event.target && performance.now() - keyboard.at < 2000 || keyup?.target === event.target && !keyup.canceled)) source = 'keyboard'
      else if (pointer?.target === event.target && performance.now() - pointer.at < 2000) source = pointer.source
      if (source === 'keyboard') for (const cycle of held.values()) cycle.clicked = true
      pointer = null; keyboard = null; keyup = null
      return source
    },
    cancel: blur,
    dispose() {
      clearTimeout(releaseTimer)
      document.removeEventListener('keydown', down, true); document.removeEventListener('keyup', up, true); document.removeEventListener('focusin', focus, true)
      root.removeEventListener('pointerdown', point, true); root.removeEventListener('click', suppress, true)
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur)
    },
  }
}
