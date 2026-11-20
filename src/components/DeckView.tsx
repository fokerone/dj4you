import { useT } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { Deck } from '../audio/deck'
import { useAnimationFrame, useStore } from '../hooks/useEngine'
import { library } from '../library/library'
import { audioAccept, isAudioFile } from '../library/audioFiles'
import { coach } from '../game'
import { Fader } from './Fader'
import { JogWheel } from './JogWheel'
import { Overview } from './Overview'
import { PadRow } from './PadRow'
import { WaveView } from './WaveView'

export function DeckView({ deck, other, onOpenLibrary }: { deck: Deck; other: Deck; onOpenLibrary: () => void }) {
  const t = useT()
  const state = useStore(deck)
  const otherState = useStore(other)
  const fileRef = useRef<HTMLInputElement>(null)
  const elapsedRef = useRef<HTMLSpanElement>(null)
  const remainRef = useRef<HTMLSpanElement>(null)
  const [dragOver, setDragOver] = useState(false)

  useAnimationFrame(() => {
    const pos = deck.position
    const empty = !state.duration
    if (elapsedRef.current) elapsedRef.current.textContent = empty ? '–:––' : formatTime(pos)
    if (remainRef.current) remainRef.current.textContent = empty ? '' : `-${formatTime(state.duration - pos)}`
  })

  const loadFile = (file: File | undefined) => {
    if (!file) return
    if (!isAudioFile(file)) {
      coach.notify('info', t('"{name}" isn\u2019t an audio file', { name: file.name }), t('Choose an MP3, M4A, WAV, AIFF, FLAC or OGG file.'))
      return
    }
    void library.loadFile(file, deck)
  }

  const ready = deck.loaded && !state.loading
  const bpm = effectiveBpm(state.bpm, state.pitch)
  const otherBpm = effectiveBpm(otherState.bpm, otherState.pitch)
  const canSync = bpm !== null && otherBpm !== null
  const inSync = canSync && tempoMatches(bpm, otherBpm)

  return (
    <section
      className={`deck deck-${state.id.toLowerCase()} ${dragOver ? 'drag-over' : ''} ${state.playing ? 'is-playing' : ''}`}
      aria-label={t('Deck {id}', { id: state.id })}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        loadFile(e.dataTransfer.files[0])
      }}
    >
      <header className="deck-head">
        <span className="deck-badge">{state.id}</span>
        <div className="deck-track">
          <MarqueeTitle text={state.trackName} empty={t('No track')} />
          <div className="deck-clock">
            <span ref={elapsedRef}>0:00.0</span>
            <span ref={remainRef} className="dim">
              -0:00.0
            </span>
          </div>
        </div>
        <div
          className={`deck-bpm ${bpm === null ? 'is-empty' : ''}`}
          aria-label={t('Tempo')}
          title={bpm === null && deck.loaded && !state.analyzing ? t('No tempo detected') : undefined}
        >
          <b>{bpm === null ? (state.analyzing ? '···' : '—') : bpm.toFixed(1)}</b>
          <span>BPM</span>
        </div>
        <div className="deck-load">
          <button className="btn btn-load" onClick={() => fileRef.current?.click()} aria-label={t('Load track')} title={t('Load a track from this device')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 16V4m0 0-5 5m5-5 5 5M5 20h14" />
            </svg>
            <span className="btn-label">{t('Load')}</span>
          </button>
          <button className="btn btn-load btn-library" onClick={onOpenLibrary} aria-label={t('Open library')} title={t('Your tracks, demo beats and recordings')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="btn-label">{t('Library')}</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={audioAccept()}
          hidden
          onChange={(e) => {
            loadFile(e.currentTarget.files?.[0])
            e.currentTarget.value = ''
          }}
        />
      </header>

      <WaveView deck={deck} state={state} onOpenLibrary={onOpenLibrary} onPickFile={() => fileRef.current?.click()} />
      <Overview deck={deck} state={state} />

      <div className="deck-body">
        <div className="transport">
          <button
            className={`btn btn-sync ${state.syncLock ? 'is-locked' : inSync ? 'is-on' : ''}`}
            disabled={!canSync}
            aria-pressed={state.syncLock}
            title={
              state.syncLock
                ? t('Synced to deck {id}. Tap to release', { id: other.id })
                : canSync
                  ? t('Match tempo and beats to deck {id}', { id: other.id })
                  : t('Needs a BPM on both decks')
            }
            onClick={() => {
              if (state.syncLock) {
                deck.setSyncLock(false)
                return
              }
              const r = deck.engageSync(other)
              if (r === 'ok') coach.notify('success', t('Deck {id} synced', { id: state.id }), t('It follows deck {other}\u2019s tempo until you tap SYNC again or move its tempo fader.', { other: other.id }))
              else if (r === 'too-far')
                coach.notify(
                  'info',
                  t('Tempos too far apart to sync'),
                  t('{a} and {b} BPM differ by more than 16%. Pick tracks with closer tempos.', { a: Math.round(state.bpm ?? 0), b: Math.round(otherBpm ?? 0) }),
                )
              else coach.notify('info', t('Needs a BPM on both decks'))
            }}
          >
            {state.syncLock && (
              <svg className="sync-lock" viewBox="0 0 24 24" aria-hidden>
                <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
              </svg>
            )}
            SYNC
          </button>
          <button
            className="btn btn-cue"
            disabled={!ready}
            onPointerDown={(e) => {
              deck.cueDown()
              capturePointer(e)
            }}
            onPointerUp={() => deck.cueUp()}
            onPointerCancel={() => deck.cueUp()}
          >
            CUE
          </button>
          <button
            className={`btn btn-play ${state.playing ? 'is-on' : ''}`}
            disabled={!ready}
            aria-pressed={state.playing}
            onClick={() => deck.togglePlay()}
          >
            {state.playing ? '❚❚' : '▶'}
          </button>
        </div>

        <JogWheel deck={deck} disabled={!ready} />

        <div className="pitch">
          <Fader
            label={t('Tempo')}
            className="fader-pitch"
            min={-state.pitchRange}
            max={state.pitchRange}
            step={0.05}
            value={state.pitch}
            onChange={(v) => deck.setPitch(v)}
            resetTo={0}
            display={`${state.pitch >= 0 ? '+' : ''}${state.pitch.toFixed(2)}%`}
          />
          <div className="pitch-buttons">
            <button className="btn btn-small" onClick={() => deck.setPitchRange(state.pitchRange === 8 ? 16 : 8)}>
              ±{state.pitchRange}
            </button>
            <button className="btn btn-small" onClick={() => deck.setPitch(0)}>
              0
            </button>
          </div>
        </div>
      </div>

      <PadRow deck={deck} state={state} ready={ready} />
    </section>
  )
}

function effectiveBpm(bpm: number | null, pitch: number): number | null {
  return bpm === null ? null : bpm * (1 + pitch / 100)
}

/** Same tempo, allowing half/double time. */
function tempoMatches(a: number, b: number): boolean {
  return [b, b * 2, b / 2].some((t) => Math.abs(a - t) < 0.05)
}

/** Keep receiving pointerup even if the finger slides off the button. */
function capturePointer(e: React.PointerEvent<HTMLElement>): void {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone */
  }
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}

/** Track title that gently scrolls back and forth when it doesn't fit. */
function MarqueeTitle({ text, empty }: { text: string | null; empty: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const box = boxRef.current
    const span = textRef.current
    if (!box || !span) return
    const measure = () => setShift(Math.max(0, Math.ceil(span.scrollWidth - box.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  return (
    <div ref={boxRef} className={`deck-title ${text ? '' : 'is-empty'} ${shift > 0 ? 'is-marquee' : ''}`} title={text ?? undefined}>
      <span
        ref={textRef}
        style={shift > 0 ? ({ '--shift': `-${shift}px`, '--marquee-time': `${Math.max(5, shift / 25)}s` } as React.CSSProperties) : undefined}
      >
        {text ?? empty}
      </span>
    </div>
  )
}
