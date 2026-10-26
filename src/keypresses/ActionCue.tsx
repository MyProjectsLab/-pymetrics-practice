export function keypressButtonName(code:string):string{
 if(code==='Space')return 'the Space bar'
 if(/^Key[A-Z]$/.test(code))return `the ${code.slice(3)} key`
 if(/^Digit[0-9]$/.test(code))return `the ${code.slice(5)} key`
 if(/^Numpad[0-9]$/.test(code))return `the number-pad ${code.slice(6)} key`
 const names:Record<string,string>={Comma:'comma',Period:'full stop',Slash:'slash',Semicolon:'semicolon',Quote:'quote',BracketLeft:'left bracket',BracketRight:'right bracket',Backslash:'backslash',Backquote:'backtick',Minus:'minus',Equal:'equals'}
 return `the ${names[code]??code} key`
}
export function KeypressesActionCue({selectedKey}:{selectedKey:string}){
 return <p className="keypresses-action">Press and release {keypressButtonName(selectedKey)} repeatedly, as quickly as you can.</p>
}
