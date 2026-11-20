import { Store } from '../audio/store'
import type { JamendoTrack } from './jamendo'

/**
 * Small per-device preferences kept in localStorage: the end-of-track warning
 * and the DJ's favourite tracks.
 */

/** Seconds before the end of a track when the deck starts warning (0 = off). */
export const END_WARNINGS = [0, 15, 30, 60] as const
export type EndWarning = (typeof END_WARNINGS)[number]

/** A favourite: one of your own tracks, a starter-pack demo or a Jamendo track. */
export type Favorite =
  | { readonly type: 'track'; readonly id: string }
  | { readonly type: 'demo'; readonly name: string }
  | { readonly type: 'jamendo'; readonly track: JamendoTrack }

export interface PrefsState {
  readonly endWarning: EndWarning
  /** Most recently starred first */
  readonly favorites: readonly Favorite[]
}

const KEY = 'dj4you.prefs'
const MAX_FAVORITES = 300

export function favoriteKey(f: Favorite): string {
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
    return this.state.favorites.some((f) => favoriteKey(f) === key)
  }

  toggleFavorite(f: Favorite): void {
    const key = favoriteKey(f)
    const favorites = this.isFavorite(key)
      ? this.state.favorites.filter((x) => favoriteKey(x) !== key)
      : [f, ...this.state.favorites].slice(0, MAX_FAVORITES)
    this.set({ favorites })
    this.save()
  }

  /** A track was deleted from the library: drop it from favourites too. */
  forgetTrack(id: string): void {
    if (!this.isFavorite(`t:${id}`)) return
    this.set({ favorites: this.state.favorites.filter((f) => !(f.type === 'track' && f.id === id)) })
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
  const fallback: PrefsState = { endWarning: 30, favorites: [] }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<PrefsState>
    return {
      endWarning: END_WARNINGS.includes(raw.endWarning as EndWarning) ? (raw.endWarning as EndWarning) : fallback.endWarning,
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(isFavorite) : [],
    }
  } catch {
    return fallback
  }
}

function isFavorite(f: unknown): f is Favorite {
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
