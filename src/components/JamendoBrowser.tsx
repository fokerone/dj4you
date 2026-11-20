import { useEffect, useRef, useState } from 'react'
import type { Deck } from '../audio/deck'
import { engine } from '../audio/engine'
import { useT } from '../i18n'
import { useStore } from '../hooks/useEngine'
import { FavButton } from './FavButton'
import { GENRES, jamendoAvailable, type JamendoTrack, knownBpms, searchJamendo } from '../library/jamendo'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Browse and search Creative Commons music on Jamendo, load onto a deck. */
export function JamendoBrowser({ onPick }: { onPick: (track: JamendoTrack, deck: Deck) => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [genre, setGenre] = useState<string>('house')
  const [tracks, setTracks] = useState<JamendoTrack[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [retry, setRetry] = useState(0)
  const abort = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
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
        setTracks((prev) => (offset === 0 ? [...page.tracks] : [...prev, ...page.tracks]))
        setHasMore(page.hasMore)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setStatus('error')
      })
  }

  useEffect(() => {
    if (!available) return
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

  const [a, b] = engine.decks
  const bpms = knownBpms()

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
        <div className="help-nav" role="radiogroup" aria-label={t('Genre')}>
          {GENRES.map((g) => (
            <button key={g.id || 'all'} role="radio" aria-checked={genre === g.id} className={`help-chip ${genre === g.id ? 'is-on' : ''}`} onClick={() => setGenre(g.id)}>
              {g.id ? t(g.label) : t('All')}
            </button>
          ))}
        </div>
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
            {tracks.map((tr) => (
              <li key={tr.id} className="lib-row jam-row">
                {tr.image ? <img className="jam-cover" src={tr.image} alt="" loading="lazy" width={44} height={44} /> : <span className="jam-cover" aria-hidden />}
                <div className="lib-info">
                  <div className="lib-title" title={tr.name}>
                    {tr.name}
                  </div>
                  <div className="lib-meta">
                    {tr.artist} · {formatDuration(tr.duration)} ·{' '}
                    {bpms[tr.id] ? (
                      <span className="jam-bpm">{bpms[tr.id].toFixed(bpms[tr.id] % 1 ? 1 : 0)} BPM</span>
                    ) : (
                      tr.speed && <span className="jam-speed" title={t('Jamendo gives no BPM: load the track and DJ4YOU measures it')}>{t(SPEED_LABEL[tr.speed])}</span>
                    )}
                    {(bpms[tr.id] || tr.speed) && ' · '}
                    <a className="jam-license" href={tr.licenseUrl || tr.pageUrl} target="_blank" rel="noreferrer" title={t('License terms')}>
                      {tr.license}
                    </a>
                  </div>
                </div>
                <div className="lib-actions">
                  <FavButton fav={{ type: 'jamendo', track: tr }} title={tr.name} />
                  <button className="btn btn-small btn-to-a" onClick={() => onPick(tr, a)} aria-label={t('Load {title} on deck {id}', { title: tr.name, id: 'A' })}>
                    A
                  </button>
                  <button className="btn btn-small btn-to-b" onClick={() => onPick(tr, b)} aria-label={t('Load {title} on deck {id}', { title: tr.name, id: 'B' })}>
                    B
                  </button>
                </div>
              </li>
            ))}
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

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
