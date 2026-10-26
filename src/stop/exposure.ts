import type { StopFormManifest, StopStandardFormFamily } from './contracts'
import { stopFormRegistry, stopV13FormRegistry } from './forms'

export interface ExposureMarker { readonly formId: string; readonly sessionId: string; readonly exposedAtMs: number }
export interface FormReservation { readonly form: StopFormManifest; readonly expiresAtMs: number | null }
/** M5 replaces this repository; callers never depend on a storage technology. */
export interface FormExposureRepository {
  claim(sessionId: string, formId: string, expiresAtMs?: number): StopFormManifest
  hydrate(markers: readonly ExposureMarker[]): void
  clear(): void
  reserve(sessionId: string, random?: () => number, family?: StopStandardFormFamily, expiresAtMs?: number, specificationVersion?: '1.1' | '1.3', preferredGoCount?: number): StopFormManifest | null
  reservation(sessionId: string, nowMs: number): FormReservation | null
  expose(sessionId: string, timestampMs: number): void
  release(sessionId: string): void
  snapshot(): readonly ExposureMarker[]
}
export function createMemoryExposureRepository(forms: readonly StopFormManifest[] = stopFormRegistry.all): FormExposureRepository {
  const exposed = new Map<string, ExposureMarker>()
  const reserved = new Map<string, FormReservation>()
  return Object.freeze({
    claim(sessionId: string, formId: string, expiresAtMs?: number) {
      const form = forms.find(item => item.id === formId)
      if (!form || exposed.has(formId) || [...reserved.values()].some(item => item.form.id === formId)) throw new Error('Form claim conflicts')
      reserved.set(sessionId, Object.freeze({ form, expiresAtMs: expiresAtMs ?? null }))
      return form
    },
    hydrate(markers: readonly ExposureMarker[]) {
      exposed.clear(); reserved.clear()
      for (const marker of markers) exposed.set(marker.formId, marker)
    },
    clear() { exposed.clear(); reserved.clear() },
    reserve(sessionId: string, random = Math.random, family: StopStandardFormFamily = 'baseline', expiresAtMs?: number, specificationVersion: '1.1' | '1.3' = '1.1', preferredGoCount?: number) {
      const existing = reserved.get(sessionId)
      if (existing) return existing.form
      // All eligible forms are still unexposed; random choice breaks their equal rank.
      const eligible = forms.filter(f => f.family === family && f.specificationVersion === specificationVersion && !exposed.has(f.id) &&
        ![...reserved.values()].some(r => r.form.id === f.id))
      if (!eligible.length) return null
      const choice = random()
      if (!Number.isFinite(choice) || choice < 0 || choice >= 1) throw new Error('Invalid random choice')
      const matching = family === 'retest' && specificationVersion === '1.3' && preferredGoCount !== undefined ?
        eligible.filter(item => item.sequence.filter(value => value === 'GO').length === preferredGoCount) : []
      const pool = matching.length ? matching : eligible
      const form = pool[Math.floor(choice * pool.length)]
      if (expiresAtMs !== undefined && !Number.isFinite(expiresAtMs)) throw new Error('Invalid reservation expiry')
      reserved.set(sessionId, Object.freeze({ form, expiresAtMs: expiresAtMs ?? null }))
      return form
    },
    reservation(sessionId: string, nowMs: number) {
      const record = reserved.get(sessionId)
      if (!record || record.expiresAtMs !== null && nowMs >= record.expiresAtMs && !exposed.has(record.form.id)) return null
      return record
    },
    expose(sessionId: string, exposedAtMs: number) {
      const form = reserved.get(sessionId)?.form
      if (!form || exposed.has(form.id) || !Number.isFinite(exposedAtMs)) throw new Error('Invalid form exposure')
      exposed.set(form.id, Object.freeze({ formId: form.id, sessionId, exposedAtMs }))
    },
    release(sessionId: string) { reserved.delete(sessionId) },
    snapshot: () => Object.freeze([...exposed.values()]),
  })
}
/** Refresh deliberately resets this memory. No browser storage or cross-tab claims. */
export const stopExposure = createMemoryExposureRepository([...stopFormRegistry.all, ...stopV13FormRegistry.all])
