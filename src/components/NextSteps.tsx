import { coach } from '../game'
import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { liveSupported, MAX_LISTENERS } from '../live/config'

/** After the tutorial: celebrate, then point to recording and going live. */
export function NextSteps({ onGoLive, onRecord }: { onGoLive: () => void; onRecord: () => void }) {
  const t = useT()
  const { questJustFinished } = useStore(coach)
  if (!questJustFinished) return null
  const close = () => coach.ackQuestFinished()
  const canLive = liveSupported()

  return (
    <div className="sheet-backdrop sheet-center" onClick={close}>
      <div className="summary next-steps" role="dialog" aria-modal="true" aria-labelledby="next-title" onClick={(e) => e.stopPropagation()}>
        <span className="summary-eyebrow">{t('Tutorial complete')}</span>
        <h2 id="next-title">{t('You made your first mix!')}</h2>
        <p className="next-lead">{t('You loaded, synced and blended two tracks like a real DJ. Now make it count:')}</p>

        <div className="promo-cards">
          <button
            className="promo-card promo-rec"
            onClick={() => {
              close()
              onRecord()
            }}
          >
            <span className="promo-icon" aria-hidden>
              <span className="rec-dot" />
            </span>
            <span className="promo-text">
              <b>{t('Record your mix')}</b>
              <small>{t('Starts now. Press REC again to stop: it is saved in your Library to listen, download or share.')}</small>
            </span>
          </button>

          <button
            className="promo-card promo-live"
            disabled={!canLive}
            onClick={() => {
              close()
              onGoLive()
            }}
          >
            <span className="promo-icon" aria-hidden>
              <LiveIcon />
            </span>
            <span className="promo-text">
              <b>{t('Go live')}</b>
              <small>
                {canLive
                  ? t('Share a link or QR code and up to {n} people listen in their browser, no app needed.', { n: MAX_LISTENERS })
                  : t('Available on the DJ4YOU website (not in this preview). Up to {n} listeners.', { n: MAX_LISTENERS })}
              </small>
            </span>
          </button>
        </div>

        <button className="btn btn-primary-solid next-keep" onClick={close}>
          {t('Keep mixing')}
        </button>
      </div>
    </div>
  )
}

export function LiveIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </svg>
  )
}
