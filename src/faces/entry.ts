import {FacesApp} from './controller'
import {dedicatedHint,claimDedicated,mockReturnUrl} from '../mock/dedicated'
import {monitorReportTarget,reportHint,verifiedReportTarget} from '../mock/report-route'
const app=new FacesApp()
try{
 const hint=dedicatedHint()
 const report=reportHint()
 if(hint&&report)throw Error('Conflicting mock routes')
 void Promise.all([hint?claimDedicated('faces',hint):Promise.resolve(null),report?verifiedReportTarget(report):Promise.resolve(null)]).then(([claim,target])=>{
  if(target&&target.game!=='faces')throw Error('Wrong saved report game')
  if(claim)app.setMock(claim.context,hint!.mockId)
  if(target)app.setReportTarget(target,report!.mockId)
  return app.init().then(()=>{if(target){const stop=monitorReportTarget(target,()=>app.withdrawMockReport());window.addEventListener('pagehide',stop,{once:true})}})
 }).catch(error=>{
  app.stage.render({title:hint||report?'Mock link unavailable':'Faces could not prepare its display',paragraphs:[hint||report?'Return to mock.':String(error)],actions:[{label:hint||report?'Return to mock':'Back to library',run:()=>location.assign(hint?mockReturnUrl(hint.mockId):report?mockReturnUrl(report.mockId):'/practice')}]})
 })
}catch{
 app.stage.render({title:'Mock link unavailable',paragraphs:['Return to mock.'],actions:[{label:'Return to mock',run:()=>location.assign('/mock')}]})
}
