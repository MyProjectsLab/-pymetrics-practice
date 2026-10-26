import type { StopTrialDefinition } from '../contracts'
import type { EngineEvent, FrameRequest } from './contracts'
import { createStopEngine } from './engine'

/** Synthetic scheduler only. It makes no statement about browser frame or timer accuracy. */
export function fixture(options: {
  phase?: StopTrialDefinition['phase']; stimuli?: StopTrialDefinition['stimulus'][];
  held?: boolean; key?: string; frameDelay?: (request: FrameRequest) => number;
  autoStart?: boolean; sequenceOffset?: number;
} = {}) {
  let time = 0
  let serial = 0
  const events: EngineEvent[] = []
  const queue: { id: number; time: number; callback: () => void; canceled: boolean }[] = []
  const confirmations: { request: FrameRequest; confirm: () => void }[] = []
  function enqueue(at: number, callback: () => void) {
    const job = { id: ++serial, time: at, callback, canceled: false }
    queue.push(job)
    return () => { job.canceled = true }
  }
  const engine = createStopEngine({
    sessionId: 'synthetic-session', sequenceOffset: options.sequenceOffset, responseKey: options.key ?? ' ', clock: () => time,
    scheduler: { at: enqueue, after: (at, callback) => enqueue(at + 0.001, callback) },
    frames: { request: (request, confirm) => {
      confirmations.push({ request, confirm })
      return enqueue(request.notBeforeMs + (options.frameDelay?.(request) ?? 0), confirm)
    } },
    sink: event => events.push(event),
  })
  const definitions = (options.stimuli ?? ['GO']).map((stimulus, index) => ({ phase: options.phase ?? 'scored', stimulus, index }))
  engine.begin({ responseKeyHeld: options.held })
  if (options.autoStart !== false) engine.start(definitions)
  return {
    engine, events, definitions, confirmations,
    setTime: (value: number) => { time = value },
    advance(target: number) {
      if (target < time) throw new Error('Use setTime for intentionally broken clocks')
      for (;;) {
        const next = queue.filter(j => !j.canceled && j.time <= target).sort((a, b) => a.time - b.time || a.id - b.id)[0]
        if (!next) break
        next.canceled = true
        time = Math.max(time, next.time)
        next.callback()
      }
      time = target
    },
    press(at: number, key = options.key ?? ' ', repeat = false) {
      this.advance(at); engine.keyDown(key, repeat)
    },
    release(at: number, key = options.key ?? ' ') {
      this.advance(at); engine.keyUp(key)
    },
    ofType<K extends EngineEvent['type']>(type: K) {
      return events.filter((e): e is Extract<EngineEvent, { type: K }> => e.type === type)
    },
  }
}
