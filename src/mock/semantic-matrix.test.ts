import {describe,it,expect} from 'vitest'
import {freshRoot,initialPreferences,validateRoot} from './contract'
import type {Root,NativeReference,BreakRecord} from './contract'
import {createMock,applyMockCommand,claimLaunch} from './state'
import fixtures from './identity-fixtures.json'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
function command(root:Root,kind:Parameters<typeof applyMockCommand>[2]['kind'],data:Record<string,unknown>,launchId:string|null=null){return applyMockCommand(root,root.mocks[0].id,{requestId:crypto.randomUUID(),expectedRevision:root.mocks[0].revision,kind,launchId,canonicalMetadata:data})}
function initial(){return createMock(freshRoot(id(1)),{requestId:id(2),expectedRevision:0,goal:'general_practice',invitation:'not_available',preferences:initialPreferences(),createdWallMs:100})}
const reference=structuredClone(fixtures.cases.find(x=>x.id==='I01-valid')!.value) as NativeReference
function stages(){const out:Record<string,Root>={preflight:initial()};let r=command(out.preflight,'start',{checkpointWallMs:100});out.boundary=r;r=command(r,'launch',{slot:1,settingsRevision:1},id(3));out.pending_launch=r;r=claimLaunch(r,{mockId:r.mocks[0].id,launchId:id(3),game:'keypresses',documentId:id(4),expectedRevision:r.mocks[0].revision});out.claimed=r;r=command(r,'arm_pending',{slot:1,settingsRevision:1,nativeArm:{requestId:reference.armRequestId,attemptId:reference.attemptId,originTicketId:null,installationId:reference.installationId,generation:null,requestKind:'start',nativeIdentity:[]}},id(3));out.arm_pending=r;r=command(r,'bind_arm',{slot:1,reference},id(3));out.armed=r;for(const classification of ['normal_complete','invalid','incomplete']){const t=command(r,'terminal',{slot:1,reference,classification,reason:classification==='normal_complete'?'none':'technical_interruption'},id(3));out['terminal_'+classification]=t;out['review_'+classification]=command(t,'review_only',{slot:1,classification,reason:'user_exit'},id(3));if(classification==='normal_complete')out.accepted=command(t,'accept',{slot:1,reference,classification,checkpointWallMs:200},id(3))}out.canceled=command(out.claimed,'cancel_no_arm',{slot:1,reason:'no_arm'},id(3));out.omitted=command(out.canceled,'omit',{slot:1,reason:'user_exit',checkpointWallMs:200});out.ended=command(out.boundary,'finish_early',{checkpointWallMs:200});return out}
describe('grouped repair legal topology and one-field neighbors',()=>{
 const states=stages()
 for(const[name,root]of Object.entries(states))it('accepts native-compatible '+name,()=>expect(()=>validateRoot(root)).not.toThrow())
 for(const name of ['pending_launch','arm_pending','armed','terminal_normal_complete','terminal_invalid','terminal_incomplete']){
  it('rejects missing live authority for '+name,()=>{const r=structuredClone(states[name]);r.mocks[0].activeLaunchId=null;expect(()=>validateRoot(r)).toThrow()})
  it('rejects resolved current slot for '+name,()=>{const r=structuredClone(states[name]);r.mocks[0].slots[0].resolution='omitted';expect(()=>validateRoot(r)).toThrow()})
 }
 for(const name of ['canceled','omitted','accepted','review_normal_complete','review_invalid','review_incomplete'])it('rejects false active authority for '+name,()=>{const r=structuredClone(states[name]);r.mocks[0].activeLaunchId=id(3);expect(()=>validateRoot(r)).toThrow()})
 for(const basis of ['monotonic','estimated_wall','unknown'] as const){
  const record:BreakRecord={id:id(10),kind:'accommodation',afterSlot:0,startWallMs:1000,endWallMs:null,clockDocumentId:id(11),startMonoMs:100,endMonoMs:null,elapsedMs:null,durationBasis:'open'}
  const open=command(states.boundary,'break_start',{breakId:record.id,checkpointWallMs:1000,breakRecord:record})
  const closed={...record,endWallMs:basis==='unknown'?999:1200,endMonoMs:basis==='monotonic'?300:null,elapsedMs:basis==='unknown'?null:200,durationBasis:basis}
  const end=command(open,'break_end',{breakId:record.id,checkpointWallMs:closed.endWallMs,breakRecord:closed})
  it('accepts '+basis+' break',()=>expect(()=>validateRoot(end)).not.toThrow())
  it('rejects open basis on closed '+basis+' break',()=>{const r=structuredClone(end);r.mocks[0].breaks[0].durationBasis='open';expect(()=>validateRoot(r)).toThrow()})
  it('rejects future '+basis+' break position',()=>{const r=structuredClone(end);r.mocks[0].breaks[0].afterSlot=11;expect(()=>validateRoot(r)).toThrow()})
 }
 for(const [availability,reason]of [['available','none'],['deleted','deleted'],['replaced','replaced'],['corrupt','corrupt'],['unavailable','missing'],['unavailable','unconfirmed'],['unavailable','unsupported']]as const){
  it('accepts source disposition '+availability+'/'+reason,()=>expect(()=>command(states.accepted,'source_status',{slot:1,reference,availability,reason},id(3))).not.toThrow())
  if(availability!=='available')it('rejects mismatched source reason '+availability+'/'+reason,()=>expect(()=>command(states.accepted,'source_status',{slot:1,reference,availability,reason:'none'},id(3))).toThrow())
 }
})
