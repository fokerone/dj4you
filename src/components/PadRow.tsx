import { useT } from '../i18n'
import { useRef, useState } from 'react'
import { type Deck, type DeckState, HOT_CUES } from '../audio/deck'
import { ECHO_BEATS, echoLabel } from '../audio/fx'
import { HOT_CUE_COLORS } from './colors'
import { Knob } from './Knob'

const LOOP_SIZES = [1, 2, 4, 8] as const
const MODES = ['cue', 'loop', 'fx', 'moves'] as const
type Mode = (typeof MODES)[number]
const MODE_LABEL: Record<Mode, string> = { cue: 'Hot Cue', loop: 'Loop', fx: 'FX', moves: 'Moves' }
const LONG_PRESS_MS = 500

/** Performance pads: one row of 4, switchable between hot cues, loops and FX. */
export function PadRow({ deck, state, ready }: { deck: Deck; state: DeckState; ready: boolean }) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('cue')
  const nextMode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]

  return (
    <div className="pads" data-mode={mode}>
      <div className="pad-modes" role="tablist" aria-label={t('Pad mode')}>
        {MODES.map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className="pad-mode" onClick={() => setMode(m)}>
            {t(MODE_LABEL[m])}
          </button>
        ))}
      </div>
      <button className="pad-mode-cycle" onClick={() => setMode(nextMode)} aria-label={t('Pad mode: {mode}. Switch to {next}', { mode: t(MODE_LABEL[mode]), next: t(MODE_LABEL[nextMode]) })}>
        {t(MODE_LABEL[mode])}
      </button>

      <div className="pad-grid">
        {mode === 'cue' &&
          Array.from({ length: HOT_CUES }, (_, i) => (
            <HotCuePad key={i} index={i} deck={deck} position={state.hotCues[i]} disabled={!ready} />
          ))}

        {mode === 'loop' &&
          LOOP_SIZES.map((beats) => (
            <button
              key={beats}
              className={`pad pad-loop ${state.loop?.beats === beats ? 'is-on' : ''}`}
              disabled={!ready}
              aria-pressed={state.loop?.beats === beats}
              onClick={() => deck.toggleLoop(beats)}
            >
              {beats}
              <small>{t(beats === 1 ? 'beat' : 'beats')}</small>
            </button>
          ))}

        {mode === 'fx' && (
          <>
            <button
              className={`pad pad-fx ${state.echoOn ? 'is-on' : ''}`}
              aria-pressed={state.echoOn}
              onClick={() => deck.toggleEcho()}
            >
              {t('Echo')}
            </button>
            <button
              className="pad pad-fx-time"
              aria-label={t('Echo time {t} beat', { t: echoLabel(state.echoBeats) })}
              onClick={() => deck.setEchoBeats(ECHO_BEATS[(ECHO_BEATS.indexOf(state.echoBeats) + 1) % ECHO_BEATS.length])}
            >
              {echoLabel(state.echoBeats)}
              <small>{t('beat')}</small>
            </button>
            <button
              className={`pad pad-fx ${state.reverbOn ? 'is-on' : ''}`}
              aria-pressed={state.reverbOn}
              onClick={() => deck.toggleReverb()}
            >
              {t('Reverb')}
            </button>
            <div className="pad pad-knob">
              <Knob
                label={t('Wet')}
                className="knob-small"
                min={0}
                max={1}
                center={0}
                value={state.fxAmount}
                onChange={(v) => deck.setFxAmount(v)}
                display={`${Math.round(state.fxAmount * 100)}%`}
              />
            </div>
          </>
        )}

        {mode === 'moves' && (
          <>
            <button className="pad pad-move" disabled={!state.playing} onClick={() => deck.brake()} title={t('The track slows to a stop, like a turntable switched off')}>
              {t('Brake')}
              <small>{t('tap')}</small>
            </button>
            <button className="pad pad-move" disabled={!state.playing} onClick={() => deck.spinback()} title={t('Spin the record backwards and stop')}>
              {t('Spinback')}
              <small>{t('tap')}</small>
            </button>
            <RollPad deck={deck} disabled={!state.playing || state.bpm === null} />
            <button
              className={`pad pad-fx ${state.flangerOn ? 'is-on' : ''}`}
              aria-pressed={state.flangerOn}
              onClick={() => deck.toggleFlanger()}
            >
              {t('Flanger')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const ROLL_SIZES = [0.5, 0.25, 0.125] as const

/** Hold to roll; tap the size to change it. */
function RollPad({ deck, disabled }: { deck: Deck; disabled: boolean }) {
  const t = useT()
  const [size, setSize] = useState<(typeof ROLL_SIZES)[number]>(0.25)
  const [on, setOn] = useState(false)
  const end = () => {
    if (!on) return
    setOn(false)
    deck.rollEnd()
  }
  return (
    <button
      className={`pad pad-move pad-roll ${on ? 'is-on' : ''}`}
      disabled={disabled}
      title={t('Hold to repeat a slice in time; let go and the track carries on where it would be')}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.roll-size')) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setOn(true)
        deck.rollStart(size)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      Roll
      <small
        className="roll-size"
        role="button"
        aria-label={t('Roll size {s} beat: tap to change', { s: rollLabel(size) })}
        onClick={(e) => {
          e.stopPropagation()
          setSize(ROLL_SIZES[(ROLL_SIZES.indexOf(size) + 1) % ROLL_SIZES.length])
        }}
      >
        {rollLabel(size)} ↻
      </small>
    </button>
  )
}

function rollLabel(s: number): string {
  return s === 0.5 ? '1/2' : s === 0.25 ? '1/4' : '1/8'
}

function HotCuePad({ index, deck, position, disabled }: { index: number; deck: Deck; position: number | null; disabled: boolean }) {
  const t = useT()
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  const set = position !== null
  const cancel = () => window.clearTimeout(timer.current)

  return (
    <button
      className={`pad pad-hotcue ${set ? 'is-set' : ''}`}
      style={{ '--pad-color': HOT_CUE_COLORS[index] } as React.CSSProperties}
      disabled={disabled}
      aria-label={set ? t('Hot cue {n}: jump. Hold to clear', { n: index + 1 }) : t('Set hot cue {n}', { n: index + 1 })}
      onPointerDown={() => {
        longPressed.current = false
        if (!set) return
        timer.current = window.setTimeout(() => {
          longPressed.current = true
          deck.clearHotCue(index)
        }, LONG_PRESS_MS)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (longPressed.current) return
        if (e.shiftKey && set) deck.clearHotCue(index)
        else deck.hotCue(index)
      }}
    >
      {index + 1}
      <small>{set ? formatShort(position) : t('set')}</small>
    </button>
  )
}

function formatShort(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
