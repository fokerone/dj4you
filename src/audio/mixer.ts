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
}

export const DEFAULT_MASTER = 0.9

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

  constructor(ctx: AudioContext) {
    super({ crossfader: 0.5, curve: 'smooth', master: DEFAULT_MASTER })
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
  }

  /** The node that carries the final mix (for recording / streaming). */
  get output(): AudioNode {
    return this.limiter
  }

  connectDeck(deck: Deck): void {
    deck.output.connect(deck.id === 'A' ? this.xfA : this.xfB)
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
