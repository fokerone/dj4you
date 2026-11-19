interface FaderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Text shown under the fader */
  display?: string
  /** Value restored on double-click */
  resetTo?: number
  className?: string
  /** Keep the accessible name but don't show the label */
  hideLabel?: boolean
}

/** Vertical fader built on a native range input (multi-touch friendly). */
export function Fader({ label, value, min, max, step, onChange, display, resetTo, className, hideLabel }: FaderProps) {
  return (
    <div className={`fader ${className ?? ''}`}>
      {!hideLabel && <span className="fader-label">{label}</span>}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onDoubleClick={resetTo === undefined ? undefined : () => onChange(resetTo)}
      />
      {display !== undefined && <span className="fader-value">{display}</span>}
    </div>
  )
}
