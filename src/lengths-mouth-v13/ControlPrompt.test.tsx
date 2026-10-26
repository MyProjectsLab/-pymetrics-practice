import {cleanup,render,screen} from '@testing-library/react'
import {afterEach,expect,it} from 'vitest'
import {ControlPrompt} from './ControlPrompt'
import {MOUTH_PRESENTATION_VERSION} from './engine'
import type {InputProfile} from './engine'
afterEach(cleanup)
const shared={variant:'standard',deviceClass:'browser-observed',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false,presentationVersion:MOUTH_PRESENTATION_VERSION} as const
it('shows the current keyboard bindings after remapping rather than stale arrow instructions',()=>{
 const {rerender}=render(<ControlPrompt profile={{...shared,kind:'keyboard',leftCode:'ArrowLeft',rightCode:'ArrowRight'}}/>);
 expect(screen.getByText('Press and release Left arrow for Short and Right arrow for Long.')).toBeVisible();
 rerender(<ControlPrompt profile={{...shared,kind:'keyboard',leftCode:'KeyA',rightCode:'KeyL'}}/>);
 expect(screen.getByText('Press and release A for Short and L for Long.')).toBeVisible();
 expect(screen.queryByText(/ArrowLeft/)).not.toBeInTheDocument()
})
it.each(['mouse','touch','pen'] as const)('shows the real %s pointer test instead of a keyboard instruction',pointerSource=>{
 render(<ControlPrompt profile={{...shared,kind:'pointer',pointerSource} as InputProfile}/>);
 expect(screen.getByText(`Use the button below once with your ${pointerSource==='touch'?'finger':pointerSource} to test your controls.`)).toBeVisible();
 expect(screen.queryByText(/Press and release/)).not.toBeInTheDocument()
})
