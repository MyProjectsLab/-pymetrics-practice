import {cleanup,render,screen} from '@testing-library/react'
import {afterEach,expect,it} from 'vitest'
import {KeypressesActionCue,keypressButtonName} from './ActionCue'
afterEach(cleanup)
it('explicitly names the Space bar and the repeated press-and-release action',()=>{
 const {container}=render(<KeypressesActionCue selectedKey="Space"/>);
 expect(screen.getByText('Press and release the Space bar repeatedly, as quickly as you can.')).toBeInTheDocument();
 expect(container.querySelector('[aria-live]')).toBeNull();expect(container.querySelector('button')).toBeNull()
})
it('updates the action to the chosen binding rather than continuing to instruct Space',()=>{
 const {rerender}=render(<KeypressesActionCue selectedKey="Space"/>);rerender(<KeypressesActionCue selectedKey="KeyK"/>);
 expect(screen.getByText('Press and release the K key repeatedly, as quickly as you can.')).toBeInTheDocument();expect(screen.queryByText(/Space bar/)).not.toBeInTheDocument()
})
it.each([['Digit7','the 7 key'],['Numpad2','the number-pad 2 key'],['Semicolon','the semicolon key'],['BracketLeft','the left bracket key']])('names %s without exposing its code', (code,label)=>{expect(keypressButtonName(code)).toBe(label)})
