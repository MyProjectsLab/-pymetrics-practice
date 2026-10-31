import { describe, expect, it } from 'vitest'
import { PreparationTrail } from './PreparationTrail'

describe('previous preparation screen', () => {
  it('returns to the visited screen, including optional examples and skipped steps', () => {
    const trail = new PreparationTrail(['guide', 'example', 'quiz', 'ready'])
    trail.enter('guide'); trail.enter('example'); trail.enter('quiz'); trail.enter('ready')
    expect(trail.back()).toBe('quiz')
    trail.enter('quiz')
    expect(trail.back()).toBe('example')
    trail.enter('example')
    expect(trail.back()).toBe('guide')
    expect(trail.back()).toBe(null)
    trail.enter('ready')
    expect(trail.back()).toBe('guide')
  })

  it('clears the trail when play, history or an attempt begins', () => {
    for (const screen of ['play', 'history', 'opening']) {
      const trail = new PreparationTrail(['guide', 'quiz', 'ready'])
      trail.enter('guide'); trail.enter('quiz'); trail.enter('ready'); trail.enter(screen)
      expect(trail.back()).toBe(null)
      trail.enter('ready')
      expect(trail.back()).toBe(null)
    }
  })

  it('keeps the previous screen across transient preparation loading', () => {
    const trail = new PreparationTrail(['guide', 'quiz', 'ready'])
    trail.enter('guide'); trail.enter('quiz'); trail.enter('pending'); trail.enter('ready')
    expect(trail.back()).toBe('quiz')
  })

  it('does not add duplicate screens on re-render and supports question/example checkpoints', () => {
    const trail = new PreparationTrail(['guide', 'question:go', 'question:no-go'])
    trail.enter('guide'); trail.enter('question:go'); trail.enter('question:go'); trail.enter('question:no-go')
    expect(trail.back()).toBe('question:go')
    trail.enter('question:go')
    expect(trail.back()).toBe('guide')
  })
})
