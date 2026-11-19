import { Deck } from './deck'
import { Mixer } from './mixer'
import { Recorder } from './recorder'

/**
 * The audio graph. Lives outside React: the UI sends commands and subscribes
 * to state, so re-renders can never cause audio glitches.
 */
export class AudioEngine {
  readonly ctx: AudioContext
  readonly mixer: Mixer
  readonly decks: readonly [Deck, Deck]
  readonly recorder: Recorder

  constructor() {
    // iOS: play through the silent switch like a media app (Safari 16.4+).
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'

    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.mixer = new Mixer(this.ctx)
    this.decks = [new Deck(this, 'A'), new Deck(this, 'B')]
    for (const deck of this.decks) this.mixer.connectDeck(deck)
    this.recorder = new Recorder(this.ctx, this.mixer)

    this.installUnlock()
  }

  /** Browsers start audio suspended until a user gesture. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  private installUnlock(): void {
    const unlock = () => {
      void this.resume().then(() => {
        if (this.ctx.state === 'running') {
          for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock, true)
        }
      })
    }
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, true)
  }
}

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const

export const engine = new AudioEngine()

// Handy for debugging from the browser console in dev builds.
if (import.meta.env.DEV) (window as unknown as { __engine: AudioEngine }).__engine = engine
