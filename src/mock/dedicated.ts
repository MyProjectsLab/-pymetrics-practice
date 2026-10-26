import type { Game } from './contract'
import type { MockJourneyContext } from './journey-context'
import { InFlightLaunchAction, ReturnIntent } from './journey-context'
import { MockStore, acquireMockOwner } from './storage'
import { MockSession } from './session'

const opaque = /^[A-Za-z0-9._-]{1,180}$/
export function dedicatedHint(): { mockId: string; launchId: string } | null {
  const query = new URLSearchParams(window.location.search)
  const mockId = query.get('mock'), launchId = query.get('launch')
  if (!mockId && !launchId) return null
  if (!mockId || !launchId || !opaque.test(mockId) || !opaque.test(launchId)) throw Error('Invalid mock launch link')
  return { mockId, launchId }
}
export function mockReturnUrl(mockId: string): string { return `/mock?mock=${encodeURIComponent(mockId)}` }
/** URL values are hints only; the persisted launch CAS and live Web Lock decide admission. */
export async function claimDedicated(game: Game, hint: { mockId: string; launchId: string }): Promise<{ context: MockJourneyContext; returnUrl: string }> {
  const release = await acquireMockOwner()
  let store: MockStore | null = null
  try {
    store = await MockStore.openRetained()
    const session = new MockSession(store, hint.mockId)
    const mock = await session.claim(hint.launchId, game)
    if (mock.slots[mock.cursor - 1]?.game !== game) throw Error('Wrong mock game')
    let launchId=hint.launchId
    let closed = false
    const returnIntent = new ReturnIntent()
    const terminalChecks = new InFlightLaunchAction<'ready' | 'review_only'>()
    const continuations = new InFlightLaunchAction<void>()
    const returnUrl = mockReturnUrl(hint.mockId)
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { window.removeEventListener('pageshow', restore); close(); window.location.replace(returnUrl) } }
    const pageExit = () => close(false)
    const close = (removeRestore = true) => { returnIntent.retire(); if (removeRestore) window.removeEventListener('pageshow', restore)
      if (closed) return; closed = true; window.removeEventListener('pagehide', pageExit)
      session.dispose(); store?.close(); release() }
    window.addEventListener('pagehide', pageExit)
    window.addEventListener('pageshow', restore)
    const context: MockJourneyContext = {
      get launchId(){return launchId},
      preferences: mock.settings.at(-1)!.preferences,
      beginReturnIntent: () => returnIntent.begin(),
      retireReturnIntent: () => returnIntent.retire(),
      finishReturnIntent: signal => returnIntent.finish(signal),
      beforeArm: async arm => { if (closed) throw Error('Mock launch retired'); await session.armPending(launchId, arm) },
      terminal: () => { if (closed) return Promise.reject(Error('Mock launch retired')); const exact=launchId
        return terminalChecks.run(exact,async()=>{if(closed||launchId!==exact)throw Error('Mock launch retired')
          const observed=await session.read()
          if(closed||launchId!==exact)throw Error('Mock launch retired')
          const attempt=observed.slots[observed.cursor-1]?.attempts.find(item=>item.launchId===exact)
          if(observed.activeLaunchId!==exact||!attempt)throw Error('Mock launch retired')
          // Passive report checks must not retire a fresh prearm launch. The
          // explicit exit closes this owner; startup recovery then performs the
          // existing ordered no-arm cancellation against the exact launch.
          if(attempt.phase==='pending_launch'&&attempt.nativeArm===null)return 'review_only'
          const next=await session.reconcile(exact)
          if(closed||launchId!==exact)throw Error('Mock launch retired')
          return next.slots[next.cursor - 1]?.attempts.find(item=>item.launchId===exact)?.phase==='terminal_verified'?'ready':'review_only' }) },
      continue: signal => { if(closed)return Promise.reject(Error('Mock launch retired'));const exact=launchId,authority=signal??returnIntent.begin()
        return continuations.run(exact,async()=>{authority.throwIfAborted();if(closed||launchId!==exact)throw Error('Mock launch retired')
          await session.accept(exact,authority)
          authority.throwIfAborted();if(closed||launchId!==exact)throw Error('Mock launch retired')
          close();window.location.assign(returnUrl)},authority).finally(()=>{if(!signal)returnIntent.finish(authority)}) },
      retry: async () => { returnIntent.retire();if(closed)throw Error('Mock launch retired');await session.retireForRetry(launchId);const nextId=crypto.randomUUID();
        await session.launchWithId(nextId);await session.claim(nextId,game);launchId=nextId;
        window.history.replaceState(null,'',`${window.location.pathname}?mock=${encodeURIComponent(hint.mockId)}&launch=${encodeURIComponent(nextId)}`) },
      leave: () => close(),
    }
    return { context, returnUrl }
  } catch (error) { store?.close(); release(); throw error }
}
