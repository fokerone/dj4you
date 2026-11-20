import { Deck } from './deck'
import { crossfaderGains, Mixer } from './mixer'
import { Broadcaster } from '../live/broadcaster'
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
  readonly live: Broadcaster

  constructor() {
    // iOS: play through the silent switch like a media app (Safari 16.4+).
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'

    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.mixer = new Mixer(this.ctx)
    this.decks = [new Deck(this, 'A'), new Deck(this, 'B')]
    for (const deck of this.decks) this.mixer.connectDeck(deck)
    // SYNC lock: a locked deck follows the other deck's tempo changes.
    const [a, b] = this.decks
    a.subscribe(() => b.followTempo(a))
    b.subscribe(() => a.followTempo(b))
    this.recorder = new Recorder(this.ctx, this.mixer)
    this.live = new Broadcaster(this)

    this.installUnlock()
  }

  /**
   * The deck the audience hears most (playing, by channel volume and
   * crossfader), or else the first deck with a track; null if both are empty.
   */
  mainDeck(): Deck | null {
    const { crossfader, curve } = this.mixer.getSnapshot()
    const xf = crossfaderGains(crossfader, curve)
    let best: Deck | null = null
    let loudest = 0
    this.decks.forEach((d, i) => {
      const s = d.getSnapshot()
      const w = s.playing ? s.volume * s.volume * xf[i] : 0
      if (w > loudest) {
        loudest = w
        best = d
      }
    })
    return best ?? this.decks.find((d) => d.loaded) ?? null
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
