/** Browser-scoped Towers presentation guard. It records invalid transitions, not just current geometry. */
export interface TowersDisplayGuard {
  readonly invalid: boolean
  attach(play: HTMLElement): boolean
  validNow(): boolean
  stop(): void
}

export function createTowersDisplayGuard(
  section: HTMLElement, onInvalid: (reason: string) => void,
): TowersDisplayGuard {
  const ancestors: HTMLElement[] = []
  for (let node: HTMLElement | null = section; node; node = node.parentElement) ancestors.push(node)
  const ancestorSet = new Set<Node>(ancestors)
  const protectedNodes = new Set<Node>(ancestors)
  let play: HTMLElement | null = null
  let live: HTMLElement | null = null
  let target: HTMLElement | null = null
  let invalid = false
  let stopped = false
  let frame = 0

  const revoke = (reason: string) => {
    if (invalid || stopped) return
    invalid = true
    onInvalid(reason)
  }
  const rectValid = (element: HTMLElement, minWidth: number, minHeight: number) => {
    if (!element.isConnected) return false
    const rect = element.getBoundingClientRect()
    return Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
      rect.width >= minWidth && rect.height >= minHeight
  }
  const stylesValid = (element: HTMLElement) => {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility === 'visible' &&
      Number(style.opacity) > 0
  }
  const check = () => {
    if (stopped || invalid) return false
    if (document.visibilityState !== 'visible' ||
      !window.visualViewport || window.visualViewport.width < 100) {
      revoke('The viewport or page became unavailable during play'); return false
    }
    for (const node of ancestors) if (!node.isConnected || !stylesValid(node)) {
      revoke('The board container changed during play'); return false
    }
    if (!play) return true
    if (!live || !target || !rectValid(play, 100, 100) ||
      !rectValid(live, 100, 1) || !rectValid(target, 100, 1) ||
      !stylesValid(play) || !stylesValid(live) || !stylesValid(target)) {
      revoke('The board display changed during play'); return false
    }
    return true
  }
  const consumeMutations = (records: MutationRecord[]) => {
    for (const record of records) {
      if (record.type === 'attributes' && ancestorSet.has(record.target)) {
        revoke('The board container changed during play'); return
      }
      if (record.type === 'childList') for (const removed of record.removedNodes) {
        if ([...protectedNodes].some(node => removed === node || removed.contains(node))) {
          revoke('An owned board surface was removed during play'); return
        }
      }
    }
    check()
  }
  const mutation = new MutationObserver(consumeMutations)
  for (const node of ancestors) mutation.observe(node, {
    attributes: true, attributeFilter: ['style', 'class', 'hidden'], childList: true,
  })
  mutation.observe(section, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['style', 'class', 'hidden'],
  })
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0]
      if (!box) { revoke('The board size could not be checked'); return }
      const minHeight = entry.target === play ? 100 : 1
      if (box.inlineSize < 100 || box.blockSize < minHeight) {
        revoke('The board display changed during play'); return
      }
    }
    check()
  })
  const measured = () => { check() }
  const hidden = () => { if (document.visibilityState !== 'visible') revoke('Page hidden during play') }
  const pagehide = () => revoke('Page left during play')
  const observerError = (event: ErrorEvent) => {
    if (/ResizeObserver loop completed with undelivered notifications|ResizeObserver loop limit exceeded/.test(event.message))
      revoke('Board size observation could not be confirmed')
  }
  const loop = () => { if (!stopped && !invalid) { check(); frame = requestAnimationFrame(loop) } }
  window.addEventListener('resize', measured)
  window.visualViewport?.addEventListener('resize', measured)
  window.visualViewport?.addEventListener('scroll', measured)
  document.addEventListener('visibilitychange', hidden)
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('error', observerError)
  frame = requestAnimationFrame(loop)
  check()

  return {
    get invalid() { return invalid },
    attach(element) {
      if (stopped || invalid) return false
      play = element
      live = element.querySelector<HTMLElement>('.towers-board:not(.towers-target)')
      target = element.querySelector<HTMLElement>('.towers-target')
      if (!live || !target || !check()) return false
      for (const surface of [play, live, target]) {
        for (let node: HTMLElement | null = surface; node; node = node.parentElement) {
          protectedNodes.add(node)
          if (node === section) break
        }
      }
      try { for (const node of [play, live, target]) resize.observe(node, { box: 'border-box' }) }
      catch { revoke('The board size could not be monitored'); return false }
      return !invalid
    },
    validNow() {
      if (stopped || invalid) return false
      consumeMutations(mutation.takeRecords())
      return check()
    },
    stop() {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(frame)
      mutation.disconnect(); resize.disconnect()
      window.removeEventListener('resize', measured)
      window.visualViewport?.removeEventListener('resize', measured)
      window.visualViewport?.removeEventListener('scroll', measured)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pagehide)
      window.removeEventListener('error', observerError)
    },
  }
}
