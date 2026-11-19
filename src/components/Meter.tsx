import { useRef } from 'react'
import { readPeak } from '../audio/meter'
import { useAnimationFrame } from '../hooks/useEngine'

const FLOOR_DB = -48
const FALL_DB_PER_FRAME = 0.8
const HOLD_FRAMES = 45

/** Vertical peak meter: -48..0 dBFS, fast attack, slow fall, peak-hold tick. */
export function Meter({ analyser, label }: { analyser: AnalyserNode; label: string }) {
  const coverRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLDivElement>(null)
  const scratch = useRef(new Float32Array(analyser.fftSize))
  const level = useRef(FLOOR_DB)
  const hold = useRef({ db: FLOOR_DB, frames: 0 })

  useAnimationFrame(() => {
    const peak = readPeak(analyser, scratch.current)
    const db = peak > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(peak)) : FLOOR_DB
    level.current = Math.max(db, level.current - FALL_DB_PER_FRAME)
    const h = hold.current
    if (db >= h.db) {
      h.db = db
      h.frames = HOLD_FRAMES
    } else if (--h.frames <= 0) {
      h.db = Math.max(FLOOR_DB, h.db - FALL_DB_PER_FRAME)
    }
    const frac = (v: number) => Math.min(1, (v - FLOOR_DB) / -FLOOR_DB)
    if (coverRef.current) coverRef.current.style.transform = `scaleY(${1 - frac(level.current)})`
    if (holdRef.current) {
      holdRef.current.style.bottom = `${frac(h.db) * 100}%`
      holdRef.current.style.opacity = h.db > FLOOR_DB ? '1' : '0'
    }
  })

  return (
    <div className="meter" role="meter" aria-label={label}>
      <div ref={coverRef} className="meter-cover" />
      <div ref={holdRef} className="meter-hold" />
    </div>
  )
}
