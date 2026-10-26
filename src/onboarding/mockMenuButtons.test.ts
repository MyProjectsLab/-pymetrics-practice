import {expect,it,vi} from 'vitest'
import {mockMenuButtons} from './mockMenuButtons'
it.each(['Money Exchange 1','Money Exchange 2'])('%s keeps one ordinary Main menu with its original action',()=>{
 const menu=vi.fn(),next=vi.fn();const ordinary=[{label:'Continue',act:next},{label:'Main menu',act:menu}];
 const shown=mockMenuButtons(ordinary);expect(shown.map(x=>x.label)).toEqual(['Continue','Main menu']);shown[1].act();expect(menu).toHaveBeenCalledOnce();expect(next).not.toHaveBeenCalled()
})
it.each(['Money Exchange 1','Money Exchange 2'])('%s replaces all old or new menu labels with one guarded mock return',()=>{
 const direct=vi.fn(),guarded=vi.fn(),next=vi.fn();const buttons=[{label:'Continue',act:next},...['Close','Library','Practice library','Back to mock','Return to mock','Main menu'].map(label=>({label,act:direct}))];
 const shown=mockMenuButtons(buttons,{label:'Return to mock',act:guarded});expect(shown.map(x=>x.label)).toEqual(['Return to mock','Continue']);shown[0].act();expect(guarded).toHaveBeenCalledOnce();expect(direct).not.toHaveBeenCalled();expect(shown[1]).toBe(buttons[0]);expect(buttons).toHaveLength(7)
})
it('retains all consequential non-menu controls and their exact handlers and flags',()=>{
 const action={label:'Continue full mock',act:vi.fn(),disabled:true};const leave={label:'Leave with result unconfirmed',act:vi.fn(),disabled:false};const shown=mockMenuButtons([action,leave],{label:'Return to mock',act:vi.fn(),disabled:false});expect(shown.slice(1)).toEqual([action,leave]);expect(shown[1]).toBe(action)
})
