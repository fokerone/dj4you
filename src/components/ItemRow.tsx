import { useEffect, useState, type ReactNode } from 'react'
import type { Deck } from '../audio/deck'
import { engine } from '../audio/engine'
import { camelot, keyName } from '../audio/key'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import type { LibItem } from '../library/items'
import { prefs } from '../library/prefs'
import { FavButton } from './FavButton'
import { formatBytes, formatDuration } from './format'

/**
 * One track in the library (own file, demo or Jamendo): star, title, details
 * (tempo, key, licence), add-to-queue and load-on-A / B buttons.
 */
export function ItemRow({
  item,
  onDeck,
  onDelete,
  cover,
  note,
  actions,
  queueButton = true,
}: {
  item: LibItem
  onDeck: (deck: Deck) => void
  onDelete?: () => void
  /** Cover image (Jamendo) */
  cover?: ReactNode
  /** Extra line under the details, e.g. why a track is suggested */
  note?: ReactNode
  /** Replaces the queue button (e.g. queue controls) */
  actions?: ReactNode
  queueButton?: boolean
}) {
  const t = useT()
  const [a, b] = engine.decks
  return (
    <li className={`lib-row ${cover !== undefined ? 'jam-row' : ''}`}>
      {cover}
      <div className="lib-info">
        <div className="lib-title" title={item.title}>
          <FavButton fav={item.ref} title={item.title} inline />
          <span>{item.title}</span>
        </div>
        <div className="lib-meta">
          <ItemMeta item={item} />
        </div>
        {note && <div className="lib-note-line">{note}</div>}
      </div>
      <div className="lib-actions">
        {actions ?? (queueButton && <QueueButton item={item} />)}
        <button className="btn btn-small btn-to-a" onClick={() => onDeck(a)} aria-label={t('Load {title} on deck {id}', { title: item.title, id: 'A' })}>
          A
        </button>
        <button className="btn btn-small btn-to-b" onClick={() => onDeck(b)} aria-label={t('Load {title} on deck {id}', { title: item.title, id: 'B' })}>
          B
        </button>
        {onDelete && <DeleteButton label={item.title} onDelete={onDelete} />}
      </div>
    </li>
  )
}

/** "Artist · 4:30 · 126 BPM · 8A · CC BY" */
export function ItemMeta({ item }: { item: LibItem }) {
  const t = useT()
  const parts: ReactNode[] = []
  if (item.subtitle) parts.push(item.subtitle)
  if (item.duration) parts.push(formatDuration(item.duration))
  if (item.bpm) parts.push(`${item.bpm.toFixed(item.bpm % 1 ? 1 : 0)} BPM`)
  else if (item.tempoHint)
    parts.push(
      <span className="jam-speed" title={t('Jamendo gives no BPM: load the track and DJ4YOU measures it')}>
        {item.tempoHint}
      </span>,
    )
  if (item.key != null)
    parts.push(
      <span className="lib-key" title={t('Key: {name} (Camelot {code})', { name: keyName(item.key), code: camelot(item.key) })}>
        {camelot(item.key)}
      </span>,
    )
  if (item.size && !item.duration) parts.push(formatBytes(item.size))
  if (item.license)
    parts.push(
      <a className="jam-license" href={item.licenseUrl || undefined} target="_blank" rel="noreferrer" title={t('License terms')}>
        {item.license}
      </a>,
    )
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </>
  )
}

/** Add to / remove from "Up next". */
export function QueueButton({ item }: { item: LibItem }) {
  const t = useT()
  useStore(prefs)
  const queued = prefs.isQueued(item.id)
  return (
    <button
      className={`btn btn-small btn-queue ${queued ? 'is-on' : ''}`}
      aria-pressed={queued}
      aria-label={queued ? t('Remove {title} from the queue', { title: item.title }) : t('Add {title} to the queue', { title: item.title })}
      title={queued ? t('In the queue: tap to remove') : t('Add to the queue')}
      onClick={() => (queued ? prefs.dequeue(item.id) : prefs.enqueue(item.ref))}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        {queued ? <path d="M4 7h10M4 12h10M4 17h6M14 16l2.5 2.5L21 14" /> : <path d="M4 7h12M4 12h12M4 17h7M18 14v6M15 17h6" />}
      </svg>
    </button>
  )
}

/** Two-step delete: first tap arms it for 3 s, second tap deletes. */
export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const t = useT()
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const tm = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(tm)
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

