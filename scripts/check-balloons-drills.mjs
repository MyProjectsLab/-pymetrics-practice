// Independent regeneration; never imports production loaders or transitions.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const bytes = readFileSync(new URL('../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json',import.meta.url))
const hash = x => createHash('sha256').update(x).digest('hex')
assert.equal(hash(bytes),'9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0')
const packet = JSON.parse(bytes), profiles = ['A','B','C'], maxima = {A:12,B:24,C:48}
const canonical = x => Array.isArray(x) ? `[${x.map(canonical).join(',')}]` : x && typeof x === 'object' ? `{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}` : JSON.stringify(x)
function generate(kind,profile,seed) {
  const prefix = `balloons-drill-v1:${kind}:${profile ? profile+':' : ''}${String(seed).padStart(8,'0')}`
  let counter = 0
  const draw = n => {
    const top = 1n<<256n, limit = top-top%BigInt(n)
    for (;;) { const x = BigInt('0x'+hash(`${prefix}:${(counter++).toString(16).padStart(8,'0')}`)); if(x<limit)return Number(x%BigInt(n)) }
  }
  const order=[]
  for(let block=0;block<3;block++) {
    const rows=profile ? Array(6).fill(profile) : ['A','B','C','A','B','C']
    if(!profile)for(let end=rows.length-1;end>0;end--){const i=draw(end+1); [rows[i],rows[end]]=[rows[end],rows[i]]}
    order.push(...rows)
  }
  const pools=Object.fromEntries(profiles.map(p=>[p,Array.from({length:order.filter(x=>x===p).length},()=>1+draw(maxima[p]))]))
  return order.map((p,i)=>({round:i+1,profile:p,threshold:pools[p].shift()}))
}
function valid(rows,single) {
  if(!single)for(let start=0;start<rows.length;start++) {
    const order=rows.map(r=>r.profile)
    if(order.slice(start,start+4).length===4 && new Set(order.slice(start,start+4)).size===1)return false
    for(const n of [2,3]){const part=order.slice(start,start+n*3);if(part.length===n*3 && new Set(part.slice(0,n)).size===n && part.every((p,i)=>p===part[i%n]))return false}
  }
  for(const p of profiles) {
    const vals=rows.filter(r=>r.profile===p).map(r=>r.threshold), n=single ? single===p ? 18 : 0 : 6
    if(vals.length!==n)return false
    if(!n)continue
    const max=maxima[p], sum=vals.reduce((a,b)=>a+b,0)
    if(!vals.some(x=>x<=max/4)||!vals.some(x=>x>3*max/4)||sum<Math.ceil(.4*n*max)||sum>Math.floor(.6*n*max))return false
    for(let b=0;b<3;b++)if(rows.slice(b*6,b*6+6).filter(r=>r.profile===p).length!==(single?6:2))return false
  }
  return true
}
for(const [i,item] of packet.drills.entries()) {
  const [,kind,profile]=item.id.split('-')
  let accepted
  for(let seed=0;seed<=item.candidateSeed;seed++){const rows=generate(kind,profile,seed);if(valid(rows,profile)){accepted={seed,rows};break}}
  assert.ok(accepted,item.id);assert.equal(accepted.seed,[22,7,5,0,0,0,1][i]);assert.deepEqual(item.rounds,accepted.rows)
  const {sha256,...body}=item;assert.equal(hash(canonical(body)),sha256)
  console.log(`${item.id}: first accepted seed ${accepted.seed}, all 18 rows, blocks/order/support/quarters/bands and SHA-256 PASS`)
}
assert.equal(packet.drills.length,7)
