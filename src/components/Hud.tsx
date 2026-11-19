import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, QUEST } from '../game/game'
import { game } from '../game'
import { useStore } from '../hooks/useEngine'

/** Score, combo, crowd energy and DJ level: the game's heads-up display. */
export function Hud() {
  const s = useStore(game)
  const score = useCountUp(s.score)
  const [open, setOpen] = useState(false)
  const hot = s.energy >= 80

  return (
    <div className="hud">
      <div className={`hud-energy ${hot ? 'is-hot' : ''}`} title="Crowd energy">
        <span className="hud-label">Crowd</span>
        <div className="hud-bar" role="meter" aria-label="Crowd energy" aria-valuenow={Math.round(s.energy)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ transform: `scaleX(${s.energy / 100})` }} />
        </div>
        <b>{Math.round(s.energy)}%</b>
      </div>
      <div className="hud-score" aria-label="Score">
        <b>{score.toLocaleString()}</b>
        {s.multiplier > 1 && (
          <span key={s.combo} className="hud-combo">
            x{s.multiplier % 1 ? s.multiplier.toFixed(1) : s.multiplier}
          </span>
        )}
      </div>
      <button className="hud-level" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Level ${s.level}, ${s.levelTitle}. Show achievements`}>
        <span className="hud-lv">Lv {s.level}</span>
        <span className="hud-title">{s.levelTitle}</span>
        <span className="hud-xp">
          <i style={{ transform: `scaleX(${s.levelProgress})` }} />
        </span>
      </button>
      {open && <Trophies onClose={() => setOpen(false)} />}
    </div>
  )
}

function Trophies({ onClose }: { onClose: () => void }) {
  const s = useStore(game)
  return (
    <div className="trophies" role="dialog" aria-label="Achievements">
      <header>
        <b>
          Achievements {s.achievements.length}/{Object.keys(ACHIEVEMENTS).length}
        </b>
        <button className="btn btn-small" onClick={onClose} aria-label="Close achievements">
          ✕
        </button>
      </header>
      <ul>
        {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
          const got = s.achievements.includes(id)
          return (
            <li key={id} className={got ? 'is-got' : ''}>
              <span className="trophy-icon" aria-hidden>
                {got ? '★' : '☆'}
              </span>
              <span>
                <b>{a.title}</b>
                <small>{a.text}</small>
              </span>
            </li>
          )
        })}
      </ul>
      {(s.questDone || s.questStep >= 0) && s.questStep < 0 && (
        <button className="btn btn-small" onClick={() => (game.startQuest(), onClose())}>
          Replay the first-mix tutorial
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
              {e.kind === 'achievement' && <small>Achievement unlocked</small>}
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
  const { questStep } = useStore(game)
  const step = QUEST[questStep]
  if (!step) return null
  return (
    <div className="coach" role="status">
      <div className="coach-head">
        <span className="coach-count">
          Mission {questStep + 1}/{QUEST.length}
        </span>
        <button className="coach-skip" onClick={() => game.skipQuest()}>
          Skip tutorial
        </button>
      </div>
      <b>{step.title}</b>
      <p>{step.text}</p>
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
  const { phaseDiff, inSync, clashing } = useStore(game)
  const known = phaseDiff !== null
  return (
    <div className={`phase ${known ? '' : 'is-off'} ${inSync ? 'is-sync' : ''} ${clashing && known ? 'is-clash' : ''}`} title="Beat alignment between deck A and B">
      <span className="phase-label">{known ? (inSync ? 'IN SYNC' : 'ALIGN') : 'PHASE'}</span>
      <div className="phase-track">
        <span className="phase-zone" />
        {known && <span className="phase-needle" style={{ left: `${50 + phaseDiff * 100}%` }} />}
      </div>
    </div>
  )
}
