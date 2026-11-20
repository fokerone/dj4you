import { describe, expect, it } from 'vitest'
import { parseDjMessage, parseListenerMessage } from '../src/live/protocol'

describe('live protocol', () => {
  it('accepts known reactions only', () => {
    expect(parseListenerMessage({ type: 'react', emoji: '🔥' })).toEqual({ type: 'react', emoji: '🔥' })
    expect(parseListenerMessage({ type: 'react', emoji: '<script>' })).toBeNull()
    expect(parseListenerMessage({ type: 'react' })).toBeNull()
    expect(parseListenerMessage('🔥')).toBeNull()
    expect(parseListenerMessage(null)).toBeNull()
  })

  it('bounds and cleans live info from the DJ', () => {
    const m = parseDjMessage({
      type: 'meta',
      dj: 'x'.repeat(100),
      title: 'Set',
      listeners: 5000,
      startedAt: 1,
      nowPlaying: null,
      decks: [{ track: 'A', bpm: 128, playing: true }, { track: null, bpm: 'fast', playing: 'yes' }, { track: 'extra' }],
    })
    expect(m?.type).toBe('meta')
    if (m?.type !== 'meta') return
    expect(m.dj).toHaveLength(40)
    expect(m.listeners).toBe(999)
    expect(m.decks).toHaveLength(2)
    expect(m.decks[1]).toEqual({ id: 'B', track: null, bpm: null, playing: false })
  })

  it('passes reactions relayed by the DJ', () => {
    expect(parseDjMessage({ type: 'react', emoji: '🙌' })).toEqual({ type: 'react', emoji: '🙌' })
    expect(parseDjMessage({ type: 'nonsense' })).toBeNull()
  })
})
