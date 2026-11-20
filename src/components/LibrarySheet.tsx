import { useT } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { Deck, DeckId } from '../audio/deck'
import { DEMOS } from '../audio/demo'
import { engine } from '../audio/engine'
import { useStore } from '../hooks/useEngine'
import { library, type RecordingMeta, type TrackMeta } from '../library/library'
import { hostDownloads, saveFile, type SaveOutcome } from '../library/saveFile'
import { install } from '../pwa'
import { audioAccept, isAudioFile } from '../library/audioFiles'
import { coach } from '../game'
import { JamendoBrowser } from './JamendoBrowser'
import { FavButton } from './FavButton'
import { type Favorite, favoriteKey, prefs } from '../library/prefs'
import { knownBpms } from '../library/jamendo'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a track was sent to a deck (e.g. to switch to that deck's tab). */
  onLoaded: (deck: DeckId) => void
}

const VIEW_KEY = 'dj4you.libraryView'

/** Track library: your saved tracks, the demo starter pack and recorded mixes. */
export function LibrarySheet({ open, onClose, onLoaded }: Props) {
  const t = useT()
  const lib = useStore(library)
  const inst = useStore(install)
  const { favorites } = useStore(prefs)
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [view, setViewState] = useState<'mine' | 'free'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'free' ? 'free' : 'mine'
    } catch {
      return 'mine'
    }
  })
  const setView = (v: 'mine' | 'free') => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* not kept */
    }
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sendTo = (deck: Deck, load: (d: Deck) => Promise<void>) => {
    void load(deck)
    onLoaded(deck.id)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Library')} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{t('Library')}</h2>
          <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
            {t('Add tracks')}
          </button>
          <button ref={closeRef} className="btn btn-small" onClick={onClose} aria-label={t('Close library')}>
            ✕
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={audioAccept()}
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])]
              e.currentTarget.value = ''
              const audio = files.filter(isAudioFile)
              const skipped = files.length - audio.length
              if (skipped) coach.notify('info', t('{n} file(s) skipped', { n: skipped }), t('Only audio files can be added.'))
              if (audio.length) void library.addFiles(audio)
            }}
          />
        </header>

        <div className="lib-tabs" role="tablist" aria-label={t('Library')}>
          <button role="tab" aria-selected={view === 'mine'} className="lib-tab" onClick={() => setView('mine')}>
            {t('My music')}
          </button>
          <button role="tab" aria-selected={view === 'free'} className="lib-tab" onClick={() => setView('free')}>
            {t('Free music')} <span className="lib-tab-badge">Jamendo</span>
          </button>
        </div>

        {view === 'free' ? (
          <JamendoBrowser onPick={(track, deck) => sendTo(deck, (d) => library.loadJamendo(track, d))} />
        ) : (
        <div className="sheet-body">
            {favorites.length > 0 && (
              <section className="lib-section lib-favs">
                <h3>
                  <span className="fav-star is-on" aria-hidden>★</span> {t('Favorites')} <span className="dim">{favorites.length}</span>
                </h3>
                <ul className="lib-list">
                  {favorites.map((f) => {
                    const row = favoriteRow(f, lib.tracks, t)
                    return (
                      row && (
                        <TrackRow
                          key={favoriteKey(f)}
                          title={row.title}
                          meta={row.meta}
                          fav={f}
                          onDeck={(deck) => sendTo(deck, row.load)}
                        />
                      )
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="lib-section">
              <h3>
                {t('Your tracks')} <span className="dim">{lib.tracks.length || ''}</span>
              </h3>
              {lib.unavailable && (
                <p className="lib-note">{t("This browser is blocking storage, so tracks play but won't be kept after you close the page.")}</p>
              )}
              {!lib.ready ? (
                <p className="lib-empty">{t('Loading your library…')}</p>
              ) : lib.tracks.length === 0 ? (
                <p className="lib-empty">
                  {t("Tracks you load are kept here on this device, so they're ready next time. Nothing is uploaded. Tap Add tracks or load a file onto a deck.")}
                </p>
              ) : (
                <ul className="lib-list">
                  {lib.tracks.map((t) => (
                    <TrackRow
                      key={t.id}
                      title={t.name}
                      meta={trackMeta(t)}
                      fav={{ type: 'track', id: t.id }}
                      onDeck={(deck) => sendTo(deck, (d) => library.loadTrack(t.id, d))}
                      onDelete={() => void library.removeTrack(t.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
  
            <section className="lib-section">
              <h3>{t('Starter pack')}</h3>
              <ul className="lib-list">
                {DEMOS.map((d, i) => (
                  <TrackRow
                    key={d.name}
                    title={d.name}
                    meta={t('{genre} · {bpm} BPM · {dur}', { genre: d.genre, bpm: d.bpm, dur: formatDuration(demoDuration(d.bpm)) })}
                    fav={{ type: 'demo', name: d.name }}
                    onDeck={(deck) => sendTo(deck, (dk) => library.loadDemo(i, dk))}
                  />
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
                    <RecordingRow key={r.id} rec={r} embedded={inst.embedded} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <footer className="sheet-foot">
          {lib.usage && (
            <span className="dim">
              {t('{used} used on this device · {quota} available', { used: formatBytes(lib.usage.used), quota: formatBytes(lib.usage.quota) })}
            </span>
          )}
          {inst.canPrompt && (
            <button className="btn btn-small btn-install" onClick={() => void install.prompt()}>
              {t('Install app')}
            </button>
          )}
          {inst.iosHint && <span className="dim">{t('To install: Share → Add to Home Screen')}</span>}
        </footer>
      </div>
    </div>
  )
}

function TrackRow({
  title,
  meta,
  fav,
  onDeck,
  onDelete,
}: {
  title: string
  meta: string
  fav?: Favorite
  onDeck: (deck: Deck) => void
  onDelete?: () => void
}) {
  const t = useT()
  const [a, b] = engine.decks
  return (
    <li className="lib-row">
      <div className="lib-info">
        <div className="lib-title" title={title}>
          {title}
        </div>
        <div className="lib-meta">{meta}</div>
      </div>
      <div className="lib-actions">
        {fav && <FavButton fav={fav} title={title} />}
        <button className="btn btn-small btn-to-a" onClick={() => onDeck(a)} aria-label={t('Load {title} on deck {id}', { title, id: 'A' })}>
          A
        </button>
        <button className="btn btn-small btn-to-b" onClick={() => onDeck(b)} aria-label={t('Load {title} on deck {id}', { title, id: 'B' })}>
          B
        </button>
        {onDelete && <DeleteButton label={title} onDelete={onDelete} />}
      </div>
    </li>
  )
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

/** Title, details and loader for a favourite; null if it's no longer in the library. */
function favoriteRow(
  f: Favorite,
  tracks: readonly TrackMeta[],
  t: ReturnType<typeof useT>,
): { title: string; meta: string; load: (d: Deck) => Promise<void> } | null {
  if (f.type === 'track') {
    const tr = tracks.find((x) => x.id === f.id)
    return tr ? { title: tr.name, meta: trackMeta(tr), load: (d) => library.loadTrack(tr.id, d) } : null
  }
  if (f.type === 'demo') {
    const i = DEMOS.findIndex((d) => d.name === f.name)
    if (i < 0) return null
    const d = DEMOS[i]
    return { title: d.name, meta: t('{genre} · {bpm} BPM · {dur}', { genre: d.genre, bpm: d.bpm, dur: formatDuration(demoDuration(d.bpm)) }), load: (dk) => library.loadDemo(i, dk) }
  }
  const bpm = knownBpms()[f.track.id]
  const meta = [f.track.artist, formatDuration(f.track.duration), bpm ? `${bpm.toFixed(bpm % 1 ? 1 : 0)} BPM` : '', `Jamendo · ${f.track.license}`].filter(Boolean).join(' · ')
  return { title: f.track.name, meta, load: (d) => library.loadJamendo(f.track, d) }
}

/** Two-step delete: first tap arms it for 3 s, second tap deletes. */
function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const t = useT()
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`btn btn-small btn-delete ${armed ? 'is-armed' : ''}`}
      aria-label={armed ? t('Confirm delete {label}', { label }) : t('Delete {label}', { label })}
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? (
        t('Delete?')
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      )}
    </button>
  )
}

function trackMeta(t: TrackMeta): string {
  const parts = []
  if (t.bpm) parts.push(`${t.bpm.toFixed(t.bpm % 1 ? 1 : 0)} BPM`)
  if (t.duration) parts.push(formatDuration(t.duration))
  parts.push(formatBytes(t.size))
  return parts.join(' · ')
}

/** Demo tracks are 32 bars plus a short tail. */
function demoDuration(bpm: number): number {
  return (32 * 4 * 60) / bpm + 1.5
}

/** Recorder output is WebM/Opus (Chrome, Firefox) or MP4/AAC (Safari). */
function extensionFor(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}
