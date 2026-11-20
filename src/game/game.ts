import type { Deck } from '../audio/deck'
import type { AudioEngine } from '../audio/engine'
import { readPeak } from '../audio/meter'
import { crossfaderGains } from '../audio/mixer'
import { Store } from '../audio/store'
import { t } from '../i18n'
import { buzz } from './haptics'

/**
 * The "coach": watches what the DJ does (it never touches the audio) and turns
 * it into gentle feedback — a quiet "nice transition", a helpful hint when beats
 * clash, achievements, and the first-mix tutorial. No scores, no penalties:
 * the goal is that mixing feels rewarding, not that it's graded.
 */

export type NoteKind = 'success' | 'achievement' | 'info'

export interface Note {
  readonly id: number
  readonly kind: NoteKind
  readonly text: string
  readonly sub?: string
}

/** A contextual tip with an optional one-tap fix. */
export interface Hint {
  readonly id: 'clash' | 'silence' | 'tempo'
  readonly text: string
  /** Deck to SYNC when the user taps the fix button */
  readonly syncDeck?: 'A' | 'B'
}

export type SegmentKind = 'rec' | 'live'

/** What happened during a recording or live set. */
export interface SessionSummary {
  readonly kind: SegmentKind
  readonly seconds: number
  readonly transitions: number
  readonly perfect: number
  /** Tracks heard, in order */
  readonly tracks: readonly string[]
  /** Achievement ids unlocked during it */
  readonly unlocked: readonly string[]
}

interface Segment {
  startedAt: number
  transitions: number
  perfect: number
  achievements: number
  tracks: string[]
}

export interface QuestStep {
  readonly id: string
  readonly title: string
  readonly text: string
}

export interface CoachState {
  /** Beat offset between decks in beats (-0.5..0.5), null if not comparable */
  readonly phaseDiff: number | null
  /** Why the phase can't be compared right now (for the phase meter) */
  readonly phaseReason: 'ok' | 'stopped' | 'tempo' | 'nobpm'
  /** Both decks audible with aligned beats */
  readonly inSync: boolean
  readonly clashing: boolean
  readonly notes: readonly Note[]
  readonly hint: Hint | null
  readonly achievements: readonly string[]
  /** Index into QUEST, or -1 when the tutorial is off / done */
  readonly questStep: number
  readonly questDone: boolean
  /** The tutorial was just finished: show the 'what next' card */
  readonly questJustFinished: boolean
  /** Session stats shown in the menu */
  readonly transitions: number
  readonly mixSeconds: number
}

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  'first-play': { title: 'Needle drop', text: 'Play your first track' },
  sync: { title: 'Locked in', text: 'Match two tracks with SYNC' },
  'first-mix': { title: 'First mix', text: 'Finish a transition between decks' },
  perfect: { title: 'Perfect blend', text: 'Blend two tracks in time for 4 seconds or more' },
  streak: { title: 'In the groove', text: 'Make 3 smooth transitions in a row' },
  loop: { title: 'Loop it', text: 'Use a beat loop' },
  cues: { title: 'Hot cue hero', text: 'Set all 4 hot cues on a deck' },
  fx: { title: 'Effects wizard', text: 'Play with echo or reverb' },
  filter: { title: 'Filter sweep', text: 'Sweep the filter while a track plays' },
  'bass-swap': { title: 'Bass swap', text: 'Cut the bass on one deck while blending' },
  rec: { title: 'On the record', text: 'Record a mix' },
  live: { title: 'On air', text: 'Go live to listeners' },
  marathon: { title: 'Marathon', text: 'Keep the music going for 10 minutes' },
}

export const QUEST: readonly QuestStep[] = [
  { id: 'load-a', title: 'Load a beat', text: 'Open the Library on Deck A and load "Sunrise" onto A.' },
  { id: 'play-a', title: 'Drop the needle', text: 'Press ▶ on Deck A. The crowd is waiting!' },
  { id: 'xf-a', title: 'Own the floor', text: 'Slide the crossfader all the way to A so only Deck A is heard.' },
  { id: 'load-b', title: 'Cue the next track', text: 'Load "Night Drive" onto Deck B. Nobody hears it yet.' },
  { id: 'play-b', title: 'Start it silently', text: 'Press ▶ on Deck B. It plays in the background.' },
  { id: 'sync-b', title: 'Match the beats', text: 'Press SYNC on Deck B. The phase meter turns green when beats line up.' },
  { id: 'crossfade', title: 'The transition', text: 'Slowly slide the crossfader all the way to B. Take a few seconds!' },
]

const STORE_KEY = 'dj4you.game.v1'
const TICK = 0.25 // seconds
/** A deck counts as heard above this gain (volume² × crossfader). */
const AUDIBLE = 0.08
/** Seconds of in-sync overlap for a perfect / smooth transition. */
const PERFECT_BLEND = 4
const SMOOTH_BLEND = 1.5

interface Persisted {
  achievements: string[]
  questDone: boolean
}

function load(): Persisted {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Persisted> | null
    // Older versions also stored xp / score-based badges; keep what still exists.
    const ach = Array.isArray(raw?.achievements) ? raw.achievements.filter((a) => a in ACHIEVEMENTS) : []
    return { achievements: ach, questDone: raw?.questDone === true }
  } catch {
    return { achievements: [], questDone: false }
  }
}

export class Coach extends Store<CoachState> {
  private readonly engine: AudioEngine
  private nextId = 1
  private scratch = new Float32Array(1024)
  private blendSecs = 0
  private clashSecs = 0
  private silentSecs = 0
  private everPlayed = false
  private dominant: Deck | null = null
  private streak = 0
  private lastFilter = [0, 0]
  private nextAchievementAt = 0
  private hintDismissed = new Map<Hint['id'], number>()
  private perfectCount = 0
  private segments = new Map<SegmentKind, Segment>()
  private ticking = 0

  constructor(engine: AudioEngine) {
    const p = load()
    super({
      phaseDiff: null,
      phaseReason: 'stopped',
      inSync: false,
      clashing: false,
      notes: [],
      hint: null,
      achievements: p.achievements,
      questStep: -1,
      questDone: p.questDone,
      questJustFinished: false,
      transitions: 0,
      mixSeconds: 0,
    })
    this.engine = engine
    this.ticking = window.setInterval(() => this.tick(), TICK * 1000)
  }

  // ---------------------------------------------------------------- public

  startQuest(): void {
    this.set({ questStep: 0 })
    this.syncCoachMarks()
  }

  /** Close the end-of-tutorial card. */
  ackQuestFinished(): void {
    this.set({ questJustFinished: false })
  }

  skipQuest(): void {
    this.set({ questStep: -1, questDone: true })
    this.save()
    this.syncCoachMarks()
  }

  /** Show a short message (also used by other parts of the app). */
  notify(kind: NoteKind, text: string, sub?: string): void {
    const note: Note = { id: this.nextId++, kind, text, sub }
    this.set({ notes: [...this.state.notes.slice(-2), note] })
    window.setTimeout(() => this.set({ notes: this.state.notes.filter((n) => n.id !== note.id) }), kind === 'achievement' ? 4000 : 2600)
  }

  /** Hide the current hint for a while. */
  dismissHint(): void {
    const h = this.state.hint
    if (h) this.hintDismissed.set(h.id, Date.now() + 45_000)
    this.set({ hint: null })
  }

  /** One-tap fix offered by a hint. */
  applyHint(): void {
    const h = this.state.hint
    if (!h?.syncDeck) return
    const [a, b] = this.engine.decks
    if (h.syncDeck === 'A') a.engageSync(b)
    else b.engageSync(a)
    this.set({ hint: null })
  }

  /** Start tracking a recording / live set for its summary. */
  beginSegment(kind: SegmentKind): void {
    this.segments.set(kind, {
      startedAt: Date.now(),
      transitions: this.state.transitions,
      perfect: this.perfectCount,
      achievements: this.state.achievements.length,
      tracks: [],
    })
  }

  endSegment(kind: SegmentKind): SessionSummary | null {
    const seg = this.segments.get(kind)
    this.segments.delete(kind)
    if (!seg) return null
    return {
      kind,
      seconds: (Date.now() - seg.startedAt) / 1000,
      transitions: this.state.transitions - seg.transitions,
      perfect: this.perfectCount - seg.perfect,
      tracks: seg.tracks,
      unlocked: this.state.achievements.slice(seg.achievements),
    }
  }

  resetProgress(): void {
    this.set({ achievements: [], questDone: false })
    this.save()
  }

  /** 0..1 beat pulse of the main deck for ambient visuals. */
  pulse(): number {
    const d = this.dominant
    if (!d || !d.getSnapshot().playing) return 0
    const ph = d.beatPhase()
    return ph === null ? 0 : (1 - ph) ** 4
  }

  /** How much of each deck is heard, 0..1 each (for ambient colour). */
  presence(): [number, number] {
    const mx = this.engine.mixer.getSnapshot()
    const xf = crossfaderGains(mx.crossfader, mx.curve)
    return this.engine.decks.map((d, i) => {
      const s = d.getSnapshot()
      return s.playing ? Math.min(1, s.volume * s.volume * xf[i] * 1.6) : 0
    }) as [number, number]
  }

  // ---------------------------------------------------------------- internals

  private syncCoachMarks(): void {
    const step = QUEST[this.state.questStep]
    if (step) document.body.dataset.coach = step.id
    else delete document.body.dataset.coach
  }

  private unlock(id: string): void {
    if (this.state.achievements.includes(id)) return
    this.set({ achievements: [...this.state.achievements, id] })
    this.save()
    const a = ACHIEVEMENTS[id]
    // Several unlocks at once appear one after another.
    const delay = Math.max(0, this.nextAchievementAt - Date.now())
    this.nextAchievementAt = Date.now() + delay + 2000
    window.setTimeout(() => {
      this.notify('achievement', t(a.title), t(a.text))
      buzz([20, 40, 40])
    }, delay)
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ achievements: [...this.state.achievements], questDone: this.state.questDone } satisfies Persisted))
    } catch {
      /* private mode: progress lasts for this session */
    }
  }

  private tick(): void {
    const { decks, mixer, recorder, live } = this.engine
    const [a, b] = decks
    const sa = a.getSnapshot()
    const sb = b.getSnapshot()
    const mx = mixer.getSnapshot()
    const xf = crossfaderGains(mx.crossfader, mx.curve)
    const weights = [sa, sb].map((s, i) => (s.playing ? s.volume * s.volume * xf[i] : 0))
    const audible = weights.filter((w) => w > AUDIBLE).length
    const masterPeak = readPeak(mixer.masterMeter, this.scratch)

    // Beat alignment
    let phaseDiff: number | null = null
    let phaseReason: CoachState['phaseReason'] = 'ok'
    if (!sa.playing || !sb.playing) phaseReason = 'stopped'
    else if (sa.bpm === null || sb.bpm === null) phaseReason = 'nobpm'
    else if (!tempoMatch(a, b)) phaseReason = 'tempo'
    else {
      const pa = a.beatPhase()
      const pb = b.beatPhase()
      if (pa !== null && pb !== null) {
        phaseDiff = pb - pa
        phaseDiff -= Math.round(phaseDiff)
      }
    }
    const blending = audible === 2
    const inSync = blending && phaseDiff !== null && Math.abs(phaseDiff) < 0.06
    const clashing = blending && !inSync

    if (inSync) this.blendSecs += TICK
    if (clashing) this.clashSecs += TICK

    // Silence after music has played
    const playing = audible > 0 && masterPeak > 0.003
    if (playing) {
      this.everPlayed = true
      this.silentSecs = 0
      this.set({ mixSeconds: this.state.mixSeconds + TICK })
      if (this.state.mixSeconds >= 600) this.unlock('marathon')
    } else this.silentSecs += TICK

    // Transitions: the main deck changes from one to the other
    const dom = this.dominantDeck(weights)
    if (dom && this.dominant && dom !== this.dominant) this.finishTransition()
    if (dom) this.dominant = dom
    if (!blending && this.blendSecs > 0 && audible === 1 && dom === this.dominant) {
      // Blend abandoned without switching: start fresh next time.
      this.blendSecs = 0
      this.clashSecs = 0
    }

    // Setlist for running recordings / live sets
    if (this.segments.size) {
      ;[sa, sb].forEach((s, i) => {
        if (weights[i] <= AUDIBLE || !s.trackName) return
        for (const seg of this.segments.values()) if (seg.tracks.at(-1) !== s.trackName && !seg.tracks.includes(s.trackName)) seg.tracks.push(s.trackName)
      })
    }

    // Achievements from what's happening
    for (const [i, s] of [sa, sb].entries()) {
      if (!s.playing) continue
      this.unlock('first-play')
      if (s.loop) this.unlock('loop')
      if (s.echoOn || s.reverbOn) this.unlock('fx')
      if (s.hotCues.every((c) => c !== null)) this.unlock('cues')
      if (Math.abs(s.filter - this.lastFilter[i]) > 0.25 && Math.abs(s.filter) > 0.4) this.unlock('filter')
      if (blending && s.eq.low < -0.8) this.unlock('bass-swap')
    }
    this.lastFilter = [sa.filter, sb.filter]
    if (tempoMatch(a, b) && sa.bpm !== sb.bpm && (sa.pitch !== 0 || sb.pitch !== 0)) this.unlock('sync')
    if (recorder.getSnapshot().recording) this.unlock('rec')
    if (live.getSnapshot().status === 'live') this.unlock('live')

    this.set({ phaseDiff, phaseReason, inSync, clashing, hint: this.pickHint(clashing, a, b) })
    this.tickQuest(a, b, mx.crossfader)
  }

  /** At most one calm, actionable tip at a time. */
  private pickHint(clashing: boolean, a: Deck, b: Deck): Hint | null {
    const allowed = (id: Hint['id']) => (this.hintDismissed.get(id) ?? 0) < Date.now()
    // Don't talk over the tutorial; it already explains each step.
    if (this.state.questStep >= 0) return null
    if (clashing && this.clashSecs >= 1.5 && allowed('clash')) {
      const quieter = this.dominant === b ? 'A' : 'B'
      const canSync = a.getSnapshot().bpm !== null && b.getSnapshot().bpm !== null
      return {
        id: 'clash',
        text: canSync ? t('The beats aren’t lined up. Press SYNC on the incoming deck.') : t('The beats aren’t lined up. Nudge the jog wheel to align them.'),
        syncDeck: canSync ? quieter : undefined,
      }
    }
    if (this.everPlayed && this.silentSecs > 3 && allowed('silence')) {
      return { id: 'silence', text: t('The dance floor is quiet. Press ▶ or raise a fader.') }
    }
    return null
  }

  private finishTransition(): void {
    const blend = this.blendSecs
    const clash = this.clashSecs
    this.blendSecs = 0
    this.clashSecs = 0
    this.set({ transitions: this.state.transitions + 1 })
    this.unlock('first-mix')
    if (clash >= 1.5) {
      this.streak = 0
      return
    }
    if (blend >= PERFECT_BLEND) {
      this.streak++
      this.perfectCount++
      this.notify('success', t('Perfect transition'), t('{n}s seamless blend', { n: blend.toFixed(0) }))
      this.unlock('perfect')
      buzz([20, 30, 60])
    } else if (blend >= SMOOTH_BLEND) {
      this.streak++
      this.notify('success', t('Smooth transition'), t('Blend a little longer for a perfect one'))
      buzz(30)
    } else {
      this.streak = 0
    }
    if (this.streak >= 3) this.unlock('streak')
  }

  private tickQuest(a: Deck, b: Deck, xf: number): void {
    if (this.state.questStep < 0) return
    const done = (() => {
      switch (QUEST[this.state.questStep]?.id) {
        case 'load-a':
          return a.loaded
        case 'play-a':
          return a.getSnapshot().playing
        case 'xf-a':
          return xf < 0.08
        case 'load-b':
          return b.loaded
        case 'play-b':
          return b.getSnapshot().playing
        case 'sync-b':
          return tempoMatch(a, b) && this.state.phaseDiff !== null && Math.abs(this.state.phaseDiff) < 0.08
        case 'crossfade':
          return xf > 0.92
        default:
          return false
      }
    })()
    if (!done) return
    buzz(25)
    const next = this.state.questStep + 1
    if (next >= QUEST.length) {
      this.set({ questStep: -1, questDone: true })
      this.set({ questJustFinished: true })
      this.save()
    } else {
      this.set({ questStep: next })
    }
    this.syncCoachMarks()
  }

  private dominantDeck(weights: number[]): Deck | null {
    const [wa, wb] = weights
    const [da, db] = this.engine.decks
    if (Math.max(wa, wb) < AUDIBLE) return null
    // Hysteresis: the other deck must clearly take over.
    if (this.dominant === da) return wb > wa * 1.4 ? db : da
    if (this.dominant === db) return wa > wb * 1.4 ? da : db
    return wa >= wb ? da : db
  }

  dispose(): void {
    window.clearInterval(this.ticking)
  }
}

function tempoMatch(a: Deck, b: Deck): boolean {
  const ta = a.effectiveBpm
  const tb = b.effectiveBpm
  return ta !== null && tb !== null && Math.abs(ta - tb) < 0.3
}
