import { engine } from '../audio/engine'
import { game } from '../game'
import { library } from '../library/library'
import { markWelcomed } from '../game/welcome'

/** First-run screen: pick the tutorial, a quick start, or free play. */
export function Welcome({ onDone }: { onDone: () => void }) {
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
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to DJ4YOU">
      <div className="welcome-card">
        <div className="welcome-disc" aria-hidden>
          <span>4</span>
        </div>
        <h1 className="welcome-logo">
          DJ<span>4</span>YOU
        </h1>
        <p className="welcome-tag">Rock the crowd. Right from your browser.</p>
        <ul className="welcome-points">
          <li>
            <b>Mix</b> two decks with sync, EQ, loops and FX
          </li>
          <li>
            <b>Score</b> points for smooth, in-time transitions
          </li>
          <li>
            <b>Level up</b> from Bedroom DJ to Festival Legend
          </li>
        </ul>
        <button className="btn btn-hero" onClick={() => finish('tutorial')}>
          Play the tutorial
          <small>Your first mix in 2 minutes</small>
        </button>
        <div className="welcome-alt">
          <button className="btn" onClick={() => finish('quick')}>
            Quick start with 2 beats
          </button>
          <button className="btn" onClick={() => finish('free')}>
            Free play
          </button>
        </div>
      </div>
    </div>
  )
}
