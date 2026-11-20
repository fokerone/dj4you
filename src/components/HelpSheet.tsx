import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollRow } from './ScrollRow'
import { HELP, type HelpItem, type HelpTab } from '../help/content'
import { useStore } from '../hooks/useEngine'
import { SHORTCUTS } from '../hooks/useShortcuts'
import { i18n, useT } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
  /** Highlight a control on the desk (switching tab on phones). */
  onSpotlight: (target: string, tab?: HelpTab) => void
}

/** Normalise for search: lower case, no accents. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Help: what every control does, searchable, with "show me on the desk". */
export function HelpSheet({ open, onClose, onSpotlight }: Props) {
  const t = useT()
  const { lang } = useStore(i18n)
  const [query, setQuery] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sections = HELP[lang]

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return sections
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => norm(`${i.name} ${i.what} ${i.tip ?? ''} ${i.keys ?? ''}`).includes(q)) }))
      .filter((s) => s.items.length > 0)
  }, [sections, query])

  if (!open) return null

  const jump = (id: string) => {
    const el = bodyRef.current?.querySelector(`#help-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-help" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head help-head">
          <h2 id="help-title">{t('Help')}</h2>
          <button className="btn btn-small" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </header>

        <div className="help-tools">
          <input
            id="help-search"
            ref={searchRef}
            className="help-search"
            type="search"
            value={query}
            placeholder={t('Search a control (e.g. SYNC, loop, filter)')}
            aria-label={t('Search help')}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && (
            <ScrollRow className="help-nav" role="navigation" label={t('Help sections')}>
              {sections.map((s) => (
                <button key={s.id} className="help-chip" onClick={() => jump(s.id)}>
                  {s.title}
                </button>
              ))}
              <button className="help-chip help-chip-keys" onClick={() => jump('keys')}>
                {t('Keyboard shortcuts')}
              </button>
            </ScrollRow>
          )}
        </div>

        <div ref={bodyRef} className="sheet-body help-body">
          {filtered.length === 0 && <p className="lib-empty">{t('Nothing matches "{q}". Try another word.', { q: query })}</p>}
          {filtered.map((s) => (
            <section key={s.id} id={`help-${s.id}`} className="help-section">
              <h3>{s.title}</h3>
              {s.intro && !query && <p className="help-intro">{s.intro}</p>}
              <div className="help-items">
                {s.items.map((item) => (
                  <HelpCard key={item.id} item={item} onShow={(target, tab) => onSpotlight(target, tab)} />
                ))}
              </div>
            </section>
          ))}
          {!query && (
            <section id="help-keys" className="help-section">
              <h3>{t('Keyboard shortcuts')}</h3>
              <p className="help-intro">{t('On a computer. They don’t work while you type in a text box.')}</p>
              <dl className="help-keys">
                {SHORTCUTS.map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{t(v)}</dd>
                  </div>
                ))}
                <div>
                  <dt>
                    <kbd>?</kbd>
                  </dt>
                  <dd>{t('Open this help')}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function HelpCard({ item, onShow }: { item: HelpItem; onShow: (target: string, tab?: HelpTab) => void }) {
  const t = useT()
  return (
    <article className="help-card">
      <header>
        <b>{item.name}</b>
        {item.target && (
          <button className="help-show" onClick={() => onShow(item.target!, item.tab)}>
            {t('Show on the desk')}
          </button>
        )}
      </header>
      <p>{item.what}</p>
      {item.tip && (
        <p className="help-tip">
          <span aria-hidden>💡</span> {item.tip}
        </p>
      )}
      {item.keys && (
        <p className="help-kbd">
          <span>{t('Keys')}:</span> <kbd>{item.keys}</kbd>
        </p>
      )}
    </article>
  )
}
