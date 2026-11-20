import { describe, expect, it } from 'vitest'
import { camelot, detectKey, heardKey, keyCompatibility, keyName, mixScore, tempoDistance, transpose } from '../src/audio/key'
import { beat, chords, noise, SR, triad } from './signals'

const C = 0
const G = 7
const Eb = 3
const Am = 12 + 9
const FsM = 12 + 6

describe('Camelot wheel', () => {
  it.each([
    [C, '8B', 'C'],
    [G, '9B', 'G'],
    [5, '7B', 'F'],
    [Am, '8A', 'Am'],
    [12 + 4, '9A', 'Em'],
    [12 + 2, '7A', 'Dm'],
    [FsM, '11A', 'F#m'],
    [Eb, '5B', 'Eb'],
  ])('key %i is %s (%s)', (k, code, name) => {
    expect(camelot(k)).toBe(code)
    expect(keyName(k)).toBe(name)
  })

  it('rates same key, neighbours and clashes', () => {
    expect(keyCompatibility(Am, Am)).toBe(2)
    expect(keyCompatibility(Am, C)).toBe(1) // relative major (8A ↔ 8B)
    expect(keyCompatibility(Am, 12 + 4)).toBe(1) // 8A ↔ 9A
    expect(keyCompatibility(Am, 12 + 2)).toBe(1) // 8A ↔ 7A
    expect(keyCompatibility(12 + 11, 12 + 6)).toBe(1) // 10A ↔ 11A
    expect(keyCompatibility(Am, FsM)).toBe(0) // 8A ↔ 11A
  })

  it('wraps 12 ↔ 1 on the wheel', () => {
    // C#m = 12A, G#m = 1A
    expect(keyCompatibility(12 + 1, 12 + 8)).toBe(1)
  })

  it('transposes with the playback speed (no key lock)', () => {
    expect(transpose(Am, 1)).toBe(12 + 10)
    expect(transpose(C, -1)).toBe(11)
    expect(heardKey(Am, 1)).toBe(Am)
    expect(heardKey(Am, 1.06)).toBe(12 + 10) // +6 % ≈ +1 semitone
    expect(heardKey(null, 1.1)).toBeNull()
  })
})

describe('key detection', () => {
  it.each([
    ['C major', [triad(60), triad(65), triad(67), triad(60)], C],
    ['A minor', [triad(57, true), triad(62, true), triad(64), triad(57, true)], Am],
    ['G major', [triad(67), triad(60), triad(62), triad(67)], G],
    ['F# minor', [triad(66, true), triad(59, true), triad(61, true), triad(66, true)], FsM],
    ['Eb major', [triad(63), triad(68), triad(70), triad(63)], Eb],
  ])('finds %s', (_name, progression, expected) => {
    expect(detectKey(chords(progression as number[][]), SR)).toBe(expected)
  })

  it('gives no key for drums only', () => {
    expect(detectKey(beat(124, 30), SR)).toBeNull()
  })

  it('gives no key for noise', () => {
    expect(detectKey(noise(20), SR)).toBeNull()
  })
})

describe('mix suggestions', () => {
  it('measures tempo distance with half / double time', () => {
    expect(tempoDistance(128, 128)).toBe(0)
    expect(tempoDistance(87, 174)).toBe(0)
    expect(tempoDistance(124, 128)).toBeCloseTo(3.23, 1)
    expect(tempoDistance(null, 128)).toBeNull()
  })

  it('prefers close tempo and a compatible key', () => {
    const now = { bpm: 126, key: Am }
    const sameKey = mixScore(now, { bpm: 128, key: Am })!
    const neighbour = mixScore(now, { bpm: 128, key: C })!
    const clash = mixScore(now, { bpm: 128, key: FsM })!
    const noKey = mixScore(now, { bpm: 128 })!
    expect(sameKey).toBeGreaterThan(neighbour)
    expect(neighbour).toBeGreaterThan(noKey)
    expect(noKey).toBeGreaterThan(clash)
  })

  it('leaves out tracks too far in tempo', () => {
    expect(mixScore({ bpm: 126, key: null }, { bpm: 140 }, 6)).toBeNull()
    expect(mixScore({ bpm: 126, key: null }, { bpm: null })).toBeNull()
  })
})
