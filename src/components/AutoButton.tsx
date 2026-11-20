import { useEffect, useRef } from 'react'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { automix } from '../library/automix'
import { coach } from '../game'

/** AUTO: let DJ4YOU mix the queue. Shows what it's doing while on. */
export function AutoButton({ className }: { className?: string }) {
  const t = useT()
  const s = useStore(automix)
  const last = useRef(s.reason)

  // Say why AUTO stopped or is waiting, once.
  useEffect(() => {
    if (s.reason === last.current) return
    last.current = s.reason
    if (s.reason === 'manual') coach.notify('info', t('AUTO off'), t('You moved the crossfader, so you have the controls again.'))
    if (s.reason === 'empty' && s.on) coach.notify('info', t('The queue is empty'), t('Add tracks to Up next in the Library (≡+) and AUTO keeps mixing.'))
  }, [s.reason, s.on, t])

  const label = !s.on
    ? t('Let DJ4YOU mix the queue for you')
    : s.phase === 'mixing'
      ? t('Mixing into the next track…')
      : s.nextIn !== null
        ? t('Next blend in {s} s', { s: Math.ceil(s.nextIn) })
        : t('AUTO is on: tap to stop')

  return (
    <button
      className={`btn btn-auto ${s.on ? 'is-on' : ''} ${s.phase === 'mixing' ? 'is-mixing' : ''} ${className ?? ''}`}
      aria-pressed={s.on}
      title={label}
      aria-label={`AUTO. ${label}`}
      onClick={() => automix.toggle()}
    >
      <span className="auto-dot" aria-hidden />
      AUTO
      {s.on && s.nextIn !== null && s.phase === 'playing' && <span className="auto-count">{Math.ceil(s.nextIn)}s</span>}
    </button>
  )
}
