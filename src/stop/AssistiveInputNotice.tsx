export const ASSISTIVE_INPUT_DISCLOSURE = 'This response method may add delay. Use untimed practice with this setup.'

export function AssistiveInputNotice({ affected, onChange }: { affected: boolean; onChange: (affected: boolean) => void }) {
  return <fieldset>
    <legend>Alternative controls</legend>
    <p>If your response method adds delay, use untimed practice.</p>
    <label className="choice"><input type="checkbox" checked={affected} onChange={event => onChange(event.target.checked)} />
      <span>My response method adds delay.</span></label>
    {affected && <p role="status">{ASSISTIVE_INPUT_DISCLOSURE} Timed practice is unavailable with this setting.</p>}
  </fieldset>
}
