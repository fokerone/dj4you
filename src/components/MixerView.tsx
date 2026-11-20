import { useT } from '../i18n'
import { useState } from 'react'
import type { Deck } from '../audio/deck'
import { eqKnobToDb, filterKnobToCutoffs } from '../audio/fx'
import { crossfaderGains } from '../audio/mixer'
import { buzz } from '../game/haptics'
import type { Mixer } from '../audio/mixer'
import { useStore } from '../hooks/useEngine'
import { Fader } from './Fader'
import { Knob } from './Knob'
import { Meter } from './Meter'

function ChannelStrip({ deck, mixer, onHeadphones }: { deck: Deck; mixer: Mixer; onHeadphones: () => void }) {
  const t = useT()
  const { id, volume, eq, filter } = useStore(deck)
  return (
    <div className={`strip strip-${id.toLowerCase()}`}>
      <div className="strip-head">
        {id}
        <CueButton mixer={mixer} index={id === 'A' ? 0 : 1} onSetup={onHeadphones} />
      </div>
      <div className="strip-knobs">
        <Knob format={eqText} label={t('Hi')} shortLabel={t('HI')} min={-1} max={1} center={0} value={eq.high} onChange={(v) => deck.setEq('high', v)} />
        <Knob format={eqText} label={t('Mid')} shortLabel={t('MID')} min={-1} max={1} center={0} value={eq.mid} onChange={(v) => deck.setEq('mid', v)} />
        <Knob format={eqText} label={t('Low')} shortLabel={t('LOW')} min={-1} max={1} center={0} value={eq.low} onChange={(v) => deck.setEq('low', v)} />
        <Knob
          label={t('Filter')}
          format={filterText}
          shortLabel={t('FLT')}
          className="knob-filter"
          min={-1}
          max={1}
          center={0}
          value={filter}
          onChange={(v) => deck.setFilter(v)}
          display={filter < -0.03 ? 'LP' : filter > 0.03 ? 'HP' : undefined}
        />
      </div>
      <div className="strip-body">
        <Meter analyser={deck.meter} label={t('Deck {id} level', { id })} />
        <Fader
          label={t('Channel {id}', { id })}
          hideLabel
          className="fader-channel"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(v) => deck.setVolume(v)}
          display={`${Math.round(volume * 100)}`}
        />
      </div>
    </div>
  )
}

/** Send a deck to the headphones (opens the setup the first time). */
function CueButton({ mixer, index, onSetup }: { mixer: Mixer; index: 0 | 1; onSetup: () => void }) {
  const t = useT()
  const { cue, cueMode } = useStore(mixer)
  const on = cue[index] && cueMode === 'split'
  return (
    <button
      className={`cue-btn ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      aria-label={t('Preview deck {id} in headphones', { id: index === 0 ? 'A' : 'B' })}
      title={t('Preview deck {id} in headphones', { id: index === 0 ? 'A' : 'B' })}
      onClick={() => (cueMode === 'off' ? onSetup() : mixer.toggleCue(index))}
    >
      <HeadphonesIcon />
    </button>
  )
}

export function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="7" rx="1.5" />
      <rect x="16.5" y="14" width="4.5" height="7" rx="1.5" />
    </svg>
  )
}

export function MixerView({
  mixer,
  decks,
  rec,
  onHeadphones,
}: {
  mixer: Mixer
  decks: readonly [Deck, Deck]
  rec?: React.ReactNode
  onHeadphones: () => void
}) {
  const t = useT()
  const { master } = useStore(mixer)
  return (
    <section className="mixer" aria-label={t('Mixer')}>
      <ChannelStrip deck={decks[0]} mixer={mixer} onHeadphones={onHeadphones} />
      <div className="strip strip-master">
        <div className="strip-head">{t('Master')}</div>
        {rec}
        <div className="strip-body">
          <Meter analyser={mixer.masterMeter} label={t('Master level')} />
          <Fader
            label={t('Master')}
            hideLabel
            className="fader-master"
            min={0}
            max={1}
            step={0.01}
            value={master}
            onChange={(v) => mixer.setMaster(v)}
            display={`${Math.round(master * 100)}`}
          />
        </div>
      </div>
      <ChannelStrip deck={decks[1]} mixer={mixer} onHeadphones={onHeadphones} />
    </section>
  )
}

export function Crossfader({ mixer }: { mixer: Mixer }) {
  const t = useT()
  const { crossfader, curve } = useStore(mixer)
  const [active, setActive] = useState(false)
  const [snapped, setSnapped] = useState(0)
  const [ga, gb] = crossfaderGains(crossfader, curve)

  const change = (v: number) => {
    // A soft "detent" click when crossing the centre.
    if ((crossfader - 0.5) * (v - 0.5) < 0) buzz(6)
    mixer.setCrossfader(v)
  }
  const release = () => {
    setActive(false)
    const x = mixer.getSnapshot().crossfader
    if (x !== 0.5 && Math.abs(x - 0.5) < 0.04) glideTo(mixer, 0.5, () => setSnapped((n) => n + 1))
  }

  return (
    <div className="xfader">
      <span className="xfader-side xfader-a" style={{ opacity: 0.45 + 0.55 * ga }}>
        A
      </span>
      <div className={`xfader-track ${active ? 'is-active' : ''}`}>
        <input
          key={snapped ? `s${snapped}` : 'x'}
          className={snapped ? 'is-snapped' : ''}
          type="range"
          aria-label={t('Crossfader')}
          aria-valuetext={`A ${Math.round(ga * 100)}% · B ${Math.round(gb * 100)}%`}
          min={0}
          max={1}
          step={0.005}
          value={crossfader}
          onChange={(e) => change(Number(e.currentTarget.value))}
          onDoubleClick={() => glideTo(mixer, 0.5)}
          onPointerDown={() => setActive(true)}
          onPointerUp={release}
          onPointerCancel={release}
          onBlur={() => setActive(false)}
        />
        {active && (
          <span className="value-bubble xfader-bubble" style={{ '--frac': crossfader } as React.CSSProperties} aria-hidden>
            A {100 - Math.round(crossfader * 100)} · B {Math.round(crossfader * 100)}
          </span>
        )}
      </div>
      <span className="xfader-side xfader-b" style={{ opacity: 0.45 + 0.55 * gb }}>
        B
      </span>
      <button
        className="btn btn-small xfader-curve"
        title={t('Crossfader curve')}
        onClick={() => mixer.setCurve(curve === 'smooth' ? 'cut' : 'smooth')}
      >
        {t(curve === 'smooth' ? 'Blend' : 'Cut')}
      </button>
    </div>
  )
}

/** Ease the crossfader to a value over ~140 ms (feels like a detent). */
function glideTo(mixer: Mixer, target: number, done?: () => void): void {
  const from = mixer.getSnapshot().crossfader
  const start = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / 140)
    mixer.setCrossfader(from + (target - from) * (1 - (1 - k) ** 3))
    if (k < 1) requestAnimationFrame(step)
    else done?.()
  }
  requestAnimationFrame(step)
}

function eqText(v: number): string {
  if (v <= -0.97) return 'KILL'
  const db = eqKnobToDb(v)
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`
}

function filterText(v: number): string {
  const { lowpass, highpass } = filterKnobToCutoffs(v, 24000)
  const hz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`)
  if (v < -0.03) return `LP ${hz(lowpass)}`
  if (v > 0.03) return `HP ${hz(highpass)}`
  return 'OFF'
}
