import { describe, expect, it } from 'vitest'
import { moneyAwardArt, moneyPairArt, moneyResultArt } from './result-art'

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
  it('shows only the starting participant with the exact $10 balance on replay',()=>{
    const art=moneyAwardArt(),paths=[...decodeURIComponent(art.src).matchAll(/<path d="([^"]+)" fill=/g)].map(match=>match[1])
    expect(readValue(paths[0],70,15,4,6)).toEqual([...'$10.00'].map(char=>digits[char].join('/')))
    expect(art.semantics).toBe('You have $10.00.')
    expect(decodeURIComponent(art.src)).not.toContain('#d6c8ed')
  })
  it('keeps paired participant shapes and exact balance pills across layouts',()=>{
    for(const layout of ['wide','narrow','compact'] as const) {
      const art=moneyPairArt(1000,0,layout)
      const paths=[...art.svg.matchAll(/<path d="([^"]+)" fill=/g)].map(match=>match[1])
      expect(paths).toHaveLength(4)
      const small=layout!=='wide'
      ;['$10.00','$0.00'].forEach((value,index)=>{
        const scale=small?3:4,cx=small?80+index*160:120+index*440
        expect(readValue(paths[index*2+1],Math.round(cx-(value.length*6-1)*scale/2),small?14:15,scale,value.length)).toEqual([...value].map(char=>digits[char].join('/')))
      })
      expect(art.svg.match(/<circle data-participant=/g)).toHaveLength(2)
      expect(art.svg).not.toMatch(/<text|<style|<script|<foreignObject|<use|url\(/)
    }
  })
  it('keeps every white balance pixel inside its dark pill at every layout',()=>{
    for(const layout of ['wide','narrow','compact'] as const){
      const art=moneyResultArt({sentCents:500,potCents:1500,returnedCents:615,selfCents:1115,partnerCents:885},layout)
      const pills=[...art.svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="[\d.]+" fill="#2d3342"/g)].map(match=>match.slice(1).map(Number))
      const amounts=[...art.svg.matchAll(/<path d="([^"]+)" fill="#ffffff"/g)].map(match=>match[1])
      expect(pills).toHaveLength(2);expect(amounts).toHaveLength(2)
      amounts.forEach((path,index)=>{
        const [left,top,width,height]=pills[index]
        const pixels=[...path.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v\3h-\3z/g)]
        expect(pixels.length).toBeGreaterThan(0)
        for(const match of pixels){const [x,y,size]=match.slice(1).map(Number)
          expect(x>=left&&x+size<=left+width&&y>=top&&y+size<=top+height,`${layout} balance ${index}, pixel ${x},${y},${size}, pill ${pills[index]}`).toBe(true)
        }
      })
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
        const small=layout!=='wide',compact=layout==='compact'
        expected.forEach((value,index)=>{
          const scale=index<2?(small?3:4):index===2?(compact?3:small?4:5):3
          const cx=index<2?(small?80+index*160:120+index*440):(compact?238:small?160:340)
          const x=index===3?(compact?185:small?140:330):Math.round(cx-(value.length*6-1)*scale/2)
          const y=index<2?15:index===2?(compact?131:small?202:111):(compact?157:small?239:205)
          expect(readValue(paths[index<3?index*2+1:7],x,y,scale,value.length)).toEqual([...value].map(char=>digits[char].join('/')))
        })
        expect(art.svg.match(/<circle data-participant=/g)).toHaveLength(2)
        expect(art.height).toBeLessThanOrEqual(260)
        expect(art.svg).not.toMatch(/<text|<style|<script|<foreignObject|<use|url\(/)
        expect(art.semantics).toContain(expected[0])
        expect(art.semantics).toContain(expected[1])
      }
    }
  })
})
