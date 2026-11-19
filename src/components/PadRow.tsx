import { useT } from '../i18n'
import { useRef, useState } from 'react'
import { type Deck, type DeckState, HOT_CUES } from '../audio/deck'
import { ECHO_BEATS, echoLabel } from '../audio/fx'
import { HOT_CUE_COLORS } from './colors'
import { Knob } from './Knob'

const LOOP_SIZES = [1, 2, 4, 8] as const
const MODES = ['cue', 'loop', 'fx'] as const
type Mode = (typeof MODES)[number]
const MODE_LABEL: Record<Mode, string> = { cue: 'Hot Cue', loop: 'Loop', fx: 'FX' }
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
      </div>
    </div>
  )
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
