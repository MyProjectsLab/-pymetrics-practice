# Adapted from the audit arithmetic oracle; implementation-agent verification.
import json,math,hashlib,pathlib,sys,statistics
out=pathlib.Path(__file__).resolve().parent
p=out/(sys.argv[1] if len(sys.argv)>1 else 'browser-full.json');d=json.loads(p.read_text());r=d['result'];ev=r['events'];form=r['form'];summary=r['summarySnapshot'];
assert r['validity']=='valid'
assert all(e['sequenceNumber']==i+1 and e['sessionId']==r['sessionId'] and math.isfinite(e['timestampMs']) and (i==0 or e['timestampMs']>=ev[i-1]['timestampMs']) for i,e in enumerate(ev))
canonical='\n'.join([str(form[k]) for k in ['schemaVersion','id','family','formVersion','specificationVersion','generatorVersion','seedId','blockCount','blockSize']]+[''.join('G' if x=='GO' else 'N' for x in form['sequence']),''])
assert form['checksum']=='sha256:'+hashlib.sha256(canonical.encode()).hexdigest()
assert ev[-2]['type']=='session_completed' and ev[-1]['type']=='protection_ended'
assert ev[-2]['payload']['eventCount']==len(ev)-1
assert sum(e['type']=='session_completed' for e in ev)==1
start=next(i for i,e in enumerate(ev) if e['type']=='trial_scheduled' and e['payload']['trial']['phase']=='scored');s=ev[start:];trials=[];vis=[];onset_delay=[];intervals=[]
for index,stimulus in enumerate(form['sequence']):
 def one(kind):
  rows=[e for e in s if e['type']==kind and e['payload'].get('trialIndex')==index];assert len(rows)==1,(kind,index,len(rows));return rows[0]
 onset=one('stimulus_presented');offset=one('stimulus_removed');res=one('trial_resolved');o=res['payload']['outcome'];assert onset['payload']['stimulus']==stimulus==o['stimulus'];assert onset['timestampMs']==onset['payload']['confirmedOnsetMs'];assert offset['timestampMs']==offset['payload']['confirmedOffsetMs'];vis.append(offset['timestampMs']-onset['timestampMs']);onset_delay.append(onset['timestampMs']-onset['payload']['eligibleAtMs']);
 if res['payload']['source']=='response':
  response=one('response_accepted');inp=ev[response['payload']['inputSequenceNumber']-1];rt=response['timestampMs']-onset['timestampMs'];assert inp['type']=='input_received' and inp['payload']['key']=='Space' and not inp['payload']['held'] and not inp['payload']['repeated'] and inp['payload']['focused'];assert rt==o['responseTimeMs']==response['payload']['responseTimeMs'];assert 0<=rt<=1000;assert o['kind']==('hit' if stimulus=='GO' else 'false_alarm');assert res['payload']['triggerSequenceNumber']==response['sequenceNumber']
 else:
  timeout=one('trial_timed_out');assert o['responseTimeMs'] is None;assert o['kind']==('miss' if stimulus=='GO' else 'correct_withhold');assert res['payload']['resolvedAtMs']==onset['timestampMs']+1000
 anchor=max(res['payload']['resolvedAtMs'],offset['timestampMs']);end=next(e for e in s if e['type']=='fixation_ended' and e['payload']['kind']=='post_resolution' and e['payload']['trialIndex']==index);intervals.append(end['timestampMs']-anchor);trials.append(o)
assert not any(e['type']=='timing_anomaly' for e in ev)
assert d['exposure'][0]['exposedAtMs']==next(e['payload']['confirmedOnsetMs'] for e in s if e['type']=='stimulus_presented')
counts={k:sum(t['kind']==v for t in trials) for k,v in [('hits','hit'),('misses','miss'),('withholds','correct_withhold'),('falseAlarms','false_alarm')]};assert counts==summary['counts']=={'hits':57,'misses':3,'withholds':17,'falseAlarms':3}
def rnd(x):return math.copysign(math.floor(abs(x)+.5),x)
def quant(xs,p):
 xs=sorted(xs);pos=(len(xs)-1)*p;lo=math.floor(pos);hi=math.ceil(pos);return xs[lo]+(xs[hi]-xs[lo])*(pos-lo)
rt=[t['responseTimeMs'] for t in trials if t['kind']=='hit' and 100<=t['responseTimeMs']<=1000];q1=quant(rt,.25);q3=quant(rt,.75);median=quant(rt,.5);assert summary['timing']==dict(count=len(rt),q1=q1,q3=q3,median=median,iqr=q3-q1)
assert f'median response time on correct GO trials was {int(rnd(median))} ms' in d['text']
assert f'spanned {int(rnd(q3-q1))} ms' in d['text']
assert d['focus']=='Your Stop practice result'
# Independent window-union oracle, includes intervening errors in previous error windows.
errors={i for i,t in enumerate(trials) if t['kind'] in ('miss','false_alarm')};post=set(j for i in errors for j in range(i+1,min(80,i+4)));controls=[t['responseTimeMs'] for i,t in enumerate(trials) if i not in post and t['kind']=='hit'];selected=[]
for i in sorted(errors):
 for j in range(i+1,min(i+4,80)):
  if j in errors:break
  if trials[j]['kind']=='hit':selected.append(trials[j]['responseTimeMs']);break
assert summary['postError']['selected']==len(selected);assert summary['postError']['comparison']==len(controls)
assert summary['postError']['postAccuracy']==len(post-errors)/len(post)
if len(selected)>=4 and len(controls)>=12:assert summary['postError']['deltaMs']==rnd(statistics.median(selected)-statistics.median(controls))
for i,b in enumerate(summary['blocks']):
 bt=trials[i*20:(i+1)*20];br=[t['responseTimeMs'] for t in bt if t['kind']=='hit'];assert b['timing']['median']==statistics.median(br);assert b['counts']['hits']==len(br)
metrics={'source':p.name,'browser':d['browser'],'form':form['id'],'events':len(ev),'counts':counts,'timing':summary['timing'],'displayMedian':rnd(median),'displayIqr':rnd(q3-q1),'visibleDurationRange':[min(vis),max(vis)],'onsetDelayRange':[min(onset_delay),max(onset_delay)],'transitionRange':[min(intervals),max(intervals)],'qualityNotes':[e['payload'] for e in ev if e['type']=='quality_note'],'result':'PASS'}
(out/(p.stem+'-verified.json')).write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))
