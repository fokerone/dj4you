import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import { coach } from '../game'
import { markWelcomed } from '../game/welcome'
import { useT } from '../i18n'
import { library } from '../library/library'
import { Brand, LangSwitch } from './Brand'
import { LiveIcon } from './NextSteps'
import { MAX_LISTENERS } from '../live/config'

/** Welcome: learn with the guided first mix, jump straight in, or start empty. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const t = useT()
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primary.current?.focus()
  }, [])

  const finish = (mode: 'tutorial' | 'quick' | 'empty') => {
    markWelcomed()
    void engine.resume()
    if (mode === 'tutorial') coach.startQuest()
    if (mode === 'quick') {
      void library.loadDemo(0, engine.decks[0])
      void library.loadDemo(1, engine.decks[1])
    }
    onDone()
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <header className="welcome-top">
        <Brand />
        <LangSwitch />
      </header>

      <div className="welcome-main">
        <Turntable />

        <div className="welcome-copy">
          <h1 id="welcome-title">{t('Mix like a DJ, right in your browser.')}</h1>
          <p className="welcome-lead">{t('Two decks, sync, loops and effects. No downloads, no sign-up.')}</p>

          <div className="welcome-choices">
            <button ref={primary} className="choice choice-learn" onClick={() => finish('tutorial')}>
              <span className="choice-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
                  <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
                </svg>
              </span>
              <span className="choice-text">
                <b>{t('Learn in 2 minutes')}</b>
                <small>{t('A guided first mix, one step at a time')}</small>
              </span>
              <span className="choice-arrow" aria-hidden>
                →
              </span>
            </button>
            <button className="choice" onClick={() => finish('quick')}>
              <span className="choice-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="choice-text">
                <b>{t('Start mixing')}</b>
                <small>{t('Two demo beats, loaded and ready')}</small>
              </span>
              <span className="choice-arrow" aria-hidden>
                →
              </span>
            </button>
          </div>

          <button className="welcome-empty" onClick={() => finish('empty')}>
            {t('Start with an empty desk')}
          </button>

          <div className="welcome-promos" aria-label={t('Also in DJ4YOU')}>
            <div className="promo-mini">
              <span className="promo-icon promo-rec" aria-hidden>
                <span className="rec-dot" />
              </span>
              <span>
                <b>{t('Record your sets')}</b>
                <small>{t('Save your mix, download it and share it.')}</small>
              </span>
            </div>
            <div className="promo-mini">
              <span className="promo-icon promo-live" aria-hidden>
                <LiveIcon />
              </span>
              <span>
                <b>{t('Stream live')}</b>
                <small>{t('Up to {n} listeners with a link or QR code.', { n: MAX_LISTENERS })}</small>
              </span>
            </div>
          </div>
        </div>
      </div>

      <ul className="welcome-facts">
        <li>{t('Free')}</li>
        <li>{t('No sign-up')}</li>
        <li>{t('Your music stays on your device')}</li>
        <li>{t('Works offline once installed')}</li>
      </ul>
    </div>
  )
}

/** A spinning record on a platter with its tonearm: pure CSS/SVG, no images. */
function Turntable() {
  return (
    <div className="tt" aria-hidden>
      <div className="tt-plinth">
        <div className="tt-platter">
          <svg className="tt-record" viewBox="0 0 200 200">
            <defs>
              <radialGradient id="tt-vinyl" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#1b1f2a" />
                <stop offset="1" stopColor="#0a0c11" />
              </radialGradient>
              <linearGradient id="tt-label" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="1" stopColor="#fb923c" />
              </linearGradient>
              <linearGradient id="tt-sheen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
                <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#tt-vinyl)" />
            {Array.from({ length: 14 }, (_, i) => (
              <circle key={i} cx="100" cy="100" r={42 + i * 4} fill="none" stroke="#ffffff" strokeOpacity={i % 3 === 0 ? 0.07 : 0.035} />
            ))}
            <circle cx="100" cy="100" r="34" fill="url(#tt-label)" />
            <text x="100" y="108" textAnchor="middle" fontSize="22" fontWeight="800" fill="#07080c" fontFamily="Space Grotesk, Inter, sans-serif">
              4
            </text>
            <circle cx="100" cy="100" r="3" fill="#07080c" />
            <circle cx="100" cy="100" r="98" fill="url(#tt-sheen)" />
          </svg>
        </div>
        <div className="tt-arm">
          <span className="tt-arm-base" />
          <span className="tt-arm-rod" />
          <span className="tt-arm-head" />
        </div>
        <div className="tt-eq">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
