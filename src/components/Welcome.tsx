import { engine } from '../audio/engine'
import { game } from '../game'
import { library } from '../library/library'
import { markWelcomed } from '../game/welcome'
import { useT } from '../i18n'
import { Brand, LangSwitch } from './Brand'

/** First-run screen: pick the tutorial, a quick start, or free play. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const t = useT()
  const finish = (mode: 'tutorial' | 'quick' | 'free') => {
    markWelcomed()
    void engine.resume()
    if (mode === 'tutorial') game.startQuest()
    if (mode === 'quick') {
      void library.loadDemo(0, engine.decks[0])
      void library.loadDemo(1, engine.decks[1])
    }
    onDone()
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={t('Welcome to DJ4YOU')}>
      <LangSwitch className="welcome-lang" />
      <div className="welcome-card">
        <div className="welcome-disc" aria-hidden>
          <span>4</span>
        </div>
        <h1 className="welcome-logo">
          <Brand />
        </h1>
        <p className="welcome-tag">{t('Rock the crowd. Right from your browser.')}</p>
        <ul className="welcome-points">
          <li>
            <b>{t('Mix')}</b> {t('two decks with sync, EQ, loops and FX')}
          </li>
          <li>
            <b>{t('Score')}</b> {t('points for smooth, in-time transitions')}
          </li>
          <li>
            <b>{t('Level up')}</b> {t('from Bedroom DJ to Festival Legend')}
          </li>
        </ul>
        <button className="btn btn-hero" onClick={() => finish('tutorial')}>
          {t('Play the tutorial')}
          <small>{t('Your first mix in 2 minutes')}</small>
        </button>
        <div className="welcome-alt">
          <button className="btn" onClick={() => finish('quick')}>
            {t('Quick start with 2 beats')}
          </button>
          <button className="btn" onClick={() => finish('free')}>
            {t('Free play')}
          </button>
        </div>
      </div>
    </div>
  )
}
