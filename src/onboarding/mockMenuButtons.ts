const menuLabels=new Set(['Close','Library','Practice library','Back to mock','Return to mock','Main menu'])
/** Replace menu exits with the existing guarded mock return, without touching other actions. */
export function mockMenuButtons<T extends {label:string}>(buttons:readonly T[],replacement?:T):T[]{
 return replacement?[replacement,...buttons.filter(button=>!menuLabels.has(button.label))]:[...buttons]
}
