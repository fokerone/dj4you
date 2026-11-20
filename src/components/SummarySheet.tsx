import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, type SessionSummary } from '../game/game'
import { useT } from '../i18n'
import { library, type RecordingMeta } from '../library/library'
import { hostDownloads, saveFile } from '../library/saveFile'

export interface SummaryData extends SessionSummary {
  recording?: RecordingMeta
}

/** End-of-set recap: time, transitions, setlist, achievements, share. */
export function SummarySheet({ data, onClose }: { data: SummaryData | null; onClose: () => void }) {
  const t = useT()
  const [url, setUrl] = useState<string | null>(null)
  const [shared, setShared] = useState<'copied' | 'shared' | null>(null)
  const [canDownload, setCanDownload] = useState(true)

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  useEffect(() => {
    void hostDownloads().then((d) => {
      let embedded = false
      try {
        embedded = window.top !== window.self
      } catch {
        embedded = true
      }
      setCanDownload(!embedded || d !== null)
    })
  }, [])
  useEffect(() => {
    if (!data) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data, onClose])

  if (!data) return null
  const mins = Math.floor(data.seconds / 60)
  const secs = Math.floor(data.seconds % 60)
  const rec = data.recording

  const shareText = t('I just mixed {time} on DJ4YOU: {n} transitions ({p} perfect).', {
    time: `${mins}:${String(secs).padStart(2, '0')}`,
    n: data.transitions,
    p: data.perfect,
  })
  const pageUrl = `${location.origin}${location.pathname}`

  const share = async () => {
    const setlist = data.tracks.length ? `\n${t('Setlist')}: ${data.tracks.join(' → ')}` : ''
    const text = `${shareText}${setlist}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DJ4YOU', text, url: pageUrl })
        setShared('shared')
        return
      }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${pageUrl}`)
      setShared('copied')
    } catch {
      setShared(null)
    }
  }

  const listen = async () => {
    if (!rec || url) return
    const blob = await library.recordingBlob(rec.id)
    if (blob) setUrl(URL.createObjectURL(blob))
  }

  const download = async () => {
    if (!rec) return
    const blob = await library.recordingBlob(rec.id)
    if (blob) await saveFile(`${rec.name.replace(/[^\w\- ]+/g, '').trim() || 'dj4you-mix'}.${rec.mime.includes('mp4') ? 'mp4' : 'webm'}`, blob)
  }

  return (
    <div className="sheet-backdrop sheet-center" onClick={onClose}>
      <div className="summary" role="dialog" aria-modal="true" aria-labelledby="summary-title" onClick={(e) => e.stopPropagation()}>
        <span className="summary-eyebrow">{data.kind === 'live' ? t('Live set ended') : t('Recording saved')}</span>
        <h2 id="summary-title">{data.perfect > 0 ? t('Great set!') : t('Nice set!')}</h2>

        <div className="summary-stats">
          <div>
            <b>
              {mins}:{String(secs).padStart(2, '0')}
            </b>
            <span>{t('duration')}</span>
          </div>
          <div>
            <b>{data.transitions}</b>
            <span>{t('transitions')}</span>
          </div>
          <div>
            <b>{data.perfect}</b>
            <span>{t('perfect')}</span>
          </div>
        </div>

        {data.tracks.length > 0 ? (
          <div className="summary-block">
            <h3>{t('Setlist')}</h3>
            <ol className="summary-setlist">
              {data.tracks.map((tr) => (
                <li key={tr}>{tr}</li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="lib-empty">{t('No track was heard long enough to make the setlist.')}</p>
        )}

        {data.unlocked.length > 0 && (
          <div className="summary-block">
            <h3>{t('Unlocked in this set')}</h3>
            <ul className="summary-badges">
              {data.unlocked.map((id) => (
                <li key={id}>
                  <span aria-hidden>★</span> {t(ACHIEVEMENTS[id]?.title ?? id)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {url && <audio className="lib-audio" src={url} controls autoPlay />}

        <div className="summary-actions">
          {rec && !url && (
            <button className="btn" onClick={() => void listen()}>
              ▶ {t('Listen')}
            </button>
          )}
          {rec && canDownload && (
            <button className="btn" onClick={() => void download()}>
              ⤓ {t('Download')}
            </button>
          )}
          <button className="btn" onClick={() => void share()}>
            {shared === 'copied' ? t('Copied') : shared === 'shared' ? t('Shared') : t('Share')}
          </button>
          <button className="btn btn-primary-solid" onClick={onClose}>
            {t('Keep mixing')}
          </button>
        </div>
      </div>
    </div>
  )
}
