import { Store } from '../audio/store'
import type { JamendoTrack } from './jamendo'

/**
 * Small per-device preferences kept in localStorage: the end-of-track warning
 * and the DJ's favourite tracks.
 */

/** Seconds before the end of a track when the deck starts warning (0 = off). */
export const END_WARNINGS = [0, 15, 30, 60] as const
export type EndWarning = (typeof END_WARNINGS)[number]

/** A track from any source: one of your own, a starter-pack demo or a Jamendo track. */
export type TrackRef =
  | { readonly type: 'track'; readonly id: string }
  | { readonly type: 'demo'; readonly name: string }
  | { readonly type: 'jamendo'; readonly track: JamendoTrack }

/** Favourites and the queue hold the same kind of reference. */
export type Favorite = TrackRef

export interface PrefsState {
  readonly endWarning: EndWarning
  /** Most recently starred first */
  readonly favorites: readonly TrackRef[]
  /** "Up next": tracks to play, in order */
  readonly queue: readonly TrackRef[]
}

const KEY = 'dj4you.prefs'
const MAX_FAVORITES = 300
const MAX_QUEUE = 100

/** Stable id of a track reference (e.g. "t:<id>", "d:Sunrise", "j:12345"). */
export function refKey(f: TrackRef): string {
  return f.type === 'track' ? `t:${f.id}` : f.type === 'demo' ? `d:${f.name}` : `j:${f.track.id}`
}

class Prefs extends Store<PrefsState> {
  constructor() {
    super(load())
  }

  setEndWarning(endWarning: EndWarning): void {
    this.set({ endWarning })
    this.save()
  }

  isFavorite(key: string): boolean {
    return this.state.favorites.some((f) => refKey(f) === key)
  }

  toggleFavorite(f: Favorite): void {
    const key = refKey(f)
    const favorites = this.isFavorite(key)
      ? this.state.favorites.filter((x) => refKey(x) !== key)
      : [f, ...this.state.favorites].slice(0, MAX_FAVORITES)
    this.set({ favorites })
    this.save()
  }

  // ---- queue ----

  isQueued(key: string): boolean {
    return this.state.queue.some((f) => refKey(f) === key)
  }

  /** Add to the end of the queue (once). */
  enqueue(ref: TrackRef): void {
    if (this.isQueued(refKey(ref))) return
    this.set({ queue: [...this.state.queue, ref].slice(0, MAX_QUEUE) })
    this.save()
  }

  dequeue(key: string): void {
    this.set({ queue: this.state.queue.filter((f) => refKey(f) !== key) })
    this.save()
  }

  /** Move a queued track one place earlier. */
  moveUp(key: string): void {
    const q = [...this.state.queue]
    const i = q.findIndex((f) => refKey(f) === key)
    if (i <= 0) return
    ;[q[i - 1], q[i]] = [q[i], q[i - 1]]
    this.set({ queue: q })
    this.save()
  }

  clearQueue(): void {
    this.set({ queue: [] })
    this.save()
  }

  /** A track was deleted from the library: drop it from favourites and the queue too. */
  forgetTrack(id: string): void {
    const gone = (f: TrackRef) => f.type === 'track' && f.id === id
    this.set({ favorites: this.state.favorites.filter((f) => !gone(f)), queue: this.state.queue.filter((f) => !gone(f)) })
    this.save()
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state))
    } catch {
      /* not kept */
    }
  }
}

function load(): PrefsState {
  const fallback: PrefsState = { endWarning: 30, favorites: [], queue: [] }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<PrefsState>
    return {
      endWarning: END_WARNINGS.includes(raw.endWarning as EndWarning) ? (raw.endWarning as EndWarning) : fallback.endWarning,
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(isRef) : [],
      queue: Array.isArray(raw.queue) ? raw.queue.filter(isRef) : [],
    }
  } catch {
    return fallback
  }
}

function isRef(f: unknown): f is TrackRef {
  if (!f || typeof f !== 'object') return false
  const x = f as Record<string, unknown>
  if (x.type === 'track') return typeof x.id === 'string'
  if (x.type === 'demo') return typeof x.name === 'string'
  if (x.type === 'jamendo') {
    const tr = x.track as Record<string, unknown> | undefined
    return !!tr && typeof tr.id === 'string' && typeof tr.name === 'string' && typeof tr.artist === 'string'
  }
  return false
}

export const prefs = new Prefs()

/** @deprecated name kept for existing imports */
export const favoriteKey = refKey
