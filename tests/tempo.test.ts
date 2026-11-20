import { describe, expect, it } from 'vitest'
import { detectTempo, findCue } from '../src/audio/analysis'
import { matchTempo } from '../src/audio/tempo'
import { beat, concat, noise, rng, SR } from './signals'

describe('BPM detection', () => {
  it.each([95, 100, 120, 122, 126, 128, 132, 140])('finds %i BPM in a four-on-the-floor beat', (bpm) => {
    const { bpm: got } = detectTempo(beat(bpm, 40), SR)
    expect(got).not.toBeNull()
    expect(Math.abs(got! - bpm)).toBeLessThan(0.6)
  })

  it('reads a drum & bass pattern at 174 or its half, 87 (SYNC handles both)', () => {
    // Kick–snare at 174 is the same pattern as a half-time groove at 87, so
    // both readings are right; matchTempo() mixes them with ratio 2 / 0.5.
    const { bpm } = detectTempo(beat(174, 40, { style: 'dnb' }), SR)
    expect(bpm).not.toBeNull()
    expect(Math.min(Math.abs(bpm! - 174), Math.abs(bpm! - 87))).toBeLessThan(1)
  })

  it('places the beat grid on the kicks', () => {
    const bpm = 120
    const offset = 0.2
    const { bpm: got, firstBeat } = detectTempo(beat(bpm, 30, { offset }), SR)
    expect(got).toBe(120)
    const beatLen = 60 / bpm
    const err = Math.abs(((firstBeat - offset) % beatLen + beatLen * 1.5) % beatLen - beatLen / 2)
    expect(err).toBeLessThan(0.02)
  })

  it.each([10, 20, 60])('gives no BPM for %i s of white noise', (secs) => {
    expect(detectTempo(noise(secs), SR).bpm).toBeNull()
  })

  it('gives no BPM for a steady tone', () => {
    const sine = new Float32Array(SR * 30).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR))
    expect(detectTempo(sine, SR).bpm).toBeNull()
  })

  it('gives no BPM for speech-like bursts', () => {
    const r = rng(11)
    const x = new Float32Array(SR * 60)
    for (let t = 0; t < 60; ) {
      const len = 0.1 + Math.abs(r()) * 0.4
      for (let i = 0; i < len * SR && t * SR + i < x.length; i++) x[Math.floor(t * SR) + i] = r() * 0.3 * Math.sin((Math.PI * i) / (len * SR))
      t += len + Math.abs(r()) * 0.5
    }
    expect(detectTempo(x, SR).bpm).toBeNull()
  })
})

describe('auto cue', () => {
  it('skips leading silence and lands on the first beat', () => {
    const x = concat(new Float32Array(SR * 3), beat(120, 20))
    const { bpm, firstBeat } = detectTempo(x, SR)
    const cue = findCue(x, SR, bpm, firstBeat)
    expect(Math.abs(cue - 3)).toBeLessThan(0.03)
  })

  it('stays at 0 when the music starts right away', () => {
    const x = beat(128, 20)
    const { bpm, firstBeat } = detectTempo(x, SR)
    expect(findCue(x, SR, bpm, firstBeat)).toBe(0)
  })

  it('works without a beat grid', () => {
    const x = concat(new Float32Array(SR * 2), noise(5))
    expect(Math.abs(findCue(x, SR, null, 0) - 2)).toBeLessThan(0.02)
  })
})

describe('SYNC tempo match', () => {
  it('matches close tempos directly', () => {
    const m = matchTempo(124, 128, 16)!
    expect(m.ratio).toBe(1)
    expect(m.pitch).toBeCloseTo(3.226, 2)
  })

  it('uses double / half time when closer', () => {
    expect(matchTempo(87, 174, 16)).toEqual({ pitch: 0, ratio: 0.5 })
    expect(matchTempo(174, 88, 16)!.ratio).toBe(2)
  })

  it('refuses tempos beyond the reach', () => {
    expect(matchTempo(90, 132, 16)).toBeNull()
    // …but a ±30 % range reaches it (as half time: 66 BPM is −26.7 %).
    const wide = matchTempo(90, 132, 30)!
    expect(wide.ratio).toBe(0.5)
    expect(wide.pitch).toBeCloseTo(-26.67, 1)
  })

  it('needs both tempos', () => {
    expect(matchTempo(null, 128, 16)).toBeNull()
    expect(matchTempo(128, null, 16)).toBeNull()
  })
})
