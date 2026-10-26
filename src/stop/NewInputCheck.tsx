import { useEffect, useRef, useState } from 'react'
import { storeNativeKeyProof } from '../core/inputCheckReceipt'
import type { InputCheckObservation } from '../core/inputCheckReceipt'
import { bindingFromKey } from './preparation'
import type { StopSetup } from './Preflight'
import { AssistiveInputNotice } from './AssistiveInputNotice'

export function NewInputCheck({ setup, onChange, onChecked, onCancel }: { setup: StopSetup; onChange: (value: StopSetup) => void; onChecked: (value: InputCheckObservation) => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'idle' | 'remap' | 'check'>('idle')
  const [message, setMessage] = useState('')
  const capture = useRef<HTMLDivElement>(null)
  const down = useRef<KeyboardEvent | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++ } }, [])
  function change(value: StopSetup) { generation.current++; down.current = null; onChange(value); setMessage(''); setMode('idle') }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault()
    if (mode === 'remap') {
      const binding = bindingFromKey(event.nativeEvent)
      if (binding && event.nativeEvent.isTrusted) { change({ ...setup, binding }); setMessage(`Using ${binding.label}. Test it before starting.`) }
      else setMessage('Press one keyboard button without Shift, Ctrl, Alt or Command.')
    } else if (mode === 'check') {
      const native = event.nativeEvent
      down.current = native.isTrusted && native.code === setup.binding.code && !native.repeat && !native.isComposing &&
        !native.ctrlKey && !native.altKey && !native.metaKey && !native.shiftKey ? native : null
      if (!down.current) setMessage(`Press and release ${setup.binding.label} without a modifier.`)
    }
  }
  async function keyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    if (mode !== 'check' || event.target !== event.currentTarget) return
    const started = down.current
    down.current = null
    if (!started || event.nativeEvent.code !== setup.binding.code) return
    const token = generation.current
    const receipt = await storeNativeKeyProof('stop', started, event.nativeEvent, setup.visualProfile)
    if (!mounted.current || token !== generation.current) return
    if (!receipt) { setMessage('Press and fully release the button once more.'); return }
    generation.current++
    setMode('idle'); onChecked(receipt)
  }
  const allowed = !setup.latencyAffectedInput && window.innerWidth >= 768 && window.innerHeight >= 600
  return <>
    <p className="eyebrow">Stop · Keyboard</p><h1 tabIndex={-1}>Test your keyboard</h1>
    <p>Use <kbd>{setup.binding.label}</kbd> to respond. Select Test my keyboard to confirm that you’re using a physical keyboard.</p>
    <button disabled={!allowed} onClick={()=>{change({...setup,physicalKeyboard:true});setMode('check');setTimeout(()=>capture.current?.focus(),0)}}>Test my keyboard</button>
    {!allowed&&<p role="status">{setup.latencyAffectedInput?'Your selected input method is for untimed practice only.':'Make the browser window larger to use timed practice.'}</p>}
    <details className="start-options"><summary>Accessibility settings</summary>
      <AssistiveInputNotice affected={setup.latencyAffectedInput===true} onChange={latencyAffectedInput=>change({...setup,latencyAffectedInput})}/>
      <fieldset><legend>Symbols</legend>
       <label className="choice"><input type="radio" name="stop-new-visual" checked={setup.visualProfile==='standard'} onChange={()=>change({...setup,visualProfile:'standard'})}/>Colour and markers</label>
       <label className="choice"><input type="radio" name="stop-new-visual" checked={setup.visualProfile==='shape_accommodation_v1'} onChange={()=>change({...setup,visualProfile:'shape_accommodation_v1'})}/>More distinct shapes</label>
      </fieldset>
      <button className="secondary" onClick={()=>{generation.current++;down.current=null;setMode('remap');setTimeout(()=>capture.current?.focus(),0)}}>Use a different keyboard button</button>
    </details>
    {setup.visualProfile!=='standard'&&<p>Using more distinct shapes.</p>}
    {mode !== 'idle' && <div ref={capture} className="key-capture" role="group" tabIndex={0} onKeyDown={keyDown} onKeyUp={event => { void keyUp(event) }} aria-label={mode === 'remap' ? 'Choose a keyboard button' : 'Keyboard test'}>
      <p>{mode === 'remap' ? 'Press the keyboard button you want to use.' : `Press and release ${setup.binding.label} once.`}</p>
      <p>Tab moves to the next control.</p><button className="secondary" onClick={() => { generation.current++; down.current = null; onCancel?.(); setMode('idle') }}>Cancel</button>
    </div>}
    <div role="status">{message}</div>
  </>
}
