import { useState } from 'react'

interface FaderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Text shown under the fader (and in the bubble while dragging) */
  display?: string
  /** Value restored on double-click */
  resetTo?: number
  className?: string
  /** Keep the accessible name but don't show the label */
  hideLabel?: boolean
}

/**
 * Vertical fader built on a native range input (multi-touch friendly).
 * While touched, a bubble next to the cap shows the exact value.
 */
export function Fader({ label, value, min, max, step, onChange, display, resetTo, className, hideLabel }: FaderProps) {
  const [active, setActive] = useState(false)
  const frac = (value - min) / (max - min)
  const shown = display ?? String(value)
  return (
    <div className={`fader ${active ? 'is-active' : ''} ${className ?? ''}`}>
      {!hideLabel && <span className="fader-label">{label}</span>}
      <div className="fader-rail">
        <input
          type="range"
          aria-label={label}
          aria-valuetext={shown}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          onDoubleClick={resetTo === undefined ? undefined : () => onChange(resetTo)}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onPointerCancel={() => setActive(false)}
          onBlur={() => setActive(false)}
        />
        {active && (
          <span className="value-bubble fader-bubble" style={{ '--frac': frac } as React.CSSProperties} aria-hidden>
            {shown}
          </span>
        )}
      </div>
      {display !== undefined && <span className="fader-value">{display}</span>}
    </div>
  )
}
