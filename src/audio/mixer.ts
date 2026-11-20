import { faderCurve } from './curves'
import type { Deck } from './deck'
import { createMeterTap } from './meter'
import { Store } from './store'

export type CrossfaderCurve = 'smooth' | 'cut'

export interface MixerState {
  /** 0 = full A, 0.5 = center, 1 = full B */
  readonly crossfader: number
  readonly curve: CrossfaderCurve
  /** Master fader, 0..1 */
  readonly master: number
  readonly cueMode: CueMode
  /** Which decks are sent to the headphones */
  readonly cue: readonly [boolean, boolean]
  /** Headphone blend: 0 = only cued decks, 1 = only master */
  readonly cueMix: number
  readonly cueVolume: number
}

export const DEFAULT_MASTER = 0.9

/**
 * Headphone cue. Browsers give a page one audio output, so cue uses "split"
 * mode like desktop DJ software: with a stereo Y-splitter cable the LEFT
 * channel (headphones) carries the cue mix and the RIGHT channel (speakers)
 * carries the master, both in mono. Recording and live streaming always get
 * the normal stereo master.
 */
export type CueMode = 'off' | 'split'

/**
 *   deck A out ─► xfA ─┐
 *                      ├─► master ─► limiter ─► speakers
 *   deck B out ─► xfB ─┘                  └─► masterMeter
 *                                         (later: recorder / live stream tap)
 */
export class Mixer extends Store<MixerState> {
  readonly master: GainNode
  readonly limiter: DynamicsCompressorNode
  readonly masterMeter: AnalyserNode
  private readonly ctx: AudioContext
  private readonly xfA: GainNode
  private readonly xfB: GainNode
  private readonly cueSends: [GainNode, GainNode]
  private readonly hpCue: GainNode
  private readonly hpMaster: GainNode
  private readonly hpOut: GainNode
  private readonly split: ChannelMergerNode
  private readonly masterMono: GainNode

  constructor(ctx: AudioContext) {
    super({ crossfader: 0.5, curve: 'smooth', master: DEFAULT_MASTER, cueMode: 'off', cue: [false, false], cueMix: 0.15, cueVolume: 0.9 })
    this.ctx = ctx
    this.xfA = ctx.createGain()
    this.xfB = ctx.createGain()
    this.master = ctx.createGain()
    this.limiter = ctx.createDynamicsCompressor()
    // Brick-wall-ish settings: only catches peaks, keeps the mix from clipping.
    this.limiter.threshold.value = -1
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.003
    this.limiter.release.value = 0.1
    this.masterMeter = createMeterTap(ctx)

    this.xfA.connect(this.master)
    this.xfB.connect(this.master)
    this.master.connect(this.limiter).connect(ctx.destination)
    this.limiter.connect(this.masterMeter)

    this.master.gain.value = faderCurve(DEFAULT_MASTER)
    this.applyCrossfader(true)

    // Headphone (cue) path — only routed to the output in split mode.
    const mono = () => {
      const g = ctx.createGain()
      g.channelCount = 1
      g.channelCountMode = 'explicit'
      g.channelInterpretation = 'speakers'
      return g
    }
    this.cueSends = [ctx.createGain(), ctx.createGain()]
    const cueBus = ctx.createGain()
    this.hpCue = ctx.createGain()
    this.hpMaster = ctx.createGain()
    this.hpOut = mono()
    this.masterMono = mono()
    this.split = ctx.createChannelMerger(2)
    for (const s of this.cueSends) {
      s.gain.value = 0
      s.connect(cueBus)
    }
    cueBus.connect(this.hpCue).connect(this.hpOut)
    this.limiter.connect(this.hpMaster).connect(this.hpOut)
    this.hpOut.connect(this.split, 0, 0) // left = headphones
    this.limiter.connect(this.masterMono).connect(this.split, 0, 1) // right = speakers
    this.applyCueMix()
  }

  setCueMode(cueMode: CueMode): void {
    if (cueMode === this.state.cueMode) return
    const dest = this.ctx.destination
    if (cueMode === 'split') {
      this.limiter.disconnect(dest)
      this.split.connect(dest)
    } else {
      this.split.disconnect(dest)
      this.limiter.connect(dest)
    }
    this.set({ cueMode })
  }

  toggleCue(index: 0 | 1): void {
    const cue = [...this.state.cue] as [boolean, boolean]
    cue[index] = !cue[index]
    this.cueSends[index].gain.setTargetAtTime(cue[index] ? 1 : 0, this.ctx.currentTime, 0.01)
    this.set({ cue })
  }

  setCueMix(v: number): void {
    this.set({ cueMix: Math.min(1, Math.max(0, v)) })
    this.applyCueMix()
  }

  setCueVolume(v: number): void {
    this.set({ cueVolume: Math.min(1, Math.max(0, v)) })
    this.applyCueMix()
  }

  private applyCueMix(): void {
    const { cueMix, cueVolume } = this.state
    const t = this.ctx.currentTime
    // Equal-power blend between cue and master in the headphones.
    this.hpCue.gain.setTargetAtTime(Math.cos((cueMix * Math.PI) / 2), t, 0.02)
    this.hpMaster.gain.setTargetAtTime(Math.sin((cueMix * Math.PI) / 2), t, 0.02)
    this.hpOut.gain.setTargetAtTime(faderCurve(cueVolume), t, 0.02)
  }

  /** The node that carries the final mix (for recording / streaming). */
  get output(): AudioNode {
    return this.limiter
  }

  connectDeck(deck: Deck): void {
    deck.output.connect(deck.id === 'A' ? this.xfA : this.xfB)
    deck.prefader.connect(this.cueSends[deck.id === 'A' ? 0 : 1])
  }

  setCrossfader(x: number): void {
    this.set({ crossfader: Math.min(1, Math.max(0, x)) })
    this.applyCrossfader()
  }

  setCurve(curve: CrossfaderCurve): void {
    this.set({ curve })
    this.applyCrossfader()
  }

  setMaster(v: number): void {
    const master = Math.min(1, Math.max(0, v))
    this.master.gain.setTargetAtTime(faderCurve(master), this.ctx.currentTime, 0.01)
    this.set({ master })
  }

  private applyCrossfader(immediate = false): void {
    const [a, b] = crossfaderGains(this.state.crossfader, this.state.curve)
    if (immediate) {
      this.xfA.gain.value = a
      this.xfB.gain.value = b
      return
    }
    const t = this.ctx.currentTime
    // Short time constant: smooth enough to avoid zipper noise, fast enough for cuts.
    this.xfA.gain.setTargetAtTime(a, t, 0.005)
    this.xfB.gain.setTargetAtTime(b, t, 0.005)
  }
}

/** Gains for [A, B] at crossfader position x (0..1). */
export function crossfaderGains(x: number, curve: CrossfaderCurve): [number, number] {
  if (curve === 'smooth') {
    // Constant power: no volume dip in the middle of a blend.
    return [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)]
  }
  // Cut / scratch: both channels full except within 5% of the far edge.
  const edge = 0.05
  return [x > 1 - edge ? (1 - x) / edge : 1, x < edge ? x / edge : 1]
}
