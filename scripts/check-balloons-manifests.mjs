import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const path = new URL('../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json', import.meta.url)
const bytes = readFileSync(path)
const packet = JSON.parse(bytes)
const expectedFileHash = '9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0'
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw new Error(`Balloons scored manifest check: ${message}`) }
const assert = (condition, message) => { if (!condition) fail(message) }
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)
assert(hash(bytes) === expectedFileHash, 'frozen file SHA-256')
assert(packet.schema === 'balloons-fixed-manifests-v1' && packet.scored.length === 9, 'packet identity/count')
const ids = ['BL1', 'BL2', 'BL3', 'RP1', 'RP2', 'RP3', 'RT1', 'RT2', 'RT3']
const seeds = [1, 3, 15, 16, 20, 23, 24, 33, 34]
const families = ['baseline', 'baseline', 'baseline', 'replay', 'replay', 'replay', 'retest', 'retest', 'retest']
const profiles = ['A', 'B', 'C']
const max = { A: 12, B: 24, C: 48 }
const band = { A: [63, 93], B: [125, 187], C: [250, 374] }
const expectedSums = [[76,171,304],[92,159,250],[92,162,348],[79,176,277],[87,148,345],[69,143,328],[66,133,267],[91,139,286],[87,165,300]]
const expectedCapSurvivors = [4,3,5,3,6,6,2,4,3]
const expectedPayouts = [[465,810,960,720,640],[495,750,840,600,480],[570,810,1140,720,800],[480,780,1020,720,480],[525,870,840,960,960],[420,690,900,720,960],[465,720,780,600,320],[510,750,900,480,640],[480,780,960,840,480]]
function generate(seed) {
  const prefix = `balloons-scored-v1:${String(seed).padStart(8, '0')}`
  let counter = 0
  const draw = n => {
    const top = 1n << 256n
    const limit = top - top % BigInt(n)
    while (true) {
      const digest = hash(`${prefix}:${counter.toString(16).padStart(8, '0')}`)
      counter++
      const x = BigInt(`0x${digest}`)
      if (x < limit) return Number(x % BigInt(n))
    }
  }
  const order = []
  for (let block = 0; block < 3; block++) {
    const part = ['A','A','A','A','B','B','B','B','C','C','C','C',profiles[(block + seed) % 3]]
    for (let end = part.length - 1; end > 0; end--) {
      const target = draw(end + 1)
      ;[part[end], part[target]] = [part[target], part[end]]
    }
    order.push(...part)
  }
  const pools = Object.fromEntries(profiles.map(p => [p, Array.from({ length: 13 }, () => draw(max[p]) + 1)]))
  const offset = { A: 0, B: 0, C: 0 }
  return order.map((profile, index) => ({ round: index + 1, profile, threshold: pools[profile][offset[profile]++] }))
}
function eligible(rounds, seed, signatures) {
  for (let block = 0; block < 3; block++) {
    for (const profile of profiles) {
      if (rounds.slice(13*block,13*block+13).filter(r=>r.profile===profile).length !== 4 + Number(profile === profiles[(block+seed)%3])) return false
    }
  }
  for (let i = 0; i < rounds.length; i++) {
    const p = j => rounds[j].profile
    if (i >= 3 && p(i)===p(i-1) && p(i)===p(i-2) && p(i)===p(i-3)) return false
    if (i >= 5 && p(i-5)!==p(i-4) && p(i-5)===p(i-3) && p(i-5)===p(i-1) && p(i-4)===p(i-2) && p(i-4)===p(i)) return false
    if (i >= 8 && new Set([p(i-8),p(i-7),p(i-6)]).size===3 && Array.from({length:9},(_,j)=>p(i-8+j)).every((v,j)=>v===p(i-8+j%3))) return false
  }
  for (const profile of profiles) {
    const t = rounds.filter(r=>r.profile===profile).map(r=>r.threshold)
    const total = t.reduce((a,b)=>a+b,0)
    if (t.length!==13 || !t.some(v=>v<=max[profile]/4) || !t.some(v=>v>3*max[profile]/4) || total<band[profile][0] || total>band[profile][1]) return false
  }
  return !signatures.has(canonical(rounds.map(r=>[r.profile,Math.min(r.threshold,33)])))
}
const accepted = [], signatures = new Set()
for (let seed = 0; accepted.length < 9; seed++) {
  assert(seed <= 34, 'unexpected acceptance past seed 34')
  const rounds = generate(seed)
  if (!eligible(rounds,seed,signatures)) continue
  signatures.add(canonical(rounds.map(r=>[r.profile,Math.min(r.threshold,33)])))
  accepted.push({seed,rounds})
}
const sigs = []
for (let i=0;i<9;i++) {
  const item = packet.scored[i], rebuilt = accepted[i]
  assert(item.id===ids[i] && item.family===families[i] && item.candidateSeed===seeds[i] && rebuilt.seed===seeds[i], `${ids[i]} identity or first accepted seed`)
  assert(canonical(item.rounds)===canonical(rebuilt.rounds), `${ids[i]} regenerated profile/threshold sequence`)
  const signature = item.rounds.map(r=>[r.profile,Math.min(r.threshold,33)])
  sigs.push(signature)
  assert(hash(canonical(signature))===item.playableSignatureSha256, `${ids[i]} signature hash`)
  const {sha256, ...input}=item
  assert(hash(canonical(input))===sha256, `${ids[i]} manifest hash`)
  const sums=profiles.map(p=>item.rounds.filter(r=>r.profile===p).reduce((sum,r)=>sum+r.threshold,0))
  assert(canonical(sums)===canonical(expectedSums[i]), `${ids[i]} threshold sums`)
  assert(item.rounds.filter(r=>r.profile==='C' && r.threshold>32).length===expectedCapSurvivors[i], `${ids[i]} C cap survival`)
  const payout = [3,6,12,24,32].map(k=>item.rounds.reduce((total,r)=>total+(r.threshold>k ? 5*k : 0),0))
  assert(canonical(payout)===canonical(expectedPayouts[i]), `${ids[i]} fixed-k payout`)
}
let minDifference=39,maxDifference=0
for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){
  const difference=sigs[i].filter((pair,k)=>pair[0]!==sigs[j][k][0]||pair[1]!==sigs[j][k][1]).length
  minDifference=Math.min(minDifference,difference);maxDifference=Math.max(maxDifference,difference)
}
assert(minDifference===35 && maxDifference===39, 'pairwise playable differences')
console.log('Balloons: frozen file SHA, first-nine regeneration (seeds 0..34), hashes, 39/13 and block/order/quartile/band constraints, all 36 signatures, cap and fixed-k review values passed.')
