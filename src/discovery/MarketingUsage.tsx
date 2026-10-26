import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { USAGE_WEBSITE_ID } from './config'
import { createMarketingUsage, type MarketingUsageClient } from './usage'
import './usage.css'

const defaultClient = () => createMarketingUsage(USAGE_WEBSITE_ID)
export function MarketingUsage({ makeClient = defaultClient }: { makeClient?: () => MarketingUsageClient }) {
  const [client, setClient] = useState(makeClient)
  const viewAttempted = useRef(false)
  useSyncExternalStore(client.subscribe, client.snapshot)
  useEffect(() => {
    let disposed = false
    const activate = () => {
      client.start(!viewAttempted.current)
      if (client.active()) viewAttempted.current = true
    }
    // Effect replay must not submit an abandoned setup's pageview.
    void Promise.resolve().then(() => { if (!disposed) activate() })
    const retire = () => client.leave()
    const suspend = () => client.pause()
    const hidden = () => {
      if (document.visibilityState !== 'visible') client.pause()
      else { activate(); client.refresh() }
    }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { client.retire(); setClient(makeClient()) }
    }
    const click = (event: MouseEvent) => {
      if (!client.active()) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement)) return
      const url = new URL(link.href)
      if (url.origin !== location.origin || url.search || url.hash) return
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && link.target !== '_blank' && url.pathname !== location.pathname) client.navigate(url.pathname)
      else client.selection(url.pathname)
    }
    window.addEventListener('pagehide', retire)
    window.addEventListener('pageshow', restore)
    document.addEventListener('freeze', suspend)
    document.addEventListener('resume', hidden)
    document.addEventListener('visibilitychange', hidden)
    document.addEventListener('click', click, true)
    return () => {
      disposed = true
      window.removeEventListener('pagehide', retire)
      window.removeEventListener('pageshow', restore)
      document.removeEventListener('freeze', suspend)
      document.removeEventListener('resume', hidden)
      document.removeEventListener('visibilitychange', hidden)
      document.removeEventListener('click', click, true)
      client.pause()
    }
  }, [client, makeClient])
  if (!client.available()) return null
  return <section className="usage-notice" aria-label="Usage information">
    <p>We collect visit counts, practice-link clicks and limited assessment result totals to improve TraitGame. We do not collect individual answers. <a href="/privacy.html">Privacy</a>.</p>
  </section>
}
