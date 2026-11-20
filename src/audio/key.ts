/**
 * Musical key detection and harmonic mixing helpers.
 *
 * A key is a number 0–23: 0–11 are the major keys (C, C#, … B) and 12–23 the
 * minor keys (Cm, C#m, … Bm). DJs usually read them on the Camelot wheel
 * ("8A" = A minor, "8B" = C major): neighbours on the wheel mix smoothly.
 *
 * Detection: a chromagram (energy per pitch class) summed over the track,
 * correlated with the 24 rotated key profiles. The profiles are tuned for
 * electronic dance music (Faraldo et al., "EDMA").
 */

export type Key = number

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

const MAJOR = [0.1652, 0.0475, 0.0829, 0.0669, 0.0999, 0.0927, 0.0529, 0.1316, 0.0522, 0.0744, 0.0694, 0.0643]
const MINOR = [0.1724, 0.04, 0.0761, 0.1211, 0.0521, 0.0877, 0.059, 0.1322, 0.07, 0.0571, 0.0672, 0.0346]

/** Below this correlation margin the key is too ambiguous to show. */
const MIN_MARGIN = 0.01
const MIN_CORRELATION = 0.45
/** (max − min) / mean of the chroma: drums and noise are flat across all 12 notes. */
const MIN_SPREAD = 0.36

/** "Am", "F#", … */
export function keyName(k: Key): string {
  return NAMES[k % 12] + (k >= 12 ? 'm' : '')
}

/** Camelot code: "8A" = A minor, "8B" = C major. */
export function camelot(k: Key): string {
  const minor = k >= 12
  const major = minor ? (k - 12 + 3) % 12 : k // a minor key sits with its relative major
  const n = ((major * 7) % 12 + 7) % 12 + 1
  return `${n}${minor ? 'A' : 'B'}`
}

/** Move a key by whole semitones (e.g. a track played faster sounds higher). */
export function transpose(k: Key, semitones: number): Key {
  const s = Math.round(semitones)
  return (k >= 12 ? 12 : 0) + ((((k % 12) + s) % 12) + 12) % 12
}

/** The key as heard at a playback rate (no key lock: speed changes pitch). */
export function heardKey(k: Key | null, rate: number): Key | null {
  return k === null ? null : transpose(k, 12 * Math.log2(rate))
}

/**
 * How well two keys mix: 2 = same key, 1 = a Camelot neighbour (±1, or the
 * relative major/minor), 0 = clash.
 */
export function keyCompatibility(a: Key, b: Key): 0 | 1 | 2 {
  if (a === b) return 2
  const ca = camelotParts(a)
  const cb = camelotParts(b)
  if (ca.n === cb.n) return 1 // relative major / minor
  if (ca.minor === cb.minor && (Math.abs(ca.n - cb.n) === 1 || Math.abs(ca.n - cb.n) === 11)) return 1
  return 0
}

function camelotParts(k: Key): { n: number; minor: boolean } {
  const c = camelot(k)
  return { n: parseInt(c, 10), minor: c.endsWith('A') }
}

/**
 * Tempo match for mixing, including half / double time: the stretch needed
 * in percent (e.g. 3 for 124 → 128), or null without both tempos.
 */
export function tempoDistance(a: number | null | undefined, b: number | null | undefined): number | null {
  if (!a || !b) return null
  let best = Infinity
  for (const r of [1, 2, 0.5]) best = Math.min(best, Math.abs((b * r) / a - 1) * 100)
  return best
}

/**
 * How good a next track is for one already playing: higher is better, null
 * if it shouldn't be suggested. Tempo within reach matters most, then key.
 */
export function mixScore(
  now: { bpm: number | null; key: Key | null },
  next: { bpm?: number | null; key?: Key | null },
  reach = 8,
): number | null {
  const d = tempoDistance(now.bpm, next.bpm)
  if (d === null || d > reach) return null
  let score = 1 - d / reach // 0..1
  if (now.key != null && next.key != null) {
    const c = keyCompatibility(now.key, next.key)
    if (c === 0) score -= 0.6
    else score += c === 2 ? 0.6 : 0.5
  }
  return score
}

// ---------------------------------------------------------------- detection

/** Detect the key of a mono signal; null if unclear (e.g. drums only). */
export function detectKey(mono: Float32Array, sampleRate: number): Key | null {
  const chroma = chromagram(mono, sampleRate)
  if (!chroma) return null
  const mean = chroma.reduce((a, b) => a + b, 0) / 12
  if (!(mean > 0) || (Math.max(...chroma) - Math.min(...chroma)) / mean < MIN_SPREAD) return null
  let best = -Infinity
  let second = -Infinity
  let bestKey = 0
  for (let k = 0; k < 24; k++) {
    const profile = k < 12 ? MAJOR : MINOR
    const tonic = k % 12
    const r = correlation(chroma, (i) => profile[(i - tonic + 12) % 12])
    if (r > best) {
      second = best
      best = r
      bestKey = k
    } else if (r > second) second = r
  }
  if (best < MIN_CORRELATION || best - second < MIN_MARGIN) return null
  return bestKey
}

/** Pitch-class energy over the whole track (12 values), or null if too quiet. */
export function chromagram(mono: Float32Array, sampleRate: number): Float64Array | null {
  // Work at ~11 kHz: enough for the notes that define a key.
  const factor = Math.max(1, Math.floor(sampleRate / 11025))
  const sr = sampleRate / factor
  const x = decimate(mono, factor)
  const N = 8192
  const hop = 4096
  if (x.length < N) return null
  const lo = Math.ceil((55 * N) / sr) // A1
  const hi = Math.floor((1760 * N) / sr) // A6
  // Each FFT bin → pitch class (A4 = 440 Hz); bins between semitones are skipped.
  const pcOf = new Int8Array(hi + 1).fill(-1)
  for (let b = lo; b <= hi; b++) {
    const midi = 69 + 12 * Math.log2((b * sr) / N / 440)
    const near = Math.round(midi)
    if (Math.abs(midi - near) < 0.35) pcOf[b] = ((near % 12) + 12) % 12
  }
  const win = new Float32Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const total = new Float64Array(12)
  const frame = new Float64Array(12)
  // Up to ~400 frames spread over the track keeps long tracks fast.
  const frames = Math.floor((x.length - N) / hop) + 1
  const stride = Math.max(1, Math.floor(frames / 400))
  let used = 0
  for (let f = 0; f < frames; f += stride) {
    const off = f * hop
    let energy = 0
    for (let i = 0; i < N; i++) {
      const v = x[off + i]
      energy += v * v
      re[i] = v * win[i]
      im[i] = 0
    }
    if (energy / N < 1e-6) continue // silence
    fft(re, im)
    frame.fill(0)
    for (let b = lo; b <= hi; b++) {
      const pc = pcOf[b]
      if (pc < 0) continue
      frame[pc] += Math.sqrt(re[b] * re[b] + im[b] * im[b])
    }
    // Normalise per frame so loud passages don't dominate, then add.
    let max = 0
    for (let i = 0; i < 12; i++) max = Math.max(max, frame[i])
    if (max <= 0) continue
    for (let i = 0; i < 12; i++) total[i] += frame[i] / max
    used++
  }
  return used >= 4 ? total : null
}

function correlation(chroma: Float64Array, profile: (i: number) => number): number {
  let ma = 0
  let mb = 0
  for (let i = 0; i < 12; i++) {
    ma += chroma[i]
    mb += profile(i)
  }
  ma /= 12
  mb /= 12
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < 12; i++) {
    const a = chroma[i] - ma
    const b = profile(i) - mb
    num += a * b
    da += a * a
    db += b * b
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}

/** Low-pass (moving average) and keep every `factor`-th sample. */
function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor === 1) return x
  const out = new Float32Array(Math.floor(x.length / factor))
  for (let i = 0; i < out.length; i++) {
    let s = 0
    const o = i * factor
    for (let j = 0; j < factor; j++) s += x[o + j]
    out[i] = s / factor
  }
  return out
}

/** In-place iterative radix-2 FFT (length must be a power of two). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const a = i + j
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}
