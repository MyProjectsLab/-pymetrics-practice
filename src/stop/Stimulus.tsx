import type { StopVisualProfile } from './contracts'

export function Stimulus({ kind, profile = 'standard' }: {
  kind: 'GO' | 'NO_GO'; profile?: StopVisualProfile
}) {
  const prefix = profile === 'standard' ? 'standard' : 'shape'
  return <img className="stimulus" src={`/stop/stimuli/${prefix}-${kind === 'GO' ? 'go' : 'no-go'}.svg`}
    alt={kind === 'GO' ? 'GO — vertical marker' : 'NO-GO — horizontal marker'} width="128" height="128" />
}
