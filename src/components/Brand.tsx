import { LANGS, i18n, useT } from '../i18n'
import { useStore } from '../hooks/useEngine'

/** DJ4YOU wordmark with its spinning-disc mark. `compact` shows only the mark. */
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={`brand ${compact ? 'is-compact' : ''} ${className ?? ''}`} aria-label="DJ4YOU" role="img">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="#0b0d12" stroke="url(#brand-g)" strokeWidth="3.5" />
        <circle cx="16" cy="16" r="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="3" fill="#ffffff" />
      </svg>
      {!compact && (
        <span className="brand-word" aria-hidden>
          DJ<b>4</b>YOU
        </span>
      )}
    </span>
  )
}

/** ES / EN switch. */
export function LangSwitch({ className }: { className?: string }) {
  const { lang } = useStore(i18n)
  const t = useT()
  return (
    <div className={`lang ${className ?? ''}`} role="radiogroup" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={lang === l.id}
          aria-label={l.label}
          title={l.label}
          className={lang === l.id ? 'is-on' : ''}
          onClick={() => i18n.setLang(l.id)}
        >
          {l.id.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
