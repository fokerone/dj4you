import { useRef, useState } from 'react'

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  /** Value restored on double-tap / double-click (also the arc's origin) */
  center?: number
  /** Short text inside / under the knob */
  display?: string
  className?: string
  /** Abbreviation used where space is tight (landscape phones) */
  shortLabel?: string
  /** Value text for the drag bubble (defaults to `display`) */
  format?: (v: number) => string
}

const SWEEP = 270 // degrees of travel
const DRAG_PX = 160 // pixels of vertical drag for the full range

/**
 * Rotary knob. Drag up/down (or sideways) to turn, double-tap to reset,
 * arrow keys for fine steps. The arc is drawn from `center`, so bipolar
 * controls (EQ, filter) show which way they are turned.
 */
export function Knob({ label, value, min, max, onChange, center = min, display, className, shortLabel, format }: KnobProps) {
  const [active, setActive] = useState(false)
  const drag = useRef<{ x: number; y: number; v: number } | null>(null)
  const lastTap = useRef(0)
  const range = max - min
  const frac = (v: number) => (v - min) / range
  const angle = (v: number) => -SWEEP / 2 + frac(v) * SWEEP

  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  // Small detent around the centre so it's easy to find "flat".
  const detent = (v: number) => (center !== min && Math.abs(v - center) < range * 0.02 ? center : v)

  return (
    <div className={`knob ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <div
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={display}
        onPointerDown={(e) => {
          const now = performance.now()
          if (now - lastTap.current < 300) {
            set(center)
            lastTap.current = 0
            return
          }
          lastTap.current = now
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, v: value }
          setActive(true)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const delta = (d.y - e.clientY + (e.clientX - d.x)) / DRAG_PX
          set(detent(d.v + delta * range))
        }}
        onPointerUp={() => {
          drag.current = null
          setActive(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setActive(false)
        }}
        onKeyDown={(e) => {
          const step = range / 50
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step)
          else if (e.key === 'Home' || e.key === 'Enter') set(center)
          else return
          e.preventDefault()
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <path className="knob-track" d={arc(angle(min), angle(max))} />
          {value !== center && (
            <path className="knob-value" d={arc(Math.min(angle(center), angle(value)), Math.max(angle(center), angle(value)))} />
          )}
        </svg>
        <div className="knob-cap" style={{ transform: `rotate(${angle(value)}deg)` }}>
          <i />
        </div>
        {active && (format || display) && (
          <span className="value-bubble knob-bubble" aria-hidden>
            {format ? format(value) : display}
          </span>
        )}
      </div>
      <span className="knob-label">{label}</span>
      {shortLabel && (
        <span className="knob-label knob-label-short" aria-hidden>
          {shortLabel}
        </span>
      )}
      {display !== undefined && <span className="knob-display">{display}</span>}
    </div>
  )
}

/** SVG arc on the knob's ring between two angles (0° = up, clockwise). */
function arc(a0: number, a1: number): string {
  const r = 17
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180
    return `${(20 + r * Math.cos(rad)).toFixed(2)} ${(20 + r * Math.sin(rad)).toFixed(2)}`
  }
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`
}
