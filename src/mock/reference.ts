import registry from './native-identity-registry.json'
import { ADAPTER_VERSION, validatePublicReference } from './contract'
import type { Game, NativeArm, NativeReference } from './contract'

type Versions = NativeReference['versions']
type PublicField = keyof Versions
export function sourceReference(input: {
  game: Game; arm: NativeArm; attemptId: string; settingsRevision: number
  formId: string | null; formHash: string | null; recorded: Partial<Versions>
  resultRevision?: number | null; allowReviewOnly?: boolean; allowLegacyFaces?: boolean
}): NativeReference {
  const families = [...registry.current, ...(input.allowReviewOnly ? registry.reviewOnly : []), ...(input.allowLegacyFaces ? [registry.legacyFacesReview] : [])]
  const family = families.find(item => item.game === input.game && item.forms.some(form => form.id === input.formId && form.hash === input.formHash) &&
    Object.entries(input.recorded).every(([key, value]) => value !== undefined && (item.versions as Record<string, string | null>)[key] === value))
  if (!family) throw new Error('Native form identity is outside the current finite registry')
  for (const [key, value] of Object.entries(input.recorded)) {
    if (value === undefined || (family.versions as Record<string, string | null>)[key as PublicField] !== value) throw new Error(`Native recorded ${key} identity disagrees with the registry`)
  }
  const reference: NativeReference = {
    adapterVersion: ADAPTER_VERSION, game: input.game, databaseFamily: family.databaseFamily,
    installationId: input.arm.installationId, generation: input.arm.generation, attemptId: input.attemptId,
    armRequestId: input.arm.requestId, originTicketId: input.arm.originTicketId,
    versions: { ...family.versions, ...input.recorded, formId: input.formId, formHash: input.formHash },
    settingsRevision: input.settingsRevision, resultRevision: input.resultRevision ?? null,
  }
  validatePublicReference(reference)
  return reference
}
