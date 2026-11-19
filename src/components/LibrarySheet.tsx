import { useEffect, useRef, useState } from 'react'
import type { Deck, DeckId } from '../audio/deck'
import { DEMOS } from '../audio/demo'
import { engine } from '../audio/engine'
import { useStore } from '../hooks/useEngine'
import { library, type RecordingMeta, type TrackMeta } from '../library/library'
import { hostDownloads, saveFile, type SaveOutcome } from '../library/saveFile'
import { install } from '../pwa'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a track was sent to a deck (e.g. to switch to that deck's tab). */
  onLoaded: (deck: DeckId) => void
}

/** Track library: your saved tracks, the demo starter pack and recorded mixes. */
export function LibrarySheet({ open, onClose, onLoaded }: Props) {
  const lib = useStore(library)
  const inst = useStore(install)
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

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
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Library" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>Library</h2>
          <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
            Add tracks
          </button>
          <button ref={closeRef} className="btn btn-small" onClick={onClose} aria-label="Close library">
            ✕
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])]
              e.currentTarget.value = ''
              if (files.length) void library.addFiles(files)
            }}
          />
        </header>

        <div className="sheet-body">
          <section className="lib-section">
            <h3>
              Your tracks <span className="dim">{lib.tracks.length || ''}</span>
            </h3>
            {lib.unavailable && (
              <p className="lib-note">This browser is blocking storage, so tracks play but won't be kept after you close the page.</p>
            )}
            {lib.tracks.length === 0 ? (
              <p className="lib-empty">
                Tracks you load are kept here on this device, so they're ready next time. Nothing is uploaded. Tap <b>Add tracks</b> or load a
                file onto a deck.
              </p>
            ) : (
              <ul className="lib-list">
                {lib.tracks.map((t) => (
                  <TrackRow
                    key={t.id}
                    title={t.name}
                    meta={trackMeta(t)}
                    onDeck={(deck) => sendTo(deck, (d) => library.loadTrack(t.id, d))}
                    onDelete={() => void library.removeTrack(t.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="lib-section">
            <h3>Starter pack</h3>
            <ul className="lib-list">
              {DEMOS.map((d, i) => (
                <TrackRow
                  key={d.name}
                  title={d.name.replace(/^Demo · /, '').replace(/ \(\d+\)$/, '')}
                  meta={`${d.bpm} BPM · ${formatDuration(demoDuration(d.bpm))} · made in your browser`}
                  onDeck={(deck) => sendTo(deck, (dk) => library.loadDemo(i, dk))}
                />
              ))}
            </ul>
          </section>

          <section className="lib-section">
            <h3>
              Recordings <span className="dim">{lib.recordings.length || ''}</span>
            </h3>
            {lib.recordings.length === 0 ? (
              <p className="lib-empty">
                Press <b>REC</b> next to the crossfader to record your mix. Recordings are saved here.
              </p>
            ) : (
              <ul className="lib-list">
                {lib.recordings.map((r) => (
                  <RecordingRow key={r.id} rec={r} embedded={inst.embedded} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="sheet-foot">
          {lib.usage && (
            <span className="dim">
              {formatBytes(lib.usage.used)} used on this device · {formatBytes(lib.usage.quota)} available
            </span>
          )}
          {inst.canPrompt && (
            <button className="btn btn-small btn-install" onClick={() => void install.prompt()}>
              Install app
            </button>
          )}
          {inst.iosHint && <span className="dim">To install: Share → Add to Home Screen</span>}
        </footer>
      </div>
    </div>
  )
}

function TrackRow({
  title,
  meta,
  onDeck,
  onDelete,
}: {
  title: string
  meta: string
  onDeck: (deck: Deck) => void
  onDelete?: () => void
}) {
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
        <button className="btn btn-small btn-to-a" onClick={() => onDeck(a)} aria-label={`Load ${title} on deck A`}>
          A
        </button>
        <button className="btn btn-small btn-to-b" onClick={() => onDeck(b)} aria-label={`Load ${title} on deck B`}>
          B
        </button>
        {onDelete && <DeleteButton label={title} onDelete={onDelete} />}
      </div>
    </li>
  )
}

function RecordingRow({ rec, embedded }: { rec: RecordingMeta; embedded: boolean }) {
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
          {!canDownload && ' · downloads work in the hosted app'}
          {saved === 'saved' && ' · downloaded'}
          {saved === 'failed' && " · couldn't download"}
        </div>
        {url && <audio className="lib-audio" src={url} controls autoPlay />}
      </div>
      <div className="lib-actions">
        {!url && (
          <button className="btn btn-small" onClick={() => void ensureUrl()} aria-label={`Play ${rec.name}`}>
            ▶
          </button>
        )}
        {canDownload && (
          <button className="btn btn-small" onClick={() => void download()} aria-label={`Download ${rec.name}`} title="Download">
            ⤓
          </button>
        )}
        <DeleteButton label={rec.name} onDelete={() => void library.removeRecording(rec.id)} />
      </div>
    </li>
  )
}

/** Two-step delete: first tap arms it for 3 s, second tap deletes. */
function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`btn btn-small btn-delete ${armed ? 'is-armed' : ''}`}
      aria-label={armed ? `Confirm delete ${label}` : `Delete ${label}`}
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? (
        'Delete?'
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
