import { useEffect } from 'react'
import { engine } from '../audio/engine'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { Knob } from './Knob'
import { HeadphonesIcon } from './MixerView'

/** Headphone cue setup: split mode, cue/master blend and volume. */
export function HeadphonesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const mixer = engine.mixer
  const s = useStore(mixer)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const on = s.cueMode === 'split'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-hp" role="dialog" aria-modal="true" aria-label={t('Headphones')} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{t('Headphones')}</h2>
          <button className="btn btn-small" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </header>
        <div className="sheet-body">
          <div className="hp-hero">
            <span className="hp-hero-icon" aria-hidden>
              <HeadphonesIcon />
            </span>
            <p>{t('Hear the next track in your headphones before the crowd does, and line it up in private.')}</p>
          </div>

          <div className="hp-how">
            <b>{t('What you need')}</b>
            <ol>
              <li>{t('A stereo Y-splitter cable (one plug, two jacks).')}</li>
              <li>{t('Headphones on the LEFT jack, speakers on the RIGHT jack.')}</li>
              <li>{t('Turn split mode on below. Both outputs become mono.')}</li>
            </ol>
          </div>

          <label className="hp-toggle">
            <input id="hp-split" type="checkbox" checked={on} onChange={(e) => mixer.setCueMode(e.target.checked ? 'split' : 'off')} />
            <span>
              <b>{t('Split mode')}</b>
              <small>{on ? t('On: left = headphones, right = speakers') : t('Off: both channels play the master')}</small>
            </span>
          </label>

          <div className={`hp-controls ${on ? '' : 'is-off'}`}>
            <div className="hp-cues">
              {(['A', 'B'] as const).map((id, i) => (
                <button
                  key={id}
                  className={`btn hp-cue hp-cue-${id.toLowerCase()} ${s.cue[i] ? 'is-on' : ''}`}
                  aria-pressed={s.cue[i]}
                  disabled={!on}
                  onClick={() => mixer.toggleCue(i as 0 | 1)}
                >
                  <HeadphonesIcon /> {t('Deck {id}', { id })}
                </button>
              ))}
            </div>
            <Knob
              label={t('Cue / master')}
              min={0}
              max={1}
              center={0}
              value={s.cueMix}
              onChange={(v) => mixer.setCueMix(v)}
              display={s.cueMix < 0.05 ? t('Cue') : s.cueMix > 0.95 ? t('Master') : `${Math.round((1 - s.cueMix) * 100)} / ${Math.round(s.cueMix * 100)}`}
            />
            <Knob
              label={t('Headphone volume')}
              min={0}
              max={1}
              center={0}
              value={s.cueVolume}
              onChange={(v) => mixer.setCueVolume(v)}
              display={`${Math.round(s.cueVolume * 100)}`}
            />
          </div>
          <p className="lib-empty">{t('Recordings and live sets always get the full stereo mix.')}</p>
        </div>
      </div>
    </div>
  )
}
