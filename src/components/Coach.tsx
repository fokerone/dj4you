import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, QUEST } from '../game/game'
import { coach } from '../game'
import { useStore } from '../hooks/useEngine'
import { SHORTCUTS } from '../hooks/useShortcuts'
import { useT } from '../i18n'
import { Brand, LangSwitch } from './Brand'

/** Short confirmations and achievement unlocks, top of the screen. */
export function Notes() {
  const t = useT()
  const { notes } = useStore(coach)
  return (
    <div className="notes" aria-live="polite">
      {notes.map((n) => (
        <div key={n.id} className={`note note-${n.kind}`}>
          <span className="note-icon" aria-hidden>
            {n.kind === 'achievement' ? '★' : n.kind === 'success' ? '✓' : 'i'}
          </span>
          <span className="note-text">
            {n.kind === 'achievement' && <small className="note-eyebrow">{t('Achievement unlocked')}</small>}
            <b>{n.text}</b>
            {n.sub && <small>{n.sub}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** One calm, actionable tip (e.g. beats clash → SYNC). */
export function HintBar() {
  const t = useT()
  const { hint } = useStore(coach)
  if (!hint) return null
  return (
    <div className="hint" role="status">
      <span className="hint-dot" aria-hidden />
      <span className="hint-text">{hint.text}</span>
      {hint.syncDeck && (
        <button className="btn btn-small hint-fix" onClick={() => coach.applyHint()}>
          {t('SYNC deck {id}', { id: hint.syncDeck })}
        </button>
      )}
      <button className="hint-close" onClick={() => coach.dismissHint()} aria-label={t('Dismiss tip')}>
        ✕
      </button>
    </div>
  )
}

/** The guided first-mix tutorial card. */
export function TutorialCard() {
  const t = useT()
  const { questStep } = useStore(coach)
  const step = QUEST[questStep]
  if (!step) return null
  return (
    <div className="coach" role="status">
      <div className="coach-head">
        <span className="coach-count">{t('Step {n} of {total}', { n: questStep + 1, total: QUEST.length })}</span>
        <button className="coach-skip" onClick={() => coach.skipQuest()}>
          {t('Skip tutorial')}
        </button>
      </div>
      <b>{t(step.title)}</b>
      <p>{t(step.text)}</p>
      <div className="coach-dots" aria-hidden>
        {QUEST.map((q, i) => (
          <i key={q.id} className={i < questStep ? 'is-done' : i === questStep ? 'is-now' : ''} />
        ))}
      </div>
    </div>
  )
}

/** Beat alignment between the decks, with a plain-language state. */
export function PhaseMeter() {
  const t = useT()
  const { phaseDiff, phaseReason, inSync, clashing } = useStore(coach)
  const known = phaseDiff !== null
  const label = known
    ? inSync
      ? t('Beats aligned')
      : clashing
        ? t('Beats off')
        : t('Beat phase')
    : phaseReason === 'tempo'
      ? t('Different tempos')
      : phaseReason === 'nobpm'
        ? t('No tempo detected')
        : t('Play both decks')
  return (
    <div className={`phase ${known ? '' : 'is-off'} ${inSync ? 'is-sync' : ''} ${clashing && known ? 'is-clash' : ''}`}>
      <span className="phase-label">{label}</span>
      <div className="phase-track" title={t('Beat alignment between deck A and B')}>
        <span className="phase-zone" />
        {known && <span className="phase-needle" style={{ left: `${50 + phaseDiff * 100}%` }} />}
      </div>
    </div>
  )
}

/** Menu button (phones: in the slim top bar; desktop: in the header). */
export function MenuButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const t = useT()
  const { achievements } = useStore(coach)
  const total = Object.keys(ACHIEVEMENTS).length
  return (
    <button className={`btn btn-small btn-menu ${className ?? ''}`} onClick={onOpen} aria-label={t('Menu')}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
      <span className="menu-count" title={t('Achievements')}>
        ★ {achievements.length}/{total}
      </span>
    </button>
  )
}

/** Slim bar on phones: logo + menu. */
export function PhoneBar({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="phonebar">
      <Brand className="phonebar-brand" />
      <MenuButton onOpen={onMenu} />
    </div>
  )
}

/** Settings + progress: language, achievements, tutorial, shortcuts. */
export function MenuSheet({
  open,
  onClose,
  onWelcome,
  onHeadphones,
  onHelp,
}: {
  open: boolean
  onClose: () => void
  onWelcome: () => void
  onHeadphones: () => void
  onHelp: () => void
}) {
  const t = useT()
  const s = useStore(coach)
  const [confirmReset, setConfirmReset] = useState(false)
  const total = Object.keys(ACHIEVEMENTS).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!confirmReset) return
    const tm = window.setTimeout(() => setConfirmReset(false), 3000)
    return () => window.clearTimeout(tm)
  }, [confirmReset])

  if (!open) return null
  const minutes = Math.floor(s.mixSeconds / 60)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-menu" role="dialog" aria-modal="true" aria-label={t('Menu')} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{t('Menu')}</h2>
          <button className="btn btn-small" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </header>
        <div className="sheet-body">
          <section className="menu-row">
            <span>{t('Language')}</span>
            <LangSwitch />
          </section>

          <button
            className="btn menu-row menu-link menu-help"
            onClick={() => {
              onClose()
              onHelp()
            }}
          >
            <span>{t('Help')}</span>
            <span className="dim">{t('What every control does')} →</span>
          </button>

          <button
            className="btn menu-row menu-link"
            onClick={() => {
              onClose()
              onHeadphones()
            }}
          >
            <span>{t('Headphones')}</span>
            <span className="dim">{t('Preview the next track')} →</span>
          </button>

          <section className="menu-stats" aria-label={t('This session')}>
            <div>
              <b>{minutes}</b>
              <span>{t('minutes mixing')}</span>
            </div>
            <div>
              <b>{s.transitions}</b>
              <span>{t('transitions')}</span>
            </div>
            <div>
              <b>
                {s.achievements.length}/{total}
              </b>
              <span>{t('achievements')}</span>
            </div>
          </section>

          <section className="lib-section">
            <h3>{t('Achievements')}</h3>
            <ul className="trophy-list">
              {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
                const got = s.achievements.includes(id)
                return (
                  <li key={id} className={got ? 'is-got' : ''}>
                    <span className="trophy-icon" aria-hidden>
                      {got ? '★' : '☆'}
                    </span>
                    <span>
                      <b>{t(a.title)}</b>
                      <small>{t(a.text)}</small>
                    </span>
                    <span className="sr-only">{got ? t('Unlocked') : t('Locked')}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="menu-actions">
            <button
              className="btn"
              onClick={() => {
                coach.startQuest()
                onClose()
              }}
              disabled={s.questStep >= 0}
            >
              {s.questStep >= 0 ? t('Tutorial in progress') : t('Play the tutorial again')}
            </button>
            <button
              className="btn"
              onClick={() => {
                onClose()
                onWelcome()
              }}
            >
              {t('Show the welcome screen')}
            </button>
            <button
              className={`btn btn-reset ${confirmReset ? 'is-armed' : ''}`}
              onClick={() => (confirmReset ? (coach.resetProgress(), setConfirmReset(false)) : setConfirmReset(true))}
            >
              {confirmReset ? t('Tap again to reset achievements') : t('Reset achievements')}
            </button>
          </section>

          <section className="lib-section menu-keys">
            <h3>{t('Keyboard shortcuts')}</h3>
            <dl>
              {SHORTCUTS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{t(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <footer className="sheet-foot">
          <Brand />
          <span className="dim">{t('Free · No sign-up · Runs in your browser')}</span>
        </footer>
      </div>
    </div>
  )
}
