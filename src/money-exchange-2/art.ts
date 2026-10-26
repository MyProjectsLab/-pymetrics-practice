import {money, action} from './core'
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
  'G':['01111','10000','10000','10111','10001','10001','01110'],
  'I':['11111','00100','00100','00100','00100','00100','11111'],
  'V':['10001','10001','10001','10001','10001','01010','00100'],
  'K':['10001','10010','10100','11000','10100','10010','10001'],
  'B':['11110','10001','10001','11110','10001','10001','11110'],
  'C':['01111','10000','10000','10000','10000','10000','01111'],
  'F':['11111','10000','10000','11110','10000','10000','10000'],
  'H':['10001','10001','10001','11111','10001','10001','10001'],
  'J':['00111','00010','00010','00010','00010','10010','01100'],
  'L':['10000','10000','10000','10000','10000','10000','11111'],
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


export interface Art {src:string;width:number;height:number;semantics:string}
export function pairArt(candidate:number,partner:number|null,name:string,compact:boolean,decision?:{cents:number;actor:string},spread=false):Art {
 const width=compact?320:spread?2000:1100,height=compact?250:spread?550:340;
 const scale=compact?2:spread?5:4;const positions=compact?[78,242]:spread?[240,1760]:[180,920];
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>`];
 for(let i=0;i<(partner===null?1:2);i++){
  const cx=partner===null?width/2:positions[i],cy=compact?100:spread?270:160,r=compact?44:spread?100:65;
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i===0?'#64bdb1':'#d9c7eb'}"/><circle cx="${cx}" cy="${cy-r*.30}" r="${r*.23}" fill="#fff"/><path d="M${cx-r*.52} ${cy+r*.43}q0 -${r*.83} ${r*.52} -${r*.83}q${r*.52} 0 ${r*.52} ${r*.83}q-${r*.52} ${r*.30} -${r*1.04} 0z" fill="#fff"/>`);
  const value=money(i===0?candidate:partner!),pillY=cy-r-22;
  parts.push(`<rect x="${cx-(compact?69:108)}" y="${pillY}" width="${compact?138:216}" height="${compact?32:48}" rx="16" fill="#353540"/>`);
  parts.push(path(value,cx-value.length*6*scale/2,pillY+8,scale,'#fff'));
  const label=i===0?'YOU':name.toUpperCase();parts.push(path(label,cx-label.length*6*scale/2,cy+r+12,scale,'#30303b'));
 }
 if(decision){const label=action(decision.cents).toUpperCase(),s=compact?2:3;parts.push(path(label,width/2-label.length*6*s/2,compact?211:70,s,'#246b50'));
  const label2=decision.actor==='candidate'?'YOU':'PARTNER';parts.push(path(label2,width/2-label2.length*6*s/2,compact?234:104,s,'#246b50'));}
 parts.push('</svg>');const svg=parts.join('');
 return {src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,width,height,semantics:`You have ${money(candidate)}.${partner===null?'':` ${name} has ${money(partner)}.`}${decision?` ${decision.actor==='candidate'?'You':name}: ${action(decision.cents)}.`:''}`};
}
