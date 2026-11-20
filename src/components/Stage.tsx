import { useEffect, useRef } from 'react'
import { coach } from '../game'

/**
 * Ambient light behind the desk: two soft glows, cyan for deck A and orange
 * for deck B, that follow what you hear and breathe gently on the beat.
 * Deliberately subtle; static for reduced-motion users.
 */
export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    const fit = () => {
      // The glows are blurry by nature: render at low resolution.
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.ceil(w / 2)
      canvas.height = Math.ceil(h / 2)
      g.setTransform(0.5, 0, 0, 0.5, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    const level = [0.15, 0.15]
    let flash = 0
    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 40) return
      last = now
      const p = coach.presence()
      for (let i = 0; i < 2; i++) level[i] += (0.12 + p[i] * 0.55 - level[i]) * 0.08
      flash = reduce ? 0 : Math.max(coach.pulse(), flash * 0.85)
      const t = reduce ? 0 : now / 1000

      g.fillStyle = '#07080c'
      g.fillRect(0, 0, w, h)
      const r = Math.max(w, h) * 0.75
      const glow = (x: number, y: number, rgb: string, a: number) => {
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, `rgba(${rgb},${a})`)
        grad.addColorStop(1, `rgba(${rgb},0)`)
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      }
      glow(w * (0.12 + Math.sin(t * 0.13) * 0.04), h * (0.08 + Math.cos(t * 0.11) * 0.05), '34,211,238', level[0] * (0.55 + 0.25 * flash))
      glow(w * (0.88 + Math.cos(t * 0.12) * 0.04), h * (0.92 + Math.sin(t * 0.1) * 0.05), '251,146,60', level[1] * (0.55 + 0.25 * flash))
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [])

  return <canvas ref={ref} className="stage" aria-hidden />
}
