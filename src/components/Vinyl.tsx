/**
 * The DJ4YOU record: vinyl grooves, the cyan–orange label and a sheen.
 * Used on the welcome turntable and on the decks' jog wheels, so both spin
 * the same disc. `id` keeps the SVG gradients unique on the page.
 */
export function Vinyl({ id, label, className }: { id: string; label: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden>
      <defs>
        <radialGradient id={`${id}-vinyl`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#1b1f2a" />
          <stop offset="1" stopColor="#0a0c11" />
        </radialGradient>
        <linearGradient id={`${id}-label`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-vinyl)`} />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx="100" cy="100" r={42 + i * 4} fill="none" stroke="#ffffff" strokeOpacity={i % 3 === 0 ? 0.07 : 0.035} />
      ))}
      <circle cx="100" cy="100" r="34" fill={`url(#${id}-label)`} />
      <text x="100" y="108" textAnchor="middle" fontSize="22" fontWeight="800" fill="#07080c" fontFamily="Space Grotesk, Inter, sans-serif">
        {label}
      </text>
      <circle cx="100" cy="100" r="3" fill="#07080c" />
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-sheen)`} />
    </svg>
  )
}
