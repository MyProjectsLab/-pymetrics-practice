import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { Outcome, VisibleType } from './contracts'

const identities = {
  'Type 1': { colour: 'Blue', pattern: 'Stripes', fill: '#257fc4', shade: '#165287' },
  'Type 2': { colour: 'Orange', pattern: 'Dots', fill: '#e37b31', shade: '#a34e1c' },
  'Type 3': { colour: 'Yellow', pattern: 'Grid', fill: '#e9bc2d', shade: '#ac8316' },
} as const

const outline = 'M160 42c-53 0-92 45-92 102 0 54 47 97 88 108l-6 12q10-3 20 0l-6-12c41-11 88-54 88-108 0-57-39-102-92-102Z'
const shards = [
  { path: 'M-37-48q-20 12-16 35l17-9Z', x: -28, y: -24, angle: -23 },
  { path: 'M-12-62q15-6 30 4L2-37Z', x: 2, y: -32, angle: 18 },
  { path: 'M38-45q22 11 18 34L34-23Z', x: 29, y: -18, angle: 30 },
  { path: 'M49 9q4 25-17 39l-1-25Z', x: 30, y: 23, angle: 21 },
  { path: 'M8 43q-3 20-18 23L-7 42Z', x: 0, y: 30, angle: -12 },
  { path: 'M-43 9l13 18-7 24q-23-14-21-37Z', x: -29, y: 21, angle: -24 },
] as const

/** Decorative projection of public, committed state; it receives no risk profile or threshold. */
export function BalloonIdentity({ type, successfulPumps = 0, outcome = null, reducedMotion = false, compact = false, showIdentity = true, playStage = false }: {
  type: VisibleType
  successfulPumps?: number
  outcome?: Outcome | null
  reducedMotion?: boolean
  compact?: boolean
  showIdentity?: boolean
  playStage?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const identity = identities[type]
  const pumps = Number.isFinite(successfulPumps) ? Math.max(0, Math.min(32, successfulPumps)) : 0
  const scale = playStage ? (.6 + pumps * .3 / 32) * 320 / 222 : .5 + pumps * .65 / 32
  return <div className={`balloons-identity${compact ? ' balloons-identity-compact' : ''}`}>
    <svg className="balloon-art" viewBox="0 0 320 320" aria-hidden="true" focusable="false"
      data-motion={reducedMotion ? 'reduced' : 'normal'} data-successful-pumps={pumps} data-outcome={outcome ?? 'active'}>
      <defs>
        <clipPath id={`${id}-outline`}><path d={outline} /></clipPath>
        <pattern id={`${id}-pattern`} width="20" height="20" patternUnits="userSpaceOnUse">
          {type === 'Type 1' ? <path d="M-5 5 5-5M0 20 20 0m-5 25 10-10" stroke="#fff" strokeWidth="2" />
            : type === 'Type 2' ? <circle cx="10" cy="10" r="2.5" fill="#fff" />
              : <path d="M0 0h20M0 0v20" stroke="#725412" strokeWidth="1.5" />}
        </pattern>
      </defs>
      {outcome === 'burst' ? <g data-balloon-burst transform={`translate(160 ${playStage ? 320 - 110 * scale : 266 - 112 * scale}) scale(${scale})`} fill={identity.fill}>
        <path d="m-8-17 9-12 8 15 21 4-17 13 2 19-16-10-15 11 3-22-17-12Z" opacity=".55" />
        {shards.map((shard, index) => <path key={index} d={shard.path} className="balloon-shard" style={{ '--shard-x': `${shard.x}px`, '--shard-y': `${shard.y}px`, '--shard-angle': `${shard.angle}deg` } as CSSProperties} />)}
      </g> : <g data-balloon-body className="balloon-inflatable" style={{ transform: `scale(${scale})` }}>
        <path d={outline} fill={identity.fill} />
        <g clipPath={`url(#${id}-outline)`}>
          <path d="M230 92c16 89-45 151-103 153l29 27h69l59-82Z" fill={identity.shade} opacity=".5" />
          <path d={outline} fill={`url(#${id}-pattern)`} opacity=".32" />
          <path d="M100 79q-21 19-21 45" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="11" strokeLinecap="round" />
        </g>
      </g>}
    </svg>
    {showIdentity && <div className="balloons-identity-label"><strong data-balloon-type>{type}</strong><span>{identity.colour}</span><span>{identity.pattern}</span></div>}
  </div>
}
