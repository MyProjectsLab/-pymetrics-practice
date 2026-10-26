import { advance } from './engine'
import type { Command, InputProfile, PointerSource, State } from './engine'
import { LengthsEntry, LengthsAdmissionChanged } from './entry'
import type { LengthsAdmission } from './entry'
import type { LengthsAuthorityHandle } from './authority'
import { authorityEqual } from './authority'
import { LengthsRecovery } from './recovery'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'
import { captureLengthsDisplayContext, lengthsContentWidth } from './display-context'

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
export class LengthsBrowserRun {
  private readonly entry: LengthsEntry
  private readonly host: HTMLElement
  private readonly publish: Listener
  private readonly clock: () => number
  private state: State | null = null
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
  private recoveryValue: LengthsRecovery | null = null
  private terminalState: State | null = null
  private admissionToken: LengthsAdmission | null = null
  private withdrawalValue: LengthsAuthorityHandle | null = null
  private breakAuthority: LengthsAuthorityHandle | null = null
  private detachBreak: (() => void) | null = null
  private detachArm: (() => void) | null = null
  private withdrawing = false

  constructor(entry: LengthsEntry, host: HTMLElement, publish: Listener, clock: () => number = () => performance.now()) {
    this.entry = entry
    this.host = host
    this.publish = publish
    this.clock = clock
    this.listen(window, 'keydown', event => this.keydown(event as KeyboardEvent), true)
    this.listen(window, 'keyup', event => this.keyup(event as KeyboardEvent), true)
    this.listen(host, 'pointerdown', event => this.pointerdown(event as PointerEvent))
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
  private targetForBreak(): LengthsAuthorityHandle {
    if (!this.attempt || this.state?.phase !== 'break') throw Error('No Lengths checkpoint is available')
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
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Lengths checkpoint is available')
    const recoveryEpoch = ++this.checkpointRecoveryEpoch, runEpoch = this.epoch, arm = this.attempt
    const current = () => !this.disposed && !this.closed && runEpoch === this.epoch && recoveryEpoch === this.checkpointRecoveryEpoch && this.state?.phase === 'break'
    while (current()) {
      const state = this.state!, target = this.targetForBreak()
      try {
        await this.entry.currentCheckpoint(arm, target)
        if (!current()) throw Error('Lengths checkpoint recovery canceled')
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
        if (!current() || saveEpoch !== this.checkpointSaveEpoch) throw Error('Lengths checkpoint recovery canceled')
        this.checkpointRevision = saved.revision; this.checkpointState = this.state === state ? state : null
        this.checkpointStatusValue = this.checkpointState ? 'saved' : 'none'
        if (this.checkpointState) return saved
      } catch (error) { if (current()) this.checkpointStatusValue = 'failed'; throw error }
    }
    throw Error('Lengths checkpoint recovery canceled')
  }
  /** Exit an untimed break with its immutable known prefix available for an
   * in-tab Incomplete review. Release the live owner before persistence. */
  endBreakForReview(): State {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt)
      throw Error('No Lengths break is available for review')
    const draft = this.state
    this.recoveryValue = new LengthsRecovery(this.entry, this.attempt, draft, this.checkpointRevision)
    this.dispose()
    return draft
  }
  recovery(): LengthsRecovery | null { return this.recoveryValue }
  withdrawalAuthority(): LengthsAuthorityHandle | null { return this.withdrawalValue }
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
    const controller = new LengthsRecovery(this.entry, this.attempt, result, floor)
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
      return Promise.reject(Error('No Lengths break-exit draft'))
    return this.recoveryValue.snapshot()
  }
  terminalStatus(): 'none' | 'pending' | 'saved' | 'unconfirmed' { return this.recoveryStatus() }
  retryTerminal(): Promise<PersistedSnapshot> {
    if (!this.terminalState || !this.attempt) return Promise.reject(Error('No Lengths terminal result'))
    this.captureTerminal()
    return this.recoveryValue!.snapshot()
  }
  private captureTerminal(): void {
    if (!this.recoveryValue && this.terminalState && this.attempt)
      this.recoveryValue = new LengthsRecovery(this.entry, this.attempt, this.terminalState)
  }
  layoutReady(): boolean {
    if (!this.host.isConnected || document.visibilityState !== 'visible' || !document.hasFocus()) return false
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
    if (lengthsContentWidth(this.host) < 520 || box.height <= 0 || box.left < left || box.right > left + width ||
      box.top < top || box.bottom > top + height || document.documentElement.scrollWidth > document.documentElement.clientWidth) return false
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    if (hit !== this.host && (!hit || !this.host.contains(hit))) return false
    for (const item of this.host.querySelectorAll<HTMLElement>('[data-lengths-stage], [data-lengths-display], [data-lengths-control]')) {
      const itemBox = item.getBoundingClientRect()
      if (!rendered(item) ||
        itemBox.width <= 0 || itemBox.height <= 0 || itemBox.left < left || itemBox.right > left + width ||
        itemBox.top < top || itemBox.bottom > top + height) return false
      if (item.hasAttribute('data-lengths-display') && itemBox.width < 520) return false
      const itemHit = document.elementFromPoint(itemBox.left + itemBox.width / 2, itemBox.top + itemBox.height / 2)
      if (itemHit !== item && (!itemHit || !item.contains(itemHit))) return false
    }
    // Hit-testing alone ignores painted overlays with pointer-events:none and
    // one center sample can miss an overlay covering only part of the cue.
    // A separate app element covering any of the reserved display footprint is
    // conservatively treated as an obstruction, including non-interactive paint.
    const nonInteractive: Array<{ element: HTMLElement; x: number; y: number }> = []
    for (const candidate of document.body.querySelectorAll<HTMLElement>('*')) {
      if (candidate === this.host || candidate.contains(this.host) || this.host.contains(candidate)) continue
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

  async begin(request: StartRequest): Promise<State> {
    if (this.disposed || this.closed || this.pending || this.state) throw Error('Lengths browser run already started or ended')
    if (!this.layoutReady()) throw Error('The Lengths display is not fully visible. Resize or zoom out before starting.')
    const pendingProfile = structuredClone(request.profile)
    const epoch = ++this.epoch
    this.pending = true
    this.pendingProfile = pendingProfile
    try {
      const arm = await this.entry.begin(request)
      if (epoch !== this.epoch || this.disposed) throw Error('Lengths browser run canceled')
      if (!this.layoutReady()) throw Error('The Lengths display changed before scored start')
      await this.entry.admitStart(arm, token => {
        this.admissionToken = token
        if (epoch !== this.epoch || this.disposed || !this.layoutReady())
          throw Error('Lengths scored start was canceled')
        this.pending = false
        this.pendingProfile = null
        this.attempt = arm
        this.state = arm.state
        this.watchArm()
        this.apply({ kind: 'start', atMs: this.clock(), responseHeld: this.responseHeld(arm.state.profile),
          displayContext: captureLengthsDisplayContext(this.host) })
        if (this.closed || this.state.phase !== 'fixation_pending') throw Error('Lengths scored start was canceled')
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
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Lengths block is ready to continue')
    const epoch = this.epoch, arm = this.attempt
    while (true) {
      await this.ensureCheckpoint()
      if (epoch !== this.epoch || this.closed || this.state?.phase !== 'break') throw Error('Lengths continuation was canceled')
      const state = this.state, target = this.targetForBreak()
      try {
        await this.entry.admitContinue(arm, target, token => {
          if (epoch !== this.epoch || this.closed || this.disposed) throw Error('Lengths continuation was canceled')
          if (this.state !== state) throw new LengthsAdmissionChanged('Lengths break input changed')
          target.confirmed()
          if (!this.layoutReady()) throw Error('The Lengths display is not fully visible. Resize or zoom out before continuing.')
          this.detachBreak?.(); this.detachBreak = null; this.breakAuthority = null
          this.admissionToken = token
          this.apply({ kind: 'continue', atMs: this.clock(), responseHeld: this.responseHeld(state.profile),
            displayContext: captureLengthsDisplayContext(this.host) })
          if (this.closed || this.snapshot()?.phase !== 'fixation_pending') throw Error('Lengths continuation was canceled')
          try { this.monitor(); this.fixation() } catch (error) { this.technical(); throw error }
        })
        return this.state!
      } catch (error) { if (error instanceof LengthsAdmissionChanged) continue; throw error }
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
      this.host.replaceChildren()
      void this.ensureCheckpoint().catch(() => { /* The untimed break can retry. */ })
    }
  }
  private async ensureCheckpoint(): Promise<void> {
    if (this.disposed || this.closed || this.state?.phase !== 'break' || !this.attempt) throw Error('No Lengths checkpoint is available')
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
      if (epoch !== this.epoch || this.closed || saveEpoch !== this.checkpointSaveEpoch) throw Error('Lengths checkpoint was canceled or superseded')
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
      try { this.host.replaceChildren() } finally { this.entry.release(retire) }
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
    if (stage === 'offset') return this.host.childElementCount === 0
    const panel = this.host.querySelector<HTMLElement>(`[data-lengths-stage="${stage}"]`)
    if (!panel || panel.getClientRects().length === 0) return false
    if (stage === 'stimulus' &&
      (panel.querySelectorAll('[data-lengths-bar]').length !== 2 ||
        panel.querySelectorAll('[data-lengths-display]').length !== 1)) return false
    return true
  }
  private fixation() {
    if (!this.state || this.state.phase !== 'fixation_pending') return
    const token = this.nextStage(), due = this.state.fixationDueMs!
    const panel = document.createElement('div')
    panel.dataset.lengthsStage = 'fixation'
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
      const trial = this.state.form.trials[this.state.trialIndex - 1]
      const panel = document.createElement('div')
      panel.dataset.lengthsStage = 'stimulus'
      const cue = document.createElement('strong')
      cue.textContent = 'Compare the bars'
      cue.setAttribute('role', 'status')
      panel.append(cue)
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 520 100')
      svg.setAttribute('width', '520')
      svg.setAttribute('height', '100')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('data-lengths-display', '')
      svg.style.display = 'block'
      svg.style.width = '520px'
      svg.style.height = '100px'
      const lengths = trial.longerSide === 'left'
        ? [trial.longLength, trial.shortLength] : [trial.shortLength, trial.longLength]
      for (const [index, length] of lengths.entries()) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', String((index === 0 ? 120 : 400) - length / 2))
        rect.setAttribute('y', String(50 - this.state.form.barHeight / 2))
        rect.setAttribute('width', String(length))
        rect.setAttribute('height', String(this.state.form.barHeight))
        rect.setAttribute('fill', 'currentColor')
        rect.setAttribute('data-lengths-bar', '')
        svg.append(rect)
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        label.setAttribute('x', String(index === 0 ? 120 : 400))
        label.setAttribute('y', '90')
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('fill', 'currentColor')
        label.textContent = index === 0 ? 'LEFT' : 'RIGHT'
        svg.append(label)
      }
      panel.append(svg)
      if (this.state.profile.kind === 'pointer') {
        const controls = document.createElement('div')
        controls.dataset.lengthsOwned = ''
        for (const direction of ['left', 'right'] as const) {
          const button = document.createElement('button')
          button.type = 'button'; button.dataset.direction = direction
          button.dataset.lengthsControl = ''
          button.textContent = direction === 'left' ? 'Left longer' : 'Right longer'
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
    this.watchdog(due, 'stimulus', token)
    this.scheduleAt(due, () => {
      if (this.state?.phase !== 'stimulus') return
      this.apply({ kind: 'resolve', atMs: this.clock() })
      if (this.protectedBlock) this.offset()
    }, token)
  }
  private offset() {
    if (!this.state || this.state.phase !== 'offset_pending') return
    const token = this.nextStage(), due = this.state.resolutionDueMs!
    this.host.replaceChildren()
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
        if (!this.layoutReady()) { this.invalidate('viewport'); return }
        this.monitorFrame = requestAnimationFrame(tick)
      } catch { this.technical() }
    }
    this.monitorFrame = requestAnimationFrame(tick)
  }
  private keydown(event: KeyboardEvent) {
    const profile = this.state?.profile ?? this.attempt?.profile ?? this.pendingProfile
    const selected = profile?.kind === 'keyboard' && (event.code === profile.leftCode || event.code === profile.rightCode)
    if (!selected) return
    const alreadyHeld = this.held.has(event.code)
    this.held.add(event.code)
    if (!this.protectedBlock || !this.state) return
    event.preventDefault()
    this.apply({ kind: 'keydown', atMs: this.clock(), code: event.code, repeat: event.repeat || alreadyHeld,
      modified: event.ctrlKey || event.altKey || event.metaKey || event.shiftKey,
      composing: event.isComposing })
  }
  private keyup(event: KeyboardEvent) {
    const profile = this.state?.profile ?? this.attempt?.profile ?? this.pendingProfile
    if (profile?.kind !== 'keyboard' || (event.code !== profile.leftCode && event.code !== profile.rightCode)) return
    this.held.delete(event.code)
    if (!this.state || (!this.protectedBlock && !(this.state.phase === 'break' && this.state.heldCodes.includes(event.code)))) return
    event.preventDefault()
    this.apply({ kind: 'keyup', atMs: this.clock(), code: event.code })
  }
  private pointerdown(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-direction]') : null
    if (!target || !this.protectedBlock || this.state?.profile.kind !== 'pointer') return
    const direction = target.dataset.direction
    if (direction !== 'left' && direction !== 'right') return
    event.preventDefault()
    const source = event.pointerType as PointerSource
    if (source !== 'mouse' && source !== 'touch' && source !== 'pen') return
    this.pointerHeld.add(event.pointerId)
    this.apply({ kind: 'pointerdown', atMs: this.clock(), side: direction, pointerId: event.pointerId,
      pointerType: source, button: event.button, isPrimary: event.isPrimary })
  }
  private pointerup(event: PointerEvent) {
    if (!this.pointerHeld.delete(event.pointerId) || this.state?.profile.kind !== 'pointer' ||
      (!this.protectedBlock && !(this.state.phase === 'break' && this.state.activePointer === event.pointerId))) return
    this.apply({ kind: 'pointerup', atMs: this.clock(), pointerId: event.pointerId })
  }
}
