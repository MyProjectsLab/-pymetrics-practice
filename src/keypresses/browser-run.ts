import { Attempt } from '../assessment-usage/client'
import { report } from './report'
import { advance, DELAYS_MS, WINDOW_MS, LATE_MS } from './core'
import type { InvalidReason, Setup, State } from './core'
import { KeypressesStore } from './storage'

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'unsaved'
export interface RunSnapshot { state: State | null; saveStatus: SaveStatus; message: string }
const OWNER_LOCK = 'assessment-practice-keypresses-live-v1'

/** Owns one protected browser interval. Storage is never awaited by key admission. */
export class KeypressesBrowserRun {
  private usage = new Attempt('keypresses')
  usageContext: 'practice' | 'mock' = 'practice'
  private state: State | null = null
  private status: SaveStatus = 'idle'
  private message = ''
  private host: HTMLElement
  private store: KeypressesStore
  private changed: (snapshot: RunSnapshot) => void
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private frames = new Set<number>()
  private listeners: Array<() => void> = []
  private releaseOwner: (() => void) | null = null
  private ownerTask: Promise<unknown> | null = null
  private epoch = 0
  private finishing = false
  private retries = 0
  private previousFrame: number | null = null

  constructor(store: KeypressesStore, host: HTMLElement, changed: (snapshot: RunSnapshot) => void) {
    this.store = store; this.host = host; this.changed = changed
  }
  snapshot(): RunSnapshot { return { state: this.state, saveStatus: this.status, message: this.message } }
  private publish() { this.changed(this.snapshot()) }
  private after(delayMs: number, callback: () => void) {
    const id = setTimeout(() => { this.timers.delete(id); callback() }, Math.max(0, delayMs))
    this.timers.add(id)
  }
  /** A relative timer may fire fractionally early; only the monotonic clock admits a boundary. */
  private atOrAfter(targetMs: number, callback: () => void) {
    const check = () => {
      const remaining = targetMs - performance.now()
      if (remaining > 0) this.after(remaining, check)
      else callback()
    }
    this.after(targetMs - performance.now(), check)
  }
  private frame(callback: (time: number) => void) {
    const id = requestAnimationFrame(time => { this.frames.delete(id); callback(time) })
    this.frames.add(id)
  }
  private listen(target: EventTarget, kind: string, handler: EventListener, capture = false) {
    target.addEventListener(kind, handler, capture)
    this.listeners.push(() => target.removeEventListener(kind, handler, capture))
  }
  private cleanup() {
    for (const id of this.timers) clearTimeout(id)
    for (const id of this.frames) cancelAnimationFrame(id)
    for (const remove of this.listeners) remove()
    this.timers.clear(); this.frames.clear(); this.listeners = []
    this.releaseOwner?.(); this.releaseOwner = null
    void this.ownerTask?.catch(() => undefined); this.ownerTask = null
  }
  private async acquireOwner() {
    if (!navigator.locks) throw new Error('This browser cannot protect a timed Keypresses run across tabs')
    let tell!: (ok: boolean) => void
    let release!: () => void
    const acquired = new Promise<boolean>(resolve => { tell = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    this.ownerTask = navigator.locks.request(OWNER_LOCK, { ifAvailable: true, mode: 'exclusive' }, async lock => {
      tell(!!lock)
      if (lock) await hold
    })
    void this.ownerTask.catch(() => tell(false))
    if (!await acquired) throw new Error('Keypresses is active in another tab')
    this.releaseOwner = release
  }
  async start(setup: Setup) {
    if (this.state || this.finishing) throw new Error('Run already started')
    if (document.visibilityState !== 'visible' || !document.hasFocus()) throw new Error('Keep this tab visible and focused before starting')
    this.usage.begin(this.usageContext)
    const epoch = ++this.epoch
    await this.acquireOwner().catch(error=>{this.usage.cancel();throw error})
    if (epoch !== this.epoch) { this.usage.cancel();this.cleanup(); return }
    try {
      const state = await this.store.start(setup, performance.now(), Date.now())
      if (epoch !== this.epoch) return
      this.state = state
      this.usage.admit(state.setup.sessionId, state.setup.profile === 'standard_physical')
      this.host.textContent = 'Wait for GO'
      this.host.dataset.phase = 'waiting'
      this.bind(setup.selectedKey)
      this.publish()
      const due = state.armedAtMs + DELAYS_MS[setup.delayIndex]
      this.atOrAfter(due, () => this.presentGo(due))
    } catch (error) {
      this.usage.cancel()
      this.cleanup()
      throw error
    }
  }
  private visible() {
    const rect = this.host.getBoundingClientRect()
    return this.host.isConnected && rect.width > 0 && rect.height > 0 &&
      getComputedStyle(this.host).visibility !== 'hidden' &&
      document.visibilityState === 'visible' && document.hasFocus()
  }
  private transition(command: Parameters<typeof advance>[1]) {
    if (!this.state || this.finishing) return
    try { this.state = advance(this.state, command) }
    catch { this.invalidate('technical_failure'); return }
    if (this.state.phase === 'invalid') { void this.finish(); return }
    if (this.state.phase === 'await_end') this.presentEnd()
  }
  private invalidate(reason: InvalidReason) {
    if (!this.state || this.finishing || ['completed', 'invalid'].includes(this.state.phase)) return
    this.state = advance(this.state, { kind: 'invalidate', atMs: performance.now(), reason })
    void this.finish()
  }
  private presentGo(due: number) {
    if (!this.state || this.state.phase !== 'waiting') return
    if (!this.visible()) { this.invalidate('hidden'); return }
    this.host.textContent = 'GO'
    this.host.dataset.phase = 'go'
    const epoch = this.epoch
    this.atOrAfter(due + 2_000, () => {
      if (epoch === this.epoch && this.state?.phase === 'waiting') this.invalidate('go_timeout')
    })
    this.frame(() => {
      if (epoch !== this.epoch || this.state?.phase !== 'waiting') return
      if (!this.visible()) { this.invalidate('hidden'); return }
      this.transition({ kind: 'go', atMs: performance.now() })
      if ((this.state as State | null)?.phase !== 'active') return
      this.publish()
      this.previousFrame = performance.now()
      this.monitorFrames(epoch)
      const deadline = this.state.goOnsetMs! + WINDOW_MS
      this.atOrAfter(deadline, () => {
        if (epoch === this.epoch && this.state?.phase === 'active')
          this.transition({ kind: 'deadline', atMs: performance.now() })
      })
    })
  }
  private monitorFrames(epoch: number) {
    this.frame(() => {
      if (epoch !== this.epoch || this.state?.phase !== 'active') return
      const now = performance.now()
      if (this.previousFrame !== null && now - this.previousFrame > 250 && this.visible()) {
        this.invalidate('frame_gap'); return
      }
      this.previousFrame = now
      this.monitorFrames(epoch)
    })
  }
  private presentEnd() {
    if (this.host.dataset.phase === 'end') return
    this.host.textContent = 'END'
    this.host.dataset.phase = 'end'
    const epoch = this.epoch
    this.atOrAfter(this.state!.logicalEndMs! + 250, () => {
      if (epoch === this.epoch && this.state?.phase === 'await_end') this.invalidate('end_timeout')
    })
    this.frame(() => {
      if (epoch !== this.epoch || this.state?.phase !== 'await_end') return
      if (!this.visible()) { this.invalidate('hidden'); return }
      this.transition({ kind: 'end', atMs: performance.now() })
      if ((this.state as State | null)?.phase !== 'late') return
      this.publish()
      const closeAt = this.state.endOnsetMs! + LATE_MS
      this.atOrAfter(closeAt, () => {
        if (epoch === this.epoch && this.state?.phase === 'late')
          this.transition({ kind: 'close', atMs: performance.now() })
        if (this.state?.phase === 'completed') void this.finish()
      })
    })
  }
  private bind(selectedKey: string) {
    this.listen(window, 'keydown', event => {
      const key = event as KeyboardEvent
      if (key.code !== selectedKey || !this.state || this.finishing) return
      key.preventDefault()
      const chord = key.altKey || key.ctrlKey || key.metaKey || key.shiftKey || key.isComposing
      this.transition({ kind: 'keydown', atMs: performance.now(), repeat: key.repeat, trusted: key.isTrusted && !chord })
    }, true)
    this.listen(window, 'keyup', event => {
      const key = event as KeyboardEvent
      if (key.code !== selectedKey || !this.state || this.finishing) return
      key.preventDefault()
      this.transition({ kind: 'keyup', atMs: performance.now(), trusted: key.isTrusted })
    }, true)
    this.listen(document, 'visibilitychange', () => { if (document.visibilityState !== 'visible') this.invalidate('hidden') })
    this.listen(window, 'blur', () => this.invalidate('blur'))
    this.listen(window, 'pagehide', () => this.invalidate('navigation'))
    this.listen(document, 'freeze', () => this.invalidate('freeze'))
    this.listen(window, 'resize', () => { if (!this.visible()) this.invalidate('resize') })
  }
  private async settleWithin<T>(work: Promise<T>, timeoutMs = 2_000): Promise<T | null> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        work.catch(() => null),
        new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), timeoutMs) }),
      ])
    } finally { if (timeout) clearTimeout(timeout) }
  }
  private async saveAndConfirm(state: State): Promise<boolean> {
    await this.settleWithin(this.store.saveCompleted(state, Date.now()))
    return !!await this.settleWithin(this.store.confirmCompleted(state))
  }
  private recordUsage(state: State, saved: boolean) {
    if (!saved) return
    const summary = report(state)
    if (!summary) return
    this.usage.finish(state.setup.sessionId, summary.status === 'valid' ? 'completed' : summary.status, () => ({ accepted: summary.acceptedCount, target: summary.targetCount, target_reached: Number(summary.targetReached) }))
  }
  private async finish() {
    if (!this.state || this.finishing) return
    this.finishing = true
    this.cleanup()
    this.status = 'pending'; this.message = 'Saving this attempt in this browser.'; this.publish()
    const state = this.state, epoch = this.epoch
    const saved = await this.saveAndConfirm(state)
    if (epoch !== this.epoch) return
    this.status = saved ? 'saved' : 'unsaved'
    this.message = saved ? 'This attempt was saved in this browser.' : 'This attempt is retained only in this tab. Saving could not be confirmed.'
    this.publish()
    this.recordUsage(state, saved)
  }
  async retrySave() {
    if (this.status !== 'unsaved' || !this.state || this.retries >= 1) return
    this.retries++
    const state = this.state, epoch = this.epoch
    this.status = 'pending'; this.publish()
    const saved = await this.saveAndConfirm(state)
    if (epoch !== this.epoch) return
    this.status = saved ? 'saved' : 'unsaved'
    this.message = saved ? 'This attempt was saved in this browser.' : 'Saving could not be confirmed. Keep this tab open to review the attempt.'
    this.publish()
    this.recordUsage(state, saved)
  }
  async dispose() {
    this.usage.cancel()
    if (!this.state) { this.epoch++; this.cleanup(); return }
    if (!['invalid', 'completed'].includes(this.state.phase) && !this.finishing) this.invalidate('navigation')
    this.epoch++
    this.cleanup()
  }
}
