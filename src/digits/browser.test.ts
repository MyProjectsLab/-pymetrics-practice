import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DigitsBrowserRun } from './browser'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { DigitsBackend, DigitsRoot, ArmRequest } from './storage'
import { loadDigitsForms } from './forms'
import { visual } from './test-support'
class Backend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T) {
    const draft = structuredClone(this.root); const result = operation(draft); this.root = draft
    return structuredClone(result)
  }
}
const request: ArmRequest = { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
  profile: visual, route: 'standalone', atMs: 0, wallMs: 1 }
let stimulus: HTMLDivElement, entry: HTMLInputElement, retired: string[]
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  let tail = Promise.resolve()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name: string, _options: unknown, work: () => Promise<unknown>) => {
      const next = tail.then(work); tail = next.then(() => undefined, () => undefined); return next
    },
  } })
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ display: 'block', visibility: 'visible', opacity: '1', contentVisibility: 'visible' } as CSSStyleDeclaration)
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1280 })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: 1280 })
  stimulus = document.createElement('div'); entry = document.createElement('input')
  document.body.replaceChildren(stimulus, entry)
  stimulus.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 200, width: 200, height: 100 } as DOMRect)
  entry.getBoundingClientRect = () => ({ left: 100, top: 300, right: 300, bottom: 350, width: 200, height: 50 } as DOMRect)
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (_x: number, y: number) => y > 200 ? entry : stimulus })
  retired = []
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
async function setup(profile = visual) {
  const backend = new Backend(), forms = await loadDigitsForms()
  const store = new DigitsStore(backend, backend.root.installationId, forms)
  const arm = await store.arm({ ...request, profile })
  const run = new DigitsBrowserRun(arm, store, { stimulus: () => stimulus, entry: () => entry,
    keypad: () => null, showEntry: () => {}, hideEntry: () => {}, onState: () => {},
    onRetired: reason => retired.push(reason) })
  return { backend, store, arm, run }
}
async function toEntry(run: DigitsBrowserRun) {
  const result = run.runTrial()
  await vi.advanceTimersByTimeAsync(5200)
  expect(run.state.phase).toBe('entry')
  return { result }
}
describe('Digits browser controller ordered observation boundaries', () => {
  it('requires exact verified checkpoint before Next; feedback remains protected', async () => {
    const { run, store, arm } = await setup()
    const { result } = await toEntry(run)
    run.edit(run.state.target!, false); run.resolve('submit'); await result
    expect(run.state.phase).toBe('feedback'); expect(run.protected).toBe(true)
    run.invalidate('blur')
    expect(run.state.phase).toBe('invalid'); expect(run.state.closed).toHaveLength(1)
    expect(run.state.events.at(-1)?.type).toBe('invalidated')
    await store.save(arm, run.state)
  })
  it.each([20000, 35000] as const)('keeps a new answer open beyond the old %sms limit', async entryWindow => {
    const { run } = await setup({ ...visual, entryWindow })
    const { result } = await toEntry(run)
    await vi.advanceTimersByTimeAsync(40000)
    expect(run.state.phase).toBe('entry')
    expect(run.state.entryDeadlineMs).toBeNull()
    expect(run.state.closed).toHaveLength(0)
    run.edit(run.state.target!, false); run.resolve('submit'); await result
    expect(run.state.closed[0]).toMatchObject({ exactCorrect: true, timedOut: false, skipped: false })
  })
  it('an unverified checkpoint cannot present a successor target', async () => {
    const { run } = await setup()
    const { result } = await toEntry(run)
    run.resolve('submit'); await result
    await run.runTrial()
    expect(run.state.phase).toBe('invalid')
    expect(run.state.presentedTrials).toBe(1)
    expect(run.state.trialIndex).toBe(1)
  })
  it('verified Next presents trial two under the same deletion order', async () => {
    const { run, store, arm } = await setup()
    const { result } = await toEntry(run)
    run.edit(run.state.target!, false); run.resolve('submit'); await result
    await store.save(arm, run.state)
    const next = run.runTrial()
    await vi.advanceTimersByTimeAsync(600)
    expect(run.state.trialIndex).toBe(2)
    expect(run.state.presentedTrials).toBe(2)
    expect(stimulus.textContent).toHaveLength(1)
    run.invalidate('candidate_ended'); await next
  })
  it('deletion first retires Start with zero exposure and no invented invalidation', async () => {
    const { run, store, arm } = await setup()
    await store.deleteAttempt(arm.sessionId)
    await run.runTrial()
    expect(run.state.presentedTrials).toBe(0)
    expect(run.state.events.some(e => e.type === 'invalidated')).toBe(false)
    expect(retired).toHaveLength(1)
    expect(run.protected).toBe(false)
  })
  it('Next first confirms first onset before ordered deletion; deletion first blocks Next', async () => {
    const { run, store, arm } = await setup()
    const { result } = await toEntry(run)
    run.resolve('submit'); await result; await store.save(arm, run.state)
    const next = run.runTrial()
    const deletion = store.deleteAttempt(arm.sessionId)
    await vi.advanceTimersByTimeAsync(600)
    await deletion
    expect(run.state.presentedTrials).toBe(2)
    expect(await store.load(arm.sessionId)).toBeNull()
    run.retire(); await next
  })
  it('held admission plus blur invalidates the committed arm and fences late first onset', async () => {
    const { run, store } = await setup()
    const original = store.load.bind(store)
    let release!: () => void
    vi.spyOn(store, 'load').mockImplementation(async (...args) => {
      const read = await original(...args)
      await new Promise<void>(resolve => { release = resolve }); return read
    })
    const pending = run.runTrial()
    await vi.advanceTimersByTimeAsync(1)
    run.invalidate('blur'); release(); await pending
    await vi.advanceTimersByTimeAsync(3000)
    expect(run.state.phase).toBe('invalid')
    expect(run.state.presentedTrials).toBe(0)
    expect(stimulus.textContent).toBe('')
  })
  it('missing initial frame watchdog invalidates without a fabricated onset', async () => {
    const { run } = await setup()
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    const pending = run.runTrial()
    await vi.advanceTimersByTimeAsync(2100); await pending
    expect(run.state.phase).toBe('invalid')
    expect(run.state.invalidReason).toBe('visual_frame_watchdog')
    expect(run.state.presentedTrials).toBe(0)
  })
  it('canceled visual and entry callbacks cannot advance a retired attempt', async () => {
    const { run } = await setup()
    const pending = run.runTrial(); await vi.advanceTimersByTimeAsync(40)
    const before = run.state.presentedTrials
    run.retire(); await pending; await vi.advanceTimersByTimeAsync(30000)
    expect(run.state.presentedTrials).toBe(before)
    expect(run.state.closed).toHaveLength(0)
    expect(stimulus.textContent).toBe('')
  })
  it('records the due digit confirmation before a same-frame foreground-gap invalidation', async () => {
    const { run } = await setup()
    let frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const pending = run.runTrial()
    await vi.advanceTimersByTimeAsync(0)
    async function draw(afterMs: number) {
      await vi.advanceTimersByTimeAsync(afterMs)
      const current = frames; frames = []
      current.forEach(callback => callback(performance.now()))
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    }
    for (let i = 0; i < 83; i++) await draw(16)
    expect(run.state.phase).toBe('presentation')
    expect(run.state.digitIndex).toBe(1)
    expect(run.state.digitOnsetMs).toBeNull()
    // The second digit is written at its due time, then both rAF observers run after a severe gap.
    await draw(300)
    await vi.advanceTimersByTimeAsync(0); await pending
    expect(run.state.phase).toBe('invalid')
    expect(run.state.events.filter(e => e.type === 'digit_presented')).toHaveLength(2)
    expect(run.state.events.at(-1)?.type).toBe('invalidated')
  })

  it.each(['start_missing', 'end_missing', 'cancel_then_late'] as const)(
    'fences local voice callbacks at %s without acoustic claims', async kind => {
      const voice = { voiceURI: 'local-test', lang: 'en-US', localService: true }
      let utterance: SpeechSynthesisUtterance | null = null
      vi.stubGlobal('SpeechSynthesisUtterance', class {
        text: string; voice: unknown = null; rate = 1; pitch = 1
        onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null
        constructor(text: string) { this.text = text }
      })
      vi.stubGlobal('speechSynthesis', { getVoices: () => [voice], cancel: () => {},
        speak: (value: SpeechSynthesisUtterance) => { utterance = value } })
      const { run } = await setup({ ...visual, mode: 'auditory', voice: { ...voice, localService: true } })
      const pending = run.runTrial()
      await vi.advanceTimersByTimeAsync(600)
      expect(utterance).not.toBeNull()
      const spoken = utterance! as SpeechSynthesisUtterance
      const startCallback = spoken.onstart!, endCallback = spoken.onend!
      if (kind === 'start_missing') await vi.advanceTimersByTimeAsync(2100)
      else if (kind === 'end_missing') {
        startCallback.call(spoken, {} as SpeechSynthesisEvent)
        await vi.advanceTimersByTimeAsync(4100)
      } else {
        run.invalidate('voice_changed')
        startCallback.call(spoken, {} as SpeechSynthesisEvent)
        endCallback.call(spoken, {} as SpeechSynthesisEvent)
      }
      await pending
      expect(run.state.phase).toBe('invalid')
      expect(run.state.presentedTrials).toBe(kind === 'end_missing' ? 1 : 0)
      expect(run.state.closed).toHaveLength(0)
    })

})
