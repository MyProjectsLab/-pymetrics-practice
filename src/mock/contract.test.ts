import { describe, expect, it } from 'vitest'
import fixtures from './identity-fixtures.json'
import example from './example-root.json'
import { validatePublicReference, validateRoot, validateLegacyRoot, migrateLegacyRoot } from './contract'
import type { NativeReference } from './contract'

describe('accepted full mock packet identities', () => {
  it('accepts the exact example root without repair', () => {
    expect(() => validateLegacyRoot(structuredClone(example))).not.toThrow()
    expect(() => validateRoot(migrateLegacyRoot(example))).not.toThrow()
    expect(() => validateRoot(example)).toThrow()
  })
  for (const fixture of fixtures.cases) {
    it(fixture.id, () => {
      const run = () => validatePublicReference(structuredClone(fixture.value) as NativeReference)
      if (fixture.schemaValid) expect(run).not.toThrow()
      else expect(run).toThrow()
    })
  }
})
