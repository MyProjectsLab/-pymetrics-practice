import { advanceDigits, currentDigitsTrial } from './engine'
import type { Command, RunState, VoiceIdentity } from './contracts'
import { sameDigitsVoice, selectDigitsVoice } from './voice'
import type { DigitsAttempt, DigitsStore } from './storage'
import { DIGITS_DATA_LOCK } from './storage'

const SPOKEN: Readonly<Record<string, string>> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Digits browser: ${reason}`)
}
function visible(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.isConnected) return false
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility !== 'visible' ||
      Number(style.opacity) === 0 || style.contentVisibility === 'hidden') return false
  }
  const rect = element.getBoundingClientRect()
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
  const width = viewport?.width ?? document.documentElement.clientWidth
  const height = viewport?.height ?? document.documentElement.clientHeight
  if (rect.width < 1 || rect.height < 1 || rect.left < left || rect.top < top ||
    rect.right > left + width || rect.bottom > top + height ||
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) return false
  const cover = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  return !!cover && (element === cover || element.contains(cover))
}
export interface DigitsBrowserHooks {
  readonly stimulus: () => HTMLElement | null
  readonly entry: () => HTMLElement | null
  readonly keypad: () => HTMLElement | null
  readonly controls?: () => HTMLElement | null
  readonly showEntry: () => void
  readonly hideEntry: () => void
  readonly onState: (state: RunState) => void
  readonly onRetired: (reason: string) => void
}
/** Only the user gesture and confirmed browser observations drive the pure engine. */
export class DigitsBrowserRun {
  private current: RunState
  private epoch = 0
  private pending = new Set<(reason: Error) => void>()
  private entryResolver: (() => void) | null = null
  private entryTimer: number | null = null
  private frameMonitor: number | null = null
  private lastFrame: number | null = null
  private observedFrameGap = false
  private disposed = false
  private running = false
  readonly arm: DigitsAttempt
  readonly store: DigitsStore
  readonly hooks: DigitsBrowserHooks
  constructor(arm: DigitsAttempt, store: DigitsStore,
    hooks: DigitsBrowserHooks) {
    this.arm = arm; this.store = store; this.hooks = hooks
    this.current = arm.arm
    hooks.stimulus()?.setAttribute('aria-hidden', 'true')
    if (hooks.stimulus()) hooks.stimulus()!.textContent = ''
  }
  get state() { return this.current }
  get protected() { return !this.disposed && this.current.phase !== 'invalid' && this.current.phase !== 'completed' }
  private emit(next: RunState) { this.current = next; this.hooks.onState(next) }
  private advance(command: Command) {
    const frameObservation = command.kind === 'visual_onset' || command.kind === 'visual_offset' || command.kind === 'entry_opened'
    if (this.observedFrameGap && !frameObservation) {
      this.observedFrameGap = false; this.invalidate('foreground_frame_gap'); return
    }
    this.emit(advanceDigits(this.current, command))
    if (this.observedFrameGap) {
      this.observedFrameGap = false; this.invalidate('foreground_frame_gap')
    }
  }
  private active(epoch: number) { assert(!this.disposed && epoch === this.epoch &&
    this.current.phase !== 'invalid' && this.current.phase !== 'completed', 'callback canceled') }
  private cancelPending(reason: string) {
    this.epoch++; this.observedFrameGap = false
    const error = Error(reason)
    for (const reject of [...this.pending]) reject(error)
    this.pending.clear()
    if (this.entryTimer !== null) clearTimeout(this.entryTimer)
    this.entryTimer = null
    this.entryResolver?.()
    this.entryResolver = null
    if (this.frameMonitor !== null) cancelAnimationFrame(this.frameMonitor)
    this.frameMonitor = null
    if (this.hooks.stimulus()) this.hooks.stimulus()!.textContent = ''
    this.hooks.hideEntry()
    if (this.current.profile.mode === 'auditory' && 'speechSynthesis' in window)
      speechSynthesis.cancel()
  }
  invalidate(reason: string) {
    if (this.disposed || !this.protected) return
    this.advance({ kind: 'invalidate', atMs: performance.now(), reason })
    this.cancelPending(reason)
  }
  retire() { this.disposed = true; this.cancelPending('retired') }
  dispose() {
    if (this.protected) this.invalidate('page_exit')
    this.disposed = true
    this.cancelPending('disposed')
  }
  private admitted() {
    assert(document.visibilityState === 'visible' && document.hasFocus(), 'page not active')
    assert(visible(this.hooks.stimulus()), 'stimulus not visible')
    assert(visible(this.hooks.entry()), 'entry footprint not visible')
    if (this.hooks.controls) assert(visible(this.hooks.controls()), 'entry controls not visible')
  }
  private monitorFrames() {
    this.lastFrame = null
    const epoch = this.epoch
    const tick = (atMs: number) => {
      if (epoch !== this.epoch || !this.protected ||
        (this.current.phase !== 'presentation' && this.current.phase !== 'entry')) return
      if (this.lastFrame !== null && atMs - this.lastFrame > 250) {
        // A confirmed stage in this rendering turn records its factual exposure first.
        // Every answer handler is fenced immediately; the fallback runs after frame callbacks.
        this.observedFrameGap = true
        window.setTimeout(() => { if (epoch === this.epoch && this.protected && this.observedFrameGap) {
          this.observedFrameGap = false; this.invalidate('foreground_frame_gap')
        } }, 0)
      }
      this.lastFrame = atMs
      this.frameMonitor = requestAnimationFrame(tick)
    }
    this.frameMonitor = requestAnimationFrame(tick)
  }
  private async sleepUntil(dueMs: number, epoch: number) {
    this.active(epoch)
    await new Promise<void>((resolve, reject) => {
      let timer: number | undefined
      const cancel = (error: Error) => { if (timer !== undefined) clearTimeout(timer)
        this.pending.delete(cancel); reject(error) }
      const check = () => {
        if (epoch !== this.epoch) { cancel(Error('callback canceled')); return }
        const remaining = dueMs - performance.now()
        if (remaining <= 0) { this.pending.delete(cancel); resolve() }
        else timer = window.setTimeout(check, Math.min(remaining, 1000))
      }
      this.pending.add(cancel)
      check()
    })
    this.active(epoch)
  }
  private async confirmFrame(dueMs: number, check: () => boolean, epoch: number) {
    this.active(epoch)
    const deadline = dueMs + 2000
    return new Promise<number>((resolve, reject) => {
      let frame = 0, watchdog = 0, settled = false
      const clear = () => { cancelAnimationFrame(frame); clearTimeout(watchdog); this.pending.delete(cancel) }
      const cancel = (error: Error) => { if (settled) return; settled = true; clear(); reject(error) }
      const fail = () => { if (settled || epoch !== this.epoch) return
        this.invalidate('visual_frame_watchdog'); cancel(Error('visual frame watchdog')) }
      this.pending.add(cancel)
      watchdog = window.setTimeout(fail, Math.max(0, deadline - performance.now()))
      frame = requestAnimationFrame(() => {
        if (settled || epoch !== this.epoch) return
        const now = performance.now()
        if (now >= deadline) { fail(); return }
        if (!check()) { this.invalidate('display_not_confirmed'); cancel(Error('display not confirmed')); return }
        settled = true; clear(); resolve(now)
      })
    })
  }
  private selectedVoice(identity: VoiceIdentity): SpeechSynthesisVoice {
    assert('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
      'speech synthesis unavailable')
    const voices = speechSynthesis.getVoices()
    assert(sameDigitsVoice(identity, voices), 'voice changed')
    const selected = selectDigitsVoice(voices, identity.voiceURI)
    assert(selected && selected.lang === identity.lang, 'selected voice unavailable')
    return selected as SpeechSynthesisVoice
  }
  private async speakCurrent(epoch: number) {
    const trial = currentDigitsTrial(this.current)
    const digit = trial.digits[this.current.digitIndex]
    const identity = this.current.profile.voice
    assert(identity, 'voice missing')
    await this.sleepUntil(this.current.nextDueMs!, epoch)
    const voice = this.selectedVoice(identity)
    const requestMs = performance.now()
    const utterance = new SpeechSynthesisUtterance(SPOKEN[digit])
    utterance.voice = voice; utterance.rate = 1; utterance.pitch = 1
    await new Promise<void>((resolve, reject) => {
      let startTimer = 0, endTimer = 0, settled = false, started = false
      const clear = () => { clearTimeout(startTimer); clearTimeout(endTimer); this.pending.delete(cancel)
        utterance.onstart = null; utterance.onend = null; utterance.onerror = null }
      const cancel = (error: Error) => { if (settled) return; settled = true; clear(); reject(error) }
      const fail = (reason: string) => { this.invalidate(reason); cancel(Error(reason)) }
      this.pending.add(cancel)
      startTimer = window.setTimeout(() => fail('speech_start_watchdog'), 2000)
      utterance.onstart = () => {
        if (settled || epoch !== this.epoch) return
        try { this.selectedVoice(identity); assert(utterance.voice === voice, 'utterance voice changed') }
        catch { fail('voice_changed'); return }
        const now = performance.now()
        if (now - requestMs > 2000) { fail('speech_start_watchdog'); return }
        clearTimeout(startTimer); started = true
        this.advance({ kind: 'speech_start', requestMs, atMs: now,
          voiceURI: identity.voiceURI, lang: identity.lang })
        endTimer = window.setTimeout(() => fail('speech_end_watchdog'), 4000)
      }
      utterance.onend = () => {
        if (settled || epoch !== this.epoch) return
        if (!started) { fail('speech_start_missing'); return }
        try { this.selectedVoice(identity); assert(utterance.voice === voice, 'utterance voice changed') }
        catch { fail('voice_changed'); return }
        const now = performance.now()
        if (now - this.current.speechStartMs! > 4000) { fail('speech_end_watchdog'); return }
        this.advance({ kind: 'speech_end', atMs: now,
          voiceURI: identity.voiceURI, lang: identity.lang })
        settled = true; clear(); resolve()
      }
      utterance.onerror = () => fail('speech_error')
      try { speechSynthesis.speak(utterance) } catch { fail('speech_request_failed') }
    })
  }
  private async visualOnset(epoch: number) {
    const trial = currentDigitsTrial(this.current)
    const index = this.current.digitIndex
    const dueMs = this.current.nextDueMs!
    await this.sleepUntil(dueMs, epoch)
    const stimulus = this.hooks.stimulus()
    assert(stimulus, 'stimulus detached')
    stimulus.textContent = trial.digits[index]
    const now = await this.confirmFrame(dueMs,
      () => visible(stimulus) && stimulus.textContent === trial.digits[index], epoch)
    this.advance({ kind: 'visual_onset', dueMs, atMs: now })
  }
  private async visualOffset(epoch: number) {
    const dueMs = this.current.nextDueMs!
    await this.sleepUntil(dueMs, epoch)
    const stimulus = this.hooks.stimulus()
    assert(stimulus, 'stimulus detached')
    stimulus.textContent = ''
    const now = await this.confirmFrame(dueMs,
      () => visible(stimulus) && !stimulus.textContent, epoch)
    this.advance({ kind: 'visual_offset', dueMs, atMs: now })
  }
  private async openEntry(epoch: number) {
    const dueMs = this.current.nextDueMs!
    await this.sleepUntil(dueMs, epoch)
    this.hooks.showEntry()
    const now = await this.confirmFrame(dueMs,
      () => visible(this.hooks.entry()) &&
        (!this.hooks.controls || visible(this.hooks.controls())) &&
        (this.current.profile.entryMethod !== 'keypad' || visible(this.hooks.keypad())), epoch)
    this.advance({ kind: 'entry_opened', dueMs, atMs: now })
    if (this.current.phase !== 'entry') return
    if (this.current.profile.entryMethod === 'keypad')
      document.querySelector<HTMLElement>('.digits-keypad button')?.focus({ preventScroll: true })
    else this.hooks.entry()?.focus({ preventScroll: true })
    await new Promise<void>(resolve => {
      this.entryResolver = resolve
      this.entryTimer = window.setTimeout(() => this.resolve('timeout'),
        Math.max(0, this.current.entryDeadlineMs! - performance.now()))
    })
    this.entryResolver = null
  }
  edit(value: string, assisted: boolean) {
    if (this.current.phase !== 'entry') return this.current.draft
    const trial = currentDigitsTrial(this.current)
    if (!/^[0-9]*$/.test(value) || value.length > trial.length) return this.current.draft
    this.advance({ kind: 'edit', atMs: performance.now(), value, assisted,
      source: assisted ? 'assisted' : this.current.profile.entryMethod })
    return this.current.draft
  }
  resolve(kind: 'submit' | 'skip' | 'timeout') {
    if (this.current.phase !== 'entry') return
    this.advance({ kind, atMs: performance.now() })
    if (this.entryTimer !== null) clearTimeout(this.entryTimer)
    this.entryTimer = null
    this.hooks.hideEntry()
    this.entryResolver?.()
    this.entryResolver = null
  }
  private async verifyAdmission() {
    this.admitted()
    const retained = await this.store.load(this.arm.sessionId)
    assert(retained && retained.requestId === this.arm.requestId &&
      retained.ordinal === this.arm.ordinal, 'arm authority changed')
    if (this.current.phase === 'feedback')
      assert(retained.snapshot && retained.snapshot.kind === 'checkpoint' &&
        JSON.stringify(retained.snapshot.state) === JSON.stringify(this.current),
      'checkpoint not confirmed')
    else assert(this.current.phase === 'armed', 'not ready')
    this.admitted()
  }
  /** Start/Next admission and the first observed digit share deletion order. */
  async runTrial(): Promise<RunState> {
    assert(!this.running && !this.disposed && 'locks' in navigator, 'run unavailable')
    this.running = true
    const epoch = this.epoch
    try {
      await navigator.locks.request(DIGITS_DATA_LOCK, { mode: 'exclusive' }, async () => {
        await this.verifyAdmission()
        const placeholderDueMs = performance.now()
        await this.confirmFrame(placeholderDueMs,
          () => visible(this.hooks.stimulus()) && visible(this.hooks.entry()), epoch)
        this.admitted()
        this.advance({ kind: this.current.phase === 'armed' ? 'start' : 'next',
          atMs: performance.now() })
        this.monitorFrames()
        if (this.current.profile.mode === 'visual') await this.visualOnset(epoch)
        else await this.speakCurrent(epoch)
      })
      while (this.current.phase === 'presentation' || this.current.phase === 'entry') {
        this.active(epoch)
        if (this.current.phase === 'presentation') {
          const trial = currentDigitsTrial(this.current)
          if (this.current.profile.mode === 'visual') {
            if (this.current.digitOnsetMs !== null) await this.visualOffset(epoch)
            if (this.current.phase === 'presentation' && this.current.digitIndex < trial.length)
              await this.visualOnset(epoch)
          } else if (this.current.speechStartMs === null &&
            this.current.digitIndex < trial.length) await this.speakCurrent(epoch)
          if (this.current.phase === 'presentation' &&
            this.current.digitIndex === trial.length &&
            this.current.digitOnsetMs === null && this.current.speechStartMs === null)
            await this.openEntry(epoch)
        }
      }
    } catch (error) {
      if (this.disposed || epoch !== this.epoch || this.current.phase === 'invalid' || this.current.phase === 'completed') {
        // Cancellation already captured its immutable terminal or retirement.
      } else if (/arm authority changed|installation replaced/.test(String(error))) {
        this.retire(); this.hooks.onRetired('This attempt was deleted or local data was replaced.')
      } else if (this.protected) this.invalidate(error instanceof Error ? error.message : 'technical')
      else throw error
    } finally {
      if (this.frameMonitor !== null) cancelAnimationFrame(this.frameMonitor)
      this.frameMonitor = null
      this.running = false
      if (this.hooks.stimulus()) this.hooks.stimulus()!.textContent = ''
      this.hooks.hideEntry()
    }
    return this.current
  }
}

export async function sampleDigitsVoice(identity: VoiceIdentity,
  onSample?: (digit: string) => void): Promise<boolean> {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false
  for (const digit of ['three', 'seven']) {
    const voices = speechSynthesis.getVoices()
    if (!sameDigitsVoice(identity, voices)) return false
    const voice = selectDigitsVoice(voices, identity.voiceURI) as SpeechSynthesisVoice
    const utterance = new SpeechSynthesisUtterance(digit)
    utterance.voice = voice; utterance.rate = 1; utterance.pitch = 1
    onSample?.(digit)
    const passed = await new Promise<boolean>(resolve => {
      let started = false, done = false
      const timer = window.setTimeout(() => finish(false), 6000)
      const finish = (value: boolean) => { if (done) return; done = true; clearTimeout(timer)
        utterance.onstart = null; utterance.onend = null; utterance.onerror = null
        if (!value) speechSynthesis.cancel()
        resolve(value) }
      utterance.onstart = () => { if (!sameDigitsVoice(identity, speechSynthesis.getVoices()) ||
        utterance.voice !== voice) finish(false); else started = true }
      utterance.onend = () => finish(started && sameDigitsVoice(identity, speechSynthesis.getVoices()) &&
        utterance.voice === voice)
      utterance.onerror = () => finish(false)
      try { speechSynthesis.speak(utterance) } catch { finish(false) }
    })
    if (!passed) return false
  }
  return true
}
