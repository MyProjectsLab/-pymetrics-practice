import type { NativeLossHandler } from '../mock/authority'
import type { NativeArm, NativeReference } from '../mock/contract'
import { Store } from './storage'

export type FacesMockSource = { classification: 'normal_complete' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
export async function withFacesMockSource<T>(arm: NativeArm, settingsRevision: number,
  commit: (source: FacesMockSource, signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return Store.observeForMock(arm, settingsRevision, commit, parent, loss)
}
