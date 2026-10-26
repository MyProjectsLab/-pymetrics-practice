import { createRegistry } from '../core/registry'
import { stopV13FormRegistry } from '../stop/forms'
import { STOP_V13_SPECIFICATION_VERSION } from '../stop/versions'

export interface GameRegistration {
  readonly id: string
  readonly specificationVersion: string
  readonly formIds: readonly string[]
}

/** A shared registration shape; only founder-authorized Stop is registered. */
export const gameRegistry = createRegistry<GameRegistration>([
  {
    id: 'stop',
    specificationVersion: STOP_V13_SPECIFICATION_VERSION,
    formIds: stopV13FormRegistry.all.map((form) => form.id),
  },
])
