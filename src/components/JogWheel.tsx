import { useRef } from 'react'
import type { Deck } from '../audio/deck'
import { useAnimationFrame } from '../hooks/useEngine'

/** A virtual 33⅓ rpm platter: one rotation = 1.8 s of track time. */
const SECONDS_PER_TURN = 1.8
const DEG_PER_SECOND = 360 / SECONDS_PER_TURN
/** Angular speed (rad/s) → tempo bend */
const BEND_PER_RAD_S = 0.03
const MAX_BEND = 0.3

interface Drag {
  angle: number
  time: number
  bend: number
}

/**
 * Jog wheel.
 *  - playing: spin to nudge the tempo (pitch bend) for manual beat-matching
 *  - paused:  turn to scrub through the track precisely
 */
export function JogWheel({ deck, disabled }: { deck: Deck; disabled: boolean }) {
  const platterRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  useAnimationFrame(() => {
    if (platterRef.current) {
      platterRef.current.style.transform = `rotate(${(deck.position * DEG_PER_SECOND) % 360}deg)`
    }
    // Let the bend fall back when the finger stops moving but stays down.
    const d = drag.current
    if (d && d.bend !== 0 && performance.now() - d.time > 60) {
      d.bend = Math.abs(d.bend) < 0.003 ? 0 : d.bend * 0.75
      deck.setBend(d.bend)
    }
  })

  const angleOf = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }

  const release = () => {
    drag.current = null
    deck.setBend(0)
  }

  return (
    <div
      className={`jog ${disabled ? 'is-disabled' : ''}`}
      role="slider"
      aria-label={`Jog wheel deck ${deck.id}`}
      aria-valuetext="Spin to nudge or scrub"
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { angle: angleOf(e), time: performance.now(), bend: 0 }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const a = angleOf(e)
        let delta = a - d.angle
        if (delta > Math.PI) delta -= 2 * Math.PI
        if (delta < -Math.PI) delta += 2 * Math.PI
        const now = performance.now()
        if (deck.getSnapshot().playing) {
          const dt = Math.max(8, now - d.time) / 1000
          const target = Math.max(-MAX_BEND, Math.min(MAX_BEND, (delta / dt) * BEND_PER_RAD_S))
          d.bend = d.bend * 0.5 + target * 0.5
          deck.setBend(d.bend)
        } else {
          deck.seek(deck.position + (delta / (2 * Math.PI)) * SECONDS_PER_TURN)
        }
        d.angle = a
        d.time = now
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={platterRef} className="jog-platter">
        <div className="jog-marker" />
      </div>
      <div className="jog-cap">{deck.id}</div>
    </div>
  )
}
