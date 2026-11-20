import { useCallback, useEffect, useRef, useState } from 'react'
import type { Deck } from './audio/deck'
import { engine } from './audio/engine'
import { DeckView } from './components/DeckView'
import { HeadphonesSheet } from './components/HeadphonesSheet'
import { SummarySheet, type SummaryData } from './components/SummarySheet'
import { LibrarySheet } from './components/LibrarySheet'
import { LiveButton, LiveSheet } from './components/LiveSheet'
import { Crossfader, MixerView } from './components/MixerView'
import { RecButton } from './components/RecButton'
import { HintBar, MenuButton, MenuSheet, Notes, PhaseMeter, PhoneBar, TutorialCard } from './components/Coach'
import { coach } from './game'
import { Stage } from './components/Stage'
import { Welcome } from './components/Welcome'
import { shouldWelcome } from './game/welcome'
import { buzz } from './game/haptics'
import { useShortcuts } from './hooks/useShortcuts'
import { Brand, LangSwitch } from './components/Brand'
import { useT } from './i18n'
import { useStore } from './hooks/useEngine'
import { library, type RecordingMeta } from './library/library'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [hpOpen, setHpOpen] = useState(false)
  const openHp = useCallback(() => setHpOpen(true), [])
  const closeHp = useCallback(() => setHpOpen(false), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])
  useShortcuts(toggleMenu)
  const recState = useStore(engine.recorder)
  const liveState = useStore(engine.live)

  // Don't lose a recording or drop listeners by closing the tab by accident.
  useEffect(() => {
    if (!recState.recording && liveState.status !== 'live') return
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [recState.recording, liveState.status])

  // Returning visit: put last session's tracks back on the decks.
  useEffect(() => {
    if (shouldWelcome()) return
    void library.restoreDecks(engine.decks).then((restored) => {
      if (restored) coach.notify('info', t('Welcome back'), t('Your decks are loaded as you left them.'))
    })
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Session recap: track each recording / live set from start to end.
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const summaryRef = useRef<SummaryData | null>(null)
  const showSummary = useCallback((s: SummaryData | null) => {
    summaryRef.current = s
    setSummary(s)
  }, [])
  useEffect(() => {
    let rec = engine.recorder.getSnapshot().recording
    let live = engine.live.getSnapshot().status === 'live'
    const unsubRec = engine.recorder.subscribe(() => {
      const now = engine.recorder.getSnapshot().recording
      if (now && !rec) coach.beginSegment('rec')
      if (!now && rec) {
        const s = coach.endSegment('rec')
        // Very short takes just get the "saved" toast.
        if (s && s.seconds >= 15) showSummary(s)
      }
      rec = now
    })
    const unsubLive = engine.live.subscribe(() => {
      const now = engine.live.getSnapshot().status === 'live'
      if (now && !live) coach.beginSegment('live')
      if (!now && live) showSummary(coach.endSegment('live'))
      live = now
    })
    return () => {
      unsubRec()
      unsubLive()
    }
  }, [showSummary])

  // Surface recorder problems instead of hiding them in a tooltip.
  useEffect(() => {
    if (recState.error) coach.notify('info', recState.error)
  }, [recState.error])

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
  const onRecSaved = useCallback(
    (r: RecordingMeta | null) => {
      // Attach the file to the recap if one is showing; otherwise a toast.
      const prev = summaryRef.current
      if (prev?.kind === 'rec' && r) showSummary({ ...prev, recording: r })
      else setToast(r ? t('Saved "{name}" to the Library', { name: r.name }) : null)
    },
    [t, showSummary],
  )

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
        <MenuButton onOpen={openMenu} />
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
        <div className="panel-bar">
          <PhoneBar onMenu={openMenu} />
        </div>
        <div className="panel panel-a">
          <DeckView deck={deckA} other={deckB} onOpenLibrary={openLibrary} />
        </div>
        <div className="panel panel-mixer">
          <MixerView mixer={engine.mixer} decks={engine.decks} onHeadphones={openHp} rec={
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
      <TutorialCard />
      <HintBar />
      <Notes />
      <MenuSheet open={menuOpen} onClose={closeMenu} onWelcome={() => setWelcome(true)} onHeadphones={openHp} />
      <HeadphonesSheet open={hpOpen} onClose={closeHp} />
      <SummarySheet key={summary ? `${summary.kind}-${summary.seconds}` : 'none'} data={summary} onClose={() => showSummary(null)} />
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
