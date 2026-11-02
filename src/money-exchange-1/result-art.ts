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
export function moneyAwardArt(){
  const width=280,height=190,semantics='You have $10.00.'
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="190" viewBox="0 0 280 190"><rect width="280" height="190" fill="#ffffff"/><circle cx="140" cy="98" r="42" fill="#4caaa4"/><circle cx="140" cy="86" r="12" fill="#ffffff"/><ellipse cx="140" cy="116" rx="27" ry="19" fill="#ffffff"/><rect x="60" y="8" width="160" height="42" rx="17" fill="#2d3342"/>${path('$10.00',70,15,4,'#ffffff')}${path('YOU',115,152,3,'#14213d')}</svg>`
  return {src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,width,height,semantics}
}
export function moneyPairArt(selfCents:number,partnerCents:number,layout:'wide'|'narrow'|'compact',partnerIsPot=false):MoneyPairArt {
  if (![selfCents,partnerCents].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=3000))
    throw Error('Participant amount outside reviewed support')
  const values=[money(selfCents),money(partnerCents)] as const
  const small=layout!=='wide'
  const width=small?320:680,height=small?170:190
  const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`]
  for(let i=0;i<2;i++) {
    const cx=small?80+i*160:120+i*440,pillX=cx-(small?72:80)
    pieces.push(`<circle data-participant="" cx="${cx}" cy="${small?82:98}" r="${small?34:42}" fill="${i===0?'#4caaa4':'#d6c8ed'}"/>`)
    pieces.push(`<circle cx="${cx}" cy="${small?72:86}" r="${small?10:12}" fill="#ffffff"/><ellipse cx="${cx}" cy="${small?98:116}" rx="${small?22:27}" ry="${small?15:19}" fill="#ffffff"/>`)
    const label=i===0?'YOU':'PARTNER',labelScale=3
    pieces.push(path(label,Math.round(cx-(label.length*6-1)*labelScale/2),small?130:152,labelScale,'#14213d'))
    pieces.push(`<rect x="${pillX}" y="8" width="${small?144:160}" height="${small?34:42}" rx="17" fill="#2d3342"/>`)
    const scale=small?3:4
    pieces.push(path(values[i],Math.round(cx-(values[i].length*6-1)*scale/2),small?14:15,scale,'#ffffff'))
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
  const small=layout!=='wide'
  const compact=layout==='compact'
  const width=small?320:680,height=compact?180:small?260:240
  const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`]
  for(let i=0;i<3;i++) {
    const cx=i<2?(small?80+i*160:120+i*440):(small?160:340)
    const label=['YOU','PARTNER','RETURNED'][i],labelScale=compact&&i===2?2.5:3
    const labelY=i<2?(compact?99:small?130:152):(compact?133:small?171:72)
    const amountY=i<2?15:(compact?131:small?202:111),scale=i<2?(small?3:4):(compact?3:small?4:5)
    if(i<2) {
      pieces.push(`<circle data-participant="" cx="${cx}" cy="${compact?65:small?82:98}" r="${compact?26:small?34:42}" fill="${i===0?'#4caaa4':'#d6c8ed'}"/>`)
      pieces.push(`<circle cx="${cx}" cy="${compact?57:small?72:86}" r="${compact?8:small?10:12}" fill="#ffffff"/><ellipse cx="${cx}" cy="${compact?77:small?98:116}" rx="${compact?17:small?22:27}" ry="${compact?12:small?15:19}" fill="#ffffff"/>`)
      pieces.push(`<rect x="${cx-(small?72:80)}" y="8" width="${small?144:160}" height="${compact?26:small?34:42}" rx="17" fill="#2d3342"/>`)
    }
    pieces.push(path(label,Math.round((compact&&i===2?66:cx)-(label.length*6-1)*labelScale/2),labelY,labelScale,'#14213d'))
    pieces.push(path(values[i],Math.round((compact&&i===2?238:cx)-(values[i].length*6-1)*scale/2),amountY,scale,i<2?'#ffffff':'#14213d'))
  }
  pieces.push(path('POT',compact?8:small?65:245,compact?159:small?239:205,compact?2.5:3,'#14213d'))
  pieces.push(path(money(amounts.potCents),compact?185:small?140:330,compact?157:small?239:205,3,'#14213d'))
  pieces.push('</svg>')
  const svg=pieces.join('')
  return {src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,svg,width,height,semantics,values}
}
