import { createRoot } from 'react-dom/client'
import { MoneyExchangeJourney } from './Journey'
import { MoneyRuntime } from './runtime'
import { ExclusiveMoneyDocument } from './exclusive-document'
import { dedicatedHint, claimDedicated, mockReturnUrl } from '../mock/dedicated'
import {monitorReportTarget,reportHint,verifiedReportTarget} from '../mock/report-route'

try {
  const boundary = new ExclusiveMoneyDocument()
  const runtime = new MoneyRuntime()
  const hint=dedicatedHint()
  const report=reportHint()
  if(hint&&report)throw Error('Conflicting mock routes')
  void Promise.all([hint?claimDedicated('money_1',hint):Promise.resolve(null),report?verifiedReportTarget(report):Promise.resolve(null)]).then(([claim,target])=>{
    if(target&&target.game!=='money_1')throw Error('Wrong saved report game')
    const mounted=createRoot(boundary.mount)
    mounted.render(<MoneyExchangeJourney runtime={runtime} boundary={boundary} mock={claim?.context} reportTarget={target??undefined}
      onLibrary={() => window.location.assign(hint?mockReturnUrl(hint.mockId):report?mockReturnUrl(report.mockId):'/practice')} />)
    if(target){const stop=monitorReportTarget(target,()=>mounted.render(<section role="alert"><p>Saved mock report is unavailable.</p><a href={mockReturnUrl(target.mockId)}>Back to mock</a></section>));window.addEventListener('pagehide',stop,{once:true})}
  }).catch(error=>{const p=document.createElement('p');p.textContent=hint||report?'Mock link unavailable. Return to mock.':`Money Exchange 1 could not prepare its display: ${String(error)}`;const link=document.createElement('a');link.href=hint?mockReturnUrl(hint.mockId):report?mockReturnUrl(report.mockId):'/practice';link.textContent=hint||report?'Return to mock':'Back to library';boundary.mount.append(p,link)})
} catch {
  const message = document.createElement('p')
  const mockLink=new URLSearchParams(window.location.search).has('mock')||new URLSearchParams(window.location.search).has('launch')
  message.textContent = mockLink?'Mock link unavailable. Return to mock.':'Money Exchange 1 could not prepare its protected display. Reload this page to retry.'
  const link = document.createElement('a')
  link.href = mockLink?'/mock':'/practice'
  if (window.top !== window) link.target = '_top'
  link.textContent = mockLink?'Return to mock':'Back to library'
  const fallback = document.createElement('body')
  fallback.append(message, link)
  if (document.body) document.body.replaceWith(fallback)
  else document.documentElement.append(fallback)
}
