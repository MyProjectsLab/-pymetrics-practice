import { expect, it } from 'vitest'
import { money } from './format'

it.each([[0, '$0.00'], [5, '$0.05'], [75, '$0.75'], [160, '$1.60'], [-75, '-$0.75']])(
  'formats stored integer cents %i as %s without changing the value', (cents, expected) => {
    expect(money(cents as number)).toBe(expected)
  },
)
