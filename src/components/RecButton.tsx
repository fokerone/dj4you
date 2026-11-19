import { useT } from '../i18n'
import { useRef } from 'react'
import { engine } from '../audio/engine'
import { useAnimationFrame, useStore } from '../hooks/useEngine'
import { library, type RecordingMeta } from '../library/library'

/** Record the master output. The finished mix is saved to the library. */
export function RecButton({ onSaved, className }: { onSaved: (r: RecordingMeta | null) => void; className?: string }) {
  const t = useT()
  const rec = engine.recorder
  const { supported, recording, startedAt, error } = useStore(rec)
  const timeRef = useRef<HTMLSpanElement>(null)

  useAnimationFrame(() => {
    if (!recording || !timeRef.current) return
    const s = Math.floor((performance.now() - startedAt) / 1000)
    timeRef.current.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })

  if (!supported) return null

  return (
    <button
      className={`btn btn-rec ${recording ? 'is-on' : ''} ${className ?? ''}`}
      aria-pressed={recording}
      title={error ?? t(recording ? 'Stop recording and save to the library' : 'Record your mix')}
      onClick={() => {
        if (recording) {
          rec.stop()
          return
        }
        void engine.resume()
        rec.start((blob, seconds) => void library.addRecording(blob, seconds).then(onSaved))
      }}
    >
      <span className="rec-dot" aria-hidden />
      {recording ? <span ref={timeRef}>0:00</span> : t('REC')}
    </button>
  )
}
