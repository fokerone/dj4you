/**
 * Jamendo: free music under Creative Commons licences.
 *
 * - Only tracks whose licence allows derivatives are listed (`ccnd=false`):
 *   a DJ mix is an adaptation, so "No Derivatives" tracks are left out.
 * - The API and the mp3d.jamendo.com audio host both send CORS headers, so the
 *   browser can fetch, decode and analyse tracks directly.
 * - Every track keeps its artist and licence so the desk, the setlist and the
 *   library can credit it.
 * The free API is for non-commercial use, which DJ4YOU is.
 */

const CLIENT_ID: string = import.meta.env.VITE_JAMENDO_CLIENT_ID || 'a26544e9'
const API = 'https://api.jamendo.com/v3.0'
export const PAGE_SIZE = 20

export interface JamendoTrack {
  readonly id: string
  readonly name: string
  readonly artist: string
  /** Seconds */
  readonly duration: number
  readonly image: string
  /** e.g. "CC BY-NC-SA" */
  readonly license: string
  readonly licenseUrl: string
  /** Track page on jamendo.com */
  readonly pageUrl: string
  /** Jamendo's rough tempo tag (it has no BPM): 'verylow' … 'veryhigh' */
  readonly speed?: string
}

export interface JamendoPage {
  readonly tracks: readonly JamendoTrack[]
  readonly hasMore: boolean
}

export const GENRES = [
  { id: '', label: 'All' },
  { id: 'house', label: 'House' },
  { id: 'techno', label: 'Techno' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'dance', label: 'Dance' },
  { id: 'hiphop', label: 'Hip-hop' },
  { id: 'dnb', label: 'Drum & bass' },
  { id: 'dubstep', label: 'Dubstep' },
  { id: 'trance', label: 'Trance' },
  { id: 'lounge', label: 'Lounge' },
  { id: 'chillout', label: 'Chillout' },
  { id: 'funk', label: 'Funk' },
  { id: 'pop', label: 'Pop' },
] as const

/** The Artifact preview blocks outside hosts; the hosted site can use Jamendo. */
export function jamendoAvailable(): boolean {
  return import.meta.env.MODE !== 'artifact'
}

/** Streamable MP3 with CORS headers (decodable in the browser). */
export function jamendoAudioUrl(id: string): string {
  return `https://mp3d.jamendo.com/?trackid=${encodeURIComponent(id)}&format=mp32`
}

interface ApiTrack {
  id: string
  name: string
  artist_name: string
  duration: number
  image?: string
  album_image?: string
  license_ccurl?: string
  shareurl?: string
  musicinfo?: { speed?: string }
}

export async function searchJamendo(opts: { query: string; genre: string; offset: number; signal?: AbortSignal }): Promise<JamendoPage> {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    format: 'json',
    limit: String(PAGE_SIZE),
    offset: String(opts.offset),
    ccnd: 'false',
    include: 'licenses musicinfo',
    imagesize: '100',
    order: opts.query ? 'relevance' : 'popularity_month',
  })
  if (opts.query) p.set('search', opts.query)
  if (opts.genre) p.set('fuzzytags', opts.genre)
  // Jamendo's API sometimes answers a valid query with an empty list (one of
  // its servers, it seems). An empty answer is retried twice before we trust it.
  let results: ApiTrack[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(250 * attempt, opts.signal)
    const res = await fetch(`${API}/tracks/?${p}`, { signal: opts.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as { headers?: { status?: string; error_message?: string }; results?: ApiTrack[] }
    if (body.headers?.status !== 'success') throw new Error(body.headers?.error_message || 'Jamendo error')
    results = body.results ?? []
    if (results.length > 0) break
  }
  return {
    tracks: results.map((t) => ({
      id: String(t.id),
      name: clean(t.name, 120),
      artist: clean(t.artist_name, 80),
      duration: Number(t.duration) || 0,
      image: safeUrl(t.image || t.album_image || ''),
      license: licenseLabel(t.license_ccurl ?? ''),
      licenseUrl: safeUrl(t.license_ccurl ?? ''),
      pageUrl: safeUrl(t.shareurl ?? `https://www.jamendo.com/track/${t.id}`),
      speed: SPEEDS.includes(t.musicinfo?.speed ?? '') ? t.musicinfo?.speed : undefined,
    })),
    hasMore: results.length === PAGE_SIZE,
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const tm = window.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(tm)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

/** "http://creativecommons.org/licenses/by-nc-sa/3.0/" → "CC BY-NC-SA" */
export function licenseLabel(url: string): string {
  const m = /licenses\/([a-z-]+)\//i.exec(url)
  return m ? `CC ${m[1].toUpperCase()}` : 'CC'
}

function clean(s: unknown, max: number): string {
  return (
    String(s ?? '')
      // eslint-disable-next-line no-control-regex -- strip control characters from API text
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/&(amp|quot|#39|apos|lt|gt);/g, (_m, e: string) => ENTITIES[e] ?? _m)
      .trim()
      .slice(0, max)
  )
}

const SPEEDS = ['verylow', 'low', 'medium', 'high', 'veryhigh']

/**
 * Jamendo's API has no BPM or key, so what DJ4YOU detects when a track is
 * loaded is kept here (by track id) and shown in the list from then on.
 */
export interface TrackInfo {
  readonly bpm?: number
  readonly key?: number
}
const INFO_KEY = 'dj4you.jamendoInfo'
const OLD_BPM_KEY = 'dj4you.jamendoBpm'
const MAX_INFO = 500

export function knownInfo(): Record<string, TrackInfo> {
  try {
    const info = JSON.parse(localStorage.getItem(INFO_KEY) ?? 'null') as Record<string, TrackInfo> | null
    if (info) return info
    // Earlier versions kept only the BPM.
    const old = JSON.parse(localStorage.getItem(OLD_BPM_KEY) ?? '{}') as Record<string, number>
    return Object.fromEntries(Object.entries(old).map(([id, bpm]) => [id, { bpm }]))
  } catch {
    return {}
  }
}

export function rememberInfo(id: string, bpm: number | null, key: number | null): void {
  if (!bpm && key === null) return
  try {
    const all = { ...knownInfo() }
    delete all[id]
    all[id] = { ...(bpm ? { bpm: Math.round(bpm * 10) / 10 } : {}), ...(key !== null ? { key } : {}) }
    const ids = Object.keys(all)
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX_INFO))) delete all[old]
    localStorage.setItem(INFO_KEY, JSON.stringify(all))
  } catch {
    /* not kept */
  }
}

/** Jamendo sometimes returns names with HTML entities ("Axl &amp; Arth"). */
const ENTITIES: Record<string, string> = { amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' }

/** Only http(s) links from the API are used in the page. */
function safeUrl(u: string): string {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href.replace(/^http:/, 'https:') : ''
  } catch {
    return ''
  }
}
