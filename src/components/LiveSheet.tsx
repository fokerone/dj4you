import { useT } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { useAnimationFrame, useStore } from '../hooks/useEngine'
import { LOBBY_URL, listenUrl, liveSupported, lobbyPageUrl, MAX_LISTENERS } from '../live/config'
import { QrCode } from './QrCode'

const NAME_KEY = 'dj4you.djName'

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Go live: set up, share the link / QR code, watch listeners, stop. */
export function LiveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const live = useStore(engine.live)
  const [dj, setDj] = useState(loadName)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(LOBBY_URL !== null)
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const supported = liveSupported()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useAnimationFrame(() => {
    if (live.status !== 'live' || !clockRef.current) return
    const s = Math.floor((Date.now() - live.startedAt) / 1000)
    clockRef.current.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })

  if (!open) return null
  const link = live.id ? listenUrl(live.id) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      linkRef.current?.select()
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-live" role="dialog" aria-modal="true" aria-label={t('Go live')} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{live.status === 'live' ? t("You're live") : t('Go live')}</h2>
          <button className="btn btn-small" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </header>

        <div className="sheet-body">
          {!supported && (
            <p className="lib-note">{t("Live streaming isn't available in this preview. Open the DJ4YOU website to go live.")}</p>
          )}

          {(live.status === 'idle' || live.status === 'error') && (
            <form
              className="live-form"
              onSubmit={(e) => {
                e.preventDefault()
                try {
                  localStorage.setItem(NAME_KEY, dj)
                } catch {
                  /* not kept */
                }
                engine.live.start({ dj, title, isPublic })
              }}
            >
              <label className="field">
                <span>{t('DJ name')}</span>
                <input id="live-dj" value={dj} maxLength={40} placeholder="DJ Nova" onChange={(e) => setDj(e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Set title (optional)')}</span>
                <input id="live-title" value={title} maxLength={80} placeholder={t('Friday warm-up')} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={`check ${LOBBY_URL ? '' : 'is-disabled'}`}>
                <input id="live-public" type="checkbox" checked={isPublic} disabled={!LOBBY_URL} onChange={(e) => setIsPublic(e.target.checked)} />
                <span>
                  {t('List my set in Live now so anyone can find it')}
                  {!LOBBY_URL && <small>{t('Needs the DJ4YOU live server. Your share link still works.')}</small>}
                </span>
              </label>
              <p className="lib-empty">
                {t("Listeners hear exactly what comes out of your master, in their browser, with no app or account. Up to {max} listeners. Keep this page open while you're live.", { max: MAX_LISTENERS })}
              </p>
              {live.error && <p className="lib-note">{live.error}</p>}
              <button className="btn btn-golive" type="submit" disabled={!supported}>
                <span className="live-dot" aria-hidden /> {t('Start live set')}
              </button>
            </form>
          )}

          {live.status === 'connecting' && <p className="live-wait">{t('Starting your set…')}</p>}

          {live.status === 'live' && (
            <div className="live-on">
              <div className="live-stats">
                <div>
                  <b ref={clockRef}>0:00</b>
                  <span>{t('on air')}</span>
                </div>
                <div>
                  <b>{live.listeners}</b>
                  <span>{t(live.listeners === 1 ? 'listener' : 'listeners')}</span>
                </div>
              </div>

              <div className="live-share">
                <QrCode text={link} label={t('QR code for your listen link')} />
                <p className="lib-empty">{t('Scan to listen, or share the link:')}</p>
                <div className="live-link">
                  <input id="live-link" ref={linkRef} readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <button className="btn btn-small" onClick={() => void copy()}>
                    {t(copied ? 'Copied' : 'Copy')}
                  </button>
                </div>
                {live.isPublic && (
                  <p className="lib-empty">
                    {live.lobbyError ? t("Couldn't list your set in Live now. The link still works.") : `${t('Listed in Live now.')} `}
                    {!live.lobbyError && (
                      <a href={lobbyPageUrl()} target="_blank" rel="noreferrer">
                        {t('See the lobby')}
                      </a>
                    )}
                  </p>
                )}
              </div>

              <button className="btn btn-stop" onClick={() => engine.live.stop()}>
                {t('End live set')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Opens the Go live sheet; shows on-air state and listener count. */
export function LiveButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const t = useT()
  const { status, listeners } = useStore(engine.live)
  const on = status === 'live'
  return (
    <button className={`btn btn-live ${on ? 'is-on' : ''} ${className ?? ''}`} onClick={onOpen} aria-label={on ? t('Live, {n} listeners', { n: listeners }) : t('Go live')}>
      <span className="live-dot" aria-hidden />
      {on ? t('LIVE {n}', { n: listeners }) : t('LIVE')}
    </button>
  )
}
