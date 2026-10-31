import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Examples } from './Examples'
import { createPreparationRecorder, spaceBinding } from './preparation'
afterEach(cleanup)
it('reviews a previous example without changing its recorded answers or advancing the active example',()=>{
 const recorder=createPreparationRecorder('review-only-examples'),onBack=vi.fn(),onComplete=vi.fn()
 render(<Examples recorder={recorder} binding={spaceBinding} held={false} onBack={onBack} onComplete={onComplete}/>)
 fireEvent.click(screen.getByRole('button',{name:'Check example'}));fireEvent.click(screen.getByRole('button',{name:'Next example'}))
 const recorded=recorder.snapshot()
 expect(screen.getByRole('heading',{name:'Example 2 of 4'})).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Back'}))
 expect(screen.getByRole('heading',{name:'Example 1 of 4'})).toBeVisible()
 expect(screen.queryByRole('button',{name:'Check example'})).toBeNull()
 expect(screen.getByText('Earlier example — review only.')).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Next example'}))
 expect(screen.getByRole('heading',{name:'Example 2 of 4'})).toBeVisible()
 expect(screen.getByRole('button',{name:'Check example'})).toBeVisible()
 expect(recorder.snapshot()).toEqual(recorded);expect(onComplete).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Back'}));fireEvent.click(screen.getByRole('button',{name:'Back'}))
 expect(onBack).toHaveBeenCalledOnce();expect(recorder.snapshot()).toEqual(recorded)
})
