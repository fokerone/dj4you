import type { Deck } from '../audio/deck'
import { engine as audioEngine, type AudioEngine } from '../audio/engine'
import { Store } from '../audio/store'
import { library } from './library'
import { prefs } from './prefs'

/**
 * AUTO: DJ4YOU mixes the queue by itself. While one deck plays, the next
 * queued track is loaded on the other deck; near the end it starts on the
 * beat, synced when the tempos are close enough, and a 16-beat blend with a
 * bass swap moves the crossfader across. Touching the crossfader hands
 * control back to the DJ.
 */

export type AutomixPhase = 'off' | 'waiting' | 'playing' | 'mixing'

export interface AutomixState {
  readonly on: boolean
  readonly phase: AutomixPhase
  /** Seconds until the next blend starts (while playing), else null */
  readonly nextIn: number | null
  /** Why AUTO stopped or is waiting (shown to the DJ), or null */
  readonly reason: 'empty' | 'manual' | null
}

const TICK_MS = 200
const BLEND_BEATS = 16
const MIN_BLEND = 6
const MAX_BLEND = 20

export class Automix extends Store<AutomixState> {
  private timer = 0
  private blend: { from: Deck; to: Deck; start: number; length: number; swapped: boolean } | null = null
  /** Crossfader value we last set, to notice the DJ moving it */
  private ourFader: number | null = null
  /** The deck we asked to load the next track (until it is ready) */
  private preparing: Deck | null = null
  private engine: AudioEngine

  constructor(engine: AudioEngine) {
    super({ on: false, phase: 'off', nextIn: null, reason: null })
    this.engine = engine
  }

  toggle(): void {
    if (this.state.on) this.stop(null)
    else this.start()
  }

  start(): void {
    if (this.state.on) return
    void this.engine.resume()
    this.set({ on: true, phase: 'waiting', reason: null, nextIn: null })
    this.ourFader = null
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  stop(reason: AutomixState['reason']): void {
    window.clearInterval(this.timer)
    if (this.blend) this.finishBlend()
    this.preparing = null
    this.set({ on: false, phase: 'off', nextIn: null, reason })
  }

  private tick(): void {
    const mixer = this.engine.mixer
    const fader = mixer.getSnapshot().crossfader
    if (this.ourFader !== null && Math.abs(fader - this.ourFader) > 0.02) {
      this.stop('manual')
      return
    }
    if (this.blend) {
      this.stepBlend()
      return
    }

    const decks = this.engine.decks
    const playing = decks.filter((d) => d.getSnapshot().playing)
    if (this.preparing && !this.preparing.getSnapshot().loading && !this.preparing.getSnapshot().analyzing && this.preparing.loaded) this.preparing = null

    if (playing.length === 0) {
      // Nothing playing: start a deck that holds a track, else load the queue.
      const ready = decks.find((d) => d.loaded && !d.getSnapshot().analyzing && d.position < d.getSnapshot().duration - 1)
      if (ready) {
        if (ready.position < ready.getSnapshot().cuePoint) ready.seek(ready.getSnapshot().cuePoint)
        ready.play()
        this.setFader(ready.id === 'A' ? 0 : 1)
        return
      }
      if (!this.preparing) {
        if (library.loadNext(decks[0])) this.preparing = decks[0]
        else this.set({ phase: 'waiting', reason: 'empty', nextIn: null })
      }
      return
    }

    const from = this.engine.mainDeck() ?? playing[0]
    const to = decks[from.id === 'A' ? 1 : 0]
    const fs = from.getSnapshot()
    const ts = to.getSnapshot()
    if (this.ourFader === null) this.setFader(from.id === 'A' ? 0 : 1)

    // Get the next track ready on the other deck.
    const toUsed = !to.loaded || ts.playing || to.position > ts.cuePoint + 1
    if (toUsed && !ts.playing && !this.preparing && prefs.getSnapshot().queue.length > 0) {
      if (library.loadNext(to)) this.preparing = to
    }
    const toReady = to.loaded && !ts.loading && !ts.analyzing && !ts.playing && !this.preparing && to.position <= ts.cuePoint + 1

    const length = blendLength(from)
    const left = (fs.duration - from.position) / Math.max(0.01, from.rate)
    const inLoop = fs.loop !== null
    this.set({ phase: 'playing', nextIn: toReady && !inLoop ? Math.max(0, left - length) : null, reason: toReady || this.preparing ? null : 'empty' })
    if (toReady && !inLoop && left <= length) this.startBlend(from, to, length)
  }

  private startBlend(from: Deck, to: Deck, length: number): void {
    to.seek(to.getSnapshot().cuePoint)
    to.setEq('low', -1) // incoming bass out until the swap
    if (to.getSnapshot().volume < from.getSnapshot().volume) to.setVolume(from.getSnapshot().volume)
    to.play()
    // Lock tempo and beats when within reach; otherwise just blend.
    to.engageSync(from)
    this.blend = { from, to, start: performance.now(), length, swapped: false }
    this.set({ phase: 'mixing', nextIn: null })
  }

  private stepBlend(): void {
    const b = this.blend!
    const k = Math.min(1, (performance.now() - b.start) / 1000 / b.length)
    const fromSide = b.from.id === 'A' ? 0 : 1
    this.setFader(fromSide + (1 - 2 * fromSide) * smooth(k))
    if (!b.swapped && k >= 0.5) {
      b.swapped = true
      b.from.setEq('low', -1)
      b.to.setEq('low', 0)
    }
    if (k >= 1 || !b.from.getSnapshot().playing) this.finishBlend()
  }

  private finishBlend(): void {
    const b = this.blend
    if (!b) return
    this.blend = null
    b.from.pause()
    b.from.setEq('low', 0)
    b.to.setEq('low', 0)
    b.to.setSyncLock(false)
    this.setFader(b.to.id === 'A' ? 0 : 1)
    if (this.state.on) this.set({ phase: 'playing' })
  }

  private setFader(x: number): void {
    this.ourFader = x
    this.engine.mixer.setCrossfader(x)
  }
}

/** 16 beats at the playing tempo (6–20 s); 10 s without a beat grid. */
function blendLength(deck: Deck): number {
  const bpm = deck.effectiveBpm
  if (!bpm) return 10
  return Math.min(MAX_BLEND, Math.max(MIN_BLEND, (BLEND_BEATS * 60) / bpm))
}

/** Ease in-out so the blend starts and ends gently. */
function smooth(k: number): number {
  return k * k * (3 - 2 * k)
}

export const automix = new Automix(audioEngine)
