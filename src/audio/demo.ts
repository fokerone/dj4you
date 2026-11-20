/**
 * Built-in demo tracks, synthesized in the browser with an OfflineAudioContext:
 * no downloads, no licensing. Several styles and tempos so beginners can try
 * mixing, SYNC and half/double-time blends right away.
 */

export interface DemoSpec {
  readonly name: string
  readonly bpm: number
  /** Bass root frequency (Hz) */
  readonly root: number
  /** Chord roots in semitones from `root`, one per 2 bars (minor chords) */
  readonly progression: readonly number[]
  readonly style?: Style
  /** Genre label shown in the library */
  readonly genre: string
}

export type Style = 'house' | 'techno' | 'hiphop' | 'dnb'

/** A one-bar pattern on a 16-step grid. */
interface Pattern {
  kick: number[]
  snare: number[]
  /** Bar from which the snare/clap comes in */
  snareFrom: number
  hats: 'sixteenths' | 'eighths'
  /** Delay of the off-beat 16ths/8ths, as a fraction of a 16th (swing) */
  swing: number
  openHat: boolean
  bass: number[]
  stabs: number[]
  pad: 'breakdown' | 'always'
}

const PATTERNS: Record<Style, Pattern> = {
  house: { kick: [0, 4, 8, 12], snare: [4, 12], snareFrom: 4, hats: 'sixteenths', swing: 0, openHat: true, bass: [2, 6, 10, 14], stabs: [6, 14], pad: 'breakdown' },
  techno: { kick: [0, 4, 8, 12], snare: [4, 12], snareFrom: 8, hats: 'sixteenths', swing: 0, openHat: true, bass: [2, 3, 6, 7, 10, 11, 14, 15], stabs: [], pad: 'breakdown' },
  hiphop: { kick: [0, 7, 10], snare: [4, 12], snareFrom: 0, hats: 'eighths', swing: 0.45, openHat: false, bass: [0, 10], stabs: [14], pad: 'always' },
  dnb: { kick: [0, 10], snare: [4, 12], snareFrom: 0, hats: 'eighths', swing: 0, openHat: false, bass: [0, 3, 10], stabs: [], pad: 'always' },
}

export const DEMOS: readonly DemoSpec[] = [
  { name: 'Demo · Sunrise (122)', bpm: 122, root: 55, progression: [0, -4, 3, -2], genre: 'House' },
  { name: 'Demo · Night Drive (126)', bpm: 126, root: 49, progression: [0, 3, -2, -4], genre: 'House' },
  { name: 'Demo · Afterglow (120)', bpm: 120, root: 46.25, progression: [0, 5, 3, -2], genre: 'Deep house' },
  { name: 'Demo · Rush Hour (128)', bpm: 128, root: 51.91, progression: [0, -2, -4, -5], genre: 'House' },
  { name: 'Demo · Warehouse (132)', bpm: 132, root: 43.65, progression: [0, 0, -2, 0], genre: 'Techno', style: 'techno' },
  { name: 'Demo · Boom Bap (90)', bpm: 90, root: 41.2, progression: [0, 5, 3, -2], genre: 'Hip-hop', style: 'hiphop' },
  { name: 'Demo · Liquid (174)', bpm: 174, root: 46.25, progression: [0, -4, 3, -5], genre: 'Drum & bass', style: 'dnb' },
]

const BARS = 32
const SR = 44100

/**
 * Each sound (kick, hats, bass note per chord, …) is rendered once in a tiny
 * OfflineAudioContext, then the arrangement is mixed sample-accurately in
 * plain JS. Much faster than scheduling thousands of nodes in one long render.
 */
export async function renderDemo(spec: DemoSpec): Promise<AudioBuffer> {
  const beat = 60 / spec.bpm
  const bar = beat * 4
  const hz = (semis: number, octave = 0) => spec.root * 2 ** (semis / 12 + octave)
  const chords = [...new Set(spec.progression)]

  const [kickS, clapS, hatS, openS] = await Promise.all([
    voice(0.45, (c, d) => kick(c, d, 0)),
    voice(0.2, (c, d) => hit(c, noiseBuffer(c), filter(c, 'bandpass', 1500, 1.2, d), 0, 0.5, 0.14)),
    voice(0.05, (c, d) => hit(c, noiseBuffer(c), filter(c, 'highpass', 7000, 0.7, d), 0, 0.08, 0.03)),
    voice(0.2, (c, d) => hit(c, noiseBuffer(c), filter(c, 'highpass', 7000, 0.7, d), 0, 0.16, 0.16)),
  ])
  const perChord = await Promise.all(
    chords.map(async (ch) => {
      const [bass, stab, padS] = await Promise.all([
        voice(beat * 0.45, (c, d) => tone(c, filter(c, 'lowpass', 380, 5, d), 'sawtooth', [hz(ch)], 0, beat * 0.4, 0.45)),
        voice(beat * 0.35, (c, d) =>
          tone(c, filter(c, 'lowpass', 2200, 1, d), 'sawtooth', [0, 3, 7].map((i) => hz(ch + i, 3)), 0, beat * 0.3, 0.07),
        ),
        voice(bar * 2, (c, d) => pad(c, filter(c, 'lowpass', 1200, 0.5, d), [0, 3, 7, 12].map((i) => hz(ch + i, 2)), 0, bar * 2)),
      ])
      return [ch, { bass, stab, pad: padS }] as const
    }),
  )
  const chordVoices = new Map(perChord)

  const length = Math.ceil((BARS * bar + 1.5) * SR)
  const L = new Float32Array(length)
  const R = new Float32Array(length)
  /** Mix a voice in at time t with gain and pan (-1..1). */
  const add = (v: Float32Array, t: number, gain = 1, pan = 0) => {
    const start = Math.round(t * SR)
    const gl = gain * Math.min(1, 1 - pan)
    const gr = gain * Math.min(1, 1 + pan)
    const n = Math.min(v.length, length - start)
    for (let i = 0; i < n; i++) {
      L[start + i] += v[i] * gl
      R[start + i] += v[i] * gr
    }
  }

  const pat = PATTERNS[spec.style ?? 'house']
  const step = beat / 4
  for (let b = 0; b < BARS; b++) {
    const t0 = b * bar
    const cv = chordVoices.get(spec.progression[Math.floor(b / 2) % spec.progression.length])!
    const breakdown = b >= 16 && b < 20
    const full = b >= 8 && !breakdown

    for (let s = 0; s < 16; s++) {
      // Swing pushes the off-beat 16ths (or 8ths) a little late.
      const offbeat = pat.hats === 'eighths' ? s % 4 === 2 : s % 2 === 1
      const t = t0 + s * step + (offbeat ? pat.swing * step : 0)
      if (!breakdown && pat.kick.includes(s)) add(kickS, t)
      if (b >= pat.snareFrom && !breakdown && pat.snare.includes(s)) add(clapS, t)
      const hatOn = pat.hats === 'sixteenths' || s % 2 === 0
      if (hatOn && (!breakdown || b >= 18)) add(hatS, t, s % 4 === 0 ? 1 : 0.6 + 0.15 * ((b + s) % 3), 0.25)
      if (full && pat.openHat && s % 4 === 2) add(openS, t, 1, -0.2)
      if (full && pat.bass.includes(s)) add(cv.bass, t, s % 2 ? 0.7 : 1)
      if (b >= 12 && pat.stabs.includes(s)) add(cv.stab, t, 1, s < 8 ? -0.15 : 0.15)
    }
    const padHere = pat.pad === 'always' ? b % 2 === 0 : b >= 16 && b < 24 && b % 2 === 0
    if (padHere) add(cv.pad, t0, pat.pad === 'always' ? 0.8 : 1)
  }

  const out = new AudioBuffer({ numberOfChannels: 2, length, sampleRate: SR })
  out.copyToChannel(L, 0)
  out.copyToChannel(R, 1)
  normalize(out, 0.89)
  return out
}

/** Render one sound to a mono sample. */
async function voice(seconds: number, build: (ctx: OfflineAudioContext, dest: AudioNode) => void): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR)
  const g = ctx.createGain()
  g.gain.value = 0.5
  g.connect(ctx.destination)
  build(ctx, g)
  const buf = await ctx.startRendering()
  return buf.getChannelData(0)
}

// ---------------------------------------------------------------- voices

function kick(ctx: BaseAudioContext, dest: AudioNode, t: number): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  g.gain.setValueAtTime(1, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + 0.45)
}

function hit(ctx: BaseAudioContext, noise: AudioBuffer, dest: AudioNode, t: number, level: number, decay: number): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const g = ctx.createGain()
  g.gain.setValueAtTime(level, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + decay)
  src.connect(g).connect(dest)
  // Random start point so repeated hits don't sound identical.
  src.start(t, Math.random() * (noise.duration - decay - 0.05))
  src.stop(t + decay + 0.01)
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freqs: number[],
  t: number,
  len: number,
  level: number,
): void {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, t + len)
  g.connect(dest)
  for (const f of freqs) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = f
    osc.connect(g)
    osc.start(t)
    osc.stop(t + len + 0.01)
  }
}

function pad(ctx: BaseAudioContext, dest: AudioNode, freqs: number[], t: number, len: number): void {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.05, t + len * 0.4)
  g.gain.linearRampToValueAtTime(0, t + len)
  g.connect(dest)
  for (const [i, f] of freqs.entries()) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = f
    osc.detune.value = i % 2 ? 6 : -6
    osc.connect(g)
    osc.start(t)
    osc.stop(t + len)
  }
}

// ---------------------------------------------------------------- helpers

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  f.connect(dest)
  return f
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, SR, SR)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function normalize(buf: AudioBuffer, target: number): void {
  let peak = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v))
  }
  if (peak === 0) return
  const k = target / peak
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
}
