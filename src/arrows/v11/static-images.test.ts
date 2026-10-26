import { expect, it } from 'vitest'
import inventory from './static-images.json'
import forms from '../../../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_1.json'

it('independently reconciles all frozen trials to exact static row geometry, color and cue', async () => {
  expect(inventory).toHaveLength(13)
  const ids = new Set<string>()
  for (const artifact of inventory) {
    expect(ids.has(artifact.id)).toBe(false); ids.add(artifact.id)
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(artifact.svg)))].map(n => n.toString(16).padStart(2, '0')).join('')
    expect(digest).toBe(artifact.sha256)
    const xml = new DOMParser().parseFromString(artifact.svg, 'image/svg+xml')
    expect(xml.querySelector('parsererror')).toBeNull()
    expect([...xml.querySelectorAll('*')].every(node => ['svg', 'path'].includes(node.tagName))).toBe(true)
    expect(artifact.svg).not.toMatch(/(?:url\(|currentColor|<text|href=|<style|<animate|<script|<use|<image|<foreignObject)/)
    expect(xml.documentElement.getAttribute('viewBox')).toBe(`0 0 ${artifact.width} ${artifact.height}`)
    expect(xml.querySelector('path')?.getAttribute('fill')).toBe('#ffffff')
  }
  for (const form of forms.forms) for (const trial of form.trials) {
    const artifact = inventory.find(a => a.id === `${trial.color}-${trial.condition}-${trial.direction}`)!
    expect(artifact.cue).toBe(trial.color === 'red' ? 'SIDES' : 'MIDDLE')
    const paths = [...new DOMParser().parseFromString(artifact.svg, 'image/svg+xml').querySelectorAll('path')].slice(-5)
    const opposite = trial.direction === 'left' ? 'right' : 'left'
    const symbols = paths.map((path, index) => {
      const target = trial.color === 'red' ? index !== 2 : index === 2
      const expected = target || trial.condition === 'aligned' ? trial.direction : trial.condition === 'neutral' ? 'bar' : opposite
      const x = 8 + index * 72, d = path.getAttribute('d')!
      const geometry = expected === 'bar' ? `M${x + 8} 72H${x + 40}` : expected === 'left' ? `M${x + 40} 72H${x + 8}M${x + 22} 58L${x + 8} 72L${x + 22} 86` : `M${x + 8} 72H${x + 40}M${x + 26} 58L${x + 40} 72L${x + 26} 86`
      expect(d).toBe(geometry)
      expect(path.getAttribute('stroke')).toBe({ red: '#b11f2f', blue: '#184dab', black: '#171717' }[trial.color])
      expect(path.getAttribute('stroke-width')).toBe('4')
      return expected
    })
    expect(artifact.symbols).toEqual(symbols)
  }
})
