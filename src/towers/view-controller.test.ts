import { describe, expect, it } from 'vitest'
import { TowersViewSession } from './view-controller'

describe('Towers view authority', () => {
  it('retires old success, error, fallback and focus tickets on navigation', () => {
    const view = new TowersViewSession<'history' | 'report' | 'guide' | 'example'>('history')
    const held = view.choose('report')
    const guide = view.choose('guide')
    expect(view.current(held)).toBe(false)
    expect(view.current(guide)).toBe(true)
    const example = view.choose('example')
    expect(view.current(guide)).toBe(false)
    expect(view.current(example)).toBe(true)
  })
})
