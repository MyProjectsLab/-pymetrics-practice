import { useCoarseEvent } from '../analytics/observations'
import { useEffect, useRef, useState } from 'react'
import type { StopVisualProfile } from './contracts'
import { bindingFromKey, isPlainResponse } from './preparation'
import type { ResponseBinding } from './preparation'
import { Stimulus } from './Stimulus'
import { storageDisclosure } from './training'
import { stopLocalStore } from './storage'
import { AssistiveInputNotice } from './AssistiveInputNotice'
import { presentationOrderingSupported } from './presentation-order'

export interface StopSetup {
  binding: ResponseBinding
  visualProfile: StopVisualProfile
  physicalKeyboard: boolean
  latencyAffectedInput?: boolean
}

export function Preflight({ setup, onChange, held, viewport, onComplete, lockedProfile = false, requiredSetup }: {
  setup: StopSetup; onChange: (setup: StopSetup) => void; held: boolean
  viewport: { width: number; height: number }; onComplete: () => void; lockedProfile?: boolean; requiredSetup?: StopSetup
}) {
  const [mode, setMode] = useState<'idle' | 'remap' | 'input'>('idle')
  const [inputPassed, setInputPassed] = useState(false)
  const [message, setMessage] = useState('')
  const capture = useRef<HTMLDivElement>(null)
  const changeButton = useRef<HTMLButtonElement>(null)
  const runButton = useRef<HTMLButtonElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  const viewportOkay = viewport.width >= 768 && viewport.height >= 600
  useCoarseEvent(message.startsWith('We did not detect ') ? { event: 'stop_device_check_completed', passed: false, reason: 'input_check_failed' } : null)
  const orderingOkay = !lockedProfile || !stopLocalStore() || presentationOrderingSupported()
  const compatible = !requiredSetup || setup.binding.code === requiredSetup.binding.code &&
    setup.visualProfile === requiredSetup.visualProfile
  const runReason = !setup.physicalKeyboard ? 'Confirm that you are using a physical keyboard, then run the input check.' :
    setup.latencyAffectedInput ? 'The selected input method adds timing delay. Timed Stop is unavailable in this beta; you can continue using the untimed guide and examples.' :
      !viewportOkay ? 'Enlarge the window or use a larger screen before running the input check.' :
        mode !== 'idle' ? 'Finish the key-capture prompt before running another input check.' : ''
  const continueReason = !setup.physicalKeyboard ? 'Confirm that you are using a physical keyboard.' :
    setup.latencyAffectedInput ? 'The selected input method adds timing delay. Timed Stop is unavailable in this beta; you can continue using the untimed guide and examples.' :
      !viewportOkay ? 'Enlarge the window or use a larger screen.' :
        !compatible ? 'Restore the baseline response key and visual profile for this retest.' :
          !orderingOkay ? 'Use a browser that supports ordered retest presentation, then run the input check.' :
            mode !== 'idle' ? 'Finish the key-capture prompt, then run the input check.' :
              !inputPassed ? `Run the input check with ${setup.binding.label} before continuing.` : ''
  useEffect(() => { if (mode !== 'idle') capture.current?.focus() }, [mode])
  useEffect(() => {
    if (mode === 'idle' && message === `${setup.binding.label} detected.`) continueButton.current?.focus()
    else if (mode === 'idle' && message.startsWith('Response key:')) runButton.current?.focus()
  }, [mode, message, setup.binding.label])
  function change(next: StopSetup) {
    onChange(next)
    setInputPassed(false)
    setMessage('')
    setMode('idle')
  }
  function checkKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    // Preserve Tab navigation and browser shortcuts, including their default actions.
    if (event.key !== 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault()
    if (mode === 'remap') {
      const binding = bindingFromKey(event.nativeEvent)
      if (!binding) {
        setMessage('Choose Space, a letter, a number, or an unmodified punctuation key. Escape, Tab, modifier keys, function keys, and browser shortcuts cannot be response keys.')
        return
      }
      change({ ...setup, binding })
      setMessage(`Response key: ${binding.label}. Run the input check again.`)
      return
    }
    if (mode === 'input') {
      if (held || event.repeat) {
        setMessage(`Release ${setup.binding.label}, then press it once for the input check.`)
      } else if (isPlainResponse(event.nativeEvent, setup.binding)) {
        setInputPassed(true)
        setMessage(`${setup.binding.label} detected.`)
        setMode('idle')
      } else {
        setMessage(`We did not detect ${setup.binding.label}. Press ${setup.binding.label} once, check your keyboard, or choose another key.`)
      }
    }
  }
  return <>
    <p className="eyebrow">Stop · Device and accessibility</p>
    <h1 tabIndex={-1}>Check your setup</h1>
    <p>Use a laptop or desktop with a physical keyboard. Keep this tab visible during live warm-up and the scored task. Choose any accessibility setting before timed play; changing it during the scored task ends the session.</p>
    <label className="choice"><input type="checkbox" checked={setup.physicalKeyboard}
      onChange={event => change({ ...setup, physicalKeyboard: event.target.checked })} />
      <span>I’m using a laptop or desktop with a physical keyboard.</span></label>
    <AssistiveInputNotice affected={setup.latencyAffectedInput === true} onChange={latencyAffectedInput => change({ ...setup, latencyAffectedInput })} />
    <p>Response key: <kbd>{setup.binding.label}</kbd></p>
    <p>Space is the default key for this Stop exercise. You can choose another physical key.</p>
    <p>Change key lets you press one new physical key for GO. A new input check is required afterward.</p>
    <button ref={changeButton} className="secondary" disabled={lockedProfile} onClick={() => { setMode('remap'); setInputPassed(false); setMessage('') }}>Change key</button>
    {lockedProfile && <p>The retest uses the baseline response key and visual profile. Confirm the same physical keyboard setup before continuing.</p>}
    <fieldset><legend>Visual symbols</legend>
      <label className="choice"><input type="radio" name="visual" checked={setup.visualProfile === 'standard'} disabled={lockedProfile}
        onChange={() => change({ ...setup, visualProfile: 'standard' })} />Standard color-plus-marker symbols</label>
      <label className="choice"><input type="radio" name="visual" checked={setup.visualProfile === 'shape_accommodation_v1'} disabled={lockedProfile}
        onChange={() => change({ ...setup, visualProfile: 'shape_accommodation_v1' })} />High-distinction shape form</label>
      <div className="rule-grid"><div><Stimulus kind="GO" profile={setup.visualProfile} /><p>GO — press {setup.binding.label}</p></div>
        <div><Stimulus kind="NO_GO" profile={setup.visualProfile} /><p>NO-GO — do nothing</p></div></div>
      {setup.visualProfile === 'shape_accommodation_v1' && <p className="note">This version uses more distinct shapes so the rule does not depend on red–green discrimination. It is an accommodated TraitGame form and is not treated as equivalent to the standard visual form.</p>}
    </fieldset>
    <p>Standard timing. Extended-time mode is planned after Public Beta 0.1 and is not available in this release.</p>
    <p className="note">{storageDisclosure()} If local data were cleared or evicted, this visit is a fresh installation: earlier results cannot be reconstructed, and no sequence can be guaranteed new relative to earlier use.</p>
    {!viewportOkay && <p role="status" className="feedback">The timed game needs a larger visible area. Enlarge the window or use a larger screen.</p>}
    {!orderingOkay && <p role="alert">This browser cannot provide the timing or storage checks required for a valid session.</p>}
    {!setup.physicalKeyboard && <details><summary>Physical keyboard requirement</summary>
      <h2>Use a physical keyboard for the timed Stop game</h2>
      <p>This beta does not treat touch responses as comparable with the keyboard task. Open this game on a laptop or desktop with a physical keyboard. You can still review the guide on this device.</p>
    </details>}
    <p>Run input check: Press {setup.binding.label} once to confirm that this browser receives your response key.</p>
    <div className="actions"><button ref={runButton} onClick={() => { setMode('input'); setInputPassed(false); setMessage('') }}
      disabled={!!runReason}>Run input check</button></div>
    {runReason && <p className="note">Run input check unavailable: {runReason}</p>}
    {mode !== 'idle' && <div ref={capture} className="key-capture" role="group" tabIndex={0} onKeyDown={checkKey}
      aria-label={mode === 'remap' ? 'Choose a response key' : 'Response-key input check'}>
      <p>{mode === 'remap' ? 'Press one new physical key for GO.' : `Press ${setup.binding.label} once to confirm that this browser receives your response key.`}</p>
      <p>Tab moves to the next control.</p>
      <button className="secondary" onClick={() => { setMode('idle'); setMessage('Key capture canceled. Run the input check before continuing.'); changeButton.current?.focus() }}>Cancel key capture</button>
    </div>}
    <div role="status">{message && <p className="feedback">{message}</p>}</div>
    <div className="actions"><button ref={continueButton} disabled={!!continueReason}
      onClick={() => {
        if (!continueReason && window.innerWidth >= 768 && window.innerHeight >= 600) onComplete()
      }}>Continue to readiness</button></div>
    {continueReason && <p className="note">Continue to readiness unavailable: {continueReason}</p>}
  </>
}
