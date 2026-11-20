/** Messages sent from the DJ to each listener over the data channel. */

export interface DeckInfo {
  readonly id: 'A' | 'B'
  readonly track: string | null
  readonly bpm: number | null
  readonly playing: boolean
}

export interface LiveMeta {
  readonly type: 'meta'
  readonly dj: string
  readonly title: string
  readonly listeners: number
  readonly startedAt: number
  /** The deck you mostly hear right now */
  readonly nowPlaying: string | null
  readonly decks: readonly DeckInfo[]
}

/** Emoji reactions listeners can send; anything else is dropped. */
export const REACTIONS = ['🔥', '🙌', '❤️', '😮', '🕺'] as const
export type Reaction = (typeof REACTIONS)[number]

/** A listener reacted (relayed by the DJ to everyone else). */
export interface ReactMessage {
  readonly type: 'react'
  readonly emoji: Reaction
}

export type DjMessage = LiveMeta | ReactMessage | { readonly type: 'end' } | { readonly type: 'full' }

/** Messages from a listener to the DJ. */
export type ListenerMessage = ReactMessage

export function parseListenerMessage(raw: unknown): ListenerMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (m.type === 'react' && REACTIONS.includes(m.emoji as Reaction)) return { type: 'react', emoji: m.emoji as Reaction }
  return null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Data from the other side is untrusted: keep only well-formed, bounded fields. */
export function parseDjMessage(raw: unknown): DjMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (m.type === 'end' || m.type === 'full') return { type: m.type }
  if (m.type === 'react') return parseListenerMessage(m)
  if (m.type !== 'meta') return null
  const decks = Array.isArray(m.decks) ? m.decks.slice(0, 2) : []
  return {
    type: 'meta',
    dj: str(m.dj, 40),
    title: str(m.title, 80),
    listeners: Math.max(0, Math.min(999, Number(m.listeners) || 0)),
    startedAt: Number(m.startedAt) || Date.now(),
    nowPlaying: m.nowPlaying == null ? null : str(m.nowPlaying, 120),
    decks: decks.map((d: Record<string, unknown>, i) => ({
      id: i === 0 ? 'A' : 'B',
      track: d?.track == null ? null : str(d.track, 120),
      bpm: Number.isFinite(Number(d?.bpm)) && d?.bpm !== null ? Number(d.bpm) : null,
      playing: d?.playing === true,
    })),
  }
}
