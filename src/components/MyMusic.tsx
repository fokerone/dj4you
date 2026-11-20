import { useEffect, useState } from 'react'
import type { Deck } from '../audio/deck'
import { engine } from '../audio/engine'
import { camelot, heardKey, keyCompatibility, mixScore, tempoDistance } from '../audio/key'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { demoItems, type LibItem, resolveRef, trackItem } from '../library/items'
import { knownInfo } from '../library/jamendo'
import { library, type RecordingMeta } from '../library/library'
import { prefs } from '../library/prefs'
import { hostDownloads, saveFile, type SaveOutcome } from '../library/saveFile'
import { DeleteButton, ItemRow } from './ItemRow'
import { formatBytes, formatDuration } from './format'
import { ScrollRow } from './ScrollRow'

type Sort = 'recent' | 'name' | 'bpm' | 'key' | 'duration'
type Filter = 'all' | 'favorites' | 'mixes'
const SORT_KEY = 'dj4you.librarySort'
const SORTS: readonly Sort[] = ['recent', 'name', 'bpm', 'key', 'duration']

/**
 * "My music": what mixes with the track playing now, the queue, favourites,
 * your own tracks (search, filter, sort), the starter pack and recordings.
 */
export function MyMusic({ sendTo, embedded }: { sendTo: (deck: Deck, load: (d: Deck) => Promise<void>) => void; embedded: boolean }) {
  const t = useT()
  const lib = useStore(library)
  const { favorites, queue } = useStore(prefs)
  // Suggestions follow what's playing.
  useStore(engine.decks[0])
  useStore(engine.decks[1])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSortState] = useState<Sort>(() => {
    try {
      const s = localStorage.getItem(SORT_KEY) as Sort | null
      return s && SORTS.includes(s) ? s : 'recent'
    } catch {
      return 'recent'
    }
  })
  const setSort = (s: Sort) => {
    setSortState(s)
    try {
      localStorage.setItem(SORT_KEY, s)
    } catch {
      /* not kept */
    }
  }

  const info = knownInfo()
  const load = (item: LibItem) => (deck: Deck) => sendTo(deck, (d) => library.loadRef(item.ref, d))

  // ---- what's playing now, and what mixes with it ----
  const main = engine.mainDeck()
  const mainState = main?.getSnapshot()
  const now = main && mainState?.trackName ? { bpm: main.effectiveBpm, key: heardKey(mainState.key, main.rate) } : null
  const loadedIds = library.loadedIds()
  const own = lib.tracks.map(trackItem)
  const pool = dedupe([...own, ...demoItems(), ...[...favorites, ...queue].map((r) => resolveRef(r, lib.tracks, info))])
  const scored = now?.bpm
    ? pool
        .filter((i) => !loadedIds.has(i.id))
        .map((i) => ({ item: i, score: mixScore(now, i, 6) }))
        .filter((x): x is { item: LibItem; score: number } => x.score !== null && x.score > 0.2)
        .sort((x, y) => y.score - x.score)
    : []
  const mixIds = new Set(scored.map((s) => s.item.id))
  const suggestions = scored.slice(0, 5)

  // ---- your tracks: search, filter, sort ----
  const q = query.trim().toLowerCase()
  const favIds = new Set(favorites.map((f) => resolveRef(f, lib.tracks, info)?.id))
  const shown = sortItems(
    own.filter((i) => (!q || i.title.toLowerCase().includes(q)) && (filter === 'all' || (filter === 'favorites' ? favIds.has(i.id) : mixIds.has(i.id)))),
    sort,
  )

  const queued = queue.map((r) => resolveRef(r, lib.tracks, info)).filter((x): x is LibItem => x !== null)
  const favItems = favorites.map((r) => resolveRef(r, lib.tracks, info)).filter((x): x is LibItem => x !== null)

  return (
    <div className="sheet-body">
      {now && (
        <section className="lib-section lib-suggest">
          <h3>
            {t('Mixes well with {id}', { id: mainState!.id })}{' '}
            <span className="dim">
              {mainState!.trackName}
              {now.bpm ? ` · ${now.bpm.toFixed(1)} BPM` : ''}
              {now.key !== null ? ` · ${camelot(now.key)}` : ''}
            </span>
          </h3>
          {!now.bpm ? (
            <p className="lib-empty">{t('Suggestions appear once the track playing has a BPM.')}</p>
          ) : suggestions.length === 0 ? (
            <p className="lib-empty">{t('Nothing in your library is close in tempo. Try Free music, or widen the tempo range to mix further.')}</p>
          ) : (
            <ul className="lib-list">
              {suggestions.map(({ item }) => (
                <ItemRow key={item.id} item={item} onDeck={load(item)} note={<MixReason now={now} item={item} />} />
              ))}
            </ul>
          )}
        </section>
      )}

      {queued.length > 0 && (
        <section className="lib-section lib-queue">
          <h3>
            {t('Up next')} <span className="dim">{queued.length}</span>
            <button className="btn btn-small lib-h-action" onClick={() => prefs.clearQueue()}>
              {t('Clear')}
            </button>
          </h3>
          <ol className="lib-list">
            {queued.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                onDeck={(deck) => {
                  prefs.dequeue(item.id)
                  load(item)(deck)
                }}
                actions={
                  <>
                    <button className="btn btn-small" disabled={i === 0} onClick={() => prefs.moveUp(item.id)} aria-label={t('Move {title} up', { title: item.title })} title={t('Move up')}>
                      ↑
                    </button>
                    <button className="btn btn-small" onClick={() => prefs.dequeue(item.id)} aria-label={t('Remove {title} from the queue', { title: item.title })} title={t('Remove from the queue')}>
                      ✕
                    </button>
                  </>
                }
              />
            ))}
          </ol>
          <p className="lib-hint">{t('Tap ⏭ on a deck to load the next track, or turn on AUTO to let DJ4YOU mix the queue for you.')}</p>
        </section>
      )}

      {favItems.length > 0 && (
        <section className="lib-section lib-favs">
          <h3>
            <span className="fav-star is-on" aria-hidden>
              ★
            </span>{' '}
            {t('Favorites')} <span className="dim">{favItems.length}</span>
          </h3>
          <ul className="lib-list">
            {favItems.map((item) => (
              <ItemRow key={item.id} item={item} onDeck={load(item)} />
            ))}
          </ul>
        </section>
      )}

      <section className="lib-section">
        <h3>
          {t('Your tracks')} <span className="dim">{lib.tracks.length || ''}</span>
        </h3>
        {lib.unavailable && <p className="lib-note">{t("This browser is blocking storage, so tracks play but won't be kept after you close the page.")}</p>}
        {!lib.ready ? (
          <p className="lib-empty">{t('Loading your library…')}</p>
        ) : lib.tracks.length === 0 ? (
          <p className="lib-empty">
            {t("Tracks you load are kept here on this device, so they're ready next time. Nothing is uploaded. Tap Add tracks or load a file onto a deck.")}
          </p>
        ) : (
          <>
            <div className="lib-tools">
              <input
                className="help-search lib-search"
                type="search"
                value={query}
                placeholder={t('Search your tracks')}
                aria-label={t('Search your tracks')}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className="lib-sort">
                <span>{t('Sort')}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recent">{t('Recently added')}</option>
                  <option value="name">{t('Name')}</option>
                  <option value="bpm">BPM</option>
                  <option value="key">{t('Key')}</option>
                  <option value="duration">{t('Duration')}</option>
                </select>
              </label>
              <ScrollRow className="help-nav" role="radiogroup" label={t('Show')}>
                {(now?.bpm ? (['all', 'favorites', 'mixes'] as const) : (['all', 'favorites'] as const)).map((f) => (
                  <button
                    key={f}
                    role="radio"
                    aria-checked={filter === f}
                    className={`help-chip ${filter === f ? 'is-on' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? t('All') : f === 'favorites' ? `★ ${t('Favorites')}` : t('Mixes with {id}', { id: mainState?.id ?? '' })}
                  </button>
                ))}
              </ScrollRow>
            </div>
            {shown.length === 0 ? (
              <p className="lib-empty">{q ? t('Nothing found for "{q}". Try another word or style.', { q: query.trim() }) : t('No tracks match this filter.')}</p>
            ) : (
              <ul className="lib-list">
                {shown.map((item) => (
                  <ItemRow key={item.id} item={item} onDeck={load(item)} onDelete={() => void library.removeTrack((item.ref as { id: string }).id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="lib-section">
        <h3>{t('Starter pack')}</h3>
        <ul className="lib-list">
          {demoItems().map((item) => (
            <ItemRow key={item.id} item={item} onDeck={load(item)} />
          ))}
        </ul>
      </section>

      <section className="lib-section">
        <h3>
          {t('Recordings')} <span className="dim">{lib.recordings.length || ''}</span>
        </h3>
        {lib.recordings.length === 0 ? (
          <p className="lib-empty">{t('Press REC next to the crossfader to record your mix. Recordings are saved here.')}</p>
        ) : (
          <ul className="lib-list">
            {lib.recordings.map((r) => (
              <RecordingRow key={r.id} rec={r} embedded={embedded} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** "+1.6 % · 8A ✓ same key" */
function MixReason({ now, item }: { now: { bpm: number | null; key: number | null }; item: LibItem }) {
  const t = useT()
  const d = tempoDistance(now.bpm, item.bpm)
  const parts: string[] = []
  if (d !== null) parts.push(d < 0.5 ? t('same tempo') : t('{d}% tempo change', { d: d.toFixed(1) }))
  if (now.key !== null && item.key != null) {
    const c = keyCompatibility(now.key, item.key)
    parts.push(c === 2 ? t('same key') : c === 1 ? t('compatible key') : t('key clash'))
  }
  return <span className="mix-reason">✓ {parts.join(' · ')}</span>
}

function dedupe(items: (LibItem | null)[]): LibItem[] {
  const seen = new Set<string>()
  const out: LibItem[] = []
  for (const i of items) {
    if (!i || seen.has(i.id)) continue
    seen.add(i.id)
    out.push(i)
  }
  return out
}

function sortItems(list: LibItem[], sort: Sort): LibItem[] {
  const by = <T,>(f: (i: LibItem) => T | null | undefined, cmp: (a: T, b: T) => number) => (a: LibItem, b: LibItem) => {
    const x = f(a)
    const y = f(b)
    if (x == null) return y == null ? 0 : 1 // unknown values last
    if (y == null) return -1
    return cmp(x, y)
  }
  const num = (a: number, b: number) => a - b
  const sorted = [...list]
  if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
  else if (sort === 'bpm') sorted.sort(by((i) => i.bpm, num))
  // Camelot order (1A, 1B, 2A…), so neighbours on the wheel sit together.
  else if (sort === 'key') sorted.sort(by((i) => (i.key == null ? null : camelotOrder(i.key)), num))
  else if (sort === 'duration') sorted.sort(by((i) => i.duration, num))
  else sorted.sort(by((i) => i.addedAt, (a, b) => b - a))
  return sorted
}

function camelotOrder(k: number): number {
  const c = camelot(k)
  return parseInt(c, 10) * 2 + (c.endsWith('B') ? 1 : 0)
}

function RecordingRow({ rec, embedded }: { rec: RecordingMeta; embedded: boolean }) {
  const t = useT()
  const [url, setUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState<SaveOutcome | null>(null)
  // Embedded without a download permission: say so instead of a dead button.
  const [canDownload, setCanDownload] = useState(!embedded)
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  useEffect(() => {
    if (embedded) void hostDownloads().then((d) => setCanDownload(d !== null))
  }, [embedded])

  const ensureUrl = async (): Promise<string | null> => {
    if (url) return url
    const blob = await library.recordingBlob(rec.id)
    if (!blob) return null
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return u
  }

  const download = async () => {
    const blob = await library.recordingBlob(rec.id)
    if (!blob) return
    const name = `${rec.name.replace(/[^\w\- ]+/g, '').trim() || 'dj4you-mix'}.${extensionFor(rec.mime)}`
    setSaved(await saveFile(name, blob))
  }

  return (
    <li className="lib-row lib-row-rec">
      <div className="lib-info">
        <div className="lib-title">{rec.name}</div>
        <div className="lib-meta">
          {formatDuration(rec.duration)} · {formatBytes(rec.size)}
          {!canDownload && ` · ${t('downloads work in the hosted app')}`}
          {saved === 'saved' && ` · ${t('downloaded')}`}
          {saved === 'failed' && ` · ${t("couldn't download")}`}
        </div>
        {url && <audio className="lib-audio" src={url} controls autoPlay />}
      </div>
      <div className="lib-actions">
        {!url && (
          <button className="btn btn-small" onClick={() => void ensureUrl()} aria-label={t('Play {name}', { name: rec.name })}>
            ▶
          </button>
        )}
        {canDownload && (
          <button className="btn btn-small" onClick={() => void download()} aria-label={t('Download {name}', { name: rec.name })} title={t('Download')}>
            ⤓
          </button>
        )}
        <DeleteButton label={rec.name} onDelete={() => void library.removeRecording(rec.id)} />
      </div>
    </li>
  )
}

/** Recorder output is WebM/Opus (Chrome, Firefox) or MP4/AAC (Safari). */
function extensionFor(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}
