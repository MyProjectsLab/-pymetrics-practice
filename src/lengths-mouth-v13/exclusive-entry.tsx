import { createRoot } from 'react-dom/client'
import { MouthV13Journey } from './Journey'
import { ExclusiveMouthDocument } from './exclusive-document'
import baseCss from '../index.css?inline'
import appCss from '../App.css?inline'
import mouthCss from './mouth.css?inline'
import { dedicatedHint, claimDedicated, mockReturnUrl } from '../mock/dedicated'
import {monitorReportTarget,reportHint,verifiedReportTarget} from '../mock/report-route'

try {
  const hint=dedicatedHint()
  const report=reportHint()
  const exclusive = new ExclusiveMouthDocument(`${baseCss.replace(':root', ':host')}\n${appCss}\n${mouthCss}`,!!hint||!!report)
  if(hint&&report)throw Error('Conflicting mock routes')
  void Promise.all([hint?claimDedicated('lengths',hint):Promise.resolve(null),report?verifiedReportTarget(report):Promise.resolve(null)]).then(([claim,target])=>{
    if(target&&target.game!=='lengths')throw Error('Wrong saved report game')
    const mounted=createRoot(exclusive.uiMount)
    mounted.render(<MouthV13Journey exclusive={exclusive} mock={claim?.context} reportTarget={target??undefined}
      onLibrary={() => window.location.assign(hint?mockReturnUrl(hint.mockId):report?mockReturnUrl(report.mockId):new URL('./', document.baseURI).href)} />)
    if(target){const stop=monitorReportTarget(target,()=>mounted.render(<section role="alert"><p>Saved mock report is unavailable.</p><a href={mockReturnUrl(target.mockId)}>Back to mock</a></section>));window.addEventListener('pagehide',stop,{once:true})}
  }).catch(error=>{const p=document.createElement('p');p.textContent=hint||report?'Mock link unavailable. Return to mock.':`Lengths could not prepare its display: ${String(error)}`;const link=document.createElement('a');link.href=hint?mockReturnUrl(hint.mockId):report?mockReturnUrl(report.mockId):'./';link.textContent=hint||report?'Return to mock':'Back to library';exclusive.uiMount.append(p,link)})
} catch {
  const body = document.createElement('body')
  const message = document.createElement('p')
  const mockLink=new URLSearchParams(window.location.search).has('mock')||new URLSearchParams(window.location.search).has('launch')
  message.textContent = mockLink?'Mock link unavailable. Return to mock.':'Lengths could not prepare its display. Reload this page to retry.'
  const link = document.createElement('a'); link.href = mockLink?'/mock':'./'; link.textContent = mockLink?'Return to mock':'Back to library'
  if (window.top !== window) link.target = '_top'
  body.append(message, link)
  if (document.body) document.body.replaceWith(body)
  else document.documentElement.append(body)
}
