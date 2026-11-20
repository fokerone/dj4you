import { DEMOS } from '../audio/demo'
import type { Key } from '../audio/key'
import type { TrackMeta } from './library'
import { knownInfo } from './jamendo'
import { refKey, type TrackRef } from './prefs'

/**
 * One row in the library, whatever its source: what to show and what is
 * known about it (tempo and key, once analysed).
 */
export interface LibItem {
  readonly ref: TrackRef
  /** refKey(ref) */
  readonly id: string
  readonly title: string
  /** Artist (Jamendo), genre (demos) */
  readonly subtitle?: string
  readonly duration?: number
  readonly bpm?: number | null
  readonly key?: Key | null
  /** Your own file (size shown) */
  readonly size?: number
  readonly addedAt?: number
  /** Creative Commons licence (Jamendo) */
  readonly license?: string
  readonly licenseUrl?: string
  /** Shown instead of the BPM while it's unknown (e.g. Jamendo's "fast") */
  readonly tempoHint?: string
}

/** Demo tracks are 32 bars plus a short tail. */
export function demoDuration(bpm: number): number {
  return (32 * 4 * 60) / bpm + 1.5
}

export function trackItem(t: TrackMeta): LibItem {
  const ref: TrackRef = { type: 'track', id: t.id }
  return { ref, id: refKey(ref), title: t.name, duration: t.duration, bpm: t.bpm, key: t.key, size: t.size, addedAt: t.addedAt }
}

export function demoItems(): LibItem[] {
  return DEMOS.map((d) => {
    const ref: TrackRef = { type: 'demo', name: d.name }
    return { ref, id: refKey(ref), title: d.name, subtitle: d.genre, duration: demoDuration(d.bpm), bpm: d.bpm, key: d.key ?? null }
  })
}

/** Turn a reference into a row; null if it no longer exists (deleted file). */
export function resolveRef(ref: TrackRef, tracks: readonly TrackMeta[], info = knownInfo()): LibItem | null {
  if (ref.type === 'track') {
    const t = tracks.find((x) => x.id === ref.id)
    return t ? trackItem(t) : null
  }
  if (ref.type === 'demo') return demoItems().find((d) => d.title === ref.name) ?? null
  const tr = ref.track
  const i = info[tr.id]
  return {
    ref,
    id: refKey(ref),
    title: tr.name,
    subtitle: tr.artist,
    duration: tr.duration,
    bpm: i?.bpm ?? null,
    key: i?.key ?? null,
    license: tr.license,
    licenseUrl: tr.licenseUrl,
  }
}
