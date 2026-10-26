export interface RegistryItem {
  readonly id: string
}

export interface ReadonlyRegistry<T extends RegistryItem> {
  readonly all: readonly T[]
  get(id: string): T | undefined
  has(id: string): boolean
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

/** A small read-only registry for approved, versioned release data. */
export function createRegistry<T extends RegistryItem>(
  entries: readonly T[],
): ReadonlyRegistry<T> {
  const byId = new Map<string, T>()
  const all = entries.map((entry) => {
    if (!entry.id || byId.has(entry.id)) {
      throw new Error(`Registry item id is empty or repeated: ${entry.id}`)
    }
    const frozen = freezeDeep(entry)
    byId.set(frozen.id, frozen)
    return frozen
  })

  return Object.freeze({
    all: Object.freeze(all),
    get: (id: string) => byId.get(id),
    has: (id: string) => byId.has(id),
  })
}
