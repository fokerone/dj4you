import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type Reaction } from '../live/protocol'
import { useT } from '../i18n'

type FeedItem = { readonly id: number; readonly emoji: Reaction; readonly mine?: boolean }

/** Emojis that float up and fade: one per new item in `feed`. */
export function FloatingReactions({ feed, className }: { feed: readonly FeedItem[]; className?: string }) {
  const [items, setItems] = useState<(FeedItem & { x: number; d: number })[]>([])
  const seen = useRef(feed.length ? feed[feed.length - 1].id : 0)

  useEffect(() => {
    const fresh = feed.filter((f) => f.id > seen.current)
    if (!fresh.length) return
    seen.current = fresh[fresh.length - 1].id
    setItems((now) => [...now, ...fresh.map((f) => ({ ...f, x: Math.random() * 70, d: 2.2 + Math.random() * 0.8 }))].slice(-30))
  }, [feed])

  return (
    <div className={`reactions-float ${className ?? ''}`} aria-hidden>
      {items.map((r) => (
        <span
          key={r.id}
          className={`reaction-bubble ${r.mine ? 'is-mine' : ''}`}
          style={{ left: `${r.x}%`, animationDuration: `${r.d}s` }}
          onAnimationEnd={() => setItems((now) => now.filter((x) => x.id !== r.id))}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  )
}

/** "🔥 12 · 🙌 4": reactions received this set. */
export function ReactionCounts({ counts }: { counts: Readonly<Partial<Record<Reaction, number>>> }) {
  const t = useT()
  const total = REACTIONS.reduce((n, e) => n + (counts[e] ?? 0), 0)
  if (!total) return <p className="reaction-counts dim">{t('Reactions from your listeners show up here.')}</p>
  return (
    <p className="reaction-counts" aria-label={t('{n} reactions', { n: total })}>
      {REACTIONS.filter((e) => counts[e]).map((e) => (
        <span key={e}>
          {e} <b>{counts[e]}</b>
        </span>
      ))}
    </p>
  )
}

/** The listener's reaction buttons. */
export function ReactionBar({ onReact }: { onReact: (e: Reaction) => void }) {
  const t = useT()
  return (
    <div className="reaction-bar" role="group" aria-label={t('Send a reaction to the DJ')}>
      {REACTIONS.map((e) => (
        <button key={e} className="reaction-btn" onClick={() => onReact(e)} aria-label={t('React {emoji}', { emoji: e })}>
          {e}
        </button>
      ))}
    </div>
  )
}
