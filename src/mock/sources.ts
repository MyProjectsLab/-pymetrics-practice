import type { NativeLossHandler } from './authority'
import type { Game, NativeArm, NativeReference } from './contract'
import { withKeypressesMockSource } from '../keypresses/mock-bridge'
import { withStopMockSource } from '../stop/mock-bridge'
import { withDigitsMockSource } from '../digits/mock-bridge'
import { withArrowsMockSource } from '../arrows/mock-bridge'
import { withBalloonsMockSource } from '../balloons/mock-bridge'
import { withTowersMockSource } from '../towers/mock-bridge'
import { withMouthMockSource } from '../lengths-mouth-v13/mock-bridge'
import { withCardsMockSource } from '../cards/mock-bridge'
import { withEasyHardMockSource } from '../easy-hard/mock-bridge'
import { withMoney1MockSource } from '../money-exchange-1/mock-bridge'
import { withMoney2MockSource } from '../money-exchange-2/mock-bridge'
import { withFacesMockSource } from '../faces/mock-bridge'

export type SourceProjection = { classification: 'normal_complete' | 'task_limit' | 'invalid' | 'incomplete' | 'no_arm'; reference: NativeReference | null }
export function withSourceProjection<T>(game: Game, arm: NativeArm, settingsRevision: number,
  commit: (source: SourceProjection, signal: AbortSignal) => Promise<T>, signal: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  switch (game) {
    case 'keypresses': return withKeypressesMockSource(arm, settingsRevision, commit, signal, loss)
    case 'stop': return withStopMockSource(arm, settingsRevision, commit, signal, loss)
    case 'digits': return withDigitsMockSource(arm, settingsRevision, commit, signal, loss)
    case 'arrows': return withArrowsMockSource(arm, settingsRevision, commit, signal, loss)
    case 'balloons': return withBalloonsMockSource(arm, settingsRevision, commit, signal, loss)
    case 'towers': return withTowersMockSource(arm, settingsRevision, commit, signal, loss)
    case 'lengths': return withMouthMockSource(arm, settingsRevision, commit, signal, loss)
    case 'cards': return withCardsMockSource(arm, settingsRevision, commit, signal, loss)
    case 'easy_hard': return withEasyHardMockSource(arm, settingsRevision, commit, signal, loss)
    case 'money_1': return withMoney1MockSource(arm, settingsRevision, commit, signal, loss)
    case 'money_2': return withMoney2MockSource(arm, settingsRevision, commit, signal, loss)
    case 'faces': return withFacesMockSource(arm, settingsRevision, commit, signal, loss)
  }
}
