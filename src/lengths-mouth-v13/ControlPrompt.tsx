import type { InputProfile } from './engine'
export function keyboardButtonLabel(code:string){
 const known:Record<string,string>={ArrowLeft:'Left arrow',ArrowRight:'Right arrow',Space:'Space'}
 return known[code]??(/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):code)
}
export function ControlPrompt({profile}:{profile:InputProfile}){
 return <p>{profile.kind==='keyboard'
  ? `Press and release ${keyboardButtonLabel(profile.leftCode)} for Short and ${keyboardButtonLabel(profile.rightCode)} for Long.`
  : `Use the button below once with your ${profile.pointerSource==='touch'?'finger':profile.pointerSource} to test your controls.`}</p>
}
