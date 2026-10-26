// Test-only oracle: no production arithmetic, transition, or router imports.
import assert from 'node:assert/strict'
import type { Profile, RoundResult } from './contracts'
interface Primitive { round:number;profile:string;threshold:number;intentPumps:number }
const profiles = ['A','B','C'] as const
export function primitiveOutcome(r: Primitive): RoundResult {
  let attempts=0, successes=0
  let outcome: RoundResult['outcome']='voluntary_collect'
  for(let n=1;n<=r.intentPumps;n++) {
    attempts++
    if(n===r.threshold){outcome='burst';break}
    successes++
    if(successes===32){outcome='cap_collect';break}
  }
  return {round:r.round,profile:r.profile as Profile,visibleType:({'A':'Type 1','B':'Type 2','C':'Type 3'} as const)[r.profile as Profile],attemptedPumps:attempts,successfulPumps:successes,
    voluntaryPoint:outcome==='voluntary_collect'?successes:null,outcome,censored:outcome!=='voluntary_collect',bankedCents:outcome==='burst'?0:5*successes,lostCents:outcome==='burst'?5*successes:0}
}
export function legalFixture(rows: readonly Primitive[]) {
  assert.equal(rows.length,39)
  for(const [i,r] of rows.entries()){assert.equal(r.round,i+1);assert.ok(profiles.includes(r.profile as Profile));assert.ok(Number.isInteger(r.threshold)&&r.threshold>=1&&r.threshold<={A:12,B:24,C:48}[r.profile as Profile]);assert.ok(Number.isInteger(r.intentPumps)&&r.intentPumps>=0&&r.intentPumps<=32)}
  for(const p of profiles){const t=rows.filter(r=>r.profile===p).map(r=>r.threshold),m={A:12,B:24,C:48}[p];assert.equal(t.length,13);assert.ok(t.some(x=>x<=m/4)&&t.some(x=>x>3*m/4));assert.ok(t.reduce((a,b)=>a+b,0)>=Math.ceil(.4*13*m)&&t.reduce((a,b)=>a+b,0)<=Math.floor(.6*13*m));for(let b=0;b<3;b++)assert.equal(rows.slice(13*b,13*b+13).filter(r=>r.profile===p).length,4+Number(p===profiles[(b+1)%3]))}
  const s=rows.map(r=>r.profile).join('')
  assert.ok(!/(A{4}|B{4}|C{4})/.test(s))
  for(let i=0;i<s.length;i++){const six=s.slice(i,i+6),nine=s.slice(i,i+9);assert.ok(!(six.length===6&&six.slice(0,2).repeat(3)===six&&six[0]!==six[1]));assert.ok(!(nine.length===9&&new Set(nine.slice(0,3)).size===3&&nine.slice(0,3).repeat(3)===nine))}
}
function middle(xs: number[]): number {
  const s=xs.toSorted((a,b)=>a-b), lo=Math.floor((s.length-1)/2),hi=Math.ceil((s.length-1)/2)
  return (s[lo]+s[hi])/2
}
export function oracle(rows: readonly RoundResult[]) {
  const groups=Object.fromEntries(profiles.map(p=>[p,rows.filter(r=>r.profile===p)])) as Record<Profile,RoundResult[]>
  const earlyBursts={A:0,B:0,C:0},last13VoluntaryN={A:0,B:0,C:0},allVoluntaryN={A:0,B:0,C:0},last13Medians:Record<Profile,number|null>={A:null,B:null,C:null}
  const consistency:{profile:Profile;n:number;iqr:number}[]=[],windows:{profile:Profile;rounds:number[]}[]=[]
  for(const p of profiles){
    const rs=groups[p],vs=rs.filter(r=>r.outcome==='voluntary_collect').map(r=>r.successfulPumps),late=rs.filter(r=>r.round>26&&r.outcome==='voluntary_collect').map(r=>r.successfulPumps)
    earlyBursts[p]=rs.filter(r=>r.round<27&&r.outcome==='burst').length;last13VoluntaryN[p]=late.length;allVoluntaryN[p]=vs.length;last13Medians[p]=late.length>=3?middle(late):null
    if(vs.length>=8){const sorted=vs.toSorted((a,b)=>a-b),h=Math.floor(vs.length/2),q1=middle(sorted.slice(0,h)),q3=middle(sorted.slice(sorted.length-h));if(q3-q1>=6)consistency.push({profile:p,n:vs.length,iqr:q3-q1})}
    for(let i=3;i<rs.length;i++){
      const [a,b,c,d]=rs.slice(i-3,i+1)
      if(a.outcome==='voluntary_collect'&&b.outcome==='burst'&&c.outcome==='voluntary_collect'&&d.outcome==='voluntary_collect'&&a.successfulPumps-c.successfulPumps>=5&&d.successfulPumps-c.successfulPumps>=5)windows.push({profile:p,rounds:[a.round,b.round,c.round,d.round]})
    }
  }
  windows.sort((a,b)=>a.rounds[3]-b.rounds[3]||a.rounds[0]-b.rounds[0]||profiles.indexOf(a.profile)-profiles.indexOf(b.profile))
  const outcomeMatches:typeof windows=[]
  for(const w of windows)if(outcomeMatches.every(chosen=>chosen.rounds.every(r=>!w.rounds.includes(r))))outcomeMatches.push(w)
  const info:{high:Profile;low:Profile;earlyDiff:number;medianDiff:number}[]=[],updating:{high:Profile;low:Profile;earlyDiff:number}[]=[]
  for(const high of profiles)for(const low of profiles){if(high===low)continue;const earlyDiff=earlyBursts[high]-earlyBursts[low],h=last13Medians[high],l=last13Medians[low];if(earlyDiff>=3&&h!==null&&l!==null&&h-l>=3)info.push({high,low,earlyDiff,medianDiff:h-l});if(earlyDiff>=2)updating.push({high,low,earlyDiff})}
  const pairOrder=(a:{high:Profile;low:Profile},b:{high:Profile;low:Profile})=>profiles.indexOf(a.high)-profiles.indexOf(b.high)||profiles.indexOf(a.low)-profiles.indexOf(b.low)
  info.sort((a,b)=>b.earlyDiff-a.earlyDiff||b.medianDiff-a.medianDiff||pairOrder(a,b));updating.sort((a,b)=>b.earlyDiff-a.earlyDiff||pairOrder(a,b));consistency.sort((a,b)=>b.iqr-a.iqr||b.n-a.n||profiles.indexOf(a.profile)-profiles.indexOf(b.profile))
  const medians=Object.values(last13Medians)
  const flags={outcome:outcomeMatches.length>=2,information:info.length>0,updating:updating.length>0&&medians.every(x=>x!==null)&&Math.max(...medians as number[])-Math.min(...medians as number[])<=2,consistency:consistency.length>0}
  return {primary:flags.outcome?'outcome':flags.information?'information':flags.updating?'updating':flags.consistency?'consistency':'maintenance',flags,earlyBursts,last13VoluntaryN,last13Medians,allVoluntaryN,outcomeMatches,informationPair:info[0]??null,updatingPair:flags.updating?[updating[0].high,updating[0].low]:null,consistencyCategory:consistency[0]??null}
}
