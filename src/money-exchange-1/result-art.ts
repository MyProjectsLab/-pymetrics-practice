import { money } from './core'
import type { Amounts } from './core'

// Original five-column block lettering. The SVG carries paths only: no fonts,
// text, links, filters, CSS, scripts or external references affect the amounts.
const glyphs: Record<string, readonly string[]> = {
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
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  'A':['01110','10001','10001','11111','10001','10001','10001'],
  'D':['11110','10001','10001','10001','10001','10001','11110'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],
  'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],
  'P':['11110','10001','10001','11110','10000','10000','10000'],
  'R':['11110','10001','10001','11110','10100','10010','10001'],
  'T':['11111','00100','00100','00100','00100','00100','00100'],
  'U':['10001','10001','10001','10001','10001','10001','01110'],
  'Y':['10001','10001','01010','00100','00100','00100','00100'],
}

function pathFor(value: string, x: number, y: number, scale: number): string {
  const parts: string[]=[]
  for (const [i,char] of [...value].entries()) {
    const rows=glyphs[char]
    if (!rows) throw Error('Unsupported result glyph')
    rows.forEach((row,r)=>[...row].forEach((bit,c)=>{
      if (bit==='1') { const left=x+(i*6+c)*scale, top=y+r*scale
        parts.push(`M${left} ${top}h${scale}v${scale}h-${scale}z`) }
    }))
  }
  return parts.join('')
}

function path(value:string,x:number,y:number,scale:number,color:string) {
  return `<path d="${pathFor(value,x,y,scale)}" fill="${color}"/>`
}

export type MoneyResultArt = { src:string; svg:string; width:number; height:number; semantics:string; values:readonly [string,string,string] }
export type MoneyPairArt = { src:string; svg:string; width:number; height:number; semantics:string; values:readonly [string,string] }
export function moneyPairArt(selfCents:number,partnerCents:number,layout:'wide'|'narrow'|'compact',partnerIsPot=false):MoneyPairArt {
  if (![selfCents,partnerCents].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=3000))
    throw Error('Participant amount outside reviewed support')
  const values=[money(selfCents),money(partnerCents)] as const
  const narrow=layout==='narrow',compact=layout==='compact'
  const width=narrow||compact?320:680,height=narrow?330:compact?145:185
  const cards=narrow?[[12,10],[12,170]]:compact?[[8,8],[162,8]]:[[20,12],[350,12]]
  const cardWidth=compact?150:narrow?296:310,cardHeight=compact?125:narrow?150:160
  const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`]
  for(let i=0;i<2;i++) {
    const [x,y]=cards[i],color=i===0?'#4caaa4':'#d6c8ed',border=i===0?'#225f60':'#8068aa'
    pieces.push(`<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="${i===0?'#e7f3f0':'#eeeafa'}"/>`)
    const cx=x+(compact?26:narrow?55:58),cy=y+(compact?35:narrow?56:60),radius=compact?17:30
    pieces.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="${border}" stroke-width="3"/>`)
    const label=i===0?'YOU':'PARTNER',scale=compact?2:3
    pieces.push(path(label,x+(compact?52:narrow?105:110),y+(compact?22:40),scale,'#1f514c'))
    const pillX=x+(compact?9:narrow?100:105),pillY=y+(compact?70:narrow?91:95)
    pieces.push(`<rect x="${pillX}" y="${pillY}" width="${compact?132:narrow?181:185}" height="${compact?40:45}" rx="18" fill="#2d3342"/>`)
    pieces.push(path(values[i],pillX+(compact?10:6),pillY+(compact?9:7),compact?3:4,'#ffffff'))
  }
  pieces.push('</svg>')
  const svg=pieces.join('')
  const semantics=`You have ${values[0]}. ${partnerIsPot?'Partner pot':'Partner has'} ${values[1]}.`
  return {src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,svg,width,height,semantics,values}
}
export function moneyResultArt(amounts:Amounts, layout:'wide'|'narrow'|'compact'):MoneyResultArt {
  for (const value of Object.values(amounts))
    if (!Number.isSafeInteger(value) || value<0 || value>3000) throw Error('Result amount outside reviewed support')
  if (amounts.potCents!==amounts.sentCents*3 || amounts.selfCents!==1000-amounts.sentCents+amounts.returnedCents ||
    amounts.partnerCents!==amounts.potCents-amounts.returnedCents) throw Error('Result arithmetic mismatch')
  const values=[money(amounts.selfCents),money(amounts.partnerCents),money(amounts.returnedCents)] as const
  const semantics=`You have ${values[0]}. The partner has ${values[1]}. The partner returned ${values[2]} from a ${money(amounts.potCents)} pot.`
  const narrow=layout==='narrow', compact=layout==='compact'
  const width=narrow||compact?320:680, height=narrow?450:250
  const locations=narrow?[[20,36],[20,165],[20,294]]:compact?[[20,17],[20,87],[20,157]]:[[24,46],[244,46],[464,46]]
  const labels=['YOU','PARTNER','RETURNED'] as const
  const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`]
  for(let i=0;i<3;i++) {
    const [x,y]=locations[i]
    pieces.push(`<rect x="${x-8}" y="${y-13}" width="${narrow||compact?296:200}" height="${narrow?111:compact?65:166}" rx="8" fill="#e8f4f0" stroke="#276251" stroke-width="2"/>`)
    if(i<2) pieces.push(`<circle cx="${x+(narrow||compact?260:168)}" cy="${y+(narrow?35:compact?18:36)}" r="${compact?15:23}" fill="${i===0?'#4caaa4':'#d6c8ed'}" stroke="${i===0?'#225f60':'#8068aa'}" stroke-width="2"/>`)
    pieces.push(path(labels[i],x,y,compact?2:3,'#1f514c'))
    pieces.push(`<rect x="${x-4}" y="${y+(compact?16:34)}" width="${narrow?234:compact?160:193}" height="${compact?34:narrow?52:43}" rx="16" fill="#2d3342"/>`)
    pieces.push(path(values[i],x,y+(compact?20:38),compact?4:narrow?6:5,'#ffffff'))
  }
  pieces.push(path('POT',narrow||compact?20:24,narrow?420:compact?222:220,compact?2:3,'#1f514c'))
  pieces.push(path(money(amounts.potCents),narrow?100:compact?80:104,narrow?420:compact?222:220,compact?2:3,'#123c37'))
  pieces.push('</svg>')
  const svg=pieces.join('')
  return {src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,svg,width,height,semantics,values}
}
