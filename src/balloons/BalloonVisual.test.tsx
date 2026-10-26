import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonIdentity } from './BalloonVisual'
import { BalloonsController } from './controller'
import type { RunView } from './controller'
import { BalloonsStore, freshRoot, WriteFailure } from './storage'
import type { Backend } from './storage'
import { loadScoredManifests } from './manifests'

beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('keeps three distinct readable identities as redundant colour and pattern cues', () => {
  const { container } = render(<>{(['Type 1', 'Type 2', 'Type 3'] as const).map(type => <BalloonIdentity key={type} type={type} />)}</>)
  expect([...container.querySelectorAll('.balloons-identity-label')].map(x => x.textContent)).toEqual(['Type 1BlueStripes', 'Type 2OrangeDots', 'Type 3YellowGrid'])
  const clips = [...container.querySelectorAll('clipPath')].map(x => x.id)
  expect(new Set(clips).size).toBe(3)
  expect(container.querySelectorAll('svg[aria-hidden="true"][focusable="false"]')).toHaveLength(3)
})

it('grows on every successful pump up to the cap, retaining size on either collection and resetting for the next balloon', () => {
  const view = render(<BalloonIdentity type="Type 1" />)
  const scale = () => Number(view.container.querySelector<SVGGElement>('[data-balloon-body]')!.style.transform.match(/scale\((.*)\)/)![1])
  const initial = scale(); let previous = initial
  for (let n = 1; n <= 32; n++) {
    view.rerender(<BalloonIdentity type="Type 1" successfulPumps={n} />)
    expect(scale()).toBeGreaterThan(previous); previous = scale()
  }
  for (const outcome of ['voluntary_collect', 'cap_collect'] as const) {
    view.rerender(<BalloonIdentity type="Type 1" successfulPumps={32} outcome={outcome} />)
    expect(scale()).toBe(previous); expect(view.container.querySelector('[data-balloon-burst]')).toBeNull()
  }
  view.rerender(<BalloonIdentity type="Type 2" successfulPumps={0} />)
  expect(scale()).toBe(initial)
})

it.each([0, 11])('renders a committed burst after %i successes without drawing an intact balloon', successfulPumps => {
  const { container } = render(<BalloonIdentity type="Type 3" successfulPumps={successfulPumps} outcome="burst" reducedMotion />)
  expect(container.querySelector('[data-balloon-body]')).toBeNull()
  expect(container.querySelectorAll('[data-balloon-burst] .balloon-shard')).toHaveLength(6)
  expect(container.querySelector('svg')?.getAttribute('data-motion')).toBe('reduced')
  expect(container.textContent).toBe('Type 3YellowGrid')
})

let frames: FrameRequestCallback[]
beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => Promise.resolve(callback({})) } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

it.each(['release', 'fail'] as const)('keeps the old balloon during a held real-controller action; %s never paints an unconfirmed action', async disposition => {
  let root = freshRoot(), held = false, release: (() => void) | undefined
  const backend: Backend = { read: async () => structuredClone(root), change: async operation => {
    const copy = structuredClone(root), result = operation(copy)
    if (held && Object.values(copy.records).at(-1)?.journal.at(-1)?.command?.kind === 'action') {
      await new Promise<void>(resolve => { release = resolve })
      if (disposition === 'fail') throw new WriteFailure('test write failure')
    }
    copy.revision++; root = structuredClone(copy); return structuredClone(result)
  } }
  const store = new BalloonsStore(backend, root.installationId)
  const view = render(<div />)
  const paint = (value: RunView) => {
    const c = value.record?.snapshot.core
    if (!c || !['playing', 'saving', 'mounting'].includes(value.mode)) { view.rerender(<p>{value.mode}</p>); return }
    const type = (['Type 1', 'Type 2', 'Type 3'] as const).find(t => c.identity.mapping[t] === c.manifest.rounds[c.round - 1].profile)!
    view.rerender(<><BalloonIdentity type={type} successfulPumps={c.current.successfulPumps} outcome={c.status === 'active' ? null : c.results.at(-1)!.outcome} reducedMotion /><button data-control="pump">Pump</button><button data-control="collect">Collect</button></>)
  }
  const controller = new BalloonsController(store, paint, record => {
    paint({ mode: 'mounting', record, message: '' })
    const element = view.container
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 300, height: 300, top: 0, left: 0, right: 300, bottom: 300, toJSON: () => '' })
    return element
  })
  try {
    let start!: Promise<void>
    await act(async () => { start = controller.start('auto', { verbose: false, reducedMotion: true, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' }) })
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0))
    await act(async () => { frames.shift()!(performance.now()) })
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0))
    await act(async () => { frames.shift()!(performance.now()); await start })
    const before = view.container.querySelector('[data-balloon-body]')?.getAttribute('style')
    held = true
    const c = controller.view.record!.snapshot.core
    let action!: Promise<void>
    await act(async () => { action = controller.action('pump', 'mouse', c.round, c.revision) })
    await vi.waitFor(() => expect(release).toBeDefined())
    expect(view.container.querySelector('[data-balloon-body]')?.getAttribute('style')).toBe(before)
    expect(view.container.querySelector('[data-balloon-burst]')).toBeNull()
    await act(async () => { release!(); await action })
    if (disposition === 'fail') {
      expect(controller.view.mode).toBe('unsaved')
      expect(Object.values(root.records)[0].snapshot.core.current.successfulPumps).toBe(0)
      expect(view.container.querySelector('svg')).toBeNull()
    } else {
      const after = controller.view.record!.snapshot.core
      expect(view.container.querySelector('svg')?.getAttribute('data-successful-pumps')).toBe(String(after.current.successfulPumps))
      if (after.status === 'active') expect(view.container.querySelector('[data-balloon-body]')?.getAttribute('style')).not.toBe(before)
      else expect(view.container.querySelector('[data-balloon-burst]')).not.toBeNull()
    }
  } finally { controller.dispose() }
})
