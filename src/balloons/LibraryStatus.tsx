import { useEffect, useState } from 'react'
import { BalloonsStore } from './storage'
import { CHANGE_CHANNEL } from './controller'
export function BalloonsLibraryStatus() {
  const [text, setText] = useState('Checking local Balloons history…')
  useEffect(() => {
    let active = true, revision = 0
    const refresh = async () => {
      const own = ++revision
      try {
        const store = await BalloonsStore.open(), root = await store.read()
        const complete = Object.values(root.records).filter(r => r.snapshot.phase === 'completed' && r.snapshot.comparisonEligible).sort((a, b) => b.header.created.wallTimeMs - a.header.created.wallTimeMs)
        if (active && own === revision) setText(complete.length ? `${complete.length} completed Balloons attempt${complete.length === 1 ? '' : 's'} saved here. Open Balloons to review.` : 'No completed Balloons result saved here yet.')
      } catch { if (active && own === revision) setText('Balloons history is unavailable until local storage and integrity checks pass.') }
    }
    void refresh()
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANGE_CHANNEL) : null
    if (channel) channel.onmessage = () => { revision++; setText('Local Balloons history changed. Open Balloons to check current history.') }
    return () => { active = false; channel?.close() }
  }, [])
  return <p className="metadata">{text}</p>
}
