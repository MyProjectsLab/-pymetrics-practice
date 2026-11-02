// Original decorative artwork. Rank/suit do not encode a payoff or a future card.
export function CardFace({ turn }: { turn: number }) {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const suits = ['♠', '♥', '♣', '♦']
  const rank = ranks[(turn - 1) % ranks.length]
  const suitIndex = Math.floor((turn - 1) / ranks.length) % suits.length
  const suit = suits[suitIndex]
  const corners: [number, number][] = [[32, 46], [68, 46], [32, 103], [68, 103]]
  const six: [number, number][] = [...corners, [32, 75], [68, 75]]
  const pips: [number, number][] = ({
    A: [[50, 82]], '2': [[50, 46], [50, 103]], '3': [[50, 46], [50, 75], [50, 103]],
    '4': corners, '5': [...corners, [50, 75]], '6': six, '7': [...six, [50, 60]],
    '8': [...six, [50, 60], [50, 90]], '9': [...corners, [32, 65], [68, 65], [32, 84], [68, 84], [50, 75]],
    '10': [...corners, [32, 65], [68, 65], [32, 84], [68, 84], [50, 55], [50, 94]],
  } as Record<string, [number, number][]>)[rank] ?? []
  return <svg className={`cards-drawn-card${suitIndex % 2 ? ' cards-drawn-card-red' : ''}`} viewBox="0 0 100 140" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="98" height="138" rx="8" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <g fill="currentColor" textAnchor="middle" fontFamily="Georgia, serif">
      <text x="15" y="23" fontSize="18">{rank}</text><text x="15" y="39" fontSize="16">{suit}</text>
      {pips.map(([x, y], index) => <text key={index} x={x} y={y} fontSize={rank === 'A' ? 44 : 21}>{suit}</text>)}
      {!pips.length && <><rect x="29" y="44" width="42" height="52" rx="5" fill="none" stroke="currentColor" /><text x="50" y="82" fontSize="34">{rank}</text></>}
      <g transform="rotate(180 50 70)"><text x="15" y="23" fontSize="18">{rank}</text><text x="15" y="39" fontSize="16">{suit}</text></g>
    </g>
  </svg>
}
