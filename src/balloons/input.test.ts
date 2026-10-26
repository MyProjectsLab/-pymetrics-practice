import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installButtonInput } from './input'
let root: HTMLDivElement, pump: HTMLButtonElement, collect: HTMLButtonElement, adapter: ReturnType<typeof installButtonInput>
let sources: (string | null)[], paused = false
beforeEach(() => {
  root = document.createElement('div'); root.innerHTML = '<button data-control="pump">Pump</button><button data-control="collect">Collect</button>'
  document.body.append(root); [pump, collect] = [...root.querySelectorAll('button')]; sources = []; paused = false
  adapter = installButtonInput(root, () => paused)
  root.addEventListener('click', e => sources.push(adapter.source(e)))
})
afterEach(() => { adapter.dispose(); root.remove() })
function key(target: HTMLElement, type: string, key: string, repeat = false) { const e = new KeyboardEvent(type, { bubbles: true, cancelable: true, key, code: key === ' ' ? 'Space' : 'Enter', repeat }); target.dispatchEvent(e); return e }
function click(target = pump, detail = 0) { const e = new MouseEvent('click', { bubbles: true, cancelable: true, detail }); target.dispatchEvent(e); return e }
describe('capture guard (synthetic classification/suppression; browser defaults tested separately)', () => {
  it.each([' ', 'Enter'])('keeps first %s default; suppresses repeats and focus-change release', k => {
    pump.focus(); expect(key(pump, 'keydown', k).defaultPrevented).toBe(false)
    if (k === 'Enter') { click(); expect(sources).toEqual(['keyboard']) }
    expect(key(pump, 'keydown', k, true).defaultPrevented).toBe(true)
    collect.focus(); expect(key(collect, 'keyup', k).defaultPrevented).toBe(true)
    click(collect); expect(sources.length).toBe(k === 'Enter' ? 1 : 0)
  })
  it('normal Space keyup click is classified and a following unknown click remains accepted', async () => {
    key(pump, 'keydown', ' '); key(pump, 'keyup', ' '); await Promise.resolve(); click()
    expect(sources).toEqual(['keyboard']); await Promise.resolve(); click(); expect(sources).toEqual(['keyboard', 'unknown_or_assistive'])
  })
  it('unknown click is accepted exactly once per event object', () => {
    const e = click(); expect(sources).toEqual(['unknown_or_assistive']); expect(adapter.source(e)).toBeNull()
  })
  it.each(['mouse', 'touch', 'pen', ''])('best supported pointer source %s', pointerType => {
    const e = new Event('pointerdown', { bubbles: true }); Object.defineProperty(e, 'pointerType', { value: pointerType }); pump.dispatchEvent(e)
    click(pump, 1); expect(sources).toEqual([pointerType === 'mouse' ? 'mouse' : pointerType ? 'touch_or_pen' : 'unknown_or_assistive'])
  })
  it('blur cancels held cycle until release and a fresh press', async () => {
    key(pump, 'keydown', ' '); window.dispatchEvent(new Event('blur'))
    expect(key(pump, 'keyup', ' ').defaultPrevented).toBe(true); await Promise.resolve()
    expect(key(pump, 'keydown', ' ').defaultPrevented).toBe(false); key(pump, 'keyup', ' '); click()
    expect(sources).toEqual(['keyboard'])
  })
  it('pending write accepts no click or inherited key activation', () => {
    paused = true; expect(key(pump, 'keydown', 'Enter').defaultPrevented).toBe(true); click(); expect(sources).toEqual([])
    const pointerClick = click(pump, 1); expect(adapter.source(pointerClick)).toBeNull()
  })
})

it('pending gameplay writes preserve first native activation on navigation buttons', () => {
  const back = document.createElement('button'); root.append(back); paused = true
  expect(key(back, 'keydown', 'Enter').defaultPrevented).toBe(false)
  expect(key(back, 'keyup', 'Enter').defaultPrevented).toBe(false)
})

it('Space release evidence expires and cannot label a later unknown activation', async () => {
  key(pump, 'keydown', ' '); key(pump, 'keyup', ' ')
  await new Promise(resolve => setTimeout(resolve, 10)); click()
  expect(sources).toEqual(['unknown_or_assistive'])
})
it('Enter release after its first click cannot label a second unclassified click', async () => {
  key(pump, 'keydown', 'Enter'); click(); key(pump, 'keyup', 'Enter')
  await Promise.resolve(); click()
  expect(sources).toEqual(['keyboard', 'unknown_or_assistive'])
})
