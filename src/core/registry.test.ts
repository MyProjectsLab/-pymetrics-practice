// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRegistry } from './registry'

describe('read-only registry foundation', () => {
  it('indexes versioned data without allowing the registered data to change', () => {
    const registry = createRegistry([{ id: 'one', nested: { values: ['a'] } }])

    expect(registry.get('one')).toBe(registry.all[0])
    expect(registry.has('missing')).toBe(false)
    expect(Object.isFrozen(registry.all)).toBe(true)
    expect(Object.isFrozen(registry.get('one')?.nested.values)).toBe(true)
  })

  it('rejects duplicate or empty identifiers', () => {
    expect(() => createRegistry([{ id: 'same' }, { id: 'same' }])).toThrow()
    expect(() => createRegistry([{ id: '' }])).toThrow()
  })
})
