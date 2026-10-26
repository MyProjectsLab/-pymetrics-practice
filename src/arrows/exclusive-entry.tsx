import { createRoot } from 'react-dom/client'
import { ArrowsJourney } from './Journey'
import { ExclusiveArrowsDocument } from './exclusive-document'
import baseCss from '../index.css?inline'
import appCss from '../App.css?inline'
import arrowsCss from './arrows.css?inline'
import { claimDedicated, dedicatedHint, mockReturnUrl } from '../mock/dedicated'
import {monitorReportTarget,reportHint,verifiedReportTarget} from '../mock/report-route'

// Styles belong to the untimed owned root; this entry imports no page stylesheet
// and never mounts the main application or an analytics component.
try {
  const hint = dedicatedHint()
  const report=reportHint()
  const exclusive = new ExclusiveArrowsDocument(`${baseCss.replace(':root', ':host')}\n${appCss}\n${arrowsCss}`,!!hint||!!report)
  if(hint&&report)throw Error('Conflicting mock routes')
  const claimed = hint ? await claimDedicated('arrows', hint) : null
  const target=report?await verifiedReportTarget(report):null
  if(target&&target.game!=='arrows')throw Error('Wrong saved report game')
  const mounted=createRoot(exclusive.uiMount)
  mounted.render(<ArrowsJourney exclusive={exclusive} mock={claimed?.context} reportTarget={target??undefined}
    onLibrary={() => { claimed?.context.leave(); window.location.assign(claimed?.returnUrl ?? (report?mockReturnUrl(report.mockId):new URL('./', document.baseURI).href)) }} />)
  if(target){const stop=monitorReportTarget(target,()=>mounted.render(<section role="alert"><p>Saved mock report is unavailable.</p><a href={mockReturnUrl(target.mockId)}>Back to mock</a></section>));window.addEventListener('pagehide',stop,{once:true})}
} catch {
  // Construction denial occurs before storage or an arm. There is no fallback
  // to the general application document for timed play.
  const message = document.createElement('p')
  const mockLink = new URLSearchParams(window.location.search).has('mock') || new URLSearchParams(window.location.search).has('launch')
  message.textContent = mockLink ? 'Mock link unavailable. Return to mock.' : window.top !== window
    ? 'Arrows must open as a full page. Return to the library to open Arrows and complete setup.'
    : 'Arrows could not prepare its protected display. Reload this page to retry, or return to the library.'
  const link = document.createElement('a')
  const hint = new URLSearchParams(window.location.search).get('mock')
  link.href = hint ? mockReturnUrl(hint) : mockLink ? '/mock' : './'
  if (window.top !== window) link.target = '_top'
  link.textContent = mockLink ? 'Return to mock' : 'Back to library'
  const fallback = document.createElement('body')
  fallback.append(message, link)
  if (document.body) document.body.replaceWith(fallback)
  else document.documentElement.append(fallback)
}
