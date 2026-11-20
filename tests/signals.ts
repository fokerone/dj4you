/**
 * Synthetic test signals: drum patterns, chord progressions, noise. Generated
 * in code so the tests need no audio files.
 */

export const SR = 44100

/** Deterministic pseudo-random numbers in −1..1. */
export function rng(seed = 7): () => number {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/**
 * A four-on-the-floor (or other) beat: kick on every beat, hi-hats on the
 * off-beats and a snare on 2 and 4, starting `offset` s in after silence.
 */
export function beat(bpm: number, seconds: number, opts: { offset?: number; style?: 'four' | 'dnb'; seed?: number } = {}): Float32Array {
  const { offset = 0, style = 'four', seed = 1 } = opts
  const x = new Float32Array(Math.floor(SR * seconds))
  const rnd = rng(seed)
  const beatLen = 60 / bpm
  const add = (t: number, f: (dt: number) => number, len: number) => {
    const i0 = Math.floor(t * SR)
    for (let i = 0; i < len * SR && i0 + i < x.length; i++) x[i0 + i] += f(i / SR)
  }
  const kick = (dt: number) => 0.9 * Math.exp(-dt * 25) * Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-dt * 40)) * dt)
  const snare = (dt: number) => 0.5 * Math.exp(-dt * 30) * (rnd() * 0.8 + 0.4 * Math.sin(2 * Math.PI * 190 * dt))
  const hat = (dt: number) => 0.18 * Math.exp(-dt * 90) * rnd()
  for (let k = 0; offset + k * beatLen < seconds; k++) {
    const t = offset + k * beatLen
    const inBar = k % 4
    if (style === 'four') {
      add(t, kick, 0.3)
      add(t + beatLen / 2, hat, 0.08)
      if (inBar === 1 || inBar === 3) add(t, snare, 0.2)
    } else {
      // Drum & bass: kick on 1 and the "and" of 3, snare on 2 and 4.
      if (inBar === 0) add(t, kick, 0.3)
      if (inBar === 2) add(t + beatLen / 2, kick, 0.3)
      if (inBar === 1 || inBar === 3) add(t, snare, 0.2)
      add(t, hat, 0.06)
      add(t + beatLen / 2, hat, 0.06)
    }
  }
  return x
}

/** Chords (MIDI notes) of `secsEach` seconds, played twice, with a soft kick. */
export function chords(progression: number[][], secsEach = 4): Float32Array {
  const x = new Float32Array(SR * secsEach * progression.length * 2)
  for (let rep = 0; rep < 2; rep++)
    progression.forEach((ch, ci) => {
      const off = (rep * progression.length + ci) * secsEach * SR
      for (let i = 0; i < secsEach * SR; i++) {
        const t = i / SR
        let v = 0
        ch.forEach((m, k) => {
          for (let h = 1; h <= 4; h++) v += (0.15 / h) * Math.sin(2 * Math.PI * midiHz(m) * h * t) * (k === 0 ? 1.5 : 1)
        })
        const bt = t % 0.5
        v += 0.6 * Math.exp(-bt * 30) * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-bt * 40)) * bt)
        x[off + i] = v * 0.3
      }
    })
  return x
}

/** Triad with the root an octave below: [root−12, root, third, fifth]. */
export function triad(root: number, minor = false): number[] {
  return [root - 12, root, root + (minor ? 3 : 4), root + 7]
}

export function noise(seconds: number, seed = 3): Float32Array {
  const r = rng(seed)
  return new Float32Array(SR * seconds).map(() => r() * 0.3)
}

/** Concatenate signals. */
export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
