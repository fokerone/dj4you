import { useT } from '../i18n'
import type { Deck } from '../audio/deck'
import type { Mixer } from '../audio/mixer'
import { useStore } from '../hooks/useEngine'
import { Fader } from './Fader'
import { Knob } from './Knob'
import { Meter } from './Meter'

function ChannelStrip({ deck }: { deck: Deck }) {
  const t = useT()
  const { id, volume, eq, filter } = useStore(deck)
  return (
    <div className={`strip strip-${id.toLowerCase()}`}>
      <div className="strip-head">{id}</div>
      <div className="strip-knobs">
        <Knob label={t('Hi')} shortLabel={t('HI')} min={-1} max={1} center={0} value={eq.high} onChange={(v) => deck.setEq('high', v)} />
        <Knob label={t('Mid')} shortLabel={t('MID')} min={-1} max={1} center={0} value={eq.mid} onChange={(v) => deck.setEq('mid', v)} />
        <Knob label={t('Low')} shortLabel={t('LOW')} min={-1} max={1} center={0} value={eq.low} onChange={(v) => deck.setEq('low', v)} />
        <Knob
          label={t('Filter')}
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

export function MixerView({ mixer, decks, rec }: { mixer: Mixer; decks: readonly [Deck, Deck]; rec?: React.ReactNode }) {
  const t = useT()
  const { master } = useStore(mixer)
  return (
    <section className="mixer" aria-label={t('Mixer')}>
      <ChannelStrip deck={decks[0]} />
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
      <ChannelStrip deck={decks[1]} />
    </section>
  )
}

export function Crossfader({ mixer }: { mixer: Mixer }) {
  const t = useT()
  const { crossfader, curve } = useStore(mixer)
  return (
    <div className="xfader">
      <span className="xfader-side xfader-a">A</span>
      <div className="xfader-track">
        <input
          type="range"
          aria-label={t('Crossfader')}
          min={0}
          max={1}
          step={0.005}
          value={crossfader}
          onChange={(e) => mixer.setCrossfader(Number(e.currentTarget.value))}
          onDoubleClick={() => mixer.setCrossfader(0.5)}
        />
      </div>
      <span className="xfader-side xfader-b">B</span>
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
