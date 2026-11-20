/**
 * Track analysis: waveform peaks + tempo/beat-grid detection.
 * Pure functions (no DOM / Web Audio), so it runs in a Web Worker
 * or — as a fallback — on the main thread.
 */

export interface Analysis {
  /** Whole-track overview peaks, 0..1 */
  peaks: Float32Array<ArrayBuffer>
  /** Detailed peaks for the scrolling waveform, `detailRate` bins per second */
  detail: Float32Array<ArrayBuffer>
  detailRate: number
  /** Per-band peaks for the coloured waveform (same bins as `detail`) */
  bands: Bands
  /** Detected tempo, or null if no clear beat was found */
  bpm: number | null
  /** Time of the first beat-grid line in seconds (0 <= firstBeat < 60/bpm) */
  firstBeat: number
}

export interface Bands {
  low: Float32Array<ArrayBuffer>
  mid: Float32Array<ArrayBuffer>
  high: Float32Array<ArrayBuffer>
}

export const DETAIL_RATE = 150
const OVERVIEW_BINS = 1200
/** Onset envelope frame rate */
const FPS = 200
const MIN_BPM = 70
const MAX_BPM = 180
/** A clear pulse: accepted without further checks */
const MIN_CLARITY = 2
/** Below this the onset pattern is flat: no beat */
const MIN_FLATNESS_CLARITY = 1.15
/** Share of segments that must agree on the tempo when the pulse is weaker */
const MIN_AGREEMENT = 0.5
/** Off-beat vs on-beat snare energy needed to call double time */
const DOUBLE_RATIO = 0.8
/** Mean log-energy rise on the beat; tiny for steady tones and noise. */
const MIN_STRENGTH = 0.15
const DEBUG = false

export function analyze(mono: Float32Array, sampleRate: number): Analysis {
  const peaks = normalize(binPeaks(mono, OVERVIEW_BINS))
  const detailBins = Math.max(1, Math.ceil((mono.length / sampleRate) * DETAIL_RATE))
  const detail = normalize(binPeaks(mono, detailBins))
  const bands = bandPeaks(mono, sampleRate, detailBins)
  const { bpm, firstBeat } = detectTempo(mono, sampleRate)
  return { peaks, detail, detailRate: DETAIL_RATE, bands, bpm, firstBeat }
}

// ---------------------------------------------------------------- peaks

function binPeaks(data: Float32Array, bins: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(bins)
  const step = data.length / bins
  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * step)
    const end = Math.min(data.length, Math.floor((b + 1) * step))
    // Stride through long bins; an exact max is not needed for display.
    const stride = Math.max(1, Math.floor((end - start) / 128))
    let max = 0
    for (let i = start; i < end; i += stride) {
      const v = Math.abs(data[i])
      if (v > max) max = v
    }
    out[b] = max
  }
  return out
}

/**
 * Split into lows (< ~200 Hz), highs (> ~2.5 kHz) and the mids in between
 * with one-pole filters, and keep each band's peak per bin. All three share
 * one scale so their heights compare.
 */
function bandPeaks(x: Float32Array, sr: number, bins: number): Bands {
  const low = new Float32Array(bins)
  const mid = new Float32Array(bins)
  const high = new Float32Array(bins)
  const aLow = Math.exp((-2 * Math.PI * 200) / sr)
  const aHigh = Math.exp((-2 * Math.PI * 2500) / sr)
  let l1 = 0
  let l2 = 0
  let h = 0
  const step = x.length / bins
  for (let b = 0; b < bins; b++) {
    const end = Math.min(x.length, Math.floor((b + 1) * step))
    let ml = 0
    let mm = 0
    let mh = 0
    for (let i = Math.floor(b * step); i < end; i++) {
      const s = x[i]
      l1 = (1 - aLow) * s + aLow * l1
      l2 = (1 - aLow) * l1 + aLow * l2
      h = (1 - aHigh) * s + aHigh * h
      const hi = s - h
      const md = h - l2
      if (l2 > ml) ml = l2
      else if (-l2 > ml) ml = -l2
      if (md > mm) mm = md
      else if (-md > mm) mm = -md
      if (hi > mh) mh = hi
      else if (-hi > mh) mh = -hi
    }
    low[b] = ml
    mid[b] = mm
    high[b] = mh
  }
  let max = 0
  for (const a of [low, mid, high]) for (const v of a) if (v > max) max = v
  if (max > 0) for (const a of [low, mid, high]) for (let i = 0; i < a.length; i++) a[i] /= max
  return { low, mid, high }
}

function normalize(a: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let max = 0
  for (const v of a) if (v > max) max = v
  if (max > 0) for (let i = 0; i < a.length; i++) a[i] /= max
  return a
}

// ---------------------------------------------------------------- tempo

/**
 * 1. Onset envelope: positive changes in log energy, from a low-passed (kick)
 *    band plus the full band, at 200 frames/s, with the local average removed.
 * 2. Comb search: for every candidate tempo, find the grid phase whose beat
 *    positions collect the most onset energy. Coarse pass over 70–180 BPM,
 *    then a fine pass around the winner.
 */
export function detectTempo(mono: Float32Array, sampleRate: number): { bpm: number | null; firstBeat: number } {
  const { onset, bright } = onsetEnvelope(mono, sampleRate)
  if (onset.length < FPS * 4) return { bpm: null, firstBeat: 0 } // < 4 s of audio

  // Coarse pass.
  let best = { bpm: 0, phase: 0, score: -Infinity }
  const raw: number[] = []
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.25) {
    const r = bestPhase(onset, bpm, 1)
    raw.push(r.score)
    const score = r.score * tempoPrior(bpm)
    if (score > best.score) best = { bpm, phase: r.phase, score }
  }
  // Reject audio without a clear pulse: a real beat makes one tempo (family)
  // stand far above the typical candidate; noise and pads stay flat.
  raw.sort((x, y) => x - y)
  const median = raw[raw.length >> 1]
  const clarity = median > 0 ? raw[raw.length - 1] / median : 0
  if (DEBUG) console.log('clarity', clarity.toFixed(2))
  // Too flat to be a beat at all (silence, steady noise).
  if (!(clarity >= MIN_FLATNESS_CLARITY)) return { bpm: null, firstBeat: 0 }
  // Fine pass.
  let fine = { bpm: best.bpm, phase: best.phase, score: -Infinity }
  for (let bpm = best.bpm - 0.3; bpm <= best.bpm + 0.3; bpm += 0.01) {
    const r = bestPhase(onset, bpm, 0.25)
    if (r.score > fine.score) fine = { bpm, phase: r.phase, score: r.score }
  }
  // Half-time trap: at 85–90 BPM the comb also fits drum & bass (170–180) when
  // its snares land on the "and"s. If the doubled grid scores nearly as well,
  // the music really moves at the faster tempo.
  if (fine.bpm < 95 && fine.bpm * 2 <= MAX_BPM + 0.5) {
    // Backbeat test: snares/claps normally sit ON the beat (2 and 4). If they
    // sit between this grid's beats instead, the real beat is twice as fast.
    const period = (FPS * 60) / fine.bpm
    const onBeats = meanAt(bright, fine.phase, period)
    const between = meanAt(bright, fine.phase + period / 2, period)
    if (DEBUG) console.log('backbeat between/on', (between / (onBeats || 1e-9)).toFixed(2))
    if (between > onBeats * DOUBLE_RATIO) {
      const dbl = bestPhase(onset, fine.bpm * 2, 0.25)
      fine = { bpm: fine.bpm * 2, phase: dbl.phase, score: dbl.score }
    }
  }

  // Most produced music sits on an integer tempo: snap if it scores about as well.
  const rounded = Math.round(fine.bpm)
  const snapped = bestPhase(onset, rounded, 0.25)
  if (snapped.score >= fine.score * 0.98) fine = { bpm: rounded, phase: snapped.phase, score: snapped.score }

  if (DEBUG) console.log('beat strength', fine.score.toFixed(3))
  if (fine.score < MIN_STRENGTH) return { bpm: null, firstBeat: 0 }
  // Real music often has a less pronounced pulse than a drum machine (vocals,
  // reverb, live drums). Accept a clear pulse, or one that stays steady
  // through the track; reject what only looks periodic by chance.
  if (clarity < MIN_CLARITY) {
    const agreement = segmentAgreement(onset, fine.bpm)
    if (DEBUG) console.log('agreement', agreement.toFixed(2))
    if (agreement < MIN_AGREEMENT) return { bpm: null, firstBeat: 0 }
  }

  return { bpm: Math.round(fine.bpm * 100) / 100, firstBeat: fine.phase / FPS }
}

function onsetEnvelope(x: Float32Array, sr: number): { onset: Float32Array; bright: Float32Array } {
  const hop = sr / FPS
  const frames = Math.floor(x.length / hop)
  const low = new Float32Array(frames)
  const full = new Float32Array(frames)
  // Two cascaded one-pole low-passes at ~150 Hz isolate the kick.
  const a = Math.exp((-2 * Math.PI * 150) / sr)
  let y1 = 0
  let y2 = 0
  let i = 0
  for (let f = 0; f < frames; f++) {
    const end = Math.floor((f + 1) * hop)
    let el = 0
    let ef = 0
    for (; i < end; i++) {
      const s = x[i]
      y1 = (1 - a) * s + a * y1
      y2 = (1 - a) * y1 + a * y2
      el += y2 * y2
      ef += s * s
    }
    low[f] = Math.log(1e-9 + el)
    full[f] = Math.log(1e-9 + ef)
  }
  const onset = new Float32Array(frames)
  /** Onsets without a matching low-end rise: snares, claps, hats. */
  const bright = new Float32Array(frames)
  for (let f = 1; f < frames; f++) {
    onset[f] = Math.max(0, low[f] - low[f - 1]) + 0.5 * Math.max(0, full[f] - full[f - 1])
    bright[f] = Math.max(0, full[f] - full[f - 1] - Math.max(0, low[f] - low[f - 1]))
  }
  onset[0] = onset[1]
  // Subtract a 0.5 s moving average and half-wave rectify: keeps the peaks.
  const win = Math.round(FPS * 0.25)
  const out = new Float32Array(frames)
  let sum = 0
  for (let f = 0; f < Math.min(frames, win); f++) sum += onset[f]
  for (let f = 0; f < frames; f++) {
    if (f + win < frames) sum += onset[f + win]
    if (f - win - 1 >= 0) sum -= onset[f - win - 1]
    const n = Math.min(frames - 1, f + win) - Math.max(0, f - win) + 1
    out[f] = Math.max(0, onset[f] - sum / n)
  }
  return { onset: out, bright }
}

/** Mean value at positions start, start + period, … (nearest frame, ±1 tolerance). */
function meanAt(env: Float32Array, start: number, period: number): number {
  let sum = 0
  let n = 0
  for (let pos = start; pos < env.length - 1; pos += period) {
    const i = Math.round(pos)
    sum += Math.max(env[i - 1] ?? 0, env[i], env[i + 1] ?? 0)
    n++
  }
  return n ? sum / n : 0
}

/** Mean onset value at beat positions, maximised over grid phase. */
function bestPhase(onset: Float32Array, bpm: number, phaseStep: number): { phase: number; score: number } {
  const period = (FPS * 60) / bpm
  let bestScore = -Infinity
  let bestPh = 0
  for (let phase = 0; phase < period; phase += phaseStep) {
    let sum = 0
    let n = 0
    for (let pos = phase; pos < onset.length - 1; pos += period) {
      const i = Math.floor(pos)
      const frac = pos - i
      // Interpolated value, with some tolerance for ±1 frame of timing jitter.
      sum += Math.max(onset[i] * (1 - frac) + onset[i + 1] * frac, 0.7 * Math.max(onset[i], onset[i + 1]))
      n++
    }
    const score = n ? sum / n : 0
    if (score > bestScore) {
      bestScore = score
      bestPh = phase
    }
  }
  return { phase: bestPh, score: bestScore }
}

/** Gentle preference for typical dance tempos (log-Gaussian around 125 BPM). */
/**
 * Share of the track's segments (≥8 s each) whose own best tempo agrees with
 * `bpm` within 2 % (also at double / half time). A real beat is steady
 * through the track; noise, pads and speech give a different "tempo" in
 * every segment.
 */
function segmentAgreement(onset: Float32Array, bpm: number): number {
  const segLen = Math.max(FPS * 8, Math.floor(onset.length / 4))
  const segs: Float32Array[] = []
  for (let start = 0; start + FPS * 6 <= onset.length; start += segLen) segs.push(onset.subarray(start, Math.min(onset.length, start + segLen)))
  // Too short to check steadiness: don't vouch for it (a clear pulse still passes).
  if (segs.length < 2) return 0
  let agree = 0
  for (const seg of segs) {
    let best = 0
    let bestScore = -Infinity
    for (let b = MIN_BPM; b <= MAX_BPM; b += 0.5) {
      const sc = bestPhase(seg, b, 1).score * tempoPrior(b)
      if (sc > bestScore) {
        bestScore = sc
        best = b
      }
    }
    if ([1, 2, 0.5].some((m) => Math.abs(best * m - bpm) / bpm < 0.02)) agree++
  }
  return agree / segs.length
}

function tempoPrior(bpm: number): number {
  const octaves = Math.log2(bpm / 125)
  return Math.exp(-0.5 * (octaves / 0.9) ** 2)
}
