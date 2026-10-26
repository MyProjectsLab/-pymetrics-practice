/** Browser-observed setup context, not a physical display or latency measurement. */
export interface LengthsDisplayContext {
  readonly layoutWidthCssPx: number
  readonly layoutHeightCssPx: number
  readonly visualWidthCssPx: number
  readonly visualHeightCssPx: number
  readonly taskHostWidthCssPx: number
  readonly devicePixelRatio: number
  readonly browserFamily: 'chromium' | 'webkit' | 'gecko' | 'other'
  readonly visibility: 'visible' | 'hidden'
  readonly focused: boolean
}

export function validLengthsDisplayContext(value: unknown): value is LengthsDisplayContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const context = value as Record<string, unknown>
  if (Object.keys(context).toSorted().join('|') !== [
    'browserFamily', 'devicePixelRatio', 'focused', 'layoutHeightCssPx',
    'layoutWidthCssPx', 'taskHostWidthCssPx', 'visibility',
    'visualHeightCssPx', 'visualWidthCssPx',
  ].join('|')) return false
  return [context.layoutWidthCssPx, context.layoutHeightCssPx,
    context.visualWidthCssPx, context.visualHeightCssPx,
    context.taskHostWidthCssPx, context.devicePixelRatio]
    .every(number => typeof number === 'number' && Number.isFinite(number) && number > 0) &&
    ['chromium', 'webkit', 'gecko', 'other'].includes(context.browserFamily as string) &&
    ['visible', 'hidden'].includes(context.visibility as string) &&
    typeof context.focused === 'boolean'
}

export function captureLengthsDisplayContext(host: HTMLElement): LengthsDisplayContext {
  const agent = navigator.userAgent
  const browserFamily = /(?:Chrome|Chromium|Edg)\//.test(agent) ? 'chromium' :
    /Firefox\//.test(agent) ? 'gecko' : /Safari\//.test(agent) ? 'webkit' : 'other'
  const context: LengthsDisplayContext = {
    layoutWidthCssPx: document.documentElement.clientWidth,
    layoutHeightCssPx: document.documentElement.clientHeight,
    visualWidthCssPx: window.visualViewport?.width ?? window.innerWidth,
    visualHeightCssPx: window.visualViewport?.height ?? window.innerHeight,
    taskHostWidthCssPx: host.getBoundingClientRect().width,
    devicePixelRatio: window.devicePixelRatio,
    browserFamily,
    visibility: document.visibilityState === 'visible' ? 'visible' : 'hidden',
    focused: document.hasFocus(),
  }
  if (!validLengthsDisplayContext(context)) throw Error('Lengths display context unavailable')
  return context
}

/** Space available to the 520-CSS-pixel SVG after the task host's own box edges. */
export function lengthsContentWidth(host: HTMLElement): number {
  const box = host.getBoundingClientRect()
  const style = getComputedStyle(host)
  return box.width - [style.paddingLeft, style.paddingRight,
    style.borderLeftWidth, style.borderRightWidth]
    .map(value => Number.parseFloat(value) || 0)
    .reduce((sum, value) => sum + value, 0)
}
