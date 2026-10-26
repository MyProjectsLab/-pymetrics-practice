// @vitest-environment node
import { expect, it } from 'vitest'
import { createMemoryExposureRepository } from './exposure'

it('S50–S52: 30-minute retest reservation does not renew, releases before exposure, consumes confirmed onset, and exhausts four forms', () => {
  const repository = createMemoryExposureRepository()
  const start = 10_000
  const first = repository.reserve('first', () => 0, 'retest', start + 1_800_000)!
  expect(repository.reserve('first', () => .9, 'retest', start + 2_000_000)?.id).toBe(first.id)
  expect(repository.reservation('first', start + 1_799_999)?.form.id).toBe(first.id)
  expect(repository.reservation('first', start + 1_800_000)).toBeNull()
  repository.release('first')
  expect(repository.snapshot()).toEqual([])
  expect(repository.reserve('second', () => 0, 'retest', start + 1_800_000)?.id).toBe(first.id)
  repository.expose('second', start + 1_800_001) // Actual confirmation retains consumption even in an expiry race.
  expect(repository.snapshot().map(marker => marker.formId)).toEqual([first.id])
  repository.release('second')
  for (let index = 0; index < 3; index++) {
    const session = `used-${index}`
    repository.reserve(session, () => 0, 'retest', start + 1_800_000)
    repository.expose(session, start + index)
    repository.release(session)
  }
  expect(repository.snapshot()).toHaveLength(4)
  expect(repository.reserve('exhausted', () => 0, 'retest', start + 1_800_000)).toBeNull()
  expect(repository.reserve('replay', () => 0, 'replay')).not.toBeNull()
})
