import { useCallback, useEffect, useState } from 'react'
import type { Deck } from './audio/deck'
import { engine } from './audio/engine'
import { DeckView } from './components/DeckView'
import { LibrarySheet } from './components/LibrarySheet'
import { LiveButton, LiveSheet } from './components/LiveSheet'
import { Crossfader, MixerView } from './components/MixerView'
import { RecButton } from './components/RecButton'
import { Coach, Hud, PhaseMeter, Popups } from './components/Hud'
import { Stage } from './components/Stage'
import { Welcome } from './components/Welcome'
import { shouldWelcome } from './game/welcome'
import { buzz } from './game/haptics'
import { SHORTCUTS, useShortcuts } from './hooks/useShortcuts'
import { Brand, LangSwitch } from './components/Brand'
import { useT } from './i18n'
import { useStore } from './hooks/useEngine'
import type { RecordingMeta } from './library/library'

type Tab = 'A' | 'mixer' | 'B'

/**
 * Layout:
 *  - landscape / wide: the full desk  — Deck A │ Mixer │ Deck B, crossfader under the mixer
 *  - portrait phone:   one panel at a time via tabs, crossfader docked at the bottom
 * All panels stay mounted (decks keep playing); CSS decides what is visible.
 */
export default function App() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('A')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [liveOpen, setLiveOpen] = useState(false)
  const openLive = useCallback(() => setLiveOpen(true), [])
  const closeLive = useCallback(() => setLiveOpen(false), [])
  const [toast, setToast] = useState<string | null>(null)
  const [welcome, setWelcome] = useState(shouldWelcome)
  const [keysOpen, setKeysOpen] = useState(false)
  const toggleKeys = useCallback(() => setKeysOpen((o) => !o), [])
  useShortcuts(toggleKeys)

  // A tiny tick of vibration on every control press (phones that support it).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.btn, .pad, .tab, .pad-mode')) buzz(8)
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])
  const [deckA, deckB] = engine.decks
  const openLibrary = useCallback(() => setLibraryOpen(true), [])
  const closeLibrary = useCallback(() => setLibraryOpen(false), [])
  const onRecSaved = useCallback((r: RecordingMeta | null) => setToast(r ? t('Saved "{name}" to the Library', { name: r.name }) : null), [t])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <div className="app">
      <Stage />
      <header className="topbar">
        <h1 className="logo">
          <Brand />
        </h1>
        <LangSwitch className="topbar-lang" />
        <button className="btn btn-small btn-keys" onClick={toggleKeys} aria-expanded={keysOpen}>
          {t('Keys')}
        </button>
      </header>

      <nav className="tabs" role="tablist" aria-label={t('Desk sections')}>
        <TabButton deck={deckA} active={tab === 'A'} onClick={() => setTab('A')} />
        <button role="tab" aria-selected={tab === 'mixer'} className="tab" onClick={() => setTab('mixer')}>
          {t('Mixer')}
        </button>
        <TabButton deck={deckB} active={tab === 'B'} onClick={() => setTab('B')} />
        <LiveButton className="live-in-tabs" onOpen={openLive} />
      </nav>

      <main className="desk" data-tab={tab}>
        <div className="panel-hud">
          <Hud />
        </div>
        <div className="panel panel-a">
          <DeckView deck={deckA} other={deckB} onOpenLibrary={openLibrary} />
        </div>
        <div className="panel panel-mixer">
          <MixerView mixer={engine.mixer} decks={engine.decks} rec={
              <>
                <RecButton className="rec-in-mixer" onSaved={onRecSaved} />
                <LiveButton className="live-in-mixer" onOpen={openLive} />
              </>
            } />
        </div>
        <div className="panel panel-b">
          <DeckView deck={deckB} other={deckA} onOpenLibrary={openLibrary} />
        </div>
        <div className="panel-xfader">
          <PhaseMeter />
          <Crossfader mixer={engine.mixer} />
          <RecButton className="rec-in-dock" onSaved={onRecSaved} />
        </div>
      </main>

      <LiveSheet open={liveOpen} onClose={closeLive} />
      <Coach />
      <Popups />
      {keysOpen && (
        <div className="keys" role="dialog" aria-label={t('Keyboard shortcuts')}>
          <header>
            <b>{t('Keyboard shortcuts')}</b>
            <button className="btn btn-small" onClick={toggleKeys} aria-label={t('Close')}>
              ✕
            </button>
          </header>
          <dl>
            {SHORTCUTS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{t(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {welcome && <Welcome onDone={() => setWelcome(false)} />}

      <LibrarySheet
        open={libraryOpen}
        onClose={closeLibrary}
        onLoaded={(id) => {
          setLibraryOpen(false)
          setTab(id)
        }}
      />

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button className="btn btn-small" onClick={() => (setToast(null), setLibraryOpen(true))}>
            {t('Open')}
          </button>
        </div>
      )}
    </div>
  )
}

function TabButton({ deck, active, onClick }: { deck: Deck; active: boolean; onClick: () => void }) {
  const t = useT()
  const { id, playing } = useStore(deck)
  return (
    <button role="tab" aria-selected={active} className={`tab tab-${id.toLowerCase()}`} onClick={onClick}>
      <span className="tab-word">{t('Deck')} </span>
      {id}
      <span className={`tab-dot ${playing ? 'is-on' : ''}`} aria-label={playing ? t('playing') : undefined} />
    </button>
  )
}
