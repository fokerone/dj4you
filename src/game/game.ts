import type { Deck } from '../audio/deck'
import type { AudioEngine } from '../audio/engine'
import { readPeak } from '../audio/meter'
import { crossfaderGains } from '../audio/mixer'
import { Store } from '../audio/store'
import { t } from '../i18n'
import { buzz } from './haptics'

/**
 * The game layer: watches what the DJ does (never touches the audio) and turns
 * it into crowd energy, points, combos, achievements and a first-mix quest.
 *
 * Rules of thumb it rewards — the same things that make a real set good:
 *  - keep the music going (no dead air)
 *  - blend tracks with matched tempo and aligned beats
 *  - finish transitions cleanly; long, in-sync blends score best
 *  - don't let one track run forever; the crowd wants new music
 */

export type EventKind = 'great' | 'good' | 'bad' | 'info' | 'achievement'

export interface GameEvent {
  readonly id: number
  readonly kind: EventKind
  readonly text: string
  readonly sub?: string
}

export interface QuestStep {
  readonly id: string
  readonly title: string
  readonly text: string
}

export interface GameState {
  /** Crowd energy 0..100 */
  readonly energy: number
  readonly score: number
  readonly combo: number
  readonly multiplier: number
  /** Lifetime XP (persisted) */
  readonly xp: number
  readonly level: number
  readonly levelTitle: string
  /** 0..1 progress to the next level */
  readonly levelProgress: number
  /** Beat offset between decks in beats (-0.5..0.5), null if not comparable */
  readonly phaseDiff: number | null
  /** Both decks audible with matched tempo and aligned beats */
  readonly inSync: boolean
  /** Both decks audible but beats clash */
  readonly clashing: boolean
  readonly events: readonly GameEvent[]
  readonly achievements: readonly string[]
  /** Index into QUEST, or -1 when the quest is off / done */
  readonly questStep: number
  readonly questDone: boolean
}

export const ACHIEVEMENTS: Record<string, { title: string; text: string }> = {
  'first-play': { title: 'Needle drop', text: 'Play your first track' },
  sync: { title: 'Locked in', text: 'Match two tracks with SYNC' },
  'first-mix': { title: 'First mix', text: 'Finish a transition between decks' },
  perfect: { title: 'Perfect blend', text: 'Land a perfect transition' },
  combo3: { title: 'On fire', text: 'Reach a x3 combo' },
  loop: { title: 'Loop it', text: 'Use a beat loop' },
  fx: { title: 'Effects wizard', text: 'Play with echo or reverb' },
  cues: { title: 'Hot cue hero', text: 'Set all 4 hot cues on a deck' },
  peak: { title: 'Peak time', text: 'Get the crowd to 100% energy' },
  rec: { title: 'On the record', text: 'Record a mix' },
  live: { title: 'On air', text: 'Go live to listeners' },
  '10k': { title: '10K club', text: 'Score 10,000 points in one session' },
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

const LEVELS = ['Bedroom DJ', 'Party Starter', 'Warm-up DJ', 'Club Resident', 'Headliner', 'Festival Legend', 'Hall of Fame']
const STORE_KEY = 'dj4you.game.v1'
const TICK = 0.25 // seconds
/** A deck counts as heard above this gain (volume² × crossfader). */
const AUDIBLE = 0.08
/** Seconds of in-sync overlap for a perfect / smooth transition. */
const PERFECT_BLEND = 4
const SMOOTH_BLEND = 1.5

interface Persisted {
  xp: number
  achievements: string[]
  questDone: boolean
}

function load(): Persisted {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Persisted> | null
    return { xp: Number(raw?.xp) || 0, achievements: Array.isArray(raw?.achievements) ? raw.achievements : [], questDone: raw?.questDone === true }
  } catch {
    return { xp: 0, achievements: [], questDone: false }
  }
}

function levelInfo(xp: number): { level: number; title: string; progress: number } {
  // Each level needs a bit more: 2.5k, 10k, 22.5k, 40k ...
  const level = Math.floor(Math.sqrt(xp / 2500)) + 1
  const lo = 2500 * (level - 1) ** 2
  const hi = 2500 * level ** 2
  return { level, title: LEVELS[Math.min(LEVELS.length - 1, level - 1)], progress: (xp - lo) / (hi - lo) }
}

export class Game extends Store<GameState> {
  private readonly engine: AudioEngine
  private nextId = 1
  private scratch = new Float32Array(1024)
  // per-session counters
  private deadAir = 0
  private deadWarned = false
  private blendSecs = 0
  private clashSecs = 0
  private clashWarned = false
  private dominant: Deck | null = null
  private dominantSecs = 0
  private boredWarned = false
  private lastSave = 0
  private ticking = 0
  private nextAchievementAt = 0

  constructor(engine: AudioEngine) {
    const p = load()
    const lv = levelInfo(p.xp)
    super({
      energy: 30,
      score: 0,
      combo: 0,
      multiplier: 1,
      xp: p.xp,
      level: lv.level,
      levelTitle: lv.title,
      levelProgress: lv.progress,
      phaseDiff: null,
      inSync: false,
      clashing: false,
      events: [],
      achievements: p.achievements,
      questStep: -1,
      questDone: p.questDone,
    })
    this.engine = engine
    this.ticking = window.setInterval(() => this.tick(), TICK * 1000)
  }

  // ---------------------------------------------------------------- quest

  startQuest(): void {
    this.set({ questStep: 0 })
    this.syncCoach()
  }

  skipQuest(): void {
    this.set({ questStep: -1, questDone: true })
    this.save()
    this.syncCoach()
  }

  /** Highlights the control the current quest step is about (CSS hooks on body). */
  private syncCoach(): void {
    const step = QUEST[this.state.questStep]
    if (step) document.body.dataset.coach = step.id
    else delete document.body.dataset.coach
  }

  private questCheck(a: Deck, b: Deck, xf: number): boolean {
    const sa = a.getSnapshot()
    const sb = b.getSnapshot()
    switch (QUEST[this.state.questStep]?.id) {
      case 'load-a':
        return a.loaded
      case 'play-a':
        return sa.playing
      case 'xf-a':
        return xf < 0.08
      case 'load-b':
        return b.loaded
      case 'play-b':
        return sb.playing
      case 'sync-b':
        return this.state.inSync || (tempoMatch(a, b) && this.state.phaseDiff !== null && Math.abs(this.state.phaseDiff) < 0.08)
      case 'crossfade':
        return xf > 0.92
      default:
        return false
    }
  }

  // ---------------------------------------------------------------- events

  emit(kind: EventKind, text: string, sub?: string): void {
    const ev: GameEvent = { id: this.nextId++, kind, text, sub }
    this.set({ events: [...this.state.events.slice(-3), ev] })
    window.setTimeout(() => this.set({ events: this.state.events.filter((e) => e.id !== ev.id) }), kind === 'achievement' ? 3800 : 2200)
  }

  private unlock(id: string): void {
    if (this.state.achievements.includes(id)) return
    this.set({ achievements: [...this.state.achievements, id] })
    const a = ACHIEVEMENTS[id]
    // Queue unlocks so several at once appear one after another.
    const delay = Math.max(0, this.nextAchievementAt - Date.now())
    this.nextAchievementAt = Date.now() + delay + 1800
    window.setTimeout(() => {
      this.emit('achievement', t(a.title), t(a.text))
      buzz([30, 40, 60])
    }, delay)
    this.save()
  }

  private addPoints(points: number): void {
    const p = Math.round(points * this.state.multiplier * (0.5 + this.state.energy / 100))
    const xp = this.state.xp + p
    const lv = levelInfo(xp)
    if (lv.level > this.state.level) {
      this.emit('great', t('LEVEL {n}', { n: lv.level }), t(lv.title))
      buzz([40, 30, 40, 30, 80])
    }
    this.set({ score: this.state.score + p, xp, level: lv.level, levelTitle: lv.title, levelProgress: lv.progress })
    if (this.state.score >= 10_000) this.unlock('10k')
  }

  private setCombo(combo: number): void {
    this.set({ combo, multiplier: Math.min(5, 1 + combo * 0.5) })
    if (combo >= 3) this.unlock('combo3')
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ xp: this.state.xp, achievements: [...this.state.achievements], questDone: this.state.questDone } satisfies Persisted),
      )
    } catch {
      /* private mode: progress lasts for this session */
    }
  }

  // ---------------------------------------------------------------- tick

  private tick(): void {
    const { decks, mixer, recorder, live } = this.engine
    const [a, b] = decks
    const mx = mixer.getSnapshot()
    const xf = crossfaderGains(mx.crossfader, mx.curve)
    const weights = decks.map((d, i) => {
      const s = d.getSnapshot()
      return s.playing ? s.volume * s.volume * xf[i] : 0
    })
    const masterPeak = readPeak(mixer.masterMeter, this.scratch)
    const audible = decks.filter((_, i) => weights[i] > AUDIBLE)
    let energy = this.state.energy

    // Beat alignment between decks (same tempo only)
    let phaseDiff: number | null = null
    const both = a.getSnapshot().playing && b.getSnapshot().playing
    if (both && tempoMatch(a, b)) {
      const pa = a.beatPhase()
      const pb = b.beatPhase()
      if (pa !== null && pb !== null) {
        phaseDiff = pb - pa
        phaseDiff -= Math.round(phaseDiff)
      }
    }
    const blending = audible.length === 2
    const inSync = blending && phaseDiff !== null && Math.abs(phaseDiff) < 0.06
    const clashing = blending && !inSync

    // Dead air
    if (audible.length === 0 || masterPeak < 0.003) {
      this.deadAir += TICK
      if (this.deadAir > 1.5) {
        energy -= 2
        if (!this.deadWarned && this.state.score > 0) {
          this.emit('bad', t('DEAD AIR'), t('Keep the music playing!'))
          this.deadWarned = true
          buzz(120)
        }
        if (this.state.combo) this.setCombo(0)
      }
    } else {
      this.deadAir = 0
      this.deadWarned = false
    }

    if (audible.length === 1) {
      energy += energy < 60 ? 0.35 : 0.04
      this.addPoints(5)
    } else if (inSync) {
      energy += 0.55
      this.blendSecs += TICK
      this.addPoints(25)
    } else if (clashing) {
      this.clashSecs += TICK
      if (this.clashSecs >= 1) {
        energy -= 1.2
        if (!this.clashWarned) {
          this.emit('bad', t('TRAINWRECK'), t('Beats are clashing: use SYNC or the jog wheel'))
          this.clashWarned = true
          buzz([80, 40, 80])
          this.setCombo(0)
        }
      }
    }
    if (!blending) {
      this.clashWarned = false
    }

    // Effects and loops add a little spice while music plays
    for (const d of decks) {
      const s = d.getSnapshot()
      if (!s.playing) continue
      if (s.loop) this.unlock('loop')
      if (s.echoOn || s.reverbOn) {
        this.unlock('fx')
        energy += 0.06
      }
      if (s.hotCues.every((c) => c !== null)) this.unlock('cues')
      this.unlock('first-play')
    }
    if (tempoMatch(a, b) && (a.getSnapshot().pitch !== 0 || b.getSnapshot().pitch !== 0) && a.getSnapshot().bpm !== b.getSnapshot().bpm) this.unlock('sync')

    // Transitions: the main deck changes from one to the other
    const dom = this.dominantDeck(weights)
    if (dom && this.dominant && dom !== this.dominant) this.finishTransition()
    if (dom) {
      if (dom === this.dominant) this.dominantSecs += TICK
      else this.dominantSecs = 0
      this.dominant = dom
    }
    if (!blending && audible.length === 1 && this.blendSecs > 0 && dom === this.dominant) {
      // Blend abandoned without switching: no reward, start fresh next time.
      this.blendSecs = 0
      this.clashSecs = 0
    }
    if (this.dominantSecs > 150 && !blending) {
      energy -= 0.12
      if (!this.boredWarned) {
        this.emit('info', t('The crowd wants something new'), t('Mix in the next track'))
        this.boredWarned = true
      }
    }

    energy = Math.max(0, Math.min(100, energy))
    if (energy >= 100) this.unlock('peak')
    if (recorder.getSnapshot().recording) this.unlock('rec')
    if (live.getSnapshot().status === 'live') this.unlock('live')

    this.set({ energy, phaseDiff, inSync, clashing })

    // Quest
    if (this.state.questStep >= 0 && this.questCheck(a, b, mx.crossfader)) {
      const next = this.state.questStep + 1
      buzz(25)
      if (next >= QUEST.length) {
        this.set({ questStep: -1, questDone: true })
        this.emit('great', t('MISSION COMPLETE'), t("You're a DJ now. Keep the crowd going!"))
        this.addPoints(2000)
        this.save()
      } else {
        this.emit('info', `✓ ${t(QUEST[this.state.questStep].title)}`)
        this.set({ questStep: next })
      }
      this.syncCoach()
    }

    if (performance.now() - this.lastSave > 10_000) {
      this.lastSave = performance.now()
      this.save()
    }
  }

  private finishTransition(): void {
    const blend = this.blendSecs
    const clash = this.clashSecs
    this.blendSecs = 0
    this.clashSecs = 0
    this.dominantSecs = 0
    this.boredWarned = false
    if (clash >= 1.5) return // the trainwreck warning already said it
    if (blend >= PERFECT_BLEND) {
      this.setCombo(this.state.combo + 1)
      this.emit('great', t('PERFECT TRANSITION'), t('{n}s seamless blend', { n: blend.toFixed(0) }))
      this.addPoints(1500)
      this.set({ energy: Math.min(100, this.state.energy + 12) })
      this.unlock('perfect')
      buzz([30, 30, 30, 30, 120])
    } else if (blend >= SMOOTH_BLEND) {
      this.setCombo(this.state.combo + 1)
      this.emit('good', t('SMOOTH MIX'), t('Blend longer for a perfect transition'))
      this.addPoints(600)
      this.set({ energy: Math.min(100, this.state.energy + 6) })
      buzz([30, 40, 60])
    } else {
      this.emit('info', t('QUICK CUT'), t('Try a slow crossfade with SYNC on'))
      this.addPoints(200)
    }
    this.unlock('first-mix')
  }

  private dominantDeck(weights: number[]): Deck | null {
    const [wa, wb] = weights
    if (Math.max(wa, wb) < AUDIBLE) return null
    // Hysteresis: the other deck must clearly take over.
    if (this.dominant === this.engine.decks[0]) return wb > wa * 1.4 ? this.engine.decks[1] : this.engine.decks[0]
    if (this.dominant === this.engine.decks[1]) return wa > wb * 1.4 ? this.engine.decks[0] : this.engine.decks[1]
    return wa >= wb ? this.engine.decks[0] : this.engine.decks[1]
  }

  /** 0..1 beat pulse of the main deck (1 on the beat, decaying) for visuals. */
  pulse(): number {
    const d = this.dominant
    if (!d || !d.getSnapshot().playing) return 0
    const ph = d.beatPhase()
    return ph === null ? 0 : (1 - ph) ** 4
  }

  /** 0 = deck A is the main deck, 1 = deck B, for colouring the stage. */
  side(): number {
    return this.engine.mixer.getSnapshot().crossfader
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
