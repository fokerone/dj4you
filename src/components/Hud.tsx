import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, QUEST } from '../game/game'
import { game } from '../game'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { Brand, LangSwitch } from './Brand'

/** Score, combo, crowd energy and DJ level: the game's heads-up display. */
export function Hud() {
  const t = useT()
  const s = useStore(game)
  const score = useCountUp(s.score)
  const [open, setOpen] = useState(false)
  const hot = s.energy >= 80

  return (
    <div className="hud">
      <Brand className="hud-brand" />
      <Brand compact className="hud-brand-mark" />
      <div className={`hud-energy ${hot ? 'is-hot' : ''}`} title={t('Crowd energy')}>
        <span className="hud-label">{t('Crowd')}</span>
        <div className="hud-bar" role="meter" aria-label={t('Crowd energy')} aria-valuenow={Math.round(s.energy)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ transform: `scaleX(${s.energy / 100})` }} />
        </div>
        <b>{Math.round(s.energy)}%</b>
      </div>
      <div className="hud-score" aria-label={t('Score')}>
        <b>{score.toLocaleString()}</b>
        {s.multiplier > 1 && (
          <span key={s.combo} className="hud-combo">
            x{s.multiplier % 1 ? s.multiplier.toFixed(1) : s.multiplier}
          </span>
        )}
      </div>
      <button className="hud-level" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Level {n}, {title}. Show achievements', { n: s.level, title: t(s.levelTitle) })}>
        <span className="hud-lv">{t('Lv {n}', { n: s.level })}</span>
        <span className="hud-title">{t(s.levelTitle)}</span>
        <span className="hud-xp">
          <i style={{ transform: `scaleX(${s.levelProgress})` }} />
        </span>
      </button>
      {open && <Trophies onClose={() => setOpen(false)} />}
    </div>
  )
}

function Trophies({ onClose }: { onClose: () => void }) {
  const t = useT()
  const s = useStore(game)
  return (
    <div className="trophies" role="dialog" aria-label={t('Achievements')}>
      <header>
        <b>
          {t('Achievements')} {s.achievements.length}/{Object.keys(ACHIEVEMENTS).length}
        </b>
        <button className="btn btn-small" onClick={onClose} aria-label={t('Close achievements')}>
          ✕
        </button>
      </header>
      <div className="trophies-lang">
        <span>{t('Language')}</span>
        <LangSwitch />
      </div>
      <ul>
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
            </li>
          )
        })}
      </ul>
      {s.questStep < 0 && (
        <button className="btn btn-small" onClick={() => (game.startQuest(), onClose())}>
          {t('Replay the first-mix tutorial')}
        </button>
      )}
    </div>
  )
}

/** Animate the score towards its new value. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 400)
      const v = Math.round(a + (target - a) * (1 - (1 - k) ** 3))
      setShown(v)
      from.current = v
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

/** Floating "PERFECT TRANSITION" style call-outs and achievement toasts. */
export function Popups() {
  const t = useT()
  const { events } = useStore(game)
  const shouts = events.filter((e) => e.kind !== 'achievement' && e.kind !== 'info')
  const infos = events.filter((e) => e.kind === 'info')
  const trophies = events.filter((e) => e.kind === 'achievement')
  return (
    <>
      <div className="shouts" aria-live="polite">
        {shouts.slice(-1).map((e) => (
          <div key={e.id} className={`shout shout-${e.kind}`}>
            <b>{e.text}</b>
            {e.sub && <span>{e.sub}</span>}
          </div>
        ))}
      </div>
      <div className="notes" aria-live="polite">
        {[...infos, ...trophies].slice(-2).map((e) => (
          <div key={e.id} className={`note note-${e.kind}`}>
            {e.kind === 'achievement' && (
              <span className="note-star" aria-hidden>
                ★
              </span>
            )}
            <span>
              {e.kind === 'achievement' && <small>{t('Achievement unlocked')}</small>}
              <b>{e.text}</b>
              {e.sub && <small>{e.sub}</small>}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/** The guided first-mix quest. */
export function Coach() {
  const t = useT()
  const { questStep } = useStore(game)
  const step = QUEST[questStep]
  if (!step) return null
  return (
    <div className="coach" role="status">
      <div className="coach-head">
        <span className="coach-count">
          {t('Mission {n}/{total}', { n: questStep + 1, total: QUEST.length })}
        </span>
        <button className="coach-skip" onClick={() => game.skipQuest()}>
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

/** Beat alignment between the decks: centred and green = in the pocket. */
export function PhaseMeter() {
  const t = useT()
  const { phaseDiff, inSync, clashing } = useStore(game)
  const known = phaseDiff !== null
  return (
    <div className={`phase ${known ? '' : 'is-off'} ${inSync ? 'is-sync' : ''} ${clashing && known ? 'is-clash' : ''}`} title={t('Beat alignment between deck A and B')}>
      <span className="phase-label">{t(known ? (inSync ? 'IN SYNC' : 'ALIGN') : 'PHASE')}</span>
      <div className="phase-track">
        <span className="phase-zone" />
        {known && <span className="phase-needle" style={{ left: `${50 + phaseDiff * 100}%` }} />}
      </div>
    </div>
  )
}
