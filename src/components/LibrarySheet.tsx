import { useT } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { Deck, DeckId } from '../audio/deck'
import { useStore } from '../hooks/useEngine'
import { library } from '../library/library'
import { install } from '../pwa'
import { audioAccept, isAudioFile } from '../library/audioFiles'
import { coach } from '../game'
import { JamendoBrowser } from './JamendoBrowser'
import { formatBytes } from './format'
import { MyMusic } from './MyMusic'

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
          <MyMusic sendTo={sendTo} embedded={inst.embedded} />
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

