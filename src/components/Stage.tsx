import { useEffect, useRef } from 'react'
import { game } from '../game'

const A = [34, 211, 238] // deck A cyan
const B = [251, 146, 60] // deck B orange
const PEOPLE = 42

interface Person {
  x: number
  scale: number
  phase: number
  hue: number
  hands: number
}

/**
 * The club behind the desk: light beams that sweep and flash on the beat, and
 * a crowd that dances harder as crowd energy rises. Colour follows the
 * crossfader (cyan = deck A, orange = deck B). Runs at ≤30 fps and stops
 * animating for reduced-motion users.
 */
export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const crowd: Person[] = Array.from({ length: PEOPLE }, (_, i) => ({
      x: (i + Math.random() * 0.8) / PEOPLE,
      scale: 0.7 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random(),
      hands: Math.random(),
    })).sort((p, q) => p.scale - q.scale)

    let w = 0
    let h = 0
    const fit = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    let raf = 0
    let last = 0
    let flash = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 33) return // ~30 fps is plenty for ambience
      last = now
      const t = now / 1000
      const { energy } = game.getSnapshot()
      const e = energy / 100
      const pulse = reduce ? 0 : game.pulse()
      flash = Math.max(pulse, flash * 0.8)
      const side = game.side()
      const col = A.map((v, i) => Math.round(v + (B[i] - v) * side))
      const rgb = (a: number) => `rgba(${col[0]},${col[1]},${col[2]},${a})`

      // Room
      g.fillStyle = '#07080c'
      g.fillRect(0, 0, w, h)
      const glow = g.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, Math.max(w, h) * 0.9)
      glow.addColorStop(0, rgb(0.1 + 0.25 * e * (0.5 + flash)))
      glow.addColorStop(1, 'rgba(7,8,12,0)')
      g.fillStyle = glow
      g.fillRect(0, 0, w, h)

      // Light beams from the rig
      g.globalCompositeOperation = 'lighter'
      const beams = 6
      for (let i = 0; i < beams; i++) {
        const ox = (w * (i + 0.5)) / beams
        const sweep = reduce ? 0 : Math.sin(t * (0.35 + i * 0.07) + i * 1.7) * 0.55
        const len = h * 1.15
        const spread = 0.09 + 0.05 * e
        const ang = Math.PI / 2 + sweep
        const alpha = (0.03 + 0.1 * e) * (0.55 + 0.9 * flash)
        const grad = g.createLinearGradient(ox, 0, ox + Math.cos(ang) * len, Math.sin(ang) * len)
        const c = i % 2 ? rgb(alpha) : `rgba(${255},${255},${255},${alpha * 0.5})`
        grad.addColorStop(0, c)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grad
        g.beginPath()
        g.moveTo(ox, -10)
        g.lineTo(ox + Math.cos(ang - spread) * len, Math.sin(ang - spread) * len)
        g.lineTo(ox + Math.cos(ang + spread) * len, Math.sin(ang + spread) * len)
        g.closePath()
        g.fill()
      }
      g.globalCompositeOperation = 'source-over'

      // Crowd silhouettes
      const base = h + 6
      for (const p of crowd) {
        const size = Math.min(70, h * 0.07) * p.scale
        const bounce = reduce ? 0 : (Math.abs(Math.sin(t * 4 + p.phase)) * 0.25 + flash * 0.75) * size * 0.45 * (0.15 + e)
        const x = p.x * w
        const y = base - size * 1.6 - bounce
        const shade = 14 + p.scale * 10
        g.fillStyle = `rgb(${shade},${shade + 2},${shade + 8})`
        // body + head
        g.beginPath()
        g.ellipse(x, y + size * 1.3, size * 0.55, size * 1.1, 0, Math.PI, 0)
        g.fill()
        g.beginPath()
        g.arc(x, y, size * 0.32, 0, Math.PI * 2)
        g.fill()
        // hands up when the energy is high
        if (e > 0.55 && p.hands < e - 0.3) {
          const wave = reduce ? 0 : Math.sin(t * 6 + p.phase) * size * 0.15
          g.strokeStyle = g.fillStyle
          g.lineWidth = size * 0.16
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(x - size * 0.35, y + size * 0.6)
          g.lineTo(x - size * 0.55 + wave, y - size * 0.7)
          g.moveTo(x + size * 0.35, y + size * 0.6)
          g.lineTo(x + size * 0.55 - wave, y - size * 0.7)
          g.stroke()
        }
        // rim light from the stage
        g.fillStyle = rgb((0.08 + 0.35 * e) * (0.4 + flash) * p.scale)
        g.beginPath()
        g.arc(x, y - size * 0.05, size * 0.32, Math.PI * 1.05, Math.PI * 1.95)
        g.fill()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [])

  return <canvas ref={ref} className="stage" aria-hidden />
}
