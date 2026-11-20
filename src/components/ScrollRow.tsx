import { type ReactNode, type Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useT } from '../i18n'

/**
 * A horizontal row of chips that scrolls sideways on every device: swipe on
 * touch, mouse wheel or drag on desktop, and ‹ › buttons with faded edges
 * whenever there is more to see.
 */
export function ScrollRow({
  children,
  className,
  label,
  role,
  ref,
}: {
  children: ReactNode
  className?: string
  label: string
  role?: string
  ref?: Ref<HTMLDivElement | null>
}) {
  const t = useT()
  const rowRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => rowRef.current as HTMLDivElement, [])
  const [edges, setEdges] = useState({ start: false, end: false })
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  const measure = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    const start = el.scrollLeft > 2
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }))
  }, [])

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // A vertical mouse wheel scrolls the row sideways.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [measure])

  const page = (dir: 1 | -1) => {
    const el = rowRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`scroll-row ${edges.start ? 'has-start' : ''} ${edges.end ? 'has-end' : ''}`}>
      <button type="button" className="scroll-row-btn is-start" tabIndex={-1} aria-label={t('Scroll left')} hidden={!edges.start} onClick={() => page(-1)}>
        ‹
      </button>
      <div
        ref={rowRef}
        className={`scroll-row-track ${className ?? ''}`}
        role={role}
        aria-label={label}
        onScroll={measure}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          if (!d.moved && Math.abs(dx) < 5) return
          if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId)
          d.moved = true
          e.currentTarget.scrollLeft = d.left - dx
        }}
        onPointerUp={() => {
          // Keep `moved` until the click that follows a drag has been swallowed.
          window.setTimeout(() => (drag.current = null), 0)
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {children}
      </div>
      <button type="button" className="scroll-row-btn is-end" tabIndex={-1} aria-label={t('Scroll right')} hidden={!edges.end} onClick={() => page(1)}>
        ›
      </button>
    </div>
  )
}
