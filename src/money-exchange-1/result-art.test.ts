import { describe, expect, it } from 'vitest'
import { moneyPairArt, moneyResultArt } from './result-art'

// Independent pixel oracle for the numeric glyphs used by the result image.
const digits:Record<string,string[]>={
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '$':['00100','01111','10100','01110','00101','11110','00100'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],
}
function readValue(path:string,x:number,y:number,scale:number,length:number):string[] {
  const pixels=new Set([...path.matchAll(/M(\d+) (\d+)h(\d+)v\3h-\3z/g)].map(([,px,py])=>`${px},${py}`))
  return Array.from({length},(_,i)=>Array.from({length:7},(_,row)=>Array.from({length:5},(_,col)=>
    pixels.has(`${x+(i*6+col)*scale},${y+row*scale}`)?'1':'0').join('')).join('/'))
}
const dollars=(cents:number)=>`$${(cents/100).toFixed(2)}`

describe('Money result image',()=>{
  it('keeps paired participant shapes and exact balance pills across layouts',()=>{
    for(const layout of ['wide','narrow','compact'] as const) {
      const art=moneyPairArt(1000,0,layout)
      const paths=[...art.svg.matchAll(/<path d="([^"]+)" fill=/g)].map(match=>match[1])
      expect(paths).toHaveLength(4)
      const positions=layout==='wide'?[[131,114,4],[461,114,4]]:
        layout==='narrow'?[[118,108,4],[118,268,4]]:[[27,87,3],[181,87,3]]
      ;['$10.00','$0.00'].forEach((value,index)=>{
        const [x,y,scale]=positions[index]
        expect(readValue(paths[index*2+1],x,y,scale,value.length)).toEqual([...value].map(char=>digits[char].join('/')))
      })
      expect(art.svg.match(/<circle /g)).toHaveLength(2)
      expect(art.svg).not.toMatch(/<text|<style|<script|<foreignObject|<use|url\(/)
    }
  })
  it('draws the correct cents for every form, boundary transfer and layout',()=>{
    for(const rate of [4100,2000,6500,0,8000,3500]) for(const sent of [0,1,5,500,999,1000]) {
      const pot=sent*3, returned=Number((BigInt(pot)*BigInt(rate)+5000n)/10000n)
      const expected=[dollars(1000-sent+returned),dollars(pot-returned),dollars(returned),dollars(pot)]
      for(const layout of ['wide','narrow','compact'] as const) {
        const art=moneyResultArt({sentCents:sent,potCents:pot,returnedCents:returned,selfCents:1000-sent+returned,partnerCents:pot-returned},layout)
        const paths=[...art.svg.matchAll(/<path d="([^"]+)" fill=/g)].map(match=>match[1])
        expect(paths).toHaveLength(8)
        const positions=layout==='wide'?[[24,84,5],[244,84,5],[464,84,5],[104,220,3]]:
          layout==='narrow'?[[20,74,6],[20,203,6],[20,332,6],[100,420,3]]:
          [[20,37,4],[20,107,4],[20,177,4],[80,222,2]]
        expected.forEach((value,index)=>{
          const [x,y,scale]=positions[index]
          expect(readValue(paths[index<3?index*2+1:7],x,y,scale,value.length)).toEqual(
            [...value].map(char=>digits[char].join('/')))
        })
        expect(art.svg).not.toMatch(/<text|<style|<script|<foreignObject|<use|url\(/)
        expect(art.semantics).toContain(expected[0])
        expect(art.semantics).toContain(expected[1])
      }
    }
  })
})
