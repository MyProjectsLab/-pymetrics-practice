import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsStaticSurface } from './static-surface'

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren() })
function fixture(held = false) {
  const images: HTMLImageElement[] = [], releases: Array<() => void> = []
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag)
    if (tag === 'img') {
      const image = element as HTMLImageElement
      images.push(image)
      Object.defineProperties(image, {
        currentSrc: { configurable: true, get: () => image.src }, complete: { configurable: true, get: () => true },
        naturalWidth: { configurable: true, get: () => image.width }, naturalHeight: { configurable: true, get: () => image.height },
        decode: { value: () => held ? new Promise<void>(resolve => releases.push(resolve)) : Promise.resolve() },
      })
    }
    return element
  }) as typeof document.createElement)
  const host = create('div'); document.body.append(host)
  const surface = new ArrowsStaticSurface(host, false, () => {})
  return { surface, images, releases }
}
it('prepares the actual thirteen retained resources and retires the readiness generation on disposal', async () => {
  const { surface, images } = fixture()
  const epoch = await surface.prepare()
  expect(images).toHaveLength(13); expect(surface.prepared(epoch)).toBe(true)
  surface.dispose(); expect(surface.prepared(epoch)).toBe(false)
})
it('cancels pending decode without waiting for its late completion', async () => {
  const { surface, releases } = fixture(true)
  const pending = surface.prepare(); void pending.catch(() => {})
  await vi.waitFor(() => expect(releases).toHaveLength(13))
  surface.dispose(); await expect(pending).rejects.toThrow('canceled')
  releases.forEach(release => release()); await Promise.resolve()
  expect(surface.prepared(1)).toBe(false)
})
it('refuses source replacement during preparation even if restored before the held decode resolves', async () => {
  const { surface, images, releases } = fixture(true)
  const pending = surface.prepare(); void pending.catch(() => {})
  await vi.waitFor(() => expect(releases).toHaveLength(13))
  const source = images[0].src; images[0].src = 'data:image/svg+xml,broken'; images[0].src = source
  releases.forEach(release => release())
  await expect(pending).rejects.toThrow('changed during preparation')
  expect(surface.prepared(1)).toBe(false); surface.dispose()
})
it('cannot fulfill a superseded preparation epoch using an old decode callback', async () => {
  const { surface, releases } = fixture(true)
  const old = surface.prepare(); void old.catch(() => {})
  await vi.waitFor(() => expect(releases).toHaveLength(13))
  const next = surface.prepare()
  await expect(old).rejects.toThrow('canceled')
  await vi.waitFor(() => expect(releases).toHaveLength(26))
  releases.slice(0, 13).forEach(release => release()); await Promise.resolve()
  expect(surface.prepared(1)).toBe(false); expect(surface.prepared(2)).toBe(false)
  releases.slice(13).forEach(release => release())
  expect(await next).toBe(2); expect(surface.prepared(2)).toBe(true); surface.dispose()
})
