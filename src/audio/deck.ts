import type { Bands } from './analysis'
import { analyzeBuffer } from './analyzer'
import { faderCurve } from './curves'
import type { AudioEngine } from './engine'
import {
  createImpulseResponse,
  type EchoBeats,
  EQ_FREQS,
  type EqBand,
  eqKnobToDb,
  filterKnobToCutoffs,
} from './fx'
import { createMeterTap } from './meter'
import { t } from '../i18n'
import { Store } from './store'

export type DeckId = 'A' | 'B'

export type SyncResult = 'ok' | 'too-far' | 'no-bpm'

/** Tempo fader ranges (%). ±30 / ±50 are for mixing tracks with very different tempos. */
export const PITCH_RANGES = [8, 16, 30, 50] as const
export type PitchRange = (typeof PITCH_RANGES)[number]
/** SYNC always reaches ±16 %; with a wider fader it reaches as far as the fader. */
export function syncReach(range: PitchRange): number {
  return Math.max(16, range)
}

export const HOT_CUES = 4

/** Reported once a loaded track has been analysed. */
export interface Analyzed {
  readonly bpm: number | null
  readonly duration: number
}

export interface Loop {
  readonly start: number
  readonly end: number
  readonly beats: number
}

export interface DeckState {
  readonly id: DeckId
  readonly trackName: string | null
  readonly duration: number
  readonly loading: boolean
  /** Waveform / BPM analysis running (track is already playable) */
  readonly analyzing: boolean
  readonly error: string | null
  readonly playing: boolean
  readonly cuePoint: number
  /** Channel fader, 0..1 */
  readonly volume: number
  /** Tempo change in percent, e.g. +3.5 */
  readonly pitch: number
  readonly pitchRange: PitchRange
  /** Overview peaks (whole track) */
  readonly peaks: Float32Array | null
  /** Detail peaks for the scrolling waveform */
  readonly detail: Float32Array | null
  readonly detailRate: number
  /** Low / mid / high peaks for the coloured waveform */
  readonly bands: Bands | null
  /** Original track tempo; null = unknown */
  readonly bpm: number | null
  /** First beat-grid line, seconds */
  readonly firstBeat: number
  /** EQ knobs, -1 (kill) .. 0 (flat) .. 1 (+6 dB) */
  readonly eq: Readonly<Record<EqBand, number>>
  /** Filter knob: -1 low-pass .. 0 off .. 1 high-pass */
  readonly filter: number
  readonly echoOn: boolean
  readonly echoBeats: EchoBeats
  readonly reverbOn: boolean
  /** Effect send level, 0..1 */
  readonly fxAmount: number
  /** Hot cue positions (seconds) or null for empty slots */
  readonly hotCues: readonly (number | null)[]
  readonly loop: Loop | null
  /** SYNC lock: this deck follows the other deck's tempo */
  readonly syncLock: boolean
}

/**
 * One turntable. Playback uses AudioBufferSourceNode, which is one-shot, so a
 * new source is created on every play/seek. The play head is derived from the
 * context clock: position = startOffset + (now - startCtxTime) * playRate.
 *
 *   source ─► input ─► EQ low ─► EQ mid ─► EQ high ─► HPF ─► LPF ─► post ─┬─► output (channel fader) ─► mixer
 *                                                                          ├─► meter (pre-fader, like a real mixer)
 *                                                    echo send ─► delay ⟲ ─┤
 *                                                  reverb send ─► convolver ┘ (returns into output)
 */
export class Deck extends Store<DeckState> {
  readonly id: DeckId
  readonly input: GainNode
  readonly output: GainNode
  readonly meter: AnalyserNode
  /** Post-EQ/filter, pre-fader signal: feeds the headphone cue */
  readonly prefader: GainNode
  private readonly eqNodes: Record<EqBand, BiquadFilterNode>
  private readonly hpf: BiquadFilterNode
  private readonly lpf: BiquadFilterNode
  private readonly echoSend: GainNode
  private readonly echoDelay: DelayNode
  private readonly reverbSend: GainNode

  private readonly engine: AudioEngine
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private startCtxTime = 0
  private startOffset = 0
  /** Temporary jog-wheel tempo bend, e.g. 0.05 = 5% faster */
  private bend = 0
  private previewing = false
  private loadToken = 0

  constructor(engine: AudioEngine, id: DeckId) {
    super({
      id,
      trackName: null,
      duration: 0,
      loading: false,
      analyzing: false,
      error: null,
      playing: false,
      cuePoint: 0,
      volume: 0.8,
      pitch: 0,
      pitchRange: 8,
      peaks: null,
      detail: null,
      detailRate: 1,
      bands: null,
      bpm: null,
      firstBeat: 0,
      eq: { low: 0, mid: 0, high: 0 },
      filter: 0,
      echoOn: false,
      echoBeats: 0.75,
      reverbOn: false,
      fxAmount: 0.5,
      hotCues: Array<number | null>(HOT_CUES).fill(null),
      loop: null,
      syncLock: false,
    })
    this.id = id
    this.engine = engine
    const ctx = engine.ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()
    this.meter = createMeterTap(ctx)

    // EQ
    const band = (type: BiquadFilterType, b: EqBand) => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = EQ_FREQS[b]
      if (type === 'peaking') f.Q.value = 0.7
      f.gain.value = 0
      return f
    }
    this.eqNodes = { low: band('lowshelf', 'low'), mid: band('peaking', 'mid'), high: band('highshelf', 'high') }

    // Filter: an HPF and an LPF in series, both wide open at centre.
    this.hpf = ctx.createBiquadFilter()
    this.hpf.type = 'highpass'
    this.lpf = ctx.createBiquadFilter()
    this.lpf.type = 'lowpass'
    this.hpf.Q.value = this.lpf.Q.value = 1.2
    const open = filterKnobToCutoffs(0, ctx.sampleRate / 2)
    this.hpf.frequency.value = open.highpass
    this.lpf.frequency.value = open.lowpass

    const post = ctx.createGain()
    this.prefader = post
    this.input
      .connect(this.eqNodes.low)
      .connect(this.eqNodes.mid)
      .connect(this.eqNodes.high)
      .connect(this.hpf)
      .connect(this.lpf)
      .connect(post)
    post.connect(this.output)
    post.connect(this.meter)

    // Echo: tempo-synced delay with a darkening feedback loop.
    this.echoSend = ctx.createGain()
    this.echoSend.gain.value = 0
    this.echoDelay = ctx.createDelay(4)
    const fbFilter = ctx.createBiquadFilter()
    fbFilter.type = 'lowpass'
    fbFilter.frequency.value = 4500
    const feedback = ctx.createGain()
    feedback.gain.value = 0.45
    post.connect(this.echoSend).connect(this.echoDelay).connect(this.output)
    this.echoDelay.connect(fbFilter).connect(feedback).connect(this.echoDelay)

    // Reverb
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0
    const convolver = ctx.createConvolver()
    convolver.buffer = createImpulseResponse(ctx)
    post.connect(this.reverbSend).connect(convolver).connect(this.output)

    this.output.gain.value = faderCurve(this.state.volume)
    this.updateEchoTime(true)
  }

  // ---- derived values (read every animation frame; not part of state) ----

  /** Tempo-fader rate */
  get rate(): number {
    return 1 + this.state.pitch / 100
  }

  /** Actual playback rate including jog bend */
  private get playRate(): number {
    return this.rate * (1 + this.bend)
  }

  /** Current play-head position in seconds of track time. */
  get position(): number {
    if (!this.state.playing) return this.startOffset
    let p = this.startOffset + (this.engine.ctx.currentTime - this.startCtxTime) * this.playRate
    const loop = this.state.loop
    if (loop && p >= loop.end) p = loop.start + ((p - loop.start) % (loop.end - loop.start))
    return Math.min(p, this.state.duration)
  }

  get loaded(): boolean {
    return this.buffer !== null
  }

  /** Tempo as heard (after the tempo fader), or null if unknown. */
  get effectiveBpm(): number | null {
    return this.state.bpm === null ? null : this.state.bpm * this.rate
  }

  /** Position within the current beat, 0..1 (null without a beat grid). */
  beatPhase(position = this.position): number | null {
    const { bpm, firstBeat } = this.state
    if (bpm === null) return null
    const beats = (position - firstBeat) / (60 / bpm)
    return beats - Math.floor(beats)
  }

  // ---- loading ----

  async load(file: File, onAnalyzed?: (a: Analyzed) => void, name = stripExtension(file.name)): Promise<void> {
    const token = this.beginLoad(name)
    try {
      const data = await file.arrayBuffer()
      const buffer = await this.engine.ctx.decodeAudioData(data)
      if (token !== this.loadToken) return // a newer load superseded this one
      this.finishLoad(buffer, token, onAnalyzed)
    } catch {
      if (token !== this.loadToken) return
      this.set({ loading: false, trackName: null, error: t('Couldn\'t decode "{name}"', { name: file.name }) })
    }
  }

  /** Download a track (e.g. from Jamendo), decode it and load it. */
  async loadUrl(url: string, name: string, onAnalyzed?: (a: Analyzed) => void): Promise<void> {
    const token = this.beginLoad(name)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.arrayBuffer()
      if (token !== this.loadToken) return
      const buffer = await this.engine.ctx.decodeAudioData(data)
      if (token !== this.loadToken) return
      this.finishLoad(buffer, token, onAnalyzed)
    } catch {
      if (token !== this.loadToken) return
      this.set({ loading: false, trackName: null, error: t('Couldn\'t download "{name}". Check your connection.', { name }) })
    }
  }

  /** Load an already decoded / generated buffer (e.g. a demo track). */
  async loadGenerated(name: string, make: () => Promise<AudioBuffer>): Promise<void> {
    const token = this.beginLoad(name)
    try {
      const buffer = await make()
      if (token !== this.loadToken) return
      this.finishLoad(buffer, token)
    } catch {
      if (token !== this.loadToken) return
      this.set({ loading: false, trackName: null, error: t('Couldn\'t create "{name}"', { name }) })
    }
  }

  private beginLoad(name: string): number {
    const token = ++this.loadToken
    this.stopSource()
    this.buffer = null
    this.startOffset = 0
    this.bend = 0
    this.set({
      trackName: name,
      loading: true,
      analyzing: false,
      error: null,
      playing: false,
      duration: 0,
      cuePoint: 0,
      peaks: null,
      detail: null,
      bands: null,
      bpm: null,
      firstBeat: 0,
      hotCues: Array<number | null>(HOT_CUES).fill(null),
      loop: null,
      syncLock: false,
    })
    return token
  }

  private finishLoad(buffer: AudioBuffer, token: number, onAnalyzed?: (a: Analyzed) => void): void {
    this.buffer = buffer
    this.set({ loading: false, analyzing: true, duration: buffer.duration })
    void analyzeBuffer(buffer).then((a) => {
      if (token !== this.loadToken) return
      // Before the state change, so anything that re-renders on it sees the result.
      onAnalyzed?.({ bpm: a.bpm, duration: buffer.duration })
      this.set({
        analyzing: false,
        peaks: a.peaks,
        detail: a.detail,
        detailRate: a.detailRate,
        bands: a.bands,
        bpm: a.bpm,
        firstBeat: a.firstBeat,
      })
      this.updateEchoTime()
    })
  }

  // ---- transport ----

  play(): void {
    if (!this.buffer || this.state.playing) return
    void this.engine.resume()
    if (this.startOffset >= this.state.duration) this.startOffset = 0
    this.startSource(this.startOffset)
    this.set({ playing: true })
  }

  pause(): void {
    if (!this.state.playing) return
    this.startOffset = this.position
    this.stopSource()
    this.previewing = false
    this.set({ playing: false })
  }

  togglePlay(): void {
    if (this.state.playing) this.pause()
    else this.play()
  }

  seek(seconds: number): void {
    if (!this.buffer) return
    const t = clamp(seconds, 0, this.state.duration)
    // Jumping out of an active loop releases it (like a CDJ).
    const loop = this.state.loop
    if (loop && (t < loop.start || t >= loop.end)) this.exitLoop()
    if (this.state.playing) {
      this.stopSource()
      this.startSource(t)
    } else {
      this.startOffset = t
      this.set({}) // paused seek: no field changes, but the UI should redraw
    }
  }

  /**
   * CDJ-style cue button:
   *  - playing          → jump back to cue point and stop
   *  - paused on cue    → preview from cue while held
   *  - paused elsewhere → set cue point here
   */
  cueDown(): void {
    if (!this.buffer) return
    if (this.state.playing) {
      this.pause()
      this.seek(this.state.cuePoint)
    } else if (Math.abs(this.startOffset - this.state.cuePoint) < 0.02) {
      this.previewing = true
      this.play()
    } else {
      this.set({ cuePoint: this.startOffset })
    }
  }

  cueUp(): void {
    if (!this.previewing) return
    this.previewing = false
    this.pause()
    this.seek(this.state.cuePoint)
  }

  // ---- tempo ----

  setVolume(v: number): void {
    const volume = clamp(v, 0, 1)
    this.output.gain.setTargetAtTime(faderCurve(volume), this.engine.ctx.currentTime, 0.01)
    this.set({ volume })
  }

  /** Tempo fader moved by the user: this also releases a SYNC lock. */
  setPitch(percent: number): void {
    if (this.state.syncLock) this.set({ syncLock: false })
    this.applyPitch(percent)
  }

  private applyPitch(percent: number): void {
    const pitch = clamp(percent, -this.state.pitchRange, this.state.pitchRange)
    this.reanchor()
    this.set({ pitch })
    this.applyRate()
    this.updateEchoTime()
  }

  setPitchRange(range: PitchRange): void {
    // A range too narrow for the synced tempo can't keep the lock.
    if (this.state.syncLock && Math.abs(this.state.pitch) > range) this.set({ syncLock: false })
    this.set({ pitchRange: range })
    this.applyPitch(this.state.pitch) // re-clamp
  }

  /** Temporary tempo bend from the jog wheel (-0.5..0.5); 0 to release. */
  setBend(amount: number): void {
    const b = clamp(amount, -0.5, 0.5)
    if (b === this.bend) return
    this.reanchor()
    this.bend = b
    this.applyRate()
  }

  /**
   * Match this deck's tempo to `other`, and if both are playing also line up
   * the beats. Handles half/double tempo (e.g. 87 ↔ 174). Returns 'too-far' if
   * the tempo is beyond the reach the DJ chose (±16 %, or ±30 / ±50 %).
   */
  syncTo(other: Deck): SyncResult {
    const own = this.state.bpm
    if (other.effectiveBpm === null || own === null) return 'no-bpm'
    const match = this.tempoMatch(other)
    if (match === null) return 'too-far'
    const { pitch, ratio } = match
    if (Math.abs(pitch) > this.state.pitchRange) this.set({ pitchRange: 16 })
    this.applyPitch(pitch)

    if (this.state.playing && other.state.playing) {
      const mine = this.beatPhase()
      let theirs = other.beatPhase()
      if (mine !== null && theirs !== null) {
        // Double / half time: express the other deck's position in our beats.
        if (ratio === 2) theirs = (theirs * 2) % 1
        if (ratio === 0.5) {
          const a = theirs / 2
          theirs = Math.abs(((a - mine + 1.5) % 1) - 0.5) <= Math.abs(((a + 0.5 - mine + 1.5) % 1) - 0.5) ? a : a + 0.5
        }
        let d = theirs - mine
        d -= Math.round(d) // shortest way: -0.5..0.5 beats
        let t = this.position + d * (60 / own)
        // Stay inside an active loop instead of jumping out of it.
        const loop = this.state.loop
        if (loop) {
          const len = loop.end - loop.start
          t = loop.start + ((((t - loop.start) % len) + len) % len)
        }
        this.seek(t)
      }
    }
    return 'ok'
  }

  /**
   * SYNC button: match `other` and stay locked to its tempo. Only one deck
   * follows at a time, so the other deck's lock is released.
   */
  engageSync(other: Deck): SyncResult {
    const r = this.syncTo(other)
    if (r === 'ok') {
      other.setSyncLock(false)
      this.set({ syncLock: true })
    }
    return r
  }

  /**
   * Tap tempo: set the track's tempo by hand. `heardBpm` is what the user
   * tapped (it includes the tempo fader); `beatAt` is a track position that
   * falls on a beat (the last tap), used to place the beat grid.
   */
  setManualTempo(heardBpm: number, beatAt: number): void {
    if (!this.buffer || !(heardBpm > 0)) return
    const bpm = Math.round((heardBpm / this.rate) * 10) / 10
    const beatLen = 60 / bpm
    const firstBeat = ((beatAt % beatLen) + beatLen) % beatLen
    this.set({ bpm, firstBeat })
    this.updateEchoTime()
  }

  setSyncLock(on: boolean): void {
    if (this.state.syncLock !== on) this.set({ syncLock: on })
  }

  /** Called when the other deck changes: keep following its tempo. */
  followTempo(other: Deck): void {
    if (!this.state.syncLock || this.state.bpm === null) return
    if (other.effectiveBpm === null) return
    const pitch = this.pitchToMatch(other)
    if (pitch === null) {
      this.set({ syncLock: false })
      return
    }
    if (Math.abs(pitch - this.state.pitch) < 0.001) return
    if (Math.abs(pitch) > this.state.pitchRange) this.set({ pitchRange: 16 })
    this.applyPitch(pitch)
  }

  /** Tempo change (%) that matches `other` (also half / double time), or null if out of reach. */
  private pitchToMatch(other: Deck): number | null {
    return this.tempoMatch(other)?.pitch ?? null
  }

  /** Best tempo match: pitch % and our beats per other-deck beat (1, 2 or 0.5). */
  private tempoMatch(other: Deck): { pitch: number; ratio: 1 | 2 | 0.5 } | null {
    const target = other.effectiveBpm
    const own = this.state.bpm
    if (target === null || own === null) return null
    const ratios = [1, 2, 0.5] as const
    let best: { pitch: number; ratio: 1 | 2 | 0.5 } | null = null
    for (const ratio of ratios) {
      const pitch = ((target * ratio) / own - 1) * 100
      if (!best || Math.abs(pitch) < Math.abs(best.pitch)) best = { pitch, ratio }
    }
    return best && Math.abs(best.pitch) <= syncReach(this.state.pitchRange) + 1e-9 ? best : null
  }

  // ---- EQ / filter / FX ----

  setEq(band: EqBand, v: number): void {
    const value = clamp(v, -1, 1)
    this.eqNodes[band].gain.setTargetAtTime(eqKnobToDb(value), this.engine.ctx.currentTime, 0.01)
    this.set({ eq: { ...this.state.eq, [band]: value } })
  }

  setFilter(v: number): void {
    const filter = clamp(v, -1, 1)
    const { lowpass, highpass } = filterKnobToCutoffs(filter, this.engine.ctx.sampleRate / 2)
    const t = this.engine.ctx.currentTime
    this.lpf.frequency.setTargetAtTime(lowpass, t, 0.015)
    this.hpf.frequency.setTargetAtTime(highpass, t, 0.015)
    this.set({ filter })
  }

  toggleEcho(): void {
    this.set({ echoOn: !this.state.echoOn })
    this.updateSends()
  }

  toggleReverb(): void {
    this.set({ reverbOn: !this.state.reverbOn })
    this.updateSends()
  }

  setEchoBeats(echoBeats: EchoBeats): void {
    this.set({ echoBeats })
    this.updateEchoTime()
  }

  setFxAmount(v: number): void {
    this.set({ fxAmount: clamp(v, 0, 1) })
    this.updateSends()
  }

  private updateSends(): void {
    const t = this.engine.ctx.currentTime
    const { echoOn, reverbOn, fxAmount } = this.state
    // Turning an effect off closes the send; its tail keeps ringing out.
    this.echoSend.gain.setTargetAtTime(echoOn ? fxAmount : 0, t, 0.02)
    this.reverbSend.gain.setTargetAtTime(reverbOn ? fxAmount * 0.8 : 0, t, 0.02)
  }

  /** Echo time follows the heard tempo (fallback 120 BPM). */
  private updateEchoTime(immediate = false): void {
    const bpm = this.effectiveBpm ?? 120
    const time = Math.min(4, (60 / bpm) * this.state.echoBeats)
    if (immediate) this.echoDelay.delayTime.value = time
    else this.echoDelay.delayTime.setTargetAtTime(time, this.engine.ctx.currentTime, 0.05)
  }

  // ---- hot cues ----

  /** Empty slot: store the (beat-quantized) position. Set slot: jump there and play. */
  hotCue(index: number): void {
    if (!this.buffer) return
    const t = this.state.hotCues[index]
    if (t === null || t === undefined) {
      const hotCues = [...this.state.hotCues]
      hotCues[index] = this.quantize(this.position)
      this.set({ hotCues })
      return
    }
    this.seek(t)
    if (!this.state.playing) this.play()
  }

  clearHotCue(index: number): void {
    const hotCues = [...this.state.hotCues]
    hotCues[index] = null
    this.set({ hotCues })
  }

  // ---- loops ----

  /**
   * Auto loop of `beats` beats starting on the beat at (or just before) the
   * play head. Pressing the active size again exits; another size resizes.
   */
  toggleLoop(beats: number): void {
    if (!this.buffer) return
    const current = this.state.loop
    if (current?.beats === beats) {
      this.exitLoop()
      return
    }
    const beatLen = 60 / (this.state.bpm ?? 120)
    const pos = this.position
    let start = current ? current.start : pos
    if (!current && this.state.bpm !== null) {
      const k = Math.floor((pos - this.state.firstBeat) / beatLen + 1e-4)
      start = Math.max(0, this.state.firstBeat + k * beatLen)
    }
    const end = Math.min(this.state.duration, start + beats * beatLen)
    if (end - start < 0.01) return

    this.reanchor()
    this.set({ loop: { start, end, beats } })
    this.applyLoop()
    // Shrinking a loop can leave the play head past the new end: wrap it in.
    if (pos >= end) this.seek(start + ((pos - start) % (end - start)))
  }

  exitLoop(): void {
    if (!this.state.loop) return
    this.reanchor() // keep the wrapped position as the new anchor
    this.set({ loop: null })
    this.applyLoop()
  }

  private applyLoop(): void {
    const src = this.source
    if (!src) return
    const loop = this.state.loop
    if (loop) {
      src.loopStart = loop.start
      src.loopEnd = loop.end
    }
    src.loop = loop !== null
  }

  /** Snap to the nearest beat-grid line (no-op without a grid). */
  private quantize(t: number): number {
    const { bpm, firstBeat } = this.state
    if (bpm === null) return t
    const beatLen = 60 / bpm
    return clamp(firstBeat + Math.round((t - firstBeat) / beatLen) * beatLen, 0, this.state.duration)
  }

  // ---- internals ----

  /** Re-anchor the play-head clock before changing the playback rate. */
  private reanchor(): void {
    if (!this.state.playing) return
    this.startOffset = this.position
    this.startCtxTime = this.engine.ctx.currentTime
  }

  private applyRate(): void {
    this.source?.playbackRate.setValueAtTime(this.playRate, this.engine.ctx.currentTime)
  }

  private startSource(offset: number): void {
    const ctx = this.engine.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.buffer
    src.playbackRate.value = this.playRate
    src.connect(this.input)
    src.onended = () => {
      // Only react to the natural end of the *current* source.
      if (this.source !== src) return
      this.source = null
      this.startOffset = this.state.duration
      this.previewing = false
      this.set({ playing: false })
    }
    this.startOffset = offset
    this.startCtxTime = ctx.currentTime
    this.source = src
    this.applyLoop()
    src.start(0, offset)
  }

  private stopSource(): void {
    const src = this.source
    if (!src) return
    this.source = null
    src.onended = null
    try {
      src.stop()
    } catch {
      /* already stopped */
    }
    src.disconnect()
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}
