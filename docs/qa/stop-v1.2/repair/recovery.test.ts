// @vitest-environment node
// Captured real-browser/IndexedDB regression, not a fresh browser run.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { verifyCompletedResult } from '../../../../src/stop/run'
import { inspectLocalState } from '../../../../src/stop/storage'
import type { StopLocalState } from '../../../../src/stop/storage'

it('admits the unchanged durable result and interrupted-warm-up diagnostics after real reload', () => {
  const read = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL(`./${name}.json.gz`, import.meta.url))).toString()) as { state: StopLocalState }
  const before = read('before-reload'), after = read('after-reload')
  const id = '9c4144b0-6c5c-4b1f-aab6-0138ba41b726'
  const result = before.state.results[id], restored = after.state.results[id]
  expect(JSON.stringify(restored)).toBe(JSON.stringify(result))
  expect(createHash('sha256').update(JSON.stringify(restored)).digest('hex')).toBe('975998c8636ba647e08f9c5229e6d08ecc196eccad48e041497f1d1699aabbfe')
  expect(restored.storageMode).toBe('persistent_local')
  expect(restored.validity).toBe('valid')
  expect(verifyCompletedResult(restored)).toBe(true)
  expect(inspectLocalState(after.state).valid.find(item => item.sessionId === id)).toEqual(restored)
  const interrupted = restored.events.filter(event => event.type === 'warmup_interrupted')
  expect(interrupted).toHaveLength(1)
  expect(interrupted[0].payload).toEqual({ reason: 'hidden', triggerSequenceNumber: 27 })
  expect(restored.events.find(event => event.sequenceNumber === 27)).toMatchObject({ type: 'visibility_changed', payload: { visible: false } })
  expect(restored.events.find(event => event.type === 'warmup_restart_required')?.payload).toEqual({ triggerSequenceNumber: 28 })
  const restartedTrials = restored.events.filter(event => event.type === 'trial_scheduled' && event.sequenceNumber > 29 && event.payload.trial.phase === 'warmup')
  expect(restartedTrials.map(event => event.type === 'trial_scheduled' && event.payload.trial.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(restored.events.filter(event => event.type === 'trial_resolved' && event.sequenceNumber > 92)).toHaveLength(80)
  expect(restored.events.filter(event => event.type === 'session_invalidated')).toHaveLength(0)
  expect(restored.events.filter(event => event.type === 'timing_anomaly')).toHaveLength(0)
})
