// Original geometric path lettering and arrows authored for Assessment Practice.
// No font outlines, external artwork, network assets or form generation.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const glyphs = {
 S: 'M10 0H0V8H10V16H0', I: 'M0 0H10M5 0V16M0 16H10',
 D: 'M0 16V0H5L10 4V12L5 16Z', E: 'M10 0H0V16H10M0 8H8',
 M: 'M0 16V0L5 7L10 0V16', L: 'M0 0V16H10',
 R: 'M0 16V0H7L10 3V6L7 8H0M5 8L10 16',
 e: 'M0 10H10V7L7 5H3L0 8V13L3 16H10',
 f: 'M3 16V3L6 0H10M0 6H8', t: 'M4 1V13L7 16H10M0 6H9',
 i: 'M5 6V16M5 0V1', g: 'M10 6H3L0 9V13L3 16H10M10 6V20L7 23H0',
 h: 'M0 0V16M0 9L3 6H7L10 9V16',
}
function move(d, x, y) {
 // Closed absolute M/L/H/V/Z grammar. Bake placement into coordinates.
 return d.replace(/([MLHVZ])([\d ]*)/g, (_, c, nums) => {
  if(c==='Z') return c
  const n=nums.trim().split(/\s+/).map(Number)
  return c+n.map((v,i)=>v+(c==='H'?x:c==='V'?y:i%2?y:x)).join(' ')
 })
}
const path = (d, paint) => `<path d="${d}" ${paint}/>`
const backing = (w,h,fill='#ffffff') => path(`M0 0H${w}V${h}H0Z`,`fill="${fill}"`)
const lettering = (word,w,y,color) => [...word].map((c,i)=>path(move(glyphs[c],(w-(word.length*15-5))/2+i*15,y),`fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`)).join('')
const svg = (w,h,paths) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`
const entries=[]
function add(id,width,height,body,metadata={}) { const bytes=svg(width,height,body); entries.push({id,width,height,...metadata,svg:bytes,sha256:createHash('sha256').update(bytes).digest('hex')}) }
for(const [color,condition] of [['red','aligned'],['red','opposed'],['blue','aligned'],['blue','opposed'],['black','neutral']]) for(const direction of ['left','right']) {
 const cue=color==='red'?'SIDES':'MIDDLE', opposite=direction==='left'?'right':'left'
 const symbols=Array.from({length:5},(_,i)=>condition==='neutral'?(i===2?direction:'bar'):condition==='aligned'?direction:(color==='red'?(i===2?opposite:direction):(i===2?direction:opposite)))
 const paint={red:'#b11f2f',blue:'#184dab',black:'#171717'}[color]
 const shapes=symbols.map((s,i)=>path(move(s==='bar'?'M8 24H40':s==='left'?'M40 24H8M22 10L8 24L22 38':'M8 24H40M26 10L40 24L26 38',8+i*72,48),`fill="none" stroke="${paint}" stroke-width="4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"`)).join('')
 add(`${color}-${condition}-${direction}`,352,112,backing(352,112)+lettering(cue,352,12,'#172d30')+shapes,{color,condition,direction,cue,symbols})
}
for(const direction of ['left','right']) { const word=direction==='left'?'Left':'Right'; add(direction,96,40,backing(96,40)+lettering(word,96,8,'#18594f')) }
add('fixation',352,112,backing(352,112)+path('M164 56H188M176 44V68','fill="none" stroke="#172d30" stroke-width="3"'))
// Reject everything outside the static grammar, including optional SVG features.
for(const e of entries) {
 const rest=e.svg.replace(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+">/,'').replace(/<\/svg>$/,'').replace(/<path d="[MLHVZ\d .-]+" (?:fill="(?:none|#[a-f\d]{6})"|stroke="#[a-f\d]{6}"|stroke-width="[\d.]+"|stroke-linecap="(?:butt|round)"|stroke-linejoin="(?:miter|round)"|stroke-miterlimit="4"| )+\/>/g,'')
 if(rest) throw Error(`Unsupported image grammar: ${e.id}: ${rest}`)
}
const output=JSON.stringify(entries,null,2)+'\n', target=new URL('../src/arrows/v11/static-images.json',import.meta.url)
if(process.argv.includes('--check')) { if(readFileSync(target,'utf8')!==output) throw Error('Arrows image inventory differs'); console.log('13 original static images verified') }
else writeFileSync(target,output)
