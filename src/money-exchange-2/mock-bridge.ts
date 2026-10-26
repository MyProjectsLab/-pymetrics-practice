import type { NativeLossHandler } from '../mock/authority'
import type { NativeArm, NativeReference } from '../mock/contract'
import { Store } from './storage'

export type Money2MockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
export async function withMoney2MockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: Money2MockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return Store.observeForMock(arm, settingsRevision, commit, parent, loss)
}
