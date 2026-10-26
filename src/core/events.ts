export type RecordedEvent<Payloads, Version extends string> = {
  [K in keyof Payloads & string]: Readonly<{
    schemaVersion: Version
    sessionId: string
    sequenceNumber: number
    timestampMs: number
    type: K
    payload: Payloads[K]
  }>
}[keyof Payloads & string]

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

/** One clock and one append-only, memory-only record per session stream. */
export function createEventRecorder<Payloads, Version extends string>(options: {
  sessionId: string
  schemaVersion: Version
  clock: () => number
  /** Continue an existing session stream without rewriting earlier immutable events. */
  sequenceOffset?: number
}) {
  const { sessionId, schemaVersion, clock, sequenceOffset = 0 } = options
  if (!Number.isSafeInteger(sequenceOffset) || sequenceOffset < 0 || sequenceOffset === Number.MAX_SAFE_INTEGER) throw new Error('Sequence offset must be a non-negative safe integer')
  if (!sessionId.trim()) throw new Error('A session identifier is required')
  const events: RecordedEvent<Payloads, Version>[] = []
  let lastTimestamp = -Infinity
  return Object.freeze({
    sessionId,
    record<K extends keyof Payloads & string>(type: K, payload: Payloads[K]) {
      if (!Number.isSafeInteger(sequenceOffset + events.length + 1)) throw new Error('Event sequence exhausted')
      const timestampMs = clock()
      if (!Number.isFinite(timestampMs) || timestampMs < 0 || timestampMs < lastTimestamp) {
        throw new Error('Event clock must be finite, non-negative, and monotonic')
      }
      // Copy first: callers cannot alter the record through retained references.
      const event = freeze({
        schemaVersion,
        sessionId,
        sequenceNumber: sequenceOffset + events.length + 1,
        timestampMs,
        type,
        payload: structuredClone(payload),
      }) as RecordedEvent<Payloads, Version>
      events.push(event)
      lastTimestamp = timestampMs
      return event
    },
    snapshot: (): readonly RecordedEvent<Payloads, Version>[] => Object.freeze([...events]),
  })
}
