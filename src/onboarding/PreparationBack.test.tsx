import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PreparationBack, usePreparationBack } from './PreparationBack'
afterEach(cleanup)
function Flow(){
 const [step,setStep]=useState('guide'),[blocked,setBlocked]=useState(false)
 const navigation=usePreparationBack(step,['guide','example','quiz','ready'] as const,previous=>{
  if(blocked)return false
  setStep(previous)
 })
 return <><h1>{step}</h1><button onClick={()=>setStep('example')}>Example</button><button onClick={()=>setStep('quiz')}>Quiz</button><button onClick={()=>setStep('ready')}>Ready</button><button onClick={()=>setStep('play')}>Start</button><button onClick={()=>setBlocked(!blocked)}>Toggle pending</button><PreparationBack navigation={navigation}/></>
}
it('Back follows the actual visited optional path without creating a forward/back loop',()=>{
 render(<Flow/>);fireEvent.click(screen.getByText('Example'));fireEvent.click(screen.getByText('Quiz'));fireEvent.click(screen.getByText('Ready'))
 for(const expected of ['quiz','example','guide']){fireEvent.click(screen.getByRole('button',{name:/Back/}));expect(screen.getByRole('heading')).toHaveTextContent(expected)}
 expect(screen.queryByRole('button',{name:/Back/})).toBeNull()
 fireEvent.click(screen.getByText('Ready'));fireEvent.click(screen.getByRole('button',{name:/Back/}));expect(screen.getByRole('heading')).toHaveTextContent('guide')
})
it('a pending action refuses Back without consuming the previous screen',()=>{
 render(<Flow/>);fireEvent.click(screen.getByText('Quiz'));fireEvent.click(screen.getByText('Toggle pending'));fireEvent.click(screen.getByRole('button',{name:/Back/}));expect(screen.getByRole('heading')).toHaveTextContent('quiz')
 fireEvent.click(screen.getByText('Toggle pending'));fireEvent.click(screen.getByRole('button',{name:/Back/}));expect(screen.getByRole('heading')).toHaveTextContent('guide')
})
it('no previous-screen action remains after scored play starts',()=>{
 render(<Flow/>);fireEvent.click(screen.getByText('Quiz'));fireEvent.click(screen.getByText('Start'));expect(screen.queryByRole('button',{name:/Back/})).toBeNull()
})
