import { useEffect, useRef, useState } from 'react'
import type { Deck } from '../audio/deck'
import { engine } from '../audio/engine'
import { useT } from '../i18n'
import { useStore } from '../hooks/useEngine'
import { ScrollRow } from './ScrollRow'
import { GENRES, jamendoAvailable, type JamendoTrack, knownInfo, searchJamendo } from '../library/jamendo'
import { resolveRef } from '../library/items'
import { heardKey, mixScore } from '../audio/key'
import { ItemRow } from './ItemRow'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const GENRE_KEY = 'dj4you.jamendoGenre'

/**
 * What the browser showed last, kept while the app is open so leaving the
 * tab or the library and coming back shows the same style, search and list
 * (the style is also remembered for the next visit).
 */
const last: { query: string; genre: string; tracks: JamendoTrack[]; hasMore: boolean; key: string | null } = {
  query: '',
  genre: savedGenre(),
  tracks: [],
  hasMore: false,
  key: null,
}

function savedGenre(): string {
  try {
    const g = localStorage.getItem(GENRE_KEY)
    if (g !== null && GENRES.some((x) => x.id === g)) return g
  } catch {
    /* not available */
  }
  return 'house'
}

/** Browse and search Creative Commons music on Jamendo, load onto a deck. */
export function JamendoBrowser({ onPick }: { onPick: (track: JamendoTrack, deck: Deck) => void }) {
  const t = useT()
  const [query, setQuery] = useState(last.query)
  const [debounced, setDebounced] = useState(last.query)
  const [genre, setGenre] = useState<string>(last.genre)
  const [tracks, setTracks] = useState<JamendoTrack[]>(last.tracks)
  const [hasMore, setHasMore] = useState(last.hasMore)
  const [status, setStatus] = useState<Status>(last.tracks.length ? 'ready' : 'idle')
  const [retry, setRetry] = useState(0)
  const abort = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  // Bring the remembered style into view (it may be further along the row).
  useEffect(() => {
    chipsRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [])
  const available = jamendoAvailable()
  // Re-render when a deck finishes analysing, so a newly detected BPM shows up.
  useStore(engine.decks[0])
  useStore(engine.decks[1])

  // Wait for typing to pause before searching.
  useEffect(() => {
    const tm = window.setTimeout(() => setDebounced(query.trim()), 350)
    return () => window.clearTimeout(tm)
  }, [query])

  const load = (offset: number) => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setStatus('loading')
    // A new style or search replaces the list: clear it so the loading state
    // shows right away instead of the old results looking stuck.
    if (offset === 0) {
      setTracks([])
      setHasMore(false)
      bodyRef.current?.scrollTo({ top: 0 })
    }
    searchJamendo({ query: debounced, genre, offset, signal: ac.signal })
      .then((page) => {
        setTracks((prev) => {
          const next = offset === 0 ? [...page.tracks] : [...prev, ...page.tracks]
          Object.assign(last, { tracks: next, hasMore: page.hasMore, key: `${genre}|${debounced}` })
          return next
        })
        setHasMore(page.hasMore)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setStatus('error')
      })
  }

  useEffect(() => {
    last.query = query
  }, [query])

  useEffect(() => {
    last.genre = genre
    try {
      localStorage.setItem(GENRE_KEY, genre)
    } catch {
      /* not kept */
    }
  }, [genre])

  useEffect(() => {
    if (!available) return
    // Coming back to the same style and search: keep the list already shown.
    if (retry === 0 && last.key === `${genre}|${debounced}` && last.tracks.length) return
    load(0)
    return () => abort.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, genre, retry, available])

  if (!available) {
    return (
      <div className="sheet-body">
        <p className="lib-note">{t('Free music from Jamendo is available on the DJ4YOU website, not in this preview.')}</p>
      </div>
    )
  }

  const info = knownInfo()
  const main = engine.mainDeck()
  const mainId = main?.getSnapshot().id ?? ''
  const now = main?.getSnapshot().trackName ? { bpm: main.effectiveBpm, key: heardKey(main.getSnapshot().key, main.rate) } : null

  return (
    <>
      <div className="jam-tools">
        <input
          id="jamendo-search"
          className="help-search"
          type="search"
          value={query}
          placeholder={t('Search artist, track or style')}
          aria-label={t('Search free music')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollRow ref={chipsRef} className="help-nav" role="radiogroup" label={t('Genre')}>
          {GENRES.map((g) => (
            <button key={g.id || 'all'} role="radio" aria-checked={genre === g.id} className={`help-chip ${genre === g.id ? 'is-on' : ''}`} onClick={() => setGenre(g.id)}>
              {g.id ? t(g.label) : t('All')}
            </button>
          ))}
        </ScrollRow>
      </div>

      <div ref={bodyRef} className="sheet-body jam-body" aria-busy={status === 'loading'}>
        {status === 'error' && (
          <div className="jam-state">
            <p>{t('Couldn’t reach Jamendo. Check your connection.')}</p>
            <button className="btn btn-small" onClick={() => setRetry((n) => n + 1)}>
              {t('Try again')}
            </button>
          </div>
        )}
        {status === 'loading' && tracks.length === 0 && (
          <div className="jam-state">
            <span className="spinner" aria-hidden />
            <p>
              {debounced
                ? t('Searching "{q}"…', { q: debounced })
                : genre
                  ? t('Finding {genre} music…', { genre: t(GENRES.find((g) => g.id === genre)?.label ?? '') })
                  : t('Finding music…')}
            </p>
          </div>
        )}
        {status === 'ready' && tracks.length === 0 && (
          <div className="jam-state">
            <p>{debounced ? t('Nothing found for "{q}". Try another word or style.', { q: debounced }) : t('No tracks in this style right now.')}</p>
          </div>
        )}

        {tracks.length > 0 && (
          <ul className="lib-list">
            {tracks.map((tr) => {
              const base = resolveRef({ type: 'jamendo', track: tr }, [], info)!
              const item = { ...base, tempoHint: tr.speed ? t(SPEED_LABEL[tr.speed]) : undefined }
              const fits = now?.bpm ? mixScore(now, item, 6) : null
              return (
                <ItemRow
                  key={tr.id}
                  item={item}
                  onDeck={(deck) => onPick(tr, deck)}
                  cover={tr.image ? <img className="jam-cover" src={tr.image} alt="" loading="lazy" width={44} height={44} /> : <span className="jam-cover" aria-hidden />}
                  note={fits !== null && fits > 0.2 ? <span className="mix-reason">✓ {t('Mixes with {id}', { id: mainId })}</span> : undefined}
                />
              )
            })}
          </ul>
        )}

        {hasMore && status !== 'error' && (
          <button className="btn jam-more" disabled={status === 'loading'} onClick={() => load(tracks.length)}>
            {status === 'loading' ? t('Loading…') : t('Load more')}
          </button>
        )}

        <p className="jam-credit">
          {t('Music from')}{' '}
          <a href="https://www.jamendo.com" target="_blank" rel="noreferrer">
            Jamendo
          </a>{' '}
          {t('under Creative Commons licences that allow remixing. Each track shows its artist and licence: respect its terms (NC = no commercial use, SA = share your mix under the same licence).')}
        </p>
      </div>
    </>
  )
}

const SPEED_LABEL: Record<string, string> = {
  verylow: 'very slow',
  low: 'slow',
  medium: 'mid tempo',
  high: 'fast',
  veryhigh: 'very fast',
}

