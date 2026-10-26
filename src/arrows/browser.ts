import { advance } from './versions'
import type { ArrowsDocumentBoundary } from './exclusive-document'
import { ArrowsStaticSurface } from './v11/static-surface'
import type { Command, InputProfile, PointerSource, State } from './versions'
import { stimulusFor, isV11 } from './versions'
import { ArrowsEntry, ArrowsAdmissionChanged } from './entry'
import type { ArrowsAdmission } from './entry'
import type { ArrowsAuthorityHandle } from './authority'
import { authorityEqual } from './authority'
import { ArrowsRecovery } from './recovery'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'

type Stage = 'fixation' | 'stimulus' | 'offset'
type Listener = (state: State) => void
type PendingFrame = { stage: Stage; due: number; phase: State['phase']; token: number }
const isTerminal = (state: State) => state.phase === 'invalid' || state.phase === 'completed'

// When pointer-events:none !important prevents a hit test, compare only two
// explicit sibling stacking layers. Looking past an intervening ancestor can
// compare unrelated z-index values; a top-layer descendant can escape them.
const definitelyBehindHost = (candidate: HTMLElement, host: HTMLElement): boolean => {
  const path = (element: Element): Element[] => {
    const nodes: Element[] = []
    for (let node: Element | null = element; node; node = node.parentElement) nodes.unshift(node)
    return nodes
  }
  const candidatePath = path(candidate), hostPath = path(host)
  let shared = 0
  while (shared < candidatePath.length && shared < hostPath.length && candidatePath[shared] === hostPath[shared]) shared++
  if (!shared || shared === candidatePath.length || shared === hostPath.length) return false
  // SVG children do not necessarily follow HTML flex/grid or positioned-box
  // stacking rules, even when their computed display and z-index look alike.
  if (!(candidatePath[shared - 1] instanceof HTMLElement) ||
    !(candidatePath[shared] instanceof HTMLElement) || !(hostPath[shared] instanceof HTMLElement)) return false
  if (candidatePath.slice(shared).some(node => node.matches('dialog, [popover], :fullscreen'))) return false
  // Numeric sibling z-index is meaningful here only for painted boxes in an
  // ordinary 2D context. A boxless display:contents ancestor contributes no
  // layer, and a shared 3D context can paint a lower z-index in front.
  if ([...candidatePath.slice(shared), ...hostPath.slice(shared)].some(
    node => getComputedStyle(node).display === 'contents')) return false
  if (candidatePath.slice(0, shared).some(node => {
    const style = getComputedStyle(node)
    return style.transformStyle === 'preserve-3d' || style.perspective !== 'none'
  })) return false
  const layer = (node: Element): number | null => {
    const style = getComputedStyle(node)
    if (style.zIndex === 'auto') return null
    const parentDisplay = node.parentElement ? getComputedStyle(node.parentElement).display : ''
    if (style.position === 'static' && !parentDisplay.includes('flex') && !parentDisplay.includes('grid')) return null
    const zIndex = Number(style.zIndex)
    return Number.isFinite(zIndex) ? zIndex : null
  }
  const candidateLevel = layer(candidatePath[shared]), hostLevel = layer(hostPath[shared])
  return candidateLevel !== null && hostLevel !== null && candidateLevel < hostLevel
}

/** Browser callbacks retain the live journal independently of storage. A8/A9
 * persist breaks and terminal drafts; candidate navigation remains separate. */
export class ArrowsBrowserRun {
  private readonly entry: ArrowsEntry
  private readonly host: HTMLElement
  private readonly publish: Listener
  private readonly clock: () => number
  private state: State | null = null
  #surface: ArrowsStaticSurface | null = null
  private preparation = 0
  private readonly useStaticSurface: boolean
  private readonly boundary: ArrowsDocumentBoundary | null
  private attempt: ArmedAttempt | null = null
  private pendingProfile: InputProfile | null = null
  private epoch = 0
  private stageEpoch = 0
  private pending = false
  private protectedBlock = false
  private closed = false
  private disposed = false
  private held = new Set<string>()
  private pointerHeld = new Set<number>()
  private lastFrame: number | null = null
  private stageTimer: number | null = null
  private watchdogTimer: number | null = null
  private stageFrame: number | null = null
  private monitorFrame: number | null = null
  private pendingFrame: PendingFrame | null = null
  private readonly remove: Array<() => void> = []
  private checkpointRevision = 0
  private checkpointState: State | null = null
  private checkpointPending: Promise<void> | null = null
  private checkpointStatusValue: 'none' | 'pending' | 'saved' | 'failed' = 'none'
  private checkpointSaveEpoch = 0
  private checkpointRecoveryEpoch = 0
  private recoveryValue: ArrowsRecovery | null = null
  private terminalState: State | null = null
  private admissionToken: ArrowsAdmission | null = null
  private withdrawalValue: ArrowsAuthorityHandle | null = null
  private breakAuthority: ArrowsAuthorityHandle | null = null
  private detachBreak: (() => void) | null = null
  private detachArm: (() => void) | null = null
  private withdrawing = false

  constructor(entry: ArrowsEntry, host: HTMLElement, publish: Listener, clock: () => number = () => performance.now(), useStaticSurface = false, boundary: ArrowsDocumentBoundary | null = null) {
    this.boundary = boundary
    this.useStaticSurface = useStaticSurface
    this.entry = entry
    this.host = host
    this.publish = publish
    this.clock = clock
    this.listen(window, 'keydown', event => this.keydown(event as KeyboardEvent), true)
    this.listen(window, 'keyup', event => this.keyup(event as KeyboardEvent), true)
    this.listen(host, 'pointerdown', event => { if (!this.#surface) this.pointerdown(event as PointerEvent) })
    this.listen(window, 'pointerup', event => this.pointerup(event as PointerEvent))
    this.listen(window, 'pointercancel', event => this.pointerup(event as PointerEvent))
    this.listen(document, 'visibilitychange', () => { if (document.visibilityState !== 'visible') this.invalidate('hidden') })
    this.listen(window, 'blur', () => this.invalidate('blur'))
    this.listen(document, 'freeze', () => this.invalidate('freeze'))
    this.listen(window, 'pagehide', () => this.invalidate('page_exit'))
    this.listen(window, 'error', () => { if (this.protectedBlock) this.technical() })
    this.listen(window, 'unhandledrejection', () => { if (this.protectedBlock) this.technical() })
    this.listen(window, 'resize', () => { if (this.protectedBlock && !this.layoutReady()) this.invalidate('viewport') })
    this.listen(window, 'orientationchange', () => { if (this.protectedBlock && !this.layoutReady()) this.invalidate('viewport') })
    if (window.visualViewport) this.listen(window.visualViewport, 'resize', () => {
      if (this.protectedBlock && !this.layoutReady()) this.invalidate('viewport')
    })
    if (window.visualViewport) this.listen(window.visualViewport, 'scroll', () => {
      if (this.protectedBlock && !this.layoutReady()) this.invalidate('viewport')
    })
  }

  snapshot(): State | null { return this.state }
  armedAttempt(): ArmedAttempt | null { return this.attempt }
  protectedNow(): boolean { return this.protectedBlock }
  checkpointStatus(): 'none' | 'pending' | 'saved' | 'failed' {
    if (this.state?.phase === 'break' && this.breakAuthority?.resultStatus().kind === 'confirmed') return 'saved'
    return this.checkpointStatusValue === 'saved' ? 'none' : this.checkpointStatusValue
  }
  private targetForBreak(): ArrowsAuthorityHandle {
    if (!this.attempt || this.state?.phase !== 'break') throw Error('No Arrows checkpoint is available')
    if (this.breakAuthority?.result === this.state || authorityEqual(this.breakAuthority?.result, this.state)) return this.breakAuthority!
    this.detachBreak?.()
    const handle = this.entry.authority(this.attempt, this.state, this.checkpointRevision)
    this.breakAuthority = handle
    this.detachBreak = handle.subscribe(status => {
      if (status.kind === 'retired' || status.kind === 'blocked') this.withdraw()
    })
    return handle
  }
  async retryCheckpoint(): Promise<PersistedSnapshot> {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Arrows checkpoint is available')
    const recoveryEpoch = ++this.checkpointRecoveryEpoch, runEpoch = this.epoch, arm = this.attempt
    const current = () => !this.disposed && !this.closed && runEpoch === this.epoch && recoveryEpoch === this.checkpointRecoveryEpoch && this.state?.phase === 'break'
    while (current()) {
      const state = this.state!, target = this.targetForBreak()
      try {
        await this.entry.currentCheckpoint(arm, target)
        if (!current()) throw Error('Arrows checkpoint recovery canceled')
        const result = target.resultStatus()
        target.assertCurrent()
        if (result.kind === 'confirmed') {
          this.checkpointRevision = result.snapshot.revision; this.checkpointState = this.state === state ? state : null
          this.checkpointSaveEpoch++; this.checkpointPending = null; this.checkpointStatusValue = this.checkpointState ? 'saved' : 'none'
          if (this.checkpointState) return result.snapshot
          continue
        }
        const revision = result.kind === 'recoverable' ? result.snapshot?.revision ?? 0 : 0
        this.checkpointSaveEpoch++; this.checkpointPending = null; this.checkpointStatusValue = 'pending'
        const saveEpoch = this.checkpointSaveEpoch
        const saved = await this.entry.checkpoint(arm, state, revision)
        if (!current() || saveEpoch !== this.checkpointSaveEpoch) throw Error('Arrows checkpoint recovery canceled')
        this.checkpointRevision = saved.revision; this.checkpointState = this.state === state ? state : null
        this.checkpointStatusValue = this.checkpointState ? 'saved' : 'none'
        if (this.checkpointState) return saved
      } catch (error) { if (current()) this.checkpointStatusValue = 'failed'; throw error }
    }
    throw Error('Arrows checkpoint recovery canceled')
  }
  /** Exit an untimed break with its immutable known prefix available for an
   * in-tab Incomplete review. Release the live owner before persistence. */
  endBreakForReview(): State {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt)
      throw Error('No Arrows break is available for review')
    const draft = this.state
    this.recoveryValue = new ArrowsRecovery(this.entry, this.attempt, draft, this.checkpointRevision)
    this.dispose()
    return draft
  }
  recovery(): ArrowsRecovery | null { return this.recoveryValue }
  withdrawalAuthority(): ArrowsAuthorityHandle | null { return this.withdrawalValue }
  private watchArm(): void {
    const arm = this.attempt
    if (!arm) return
    this.detachArm = this.entry.armAuthority(arm).subscribe(status => {
      if (status.kind === 'retired' || status.kind === 'blocked') this.withdraw()
    })
  }
  private withdraw(): void {
    if (this.withdrawing || this.closed || !this.state || !this.attempt) return
    // Latch before creating/refreshing a handle: refresh synchronously dispatches
    // the other subscriber. Both listener orders must select this one owner.
    this.withdrawing = true
    const prior = this.state, floor = prior.phase === 'break' ? this.checkpointRevision : 0
    const result = prior.phase === 'break' || isTerminal(prior) ? prior :
      advance(prior, { kind: 'invalidate', atMs: this.clock(), reason: 'technical' })
    this.state = result
    if (isTerminal(result)) this.terminalState = result
    this.stop()
    const controller = new ArrowsRecovery(this.entry, this.attempt, result, floor)
    this.recoveryValue = controller; this.withdrawalValue = controller.authority
    this.publish(result)
  }
  private recoveryStatus(): 'none' | 'pending' | 'saved' | 'unconfirmed' {
    if (!this.recoveryValue) return 'none'
    if (this.recoveryValue.outcome().kind === 'retired') return 'unconfirmed'
    if (this.recoveryValue.pending()) return 'pending'
    return this.recoveryValue.outcome().kind === 'confirmed' ? 'saved' : 'unconfirmed'
  }
  breakExitStatus(): 'none' | 'pending' | 'saved' | 'unconfirmed' { return this.recoveryStatus() }
  retryBreakExit(): Promise<PersistedSnapshot> {
    if (!this.recoveryValue || this.recoveryValue.target.kind !== 'checkpoint')
      return Promise.reject(Error('No Arrows break-exit draft'))
    return this.recoveryValue.snapshot()
  }
  terminalStatus(): 'none' | 'pending' | 'saved' | 'unconfirmed' { return this.recoveryStatus() }
  retryTerminal(): Promise<PersistedSnapshot> {
    if (!this.terminalState || !this.attempt) return Promise.reject(Error('No Arrows terminal result'))
    this.captureTerminal()
    return this.recoveryValue!.snapshot()
  }
  private captureTerminal(): void {
    if (!this.recoveryValue && this.terminalState && this.attempt)
      this.recoveryValue = new ArrowsRecovery(this.entry, this.attempt, this.terminalState)
  }
  layoutReady(): boolean {
    if (!this.host.isConnected || document.visibilityState !== 'visible' || !document.hasFocus()) return false
    if (this.#surface) return this.#surface.composition((shell, painted, root) => this.outerComposition(shell, painted, root))
    const rendered = (element: Element): boolean => {
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
      }
      return true
    }
    if (!rendered(this.host)) return false
    const box = this.host.getBoundingClientRect()
    const vv = window.visualViewport
    const left = vv?.offsetLeft ?? 0, top = vv?.offsetTop ?? 0
    const width = vv?.width ?? document.documentElement.clientWidth
    const height = vv?.height ?? document.documentElement.clientHeight
    if (box.width <= 0 || box.height <= 0 || box.left < left || box.right > left + width ||
      box.top < top || box.bottom > top + height || document.documentElement.scrollWidth > document.documentElement.clientWidth) return false
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    if (hit !== this.host && (!hit || !this.host.contains(hit))) return false
    for (const item of this.host.querySelectorAll<HTMLElement>('[data-arrows-stage], [data-arrows-cue], [data-arrows-symbol], [data-direction], [data-arrows-symbol] > svg')) {
      const itemBox = item.getBoundingClientRect()
      if (!rendered(item) ||
        itemBox.width <= 0 || itemBox.height <= 0 || itemBox.left < left || itemBox.right > left + width ||
        itemBox.top < top || itemBox.bottom > top + height) return false
      const itemHit = document.elementFromPoint(itemBox.left + itemBox.width / 2, itemBox.top + itemBox.height / 2)
      if (itemHit !== item && (!itemHit || !item.contains(itemHit))) return false
    }
    // Hit-testing alone ignores painted overlays with pointer-events:none and
    // one center sample can miss an overlay covering only part of the cue.
    // A separate app element covering any of the reserved display footprint is
    // conservatively treated as an obstruction, including non-interactive paint.
    const nonInteractive: Array<{ element: HTMLElement; x: number; y: number }> = []
    for (const candidate of document.body.querySelectorAll<HTMLElement>('*')) {
      if (candidate === this.host || candidate.contains(this.host) ||
        (this.host.contains(candidate) && candidate.matches(
          '[data-arrows-stage], [data-arrows-cue], [data-arrows-symbol], [data-direction], [data-arrows-owned], [data-arrows-symbol] > svg, [data-arrows-symbol] > svg > path'))) continue
      const candidateBox = candidate.getBoundingClientRect()
      const x1 = Math.max(box.left, candidateBox.left), x2 = Math.min(box.right, candidateBox.right)
      const y1 = Math.max(box.top, candidateBox.top), y2 = Math.min(box.bottom, candidateBox.bottom)
      if (x1 >= x2 || y1 >= y2 || !rendered(candidate)) continue
      const style = getComputedStyle(candidate)
      const centerX = (x1 + x2) / 2, centerY = (y1 + y2) / 2
      if (style.pointerEvents === 'none') nonInteractive.push({ element: candidate, x: centerX, y: centerY })
      else {
        const hit = document.elementFromPoint(centerX, centerY)
        if (hit === candidate || (hit && candidate.contains(hit))) return false
      }
    }
    if (nonInteractive.length) {
      // A constructable stylesheet changes hit eligibility without changing any
      // element attributes. Inline style mutation can activate [style] selectors
      // and change the paint order being measured.
      if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in document)) return false
      // The browser exposes a live array here; keep a value snapshot so the
      // setter cannot mutate the collection used for restoration.
      const originalSheets = [...document.adoptedStyleSheets]
      try {
        const hitTestSheet = new CSSStyleSheet()
        hitTestSheet.replaceSync('* { pointer-events: auto !important; }')
        document.adoptedStyleSheets = [...originalSheets, hitTestSheet]
        for (const { element, x, y } of nonInteractive) {
          if (getComputedStyle(element).pointerEvents !== 'auto') {
            if (!definitelyBehindHost(element, this.host)) return false
            continue
          }
          const hit = document.elementFromPoint(x, y)
          if (hit === element || (hit && element.contains(hit))) return false
        }
      } catch {
        return false
      } finally {
        document.adoptedStyleSheets = originalSheets
      }
    }
    return true
  }

  /** Outer composition only: a fixed image/closed-shell footprint, never a
   * reconstruction of individual arrow paths or cue glyphs. */
  private outerComposition(shell: HTMLElement, painted: Element[], root: ShadowRoot): boolean {
    if (!this.boundary?.check(this.host, shell, root)) return false
    const parent = (node: Element): Element | null => node.parentElement ?? (node.getRootNode() instanceof ShadowRoot ? (node.getRootNode() as ShadowRoot).host : null)
    const chain = (node: Element) => { const nodes: Element[] = []; for (let n: Element | null = node; n; n = parent(n)) nodes.push(n); return nodes }
    const styles = new Map<Element, CSSStyleDeclaration>()
    const styleOf = (node: Element) => { let style = styles.get(node); if (!style) { style = getComputedStyle(node); styles.set(node, style) }; return style }
    const plain = (style: CSSStyleDeclaration, property: string, expected: string) => !style.getPropertyValue(property) || style.getPropertyValue(property) === expected
    // The owned opaque stacking context backs the whole stage, including empty
    // offset and control gaps. Ordinary text below it needs no glyph-ink estimate.
    const unsupportedPaint = (style: CSSStyleDeclaration) =>
      !plain(style, 'box-shadow', 'none') || !plain(style, 'text-shadow', 'none') ||
      !plain(style, 'border-image-source', 'none') || !plain(style, '-webkit-text-stroke-width', '0px')
    const ancestors = chain(shell)
    if (!shell.isConnected || ancestors.at(-1) !== document.documentElement || !ancestors.includes(this.host) ||
      root.host !== shell || window.matchMedia('(forced-colors: active)').matches) return false
    const owned = [shell, ...painted], all = new Set([...ancestors, ...owned])
    for (const node of all) {
      const style = styleOf(node)
      if (unsupportedPaint(style) || style.display === 'none' || style.display === 'contents' || style.visibility !== 'visible' || Number(style.opacity) !== 1 ||
        style.transform !== 'none' || style.perspective !== 'none' || style.transformStyle !== 'flat' ||
        !plain(style, 'rotate', 'none') || !plain(style, 'scale', 'none') || !plain(style, 'translate', 'none') ||
        !plain(style, 'offset-path', 'none') || !plain(style, 'content-visibility', 'visible') ||
        !plain(style, 'filter', 'none') || !plain(style, 'backdrop-filter', 'none') || !plain(style, '-webkit-backdrop-filter', 'none') ||
        !plain(style, 'clip-path', 'none') || !plain(style, 'clip', 'auto') || !plain(style, 'mask-image', 'none') ||
        !plain(style, '-webkit-mask-image', 'none') || !plain(style, 'mask-border-source', 'none') ||
        !plain(style, '-webkit-mask-box-image-source', 'none') || !plain(style, 'mix-blend-mode', 'normal') ||
        style.animationName !== 'none' || style.transitionDuration.split(',').some(v => Number.parseFloat(v) !== 0) ||
        node.getAnimations().some(a => a.playState !== 'finished' && a.playState !== 'idle')) return false
      for (const pseudo of ['::before', '::after']) {
        const content = getComputedStyle(node, pseudo).content
        if (!['none', 'normal'].includes(content) &&
          !(pseudo === '::before' && content === '-moz-alt-content' &&
            node instanceof HTMLImageElement && painted.includes(node))) return false
      }
    }
    const shellStyle = styleOf(shell)
    if (shellStyle.backgroundColor !== 'rgb(255, 255, 255)' || shellStyle.backgroundImage !== 'none' ||
      shellStyle.backgroundClip !== 'border-box' || !plain(shellStyle, 'content', 'normal') ||
      shellStyle.position !== 'relative' || shellStyle.zIndex !== '100' || shellStyle.isolation !== 'isolate' ||
      shellStyle.borderRadius !== '0px') return false
    const footprint = shell.getBoundingClientRect(), zoom = footprint.width / 352
    if (!Number.isFinite(zoom) || zoom <= 0 || shell.offsetWidth !== 352 || Math.abs(footprint.height - shell.offsetHeight * zoom) > 0.2) return false
    const vv = window.visualViewport, left = vv?.offsetLeft ?? 0, top = vv?.offsetTop ?? 0
    const right = left + (vv?.width ?? document.documentElement.clientWidth), bottom = top + (vv?.height ?? document.documentElement.clientHeight)
    const inside = (box: DOMRect) => box.width > 0 && box.height > 0 && box.left >= left && box.right <= right && box.top >= top && box.bottom <= bottom
    if (!inside(footprint) || document.documentElement.scrollWidth > document.documentElement.clientWidth) return false
    const boxes: DOMRect[] = [footprint]
    for (const node of painted) {
      const rect = node.getBoundingClientRect(), style = styleOf(node)
      if (!inside(rect) || rect.left < footprint.left - .1 || rect.right > footprint.right + .1 || rect.top < footprint.top - .1 || rect.bottom > footprint.bottom + .1) return false
      if (node instanceof HTMLImageElement && (style.objectFit !== 'contain' || style.objectPosition !== '50% 50%' || !plain(style, 'content', 'normal') ||
        Math.abs(rect.width - node.width * zoom) > .2 || Math.abs(rect.height - node.height * zoom) > .2)) return false
      if (node instanceof HTMLButtonElement && style.outlineStyle !== 'none') {
        if (style.outlineStyle !== 'solid' || style.outlineWidth !== '3px' || style.outlineOffset !== '4px' || style.outlineColor !== 'rgb(153, 85, 0)') return false
        const expanded = new DOMRect(rect.left - 7 * zoom, rect.top - 7 * zoom, rect.width + 14 * zoom, rect.height + 14 * zoom)
        if (!inside(expanded) || expanded.left < footprint.left || expanded.right > footprint.right || expanded.top < footprint.top || expanded.bottom > footprint.bottom) return false
        boxes.push(expanded)
      }
    }
    // Check every composed clipping ancestor. The host's rounded white backing
    // is conservatively an inset rectangle, even if it does not clip children.
    for (const ancestor of ancestors) {
      const style = styleOf(ancestor), rect = ancestor.getBoundingClientRect()
      const paint = ancestor === this.host || /(?:paint|strict|content)/.test(style.contain)
      const clipX = paint || style.overflowX !== 'visible', clipY = paint || style.overflowY !== 'visible'
      if (!clipX && !clipY) continue
      const sx = ancestor instanceof HTMLElement && ancestor.offsetWidth ? rect.width / ancestor.offsetWidth : zoom
      const sy = ancestor instanceof HTMLElement && ancestor.offsetHeight ? rect.height / ancestor.offsetHeight : zoom
      const radius = Math.max(...['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
        const raw = style.getPropertyValue(`border-${corner}-radius`)
        return raw.includes('%') ? Math.max(rect.width, rect.height) : Math.max(...raw.split(' ').map(Number.parseFloat)) * Math.max(sx, sy)
      }))
      if (!Number.isFinite(radius)) return false
      for (const box of boxes) if ((clipX && (box.left < rect.left + ancestor.clientLeft * sx + radius - .1 || box.right > rect.left + (ancestor.clientLeft + ancestor.clientWidth) * sx - radius + .1)) ||
        (clipY && (box.top < rect.top + ancestor.clientTop * sy + radius - .1 || box.bottom > rect.top + (ancestor.clientTop + ancestor.clientHeight) * sy - radius + .1))) return false
    }
    return true
  }

  async begin(request: StartRequest, beforeArm?: () => Promise<void>): Promise<State> {
    if (this.disposed || this.closed || this.pending || this.state) throw Error('Arrows browser run already started or ended')
    const ownedRequest = structuredClone(request)
    const pendingProfile = ownedRequest.profile
    const epoch = ++this.epoch
    this.pending = true
    this.pendingProfile = pendingProfile
    try {
      if (this.useStaticSurface) {
        this.#surface = new ArrowsStaticSurface(this.host, pendingProfile.kind === 'pointer', (event, direction) => this.pointerdown(event, direction))
        this.preparation = await this.#surface.prepare()
        if (epoch !== this.epoch || this.disposed || !this.#surface.prepared(this.preparation)) throw Error('Arrows preparation canceled')
      }
      if (!this.layoutReady()) throw Error('The Arrows display is not fully visible. Resize or zoom out before starting.')
      const arm = await this.entry.begin(ownedRequest, beforeArm)
      if (epoch !== this.epoch || this.disposed) throw Error('Arrows browser run canceled')
      if (isV11(arm.state) && !this.#surface) throw Error('Arrows V1.1 images must be prepared before arming')
      if (!this.layoutReady()) throw Error('The Arrows display changed before scored start')
      await this.entry.admitStart(arm, token => {
        this.admissionToken = token
        if (epoch !== this.epoch || this.disposed || !this.layoutReady() || (this.#surface && !this.#surface.prepared(this.preparation)))
          throw Error('Arrows scored start was canceled')
        this.pending = false
        this.pendingProfile = null
        this.attempt = arm
        this.state = arm.state
        this.watchArm()
        this.apply({ kind: 'start', atMs: this.clock(), responseHeld: this.responseHeld(arm.state.profile) })
        if (this.closed || this.state.phase !== 'fixation_pending') throw Error('Arrows scored start was canceled')
        try { this.monitor(); this.fixation() } catch (error) { this.technical(); throw error }
      })
      return this.state!
    } catch (error) {
      if (epoch === this.epoch) {
        if (this.protectedBlock) this.technical()
        else this.stop(this.attempt !== null)
      }
      throw error
    }
  }

  async continue(): Promise<State> {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Arrows block is ready to continue')
    const epoch = this.epoch, arm = this.attempt
    if (isV11(this.state) && !this.#surface) this.#surface = new ArrowsStaticSurface(this.host, this.state.profile.kind === 'pointer', (event, direction) => this.pointerdown(event, direction))
    const preparation = this.#surface ? await this.#surface.prepare() : 0
    this.preparation = preparation
    if (epoch !== this.epoch || this.closed || (this.#surface && !this.#surface.prepared(preparation))) throw Error('Arrows continuation was canceled')
    while (true) {
      await this.ensureCheckpoint()
      if (epoch !== this.epoch || this.closed || this.state?.phase !== 'break') throw Error('Arrows continuation was canceled')
      const state = this.state, target = this.targetForBreak()
      try {
        await this.entry.admitContinue(arm, target, token => {
          if (epoch !== this.epoch || this.closed || this.disposed || this.preparation !== preparation || (this.#surface && !this.#surface.prepared(preparation))) throw Error('Arrows continuation was canceled')
          if (this.state !== state) throw new ArrowsAdmissionChanged('Arrows break input changed')
          target.confirmed()
          if (!this.layoutReady()) throw Error('The Arrows display is not fully visible. Resize or zoom out before continuing.')
          this.detachBreak?.(); this.detachBreak = null; this.breakAuthority = null
          this.admissionToken = token
          this.apply({ kind: 'continue', atMs: this.clock(), responseHeld: this.responseHeld(state.profile) })
          if (this.closed || this.snapshot()?.phase !== 'fixation_pending') throw Error('Arrows continuation was canceled')
          try { this.monitor(); this.fixation() } catch (error) { this.technical(); throw error }
        })
        return this.state!
      } catch (error) { if (error instanceof ArrowsAdmissionChanged) continue; throw error }
    }
  }

  settingsChanged(): void {
    if (this.pending) { this.stop(); return }
    if (this.state && !isTerminal(this.state))
      this.apply({ kind: 'invalidate', atMs: this.clock(), reason: 'settings' })
  }
  cancel(): void { if (this.protectedBlock) this.invalidate('page_exit'); else this.stop() }
  dispose(): void {
    if (this.disposed) return
    this.cancel()
    this.disposed = true
    this.remove.forEach(remove => remove())
  }

  private listen(target: EventTarget, type: string, callback: (event: Event) => void, capture = false) {
    const guarded = (event: Event) => { try { callback(event) } catch { this.technical() } }
    target.addEventListener(type, guarded, capture)
    this.remove.push(() => target.removeEventListener(type, guarded, capture))
  }
  private responseHeld(profile: InputProfile): boolean {
    return profile.kind === 'keyboard' ? this.held.has(profile.leftCode) || this.held.has(profile.rightCode) : this.pointerHeld.size > 0
  }
  private apply(command: Command): void {
    if (this.closed || this.withdrawing || !this.state || isTerminal(this.state)) return
    this.state = advance(this.state, command)
    // The engine has accepted the block before publishing it. Publication failure
    // must therefore invalidate under protection, before ownership is released.
    if ((command.kind === 'start' || command.kind === 'continue') && this.state.phase === 'fixation_pending')
      this.protectedBlock = true
    if (this.state.phase === 'break') this.protectedBlock = false
    const terminal = isTerminal(this.state) ? this.state : null
    if (terminal) { this.terminalState = terminal; this.captureTerminal() }
    try { this.publish(this.state) } catch { this.technical(); return }
    if (terminal) {
      this.stop()
      void this.persistTerminal().catch(() => { /* The immutable in-tab draft remains reviewable. */ })
      return
    }
    if (this.closed) return
    if (this.state.phase === 'break') {
      this.clearTimers()
      if (this.#surface && command.kind === 'offset') { this.#surface.dispose(); this.#surface = null }
      else if (this.#surface) this.#surface.clear(); else this.host.replaceChildren()
      void this.ensureCheckpoint().catch(() => { /* The untimed break can retry. */ })
    }
  }
  private async ensureCheckpoint(): Promise<void> {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Arrows checkpoint is available')
    const target = this.targetForBreak(), result = target.resultStatus()
    target.assertCurrent()
    if (result.kind === 'confirmed') {
      this.checkpointRevision = result.snapshot.revision; this.checkpointState = this.state; this.checkpointStatusValue = 'saved'; return
    }
    // A held delivery is bounded by recovery's fresh read; it never gates Continue.
    if (this.checkpointPending) { await this.retryCheckpoint(); return }
    const state = this.state, arm = this.attempt, epoch = this.epoch, saveEpoch = ++this.checkpointSaveEpoch
    this.checkpointStatusValue = 'pending'
    const revision = result.kind === 'recoverable' ? result.snapshot?.revision ?? 0 : this.checkpointRevision
    const pending = this.entry.checkpoint(arm, state, revision).then(snapshot => {
      if (epoch !== this.epoch || this.closed || saveEpoch !== this.checkpointSaveEpoch) throw Error('Arrows checkpoint was canceled or superseded')
      this.checkpointRevision = snapshot.revision; this.checkpointState = this.state === state ? state : null; this.checkpointStatusValue = 'saved'
    }).catch(async error => {
      if (epoch !== this.epoch || this.closed || saveEpoch !== this.checkpointSaveEpoch) throw error
      this.checkpointStatusValue = 'failed'
      // Every settlement root feeds all targets, even when public delivery cancels.
      try { await this.entry.currentCheckpoint(arm, target) } catch { throw error }
      if (epoch !== this.epoch || this.closed || saveEpoch !== this.checkpointSaveEpoch) throw error
      const latest = target.resultStatus(); target.assertCurrent()
      if (latest.kind !== 'confirmed') throw error
      this.checkpointRevision = latest.snapshot.revision; this.checkpointState = this.state === state ? state : null; this.checkpointStatusValue = 'saved'
    }).finally(() => { if (this.checkpointPending === pending) this.checkpointPending = null })
    this.checkpointPending = pending
    await pending
    if (this.state?.phase === 'break' && this.state !== state) await this.ensureCheckpoint()
  }
  private invalidate(reason: Extract<Command, { kind: 'invalidate' }>['reason']) {
    if (this.protectedBlock && this.state && !isTerminal(this.state))
      this.apply({ kind: 'invalidate', atMs: this.clock(), reason })
  }
  private technical(): void {
    if (this.protectedBlock && this.state && !isTerminal(this.state)) {
      try {
        this.state = advance(this.state, { kind: 'invalidate', atMs: this.clock(), reason: 'technical' })
        this.terminalState = this.state
        this.captureTerminal()
        this.publish(this.state)
      } catch { /* Preserve the known in-memory prefix even if reporting also fails. */ }
    }
    this.stop()
    if (this.state && isTerminal(this.state)) {
      this.terminalState = this.state
      void this.persistTerminal().catch(() => { /* Keep the unconfirmed terminal draft. */ })
    }
  }
  private async persistTerminal(): Promise<void> {
    this.captureTerminal()
    await this.recoveryValue?.recover(true)
  }
  private stop(retire = true): void {
    if (this.closed) return
    this.closed = true
    this.epoch++
    this.pending = false
    this.pendingProfile = null
    this.detachBreak?.(); this.detachBreak = null
    this.detachArm?.(); this.detachArm = null
    this.protectedBlock = false
    try { this.clearTimers() } finally {
      try { this.#surface?.dispose(); this.host.replaceChildren() } finally { this.entry.release(retire) }
    }
  }
  private clearTimers() {
    this.stageEpoch++
    if (this.stageTimer !== null) clearTimeout(this.stageTimer)
    if (this.watchdogTimer !== null) clearTimeout(this.watchdogTimer)
    if (this.stageFrame !== null) cancelAnimationFrame(this.stageFrame)
    if (this.monitorFrame !== null) cancelAnimationFrame(this.monitorFrame)
    this.stageTimer = this.watchdogTimer = this.stageFrame = this.monitorFrame = null
    this.pendingFrame = null
    this.lastFrame = null
  }
  private nextStage() {
    this.stageEpoch++
    if (this.stageTimer !== null) clearTimeout(this.stageTimer)
    if (this.watchdogTimer !== null) clearTimeout(this.watchdogTimer)
    if (this.stageFrame !== null) cancelAnimationFrame(this.stageFrame)
    this.stageTimer = this.watchdogTimer = this.stageFrame = null
    this.pendingFrame = null
    return this.stageEpoch
  }
  private scheduleAt(time: number, callback: () => void, token: number, watchdog = false): void {
    const tick = () => {
      if (token !== this.stageEpoch || !this.protectedBlock) return
      if (this.clock() < time) {
        const id = window.setTimeout(tick, Math.max(1, time - this.clock()))
        if (watchdog) this.watchdogTimer = id; else this.stageTimer = id
      } else { try { callback() } catch { this.technical() } }
    }
    const id = window.setTimeout(tick, Math.max(0, time - this.clock()))
    if (watchdog) this.watchdogTimer = id; else this.stageTimer = id
  }
  private watchdog(due: number, phase: State['phase'], token: number) {
    this.scheduleAt(due + 2_000, () => {
      if (this.state?.phase === phase) this.apply({ kind: 'watchdog', atMs: this.clock() })
    }, token, true)
  }
  private confirm(stage: Stage, due: number, phase: State['phase'], token: number) {
    const pending = { stage, due, phase, token }
    this.pendingFrame = pending
    const frame = () => {
      try {
        if (this.pendingFrame !== pending || token !== this.stageEpoch || !this.protectedBlock) return
        if (this.clock() < due) { this.stageFrame = requestAnimationFrame(frame); return }
        this.confirmNow(pending)
      } catch { this.technical() }
    }
    this.stageFrame = requestAnimationFrame(frame)
  }
  private confirmNow(pending: PendingFrame) {
    if (this.pendingFrame !== pending || pending.token !== this.stageEpoch || !this.protectedBlock ||
      this.state?.phase !== pending.phase) return
    const time = this.clock()
    if (time < pending.due) return
    if (!this.layoutReady() || !this.displayMatches(pending.stage)) { this.invalidate('viewport'); return }
    this.pendingFrame = null
    this.apply({ kind: pending.stage === 'stimulus' ? 'onset' : pending.stage === 'fixation' ? 'fixation' : 'offset', atMs: time })
    if (pending.stage === 'stimulus' && this.state && this.attempt && this.admissionToken)
      this.entry.confirmFirstPresentation(this.attempt, this.admissionToken, this.state.trialIndex)
    if (!this.protectedBlock) return
    if (pending.stage === 'fixation') this.onset()
    else if (pending.stage === 'stimulus') this.resolve()
    else if (this.state?.phase === 'fixation_pending') this.fixation()
  }
  private displayMatches(stage: Stage): boolean {
    if (this.state && isV11(this.state)) {
      return !!this.#surface && this.#surface.admit(stage === 'offset' ? 'empty' : stage, stage === 'stimulus' ? stimulusFor(this.state) as import('./v11/contracts').Stimulus : undefined)
    }
    if (stage === 'offset') return this.host.childElementCount === 0
    const panel = this.host.querySelector<HTMLElement>(`[data-arrows-stage="${stage}"]`)
    return !!panel && panel.getClientRects().length !== 0
  }
  private activePresentationReady(withLayout = false): boolean {
    if (!this.state || !isV11(this.state)) return true
    const stage = this.pendingFrame?.stage ?? (this.state.phase === 'stimulus' ? 'stimulus' : this.state.phase === 'offset_pending' ? 'offset' : 'fixation')
    return (!withLayout || this.layoutReady()) && this.displayMatches(stage)
  }
  private fixation() {
    if (!this.state || this.state.phase !== 'fixation_pending') return
    const token = this.nextStage(), due = this.state.fixationDueMs!
    if (isV11(this.state)) {
      this.#surface!.show('fixation')
      this.watchdog(due, 'fixation_pending', token)
      this.confirm('fixation', due, 'fixation_pending', token)
      return
    }
    const panel = document.createElement('div')
    panel.dataset.arrowsStage = 'fixation'
    panel.textContent = '+'
    panel.style.minHeight = '3rem'
    this.host.replaceChildren(panel)
    this.watchdog(due, 'fixation_pending', token)
    this.confirm('fixation', due, 'fixation_pending', token)
  }
  private onset() {
    if (!this.state || this.state.phase !== 'fixation') return
    const token = this.nextStage(), due = this.state.stimulusDueMs!
    this.watchdog(due, 'fixation', token)
    this.scheduleAt(due, () => {
      if (!this.state || this.state.phase !== 'fixation') return
      const stimulus = stimulusFor(this.state)
      if (isV11(this.state)) {
        this.#surface!.show('stimulus', stimulus as import('./v11/contracts').Stimulus)
        this.confirm('stimulus', due, 'fixation', token)
        return
      }
      const panel = document.createElement('div')
      panel.dataset.arrowsStage = 'stimulus'
      const cue = document.createElement('strong')
      cue.dataset.arrowsCue = ''
      cue.textContent = isV11(this.state) ? stimulus.cue : `${stimulus.cue} — ${stimulus.cueInstruction}`
      cue.setAttribute('role', 'status')
      panel.append(cue)
      const row = document.createElement('div')
      row.dataset.arrowsOwned = ''
      row.style.display = 'flex'; row.style.justifyContent = 'space-around'
      row.setAttribute('aria-hidden', 'true')
      for (const [index, symbol] of stimulus.symbols.entries()) {
        const span = document.createElement('span')
        span.dataset.arrowsSymbol = String(index + 1)
        span.textContent = symbol === 'bar' ? '│' : symbol === 'left' ? '←' : '→'
        span.style.fontSize = '2rem'
        if (stimulus.targetPositions.includes(index + 1)) span.style.outline = '2px solid currentColor'
        row.append(span)
      }
      panel.append(row)
      let controls: HTMLElement | null = null
      if (this.state.profile.kind === 'pointer') {
        controls = document.createElement('div')
        controls.dataset.arrowsOwned = ''
        for (const direction of ['left', 'right'] as const) {
          const button = document.createElement('button')
          button.type = 'button'; button.dataset.direction = direction
          button.textContent = direction === 'left' ? 'Left' : 'Right'
          controls.append(button)
        }
        panel.append(controls)
      }
      this.host.replaceChildren(panel)
      this.confirm('stimulus', due, 'fixation', token)
    }, token)
  }
  private resolve() {
    if (!this.state || this.state.phase !== 'stimulus') return
    const token = this.nextStage(), due = this.state.resolutionDueMs!
    this.scheduleAt(due, () => {
      if (this.state?.phase !== 'stimulus') return
      const time = this.clock()
      if (!this.activePresentationReady(true)) { this.invalidate('viewport'); return }
      this.apply({ kind: 'resolve', atMs: time })
      if (this.protectedBlock) this.offset()
    }, token)
  }
  private offset() {
    if (!this.state || this.state.phase !== 'offset_pending') return
    const token = this.nextStage(), due = this.state.resolutionDueMs!
    if (this.#surface) this.#surface.clear(); else this.host.replaceChildren()
    this.watchdog(due, 'offset_pending', token)
    this.confirm('offset', due, 'offset_pending', token)
  }
  private monitor() {
    const epoch = this.epoch
    this.lastFrame = null
    const tick = () => {
      try {
        if (epoch !== this.epoch || !this.protectedBlock || !this.state) return
        const now = this.clock()
        if (this.lastFrame !== null && now - this.lastFrame > 50) {
          const gapMs = now - this.lastFrame
          const pending = this.pendingFrame
          // A severe gap must not erase actual presentation in this same frame
          // merely because the monitor callback ran before stage confirmation.
          if (gapMs > 250 && pending && pending.stage !== 'offset' && now >= pending.due &&
            this.layoutReady() && this.displayMatches(pending.stage)) this.confirmNow(pending)
          if (this.protectedBlock) this.apply({ kind: 'frameGap', atMs: now, gapMs })
        }
        if (!this.protectedBlock) return
        this.lastFrame = now
        if (!this.layoutReady() || !this.activePresentationReady()) { this.invalidate('viewport'); return }
        this.monitorFrame = requestAnimationFrame(tick)
      } catch { this.technical() }
    }
    this.monitorFrame = requestAnimationFrame(tick)
  }
  private keydown(event: KeyboardEvent) {
    const time = this.clock()
    const profile = this.state?.profile ?? this.attempt?.profile ?? this.pendingProfile
    const selected = profile?.kind === 'keyboard' && (event.code === profile.leftCode || event.code === profile.rightCode)
    if (!selected) return
    const alreadyHeld = this.held.has(event.code)
    this.held.add(event.code)
    if (!this.protectedBlock || !this.state) return
    event.preventDefault()
    if (!this.activePresentationReady(true)) { this.invalidate('viewport'); return }
    this.apply({ kind: 'keydown', atMs: time, code: event.code, repeat: event.repeat || alreadyHeld,
      modified: event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing })
  }
  private keyup(event: KeyboardEvent) {
    const profile = this.state?.profile ?? this.attempt?.profile ?? this.pendingProfile
    if (profile?.kind !== 'keyboard' || (event.code !== profile.leftCode && event.code !== profile.rightCode)) return
    this.held.delete(event.code)
    if (!this.state || (!this.protectedBlock && !(this.state.phase === 'break' && this.state.heldCodes.includes(event.code)))) return
    event.preventDefault()
    this.apply({ kind: 'keyup', atMs: this.clock(), code: event.code })
  }
  private pointerdown(event: PointerEvent, ownedDirection?: 'left' | 'right') {
    const time = this.clock()
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-direction]') : null
    if ((!target && !ownedDirection) || !this.protectedBlock || this.state?.profile.kind !== 'pointer') return
    const direction = ownedDirection ?? target?.dataset.direction
    if (direction !== 'left' && direction !== 'right') return
    event.preventDefault()
    if (!this.activePresentationReady(true)) { this.invalidate('viewport'); return }
    const source = event.pointerType as PointerSource
    if (source !== 'mouse' && source !== 'touch' && source !== 'pen') return
    this.pointerHeld.add(event.pointerId)
    this.apply({ kind: 'pointerdown', atMs: time, direction, pointerId: event.pointerId,
      pointerType: source, button: event.button, isPrimary: event.isPrimary })
  }
  private pointerup(event: PointerEvent) {
    if (!this.pointerHeld.delete(event.pointerId) || this.state?.profile.kind !== 'pointer' ||
      (!this.protectedBlock && !(this.state.phase === 'break' && this.state.activePointer === event.pointerId))) return
    this.apply({ kind: 'pointerup', atMs: this.clock(), pointerId: event.pointerId })
  }
}
