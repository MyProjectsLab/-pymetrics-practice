/** Shared transport types and exact dispatch. Historical mechanics stay frozen. */
import * as v1Engine from './engine'
import * as v11Engine from './v11/engine'
import * as v1Report from './report'
import * as v11Report from './v11/report'
import * as v1Forms from './manifests'
import * as v11Forms from './v11/manifests'
import type { Form as FormV1, FormId as FormIdV1 } from './contracts'
import type { Form as FormV11, FormId as FormIdV11 } from './v11/contracts'
export type State = v1Engine.State | v11Engine.State
export type HeadlessReview = v1Report.HeadlessReview | v11Report.HeadlessReview
export type Form = FormV1 | FormV11
export type FormId = FormIdV1 | FormIdV11
export type { Command, InputProfile, PointerSource } from './engine'
export const isV11 = (state: State): state is v11Engine.State => state.specificationVersion === 'arrows_spec_v1_1'
export function advance(state: State, command: v1Engine.Command): State { return isV11(state) ? v11Engine.advance(state, command) : v1Engine.advance(state, command) }
export function verifyHeadless(state: State): boolean {
  return state.specificationVersion === 'arrows_spec_v1_1' ? v11Engine.verifyHeadless(state) : state.specificationVersion === 'arrows_spec_v1_0' && v1Engine.verifyHeadless(state)
}
export function reconcileHeadless(state: State): HeadlessReview { return isV11(state) ? v11Report.reconcileHeadless(state) : v1Report.reconcileHeadless(state) }
export async function loadArrowsForms(): Promise<ReadonlyMap<FormId, Form>> {
  const [oldForms, newForms] = await Promise.all([v1Forms.loadArrowsForms(), v11Forms.loadArrowsForms()])
  return new Map<FormId, Form>([...oldForms.entries(), ...newForms.entries()])
}
export function stimulusFor(state: State) { return isV11(state) ? v11Forms.stimulusFor(state.form, state.trialIndex) : v1Forms.stimulusFor(state.form, state.trialIndex) }
export function canonicalState(state: State, form: Form): State {
  if (isV11(state) && form.id.startsWith('AR11-')) return { ...state, form: form as FormV11 }
  if (!isV11(state) && !form.id.startsWith('AR11-')) return { ...state, form: form as FormV1 }
  throw Error('Arrows state/form version mismatch')
}
export const versionCount = (root: { scoredStartCount: number; scoredStartCountV11?: number }, state: State): number => isV11(state) ? root.scoredStartCountV11 ?? 0 : root.scoredStartCount
export function armHeadless(form: Form, identity: v1Engine.Identity, profile: v1Engine.InputProfile, atMs: number): State {
  return form.id.startsWith('AR11-') ? v11Engine.armHeadless(form as FormV11, identity, profile, atMs) : v1Engine.armHeadless(form as FormV1, identity, profile, atMs)
}
