import { useT } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { Deck, DeckState } from '../audio/deck'
import { useAnimationFrame } from '../hooks/useEngine'
import { HOT_CUE_COLORS } from './colors'

const ZOOMS = [2, 4, 8, 16, 32] // seconds visible

/**
 * Scrolling waveform centred on the play head, with the beat grid (bar lines
 * brighter), cue marker and a 4-beat counter. Drag to move through the track.
 */
interface WaveProps {
  deck: Deck
  state: DeckState
  onOpenLibrary: () => void
  onPickFile: () => void
}

export function WaveView({ deck, state, onOpenLibrary, onPickFile }: WaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beatsRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const [zoom, setZoom] = useState(2) // index into ZOOMS
  const colors = useRef({ accent: '#22d3ee', cue: '#facc15' })
  const drag = useRef<{ x: number; pos: number } | null>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    colors.current = { accent: cs.color, cue: cs.getPropertyValue('--cue').trim() || '#facc15' }
  }, [state.id])

  // Keep the backing store matched to the element size / pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)

    const pos = deck.position
    const span = ZOOMS[zoom]
    const pps = w / span // pixels per second
    const center = w / 2
    const tAt = (x: number) => pos + (x - center) / pps
    const xAt = (t: number) => center + (t - pos) * pps
    const { detail, detailRate, bpm, firstBeat, cuePoint, duration, loop, hotCues } = state

    // Active loop region
    if (loop) {
      const x0 = xAt(loop.start)
      const x1 = xAt(loop.end)
      g.fillStyle = 'rgba(74, 222, 128, 0.16)'
      g.fillRect(x0, 0, x1 - x0, h)
      g.fillStyle = 'rgba(74, 222, 128, 0.9)'
      g.fillRect(Math.round(x0), 0, 2, h)
      g.fillRect(Math.round(x1) - 2, 0, 2, h)
    }

    // Beat grid
    let beatInBar = -1
    if (bpm) {
      const beatLen = 60 / bpm
      const k0 = Math.ceil((tAt(0) - firstBeat) / beatLen)
      const k1 = Math.floor((tAt(w) - firstBeat) / beatLen)
      for (let k = k0; k <= k1; k++) {
        const t = firstBeat + k * beatLen
        if (t < 0 || t > duration) continue
        const bar = ((k % 4) + 4) % 4 === 0
        g.fillStyle = bar ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.14)'
        g.fillRect(Math.round(xAt(t)), 0, bar ? 2 : 1, h)
      }
      const current = Math.floor((pos - firstBeat) / beatLen)
      beatInBar = ((current % 4) + 4) % 4
    }

    // Waveform: max of the bins under each pixel column. With band data the
    // lows, mids and highs are layered (dim accent / accent / white).
    if (detail) {
      const mid = h / 2
      const drawRange = (data: Float32Array, x0: number, x1: number, scale: number) => {
        for (let x = x0; x < x1; x++) {
          const b0 = Math.floor(tAt(x) * detailRate)
          const b1 = Math.max(b0 + 1, Math.floor(tAt(x + 1) * detailRate))
          if (b1 <= 0 || b0 >= data.length) continue
          let m = 0
          for (let b = Math.max(0, b0); b < Math.min(data.length, b1); b++) if (data[b] > m) m = data[b]
          const ph = Math.max(1, m * scale * (h - 6))
          g.fillRect(x, mid - ph / 2, 1, ph)
        }
      }
      const layers: [Float32Array, string, number, number][] = state.bands
        ? [
            [state.bands.low, colors.current.accent, 0.5, 1],
            [state.bands.mid, colors.current.accent, 1, 0.9],
            [state.bands.high, '#f8fafc', 0.9, 0.75],
          ]
        : [[detail, colors.current.accent, 1, 1]]
      const split = Math.floor(center)
      for (const [data, color, alpha, scale] of layers) {
        g.fillStyle = color
        g.globalAlpha = alpha * 0.35 // already played
        drawRange(data, 0, split, scale)
        g.globalAlpha = alpha
        drawRange(data, split, Math.ceil(w), scale)
      }
      g.globalAlpha = 1
    }

    // Cue marker
    if (duration > 0) {
      const x = xAt(cuePoint)
      if (x >= -6 && x <= w + 6) {
        g.fillStyle = colors.current.cue
        g.fillRect(Math.round(x), 0, 2, h)
        g.beginPath()
        g.moveTo(x - 5, 0)
        g.lineTo(x + 7, 0)
        g.lineTo(x + 1, 7)
        g.fill()
      }
    }

    // Hot cues: coloured line + numbered flag
    g.font = '700 10px system-ui, sans-serif'
    g.textBaseline = 'middle'
    hotCues.forEach((t, i) => {
      if (t === null) return
      const x = xAt(t)
      if (x < -16 || x > w + 2) return
      g.fillStyle = HOT_CUE_COLORS[i]
      g.fillRect(Math.round(x), 0, 2, h)
      g.fillRect(Math.round(x), h - 14, 14, 14)
      g.fillStyle = '#0b0d12'
      g.fillText(String(i + 1), Math.round(x) + 4, h - 7)
    })

    // Play head
    if (duration > 0) {
      g.fillStyle = '#fff'
      g.fillRect(Math.round(center) - 1, 0, 2, h)
    }

    // Beat counter
    const dots = beatsRef.current?.children
    if (dots) {
      for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('is-on', i === beatInBar && state.playing)
    }
  })

  return (
    <div
      className="wave"
      onPointerDown={(e) => {
        if (!state.duration) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, pos: deck.position }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const pps = e.currentTarget.clientWidth / ZOOMS[zoom]
        deck.seek(d.pos - (e.clientX - d.x) / pps)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <canvas ref={canvasRef} />
      <div ref={beatsRef} className={`wave-beats ${state.duration ? '' : 'is-hidden'}`} aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className={`wave-zoom ${state.duration ? '' : 'is-hidden'}`} onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label={t('Zoom out')} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)}>
          −
        </button>
        <button aria-label={t('Zoom in')} disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
          +
        </button>
      </div>
      {state.loading && (
        <div className="wave-state">
          <span className="spinner" aria-hidden />
          <span>{t('Loading track…')}</span>
        </div>
      )}
      {!state.loading && state.analyzing && (
        <div className="wave-pill">
          <span className="spinner spinner-small" aria-hidden />
          {t('Finding the tempo…')}
        </div>
      )}
      {!state.loading && !state.duration && (
        <div className={`wave-state ${state.error ? 'is-error' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
          <span className="wave-state-text">{state.error ?? t('Deck {id} is empty', { id: state.id })}</span>
          <div className="wave-state-actions">
            <button className="btn btn-small btn-library" onClick={onOpenLibrary}>
              {t('Library')}
            </button>
            <button className="btn btn-small" onClick={onPickFile}>
              {state.error ? t('Choose another file') : t('Open a file')}
            </button>
          </div>
          <small className="wave-drop-hint">{t('or drop an audio file here')}</small>
        </div>
      )}
    </div>
  )
}
