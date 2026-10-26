import { createRegistry } from '../../core/registry'
import manifests from './manifests.json'
import variableMixManifests from '../../../docs/specifications/ASSESSMENT_PRACTICE_STOP_V1_3_FORMS.json'
import type { StopLegacyFormManifest, StopV13FormManifest } from '../contracts'

/** Frozen, reviewed standard release forms. No runtime sequence generation. */
export const stopFormRegistry = createRegistry(
  manifests as readonly StopLegacyFormManifest[],
)
export const stopV13FormRegistry = createRegistry(
  variableMixManifests as unknown as readonly StopV13FormManifest[],
)
export const findStopForm = (id: string) => stopV13FormRegistry.get(id) ?? stopFormRegistry.get(id)
