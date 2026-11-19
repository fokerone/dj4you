import { useT } from '../i18n'
import { useEffect, useRef } from 'react'
import type { Deck, DeckState } from '../audio/deck'
import { useAnimationFrame } from '../hooks/useEngine'
import { HOT_CUE_COLORS } from './colors'

/** Full-track waveform overview. Tap or drag to seek. */
export function Overview({ deck, state }: { deck: Deck; state: DeckState }) {
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const playedRef = useRef<HTMLDivElement>(null)
  const { peaks, duration, cuePoint } = state

  // Redraw the waveform when the track or the size changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      if (!peaks) return
      g.fillStyle = getComputedStyle(canvas).color
      const mid = h / 2
      for (let x = 0; x < w; x++) {
        const p = peaks[Math.floor((x / w) * peaks.length)]
        const ph = Math.max(1, p * (h - 4))
        g.fillRect(x, mid - ph / 2, 1, ph)
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [peaks])

  useAnimationFrame(() => {
    const frac = duration > 0 ? deck.position / duration : 0
    const pct = `${(frac * 100).toFixed(3)}%`
    if (headRef.current) headRef.current.style.left = pct
    if (playedRef.current) playedRef.current.style.width = pct
  })

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return
    const r = e.currentTarget.getBoundingClientRect()
    deck.seek(((e.clientX - r.left) / r.width) * duration)
  }

  return (
    <div
      className="overview"
      onPointerDown={(e) => {
        if (!duration) return
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromPointer(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e)
      }}
    >
      <canvas ref={canvasRef} />
      <div ref={playedRef} className="overview-played" />
      {duration > 0 && state.loop && (
        <div
          className="overview-loop"
          style={{
            left: `${(state.loop.start / duration) * 100}%`,
            width: `${Math.max(0.3, ((state.loop.end - state.loop.start) / duration) * 100)}%`,
          }}
        />
      )}
      {duration > 0 &&
        state.hotCues.map(
          (t, i) =>
            t !== null && (
              <div
                key={i}
                className="overview-hotcue"
                style={{ left: `${(t / duration) * 100}%`, background: HOT_CUE_COLORS[i] }}
              />
            ),
        )}
      {duration > 0 && <div className="overview-cue" style={{ left: `${(cuePoint / duration) * 100}%` }} />}
      <div ref={headRef} className="overview-head" />
      {!peaks && (
        <div className="overview-empty">{t(state.loading ? 'Loading…' : state.analyzing ? 'Analyzing…' : 'No track loaded')}</div>
      )}
    </div>
  )
}
